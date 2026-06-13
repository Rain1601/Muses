"""
Slot Fill API — fulfill prompt-slot occurrences inside the prose editor.

Supports multiple providers:
  * local:claude — spawns `claude --print --output-format json --model <m>` per candidate
  * local:codex  — spawns `codex exec --json --skip-git-repo-check --sandbox read-only --model <m>`
  * aihubmix / openrouter / bailian — routed through the existing unified_ai
    client, requiring an authenticated user with the corresponding API key.

Endpoints:
  GET  /api/slot-fill/providers — list providers, models, and availability
  POST /api/slot-fill           — generate N candidates (returns same shape regardless of provider)
"""

import asyncio
import json
import shutil
from typing import Optional, Any

from fastapi import APIRouter, Header, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..models_config import MODELS as REGISTRY_MODELS
from ..services.auth_service import AuthService
from ..services.unified_ai import UnifiedAIClient

router = APIRouter()

DEFAULT_N = 3
MAX_N = 5

# Local CLI defaults.
LOCAL_CLAUDE_MODELS = ["sonnet", "opus", "haiku"]
LOCAL_CODEX_MODELS = ["(default)"]  # codex default model is picked by user's ~/.codex/config

# Aggregated provider model whitelist — surface only the most useful ones in the picker.
AGG_MODELS_BY_PROVIDER = {
    "aihubmix":   ["claude-sonnet-4-5-20250929", "claude-opus-4-1-20250805", "gpt-4o", "gemini-2.5-pro", "deepseek-chat"],
    "openrouter": ["claude-sonnet-4-5-20250929", "gpt-4o", "deepseek-chat"],
    "bailian":    ["qwen-max", "qwen-plus", "deepseek-chat"],
}

SYSTEM_PROMPT = (
    "You are an in-line writing collaborator. The user is drafting prose and has "
    "marked a TODO position. You will be given the surrounding context and a short "
    "instruction describing what should appear at that position. Output ONLY the "
    "text that should be inserted at that position — no preamble, no quotes around "
    "the answer, no labels, no markdown fences. Match the surrounding voice, "
    "register, and language (Chinese / English / mixed). Be concise; aim to fit "
    "the local rhythm rather than expand it. If the instruction asks for a "
    "specific length (一句话/一段/约100字), respect it."
)


class SlotFillRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=4000)
    context_before: str = Field("", max_length=8000)
    context_after: str = Field("", max_length=8000)
    n_candidates: int = Field(DEFAULT_N, ge=1, le=MAX_N)
    provider: str = Field("local:claude")
    model: str = Field("sonnet")


class Candidate(BaseModel):
    text: str
    cost_usd: Optional[float] = None
    duration_ms: Optional[int] = None
    model: Optional[str] = None
    error: Optional[str] = None


class SlotFillResponse(BaseModel):
    candidates: list[Candidate]
    total_cost_usd: float
    provider: str
    model: str


# ── Prompt assembly ────────────────────────────────────

def _build_user_prompt(req: SlotFillRequest) -> str:
    parts = []
    if req.context_before.strip():
        parts.append(f"<context_before>\n{req.context_before.strip()}\n</context_before>")
    parts.append(f"<instruction>\n{req.prompt.strip()}\n</instruction>")
    if req.context_after.strip():
        parts.append(f"<context_after>\n{req.context_after.strip()}\n</context_after>")
    parts.append("Write the text that belongs at the marked position. Output the text only.")
    return "\n\n".join(parts)


# ── Local claude ───────────────────────────────────────

async def _candidate_local_claude(model: str, user_prompt: str) -> Candidate:
    claude_bin = shutil.which("claude")
    if not claude_bin:
        return Candidate(text="", error="claude CLI not on PATH")
    args = [
        claude_bin, "--print", "--output-format", "json",
        "--setting-sources", "", "--allowed-tools", "",
        "--max-turns", "1",
        "--model", model,
        "--append-system-prompt", SYSTEM_PROMPT,
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *args, stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(user_prompt.encode("utf-8")), timeout=90
        )
    except asyncio.TimeoutError:
        return Candidate(text="", error="timeout")
    except Exception as e:
        return Candidate(text="", error=f"spawn failed: {e}")

    if proc.returncode != 0:
        return Candidate(
            text="",
            error=f"exit {proc.returncode}: {stderr.decode('utf-8', errors='replace')[-300:]}",
            model=model,
        )
    try:
        data = json.loads(stdout.decode("utf-8", errors="replace"))
    except json.JSONDecodeError as e:
        return Candidate(text="", error=f"json decode: {e}", model=model)
    text = (data.get("result") or "").strip()
    return Candidate(
        text=text,
        cost_usd=data.get("total_cost_usd"),
        duration_ms=data.get("duration_ms"),
        model=model,
        error=None if text else "empty result",
    )


# ── Local codex ────────────────────────────────────────

async def _candidate_local_codex(model: str, user_prompt: str) -> Candidate:
    codex_bin = shutil.which("codex")
    if not codex_bin:
        return Candidate(text="", error="codex CLI not on PATH")

    # Codex's exec mode reads prompt from stdin when '-' is passed. We always
    # prepend the system prompt to the user prompt because codex exec doesn't
    # expose a separate system slot.
    full_prompt = f"{SYSTEM_PROMPT}\n\n---\n\n{user_prompt}"

    args = [
        codex_bin, "exec",
        "--json",
        "--skip-git-repo-check",
        "--sandbox", "read-only",
        "-",
    ]
    if model and model != "(default)":
        args[2:2] = ["--model", model]

    try:
        proc = await asyncio.create_subprocess_exec(
            *args, stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(full_prompt.encode("utf-8")), timeout=120
        )
    except asyncio.TimeoutError:
        return Candidate(text="", error="timeout", model=model)
    except Exception as e:
        return Candidate(text="", error=f"spawn failed: {e}", model=model)

    if proc.returncode != 0:
        return Candidate(
            text="",
            error=f"exit {proc.returncode}: {stderr.decode('utf-8', errors='replace')[-300:]}",
            model=model,
        )

    # codex --json emits jsonl. Parse line-by-line; the final agent_message
    # carries the response text.
    text = ""
    err: Optional[str] = None
    for line in stdout.decode("utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        t = ev.get("type")
        if t == "item.completed":
            item = ev.get("item") or {}
            if item.get("type") == "agent_message":
                text = (item.get("text") or "").strip()
        elif t in ("error", "turn.failed"):
            msg = ev.get("message") or json.dumps(ev.get("error") or {})
            err = msg

    if err and not text:
        return Candidate(text="", error=err, model=model)
    return Candidate(
        text=text,
        cost_usd=None,  # codex doesn't surface cost on the local plan
        duration_ms=None,
        model=model,
        error=None if text else (err or "empty result"),
    )


# ── Aggregated providers via unified_ai ────────────────

async def _candidate_aggregated(user: User, provider: str, model: str, user_prompt: str) -> Candidate:
    try:
        out = await UnifiedAIClient.call(
            user=user,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            provider=provider,
            model=model,
            temperature=0.85,   # bump for candidate diversity
            max_tokens=600,
        )
    except Exception as e:
        return Candidate(text="", error=str(e), model=model)
    text = (out or "").strip()
    return Candidate(text=text, model=model, error=None if text else "empty result")


# ── Provider routing ──────────────────────────────────

def _resolve_user(authorization: Optional[str], db: Session) -> Optional[User]:
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        return None
    try:
        return AuthService.verify_user_token(token, db)
    except Exception:
        return None


@router.get("/providers")
async def list_providers(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """List the providers and models the user can pick from on this machine."""
    user = _resolve_user(authorization, db)

    def model_label(mid: str) -> str:
        info = REGISTRY_MODELS.get(mid)
        return info["name"] if info else mid

    out: list[dict[str, Any]] = []

    # local:claude
    out.append({
        "key": "local:claude",
        "label": "Claude (local)",
        "available": shutil.which("claude") is not None,
        "requires_auth": False,
        "kind": "local",
        "models": [{"id": m, "label": m} for m in LOCAL_CLAUDE_MODELS],
    })

    # local:codex
    out.append({
        "key": "local:codex",
        "label": "Codex (local)",
        "available": shutil.which("codex") is not None,
        "requires_auth": False,
        "kind": "local",
        "models": [{"id": m, "label": m} for m in LOCAL_CODEX_MODELS],
    })

    # aggregated providers
    for prov in ("aihubmix", "openrouter", "bailian"):
        key_attr = {"aihubmix": "aihubmixKey", "openrouter": "openrouterKey", "bailian": "bailianKey"}[prov]
        has_key = bool(user and getattr(user, key_attr, None))
        out.append({
            "key": prov,
            "label": prov,
            "available": has_key,
            "requires_auth": True,
            "kind": "aggregated",
            "models": [
                {"id": mid, "label": model_label(mid)}
                for mid in AGG_MODELS_BY_PROVIDER[prov]
            ],
        })

    return {"providers": out, "authenticated": user is not None}


@router.post("", response_model=SlotFillResponse)
async def slot_fill(
    req: SlotFillRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_prompt = _build_user_prompt(req)
    provider = req.provider
    model = req.model

    if provider == "local:claude":
        tasks = [_candidate_local_claude(model, user_prompt) for _ in range(req.n_candidates)]
    elif provider == "local:codex":
        tasks = [_candidate_local_codex(model, user_prompt) for _ in range(req.n_candidates)]
    elif provider in ("aihubmix", "openrouter", "bailian"):
        user = _resolve_user(authorization, db)
        if not user:
            raise HTTPException(401, "Login required for aggregated providers")
        tasks = [_candidate_aggregated(user, provider, model, user_prompt) for _ in range(req.n_candidates)]
    else:
        raise HTTPException(400, f"Unknown provider: {provider}")

    candidates = await asyncio.gather(*tasks)
    total = sum(c.cost_usd or 0 for c in candidates)
    return SlotFillResponse(
        candidates=list(candidates),
        total_cost_usd=total,
        provider=provider,
        model=model,
    )

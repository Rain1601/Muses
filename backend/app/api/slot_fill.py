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

from ..config import settings
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
# DeepSeek direct uses its native model IDs (deepseek-chat = V3, deepseek-reasoner = R1).
AGG_MODELS_BY_PROVIDER = {
    "aihubmix":   ["claude-sonnet-4-5-20250929", "claude-opus-4-1-20250805", "gpt-4o", "gemini-2.5-pro", "deepseek-chat"],
    "openrouter": ["claude-sonnet-4-5-20250929", "gpt-4o", "deepseek-chat"],
    "bailian":    ["qwen-max", "qwen-plus", "deepseek-chat"],
    "deepseek":   ["deepseek-chat", "deepseek-reasoner"],
}

SYSTEM_PROMPT = """你是 inline 写作协作者。用户在文章里标记了一个 TODO 位置, 给你前后文 + 一条短指令, 要你产出"应填入该位置的文本"。

## 输出格式 (强制, 单行 JSON)

必须严格输出以下 JSON, **不能输出任何 JSON 以外的字符**:

{"text": "<要插入的文本>"}

字段规范:
- `text`: 纯文本字符串。**不要**带外层引号、markdown、代码围栏 (```)、label、前言 ("好的"/"以下是"/"Sure"等)。
- 文本要与上下文的语种 / 语气 / 节奏匹配 (中文 / 英文 / 混排)。
- 简洁优先, 贴合本地节奏, 不要扩张。
- 如果指令指定了长度 (一句话 / 一段 / 约 N 字 / 不超过 N 字), 严格遵守。
- 不输出任何解释、注释、思考过程。

## 示例

输入:
<context_before>
深度学习模型推理阶段最大的开销往往不是矩阵乘, 而是
</context_before>
<instruction>补一句, 点出 KV cache 的内存占用</instruction>
<context_after>。这也是 vLLM 把 PagedAttention 当作核心卖点的原因。</context_after>

输出:
{"text": "KV cache 占用的显存——尤其在长上下文 + 大 batch 场景下, 它会迅速吃掉一张卡的可用显存"}

---

输入:
<context_before>The team shipped the migration on Friday.</context_before>
<instruction>add one sentence about the on-call rotation reaction</instruction>
<context_after>By Monday morning everyone agreed the rollout had been smooth.</context_after>

输出:
{"text": "On-call slept through the weekend without a single page."}

---

输入:
<context_before>这篇文章想聊三件事: 第一是</context_before>
<instruction>一句话给出第一个主题</instruction>
<context_after>, 第二是 AI 工具链的演进, 第三是个人写作习惯的迁移。</context_after>

输出:
{"text": "团队协作模式怎么被 AI 改写"}"""


def _parse_slot_output(raw: str) -> tuple[str, Optional[str]]:
    """从模型回复中抽取要插入的文本。

    返回 (text, parse_error_or_none)。优先按 JSON schema 解析, 解析失败时
    回退到"去噪后的原文本", 保证 UI 永远拿得到可用文本。
    """
    raw = (raw or "").strip()
    if not raw:
        return "", "empty response"

    # 个别模型会把 JSON 包在 markdown fence 里, 先剥掉
    s = raw
    if s.startswith("```"):
        # 取首个 ``` 与末个 ``` 之间的内容
        try:
            inner = s.split("```", 2)[1]
            # 可能是 ```json\n{...}
            if "\n" in inner:
                lang, body = inner.split("\n", 1)
                if lang.strip().lower() in ("json", ""):
                    s = body
                else:
                    s = inner
            else:
                s = inner
            # 去掉结尾的 ```
            if s.rstrip().endswith("```"):
                s = s.rstrip()[:-3]
            s = s.strip()
        except Exception:
            pass

    # 主路径: 严格 JSON
    try:
        obj = json.loads(s)
        if isinstance(obj, dict) and "text" in obj:
            text = obj.get("text")
            if isinstance(text, str):
                stripped = text.strip()
                # 即使 text 为空也视为模型合法响应 (空 = 模型认为不应插入), 不走 fallback
                return stripped, None if stripped else "model returned empty text"
    except json.JSONDecodeError:
        pass

    # Fallback: 模型没听话, 尽力清洗
    cleaned = raw
    # 去 markdown fence
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
    # 去常见前言
    for prefix in ("好的，", "好的,", "好的 ", "以下是", "这里是", "Here is ", "Here's ", "Sure, ", "Sure: "):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):].lstrip()
            break
    # 去外层引号
    if len(cleaned) >= 2:
        pairs = [('"', '"'), ("'", "'"), ("“", "”"), ("‘", "’"), ("「", "」"), ("『", "』")]
        for l, r in pairs:
            if cleaned.startswith(l) and cleaned.endswith(r):
                cleaned = cleaned[1:-1]
                break
    return cleaned.strip(), "json parse failed, used fallback"


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
    raw_result = (data.get("result") or "")
    text, parse_warn = _parse_slot_output(raw_result)
    return Candidate(
        text=text,
        cost_usd=data.get("total_cost_usd"),
        duration_ms=data.get("duration_ms"),
        model=model,
        error=None if text else (parse_warn or "empty result"),
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
    raw_text = ""
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
                raw_text = item.get("text") or ""
        elif t in ("error", "turn.failed"):
            msg = ev.get("message") or json.dumps(ev.get("error") or {})
            err = msg

    if err and not raw_text:
        return Candidate(text="", error=err, model=model)
    text, parse_warn = _parse_slot_output(raw_text)
    return Candidate(
        text=text,
        cost_usd=None,  # codex doesn't surface cost on the local plan
        duration_ms=None,
        model=model,
        error=None if text else (err or parse_warn or "empty result"),
    )


# ── Aggregated providers via unified_ai ────────────────

async def _candidate_aggregated(user: User, provider: str, model: str, user_prompt: str) -> Candidate:
    # 温度从 0.85 降到 0.6: schema 已强约束 + few-shot, 仍保留少量采样多样性
    # 让 N 个并行 candidate 不至于完全雷同。
    extra: dict[str, Any] = {}
    # DeepSeek 原生支持 OpenAI JSON mode, 进一步硬约束 schema。
    # aihubmix/openrouter/bailian 是否透传取决于上游路由, 这里只对直连开。
    if provider == "deepseek":
        extra["response_format"] = {"type": "json_object"}
    try:
        out = await UnifiedAIClient.call(
            user=user,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            provider=provider,
            model=model,
            temperature=0.6,
            max_tokens=600,
            **extra,
        )
    except Exception as e:
        return Candidate(text="", error=str(e), model=model)
    text, parse_warn = _parse_slot_output(out)
    return Candidate(text=text, model=model, error=None if text else (parse_warn or "empty result"))


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

    # DeepSeek direct — auth optional (env key fallback). Surface as its own
    # provider so users picking "deepseek" go straight to api.deepseek.com.
    deepseek_available = bool(settings.deepseek_api_key) or bool(
        user and getattr(user, "deepseekKey", None)
    )
    out.append({
        "key": "deepseek",
        "label": "DeepSeek (direct)",
        "available": deepseek_available,
        "requires_auth": False,
        "kind": "direct",
        "models": [
            {"id": mid, "label": model_label(mid) if REGISTRY_MODELS.get(mid) else mid}
            for mid in AGG_MODELS_BY_PROVIDER["deepseek"]
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
    elif provider == "deepseek":
        # Direct DeepSeek — env key is sufficient; user-stored key wins if present.
        user = _resolve_user(authorization, db)
        if not (settings.deepseek_api_key or (user and getattr(user, "deepseekKey", None))):
            raise HTTPException(400, "DEEPSEEK_API_KEY not configured (backend/.env)")
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

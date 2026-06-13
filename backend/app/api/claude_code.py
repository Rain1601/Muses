"""
Claude Code API — bridge `claude` CLI subprocess to SSE for the dashboard-cc UI.

Endpoints:
  POST /api/claude-code/stream   — Run a one-shot agent loop, stream events as SSE.
  GET  /api/claude-code/health   — Reports whether the local `claude` CLI is available.

Design notes:
  * Spawns `claude --print --output-format stream-json --verbose` per request.
  * `--setting-sources ""` so we don't inherit the operator's ~/.claude/CLAUDE.md
    hooks/preferences into the agent run.
  * cwd is constrained to a safe root (default WORKSPACE_DIR) to prevent the agent
    from wandering the filesystem on local dev.
  * Tool allow-list comes from the request; defaults to read-only tools.
"""

import asyncio
import json
import os
import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

router = APIRouter()

# Root the agent is allowed to work in. Same workspace dir as studio mode.
WORKSPACE_ROOT = Path(os.path.expanduser("~/muses-workspace")).resolve()
WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)

# Conservative defaults — read-only-ish. Caller can broaden.
DEFAULT_ALLOWED_TOOLS = ["Read", "Glob", "Grep", "WebSearch", "WebFetch"]
DEFAULT_MAX_TURNS = 12


class ClaudeCodeRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=20000)
    cwd: Optional[str] = None
    allowed_tools: Optional[list[str]] = None
    max_turns: int = Field(DEFAULT_MAX_TURNS, ge=1, le=50)
    model: Optional[str] = None  # e.g. "sonnet" / "opus" / full id
    permission_mode: str = Field("default", pattern="^(default|acceptEdits|bypassPermissions|plan)$")


def _resolve_cwd(requested: Optional[str]) -> Path:
    """Resolve cwd against WORKSPACE_ROOT, refusing escapes."""
    if not requested:
        return WORKSPACE_ROOT
    candidate = (WORKSPACE_ROOT / requested).resolve()
    root = WORKSPACE_ROOT
    if root not in candidate.parents and candidate != root:
        raise HTTPException(status_code=403, detail="cwd outside workspace")
    candidate.mkdir(parents=True, exist_ok=True)
    return candidate


def _format_sse(event_type: str, data: dict) -> bytes:
    """Encode a single SSE message. Each payload is a JSON object."""
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event_type}\ndata: {payload}\n\n".encode("utf-8")


def _normalize_event(raw: dict) -> Optional[dict]:
    """
    Translate a raw claude CLI JSON line into a UI-friendly event.

    We collapse the verbose CLI event vocabulary into a small set the frontend
    can render directly. Returns None for events the UI should ignore.
    """
    t = raw.get("type")

    if t == "system":
        sub = raw.get("subtype")
        if sub == "init":
            return {
                "kind": "session",
                "session_id": raw.get("session_id"),
                "model": raw.get("model"),
                "cwd": raw.get("cwd"),
                "tools": raw.get("tools"),
            }
        # Hooks are silenced — they're operator-machine noise.
        return None

    if t == "assistant":
        message = raw.get("message") or {}
        out = []
        for block in message.get("content", []) or []:
            bt = block.get("type")
            if bt == "text":
                out.append({"kind": "text", "text": block.get("text", "")})
            elif bt == "thinking":
                out.append({"kind": "thinking", "text": block.get("thinking", "")})
            elif bt == "tool_use":
                out.append({
                    "kind": "tool_use",
                    "id": block.get("id"),
                    "name": block.get("name"),
                    "input": block.get("input", {}),
                })
        if len(out) == 1:
            return out[0]
        if out:
            return {"kind": "batch", "items": out}
        return None

    if t == "user":
        # tool_result blocks come back wrapped in user messages
        message = raw.get("message") or {}
        for block in message.get("content", []) or []:
            if block.get("type") == "tool_result":
                content = block.get("content")
                # content can be string or list-of-content-blocks
                if isinstance(content, list):
                    content = "".join(
                        (c.get("text", "") if isinstance(c, dict) else str(c))
                        for c in content
                    )
                return {
                    "kind": "tool_result",
                    "tool_use_id": block.get("tool_use_id"),
                    "is_error": bool(block.get("is_error", False)),
                    "content": content or "",
                }
        return None

    if t == "result":
        usage = raw.get("usage") or {}
        return {
            "kind": "result",
            "subtype": raw.get("subtype"),
            "is_error": bool(raw.get("is_error", False)),
            "duration_ms": raw.get("duration_ms"),
            "num_turns": raw.get("num_turns"),
            "total_cost_usd": raw.get("total_cost_usd"),
            "stop_reason": raw.get("stop_reason"),
            "input_tokens": usage.get("input_tokens"),
            "output_tokens": usage.get("output_tokens"),
            "cache_read_input_tokens": usage.get("cache_read_input_tokens"),
            "cache_creation_input_tokens": usage.get("cache_creation_input_tokens"),
            "errors": raw.get("errors") or [],
        }

    if t == "rate_limit_event":
        # Forward as-is for observability; UI shows a small badge.
        return {"kind": "rate_limit", "data": raw}

    return None


async def _run_agent_stream(req: ClaudeCodeRequest):
    """Async generator yielding SSE bytes for one agent run."""
    claude_bin = shutil.which("claude")
    if not claude_bin:
        yield _format_sse("error", {"message": "`claude` CLI not found on PATH"})
        return

    cwd = _resolve_cwd(req.cwd)
    tools = req.allowed_tools if req.allowed_tools is not None else DEFAULT_ALLOWED_TOOLS

    args = [
        claude_bin,
        "--print",
        "--output-format", "stream-json",
        "--verbose",
        "--max-turns", str(req.max_turns),
        "--setting-sources", "",  # do not inherit operator's CLAUDE.md / hooks
        "--permission-mode", req.permission_mode,
    ]
    if tools:
        args += ["--allowed-tools", ",".join(tools)]
    if req.model:
        args += ["--model", req.model]

    yield _format_sse("started", {
        "cwd": str(cwd),
        "tools": tools,
        "model": req.model,
        "max_turns": req.max_turns,
    })

    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(cwd),
        )
    except Exception as e:
        yield _format_sse("error", {"message": f"failed to spawn claude: {e}"})
        return

    # Push prompt then close stdin so claude proceeds.
    assert proc.stdin is not None
    proc.stdin.write(req.prompt.encode("utf-8"))
    proc.stdin.write(b"\n")
    await proc.stdin.drain()
    proc.stdin.close()

    assert proc.stdout is not None
    stderr_chunks: list[bytes] = []

    async def _drain_stderr():
        if proc.stderr is None:
            return
        while True:
            chunk = await proc.stderr.read(4096)
            if not chunk:
                return
            stderr_chunks.append(chunk)

    stderr_task = asyncio.create_task(_drain_stderr())

    try:
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            line = line.strip()
            if not line:
                continue
            try:
                raw = json.loads(line)
            except json.JSONDecodeError:
                # Non-JSON line — surface as raw text so dev can see it.
                yield _format_sse("raw", {"line": line.decode("utf-8", errors="replace")})
                continue

            normalized = _normalize_event(raw)
            if normalized is None:
                continue
            yield _format_sse("event", normalized)
    except asyncio.CancelledError:
        # Client disconnected — kill the subprocess so we don't leak it.
        proc.kill()
        raise
    finally:
        await stderr_task
        await proc.wait()
        if proc.returncode not in (0, None):
            yield _format_sse("error", {
                "message": "claude exited non-zero",
                "code": proc.returncode,
                "stderr": b"".join(stderr_chunks).decode("utf-8", errors="replace")[-2000:],
            })
        yield _format_sse("done", {"code": proc.returncode})


@router.post("/stream")
async def stream(req: ClaudeCodeRequest):
    return StreamingResponse(
        _run_agent_stream(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable proxy buffering
        },
    )


@router.get("/health")
async def health():
    claude_bin = shutil.which("claude")
    if not claude_bin:
        return {"available": False, "reason": "claude CLI not on PATH"}
    # Cheap version check; do not block long.
    try:
        proc = await asyncio.create_subprocess_exec(
            claude_bin, "--version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
        return {
            "available": True,
            "path": claude_bin,
            "version": out.decode("utf-8", errors="replace").strip(),
            "workspace_root": str(WORKSPACE_ROOT),
        }
    except Exception as e:
        return {"available": False, "reason": str(e)}

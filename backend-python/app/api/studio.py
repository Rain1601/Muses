"""
Studio API — Claude Chat + file management + diff engine.

Endpoints:
  POST /api/studio/chat         — Stream chat with Claude (AIHubMix)
  WS /api/studio/filewatcher    — Pushes file diffs when workspace files change
  GET /api/studio/files          — List workspace article files
  GET/PUT/POST/DELETE /api/studio/files/{filename} — File CRUD
"""

import asyncio
import os
import difflib
import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel

router = APIRouter()

# Workspace directory for articles
WORKSPACE_DIR = Path(os.path.expanduser("~/muses-workspace"))
WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# File Management
# ============================================================

class FileContent(BaseModel):
    content: str


@router.get("/files")
async def list_files():
    """List all markdown files in workspace."""
    files = []
    for f in sorted(WORKSPACE_DIR.glob("*.md")):
        stat = f.stat()
        files.append({
            "name": f.name,
            "size": stat.st_size,
            "modified": stat.st_mtime,
        })
    return {"files": files}


@router.get("/files/{filename}")
async def read_file(filename: str):
    """Read a workspace file."""
    filepath = WORKSPACE_DIR / filename
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    content = filepath.read_text(encoding="utf-8")
    return {"name": filename, "content": content}


@router.put("/files/{filename}")
async def write_file(filename: str, body: FileContent):
    """Write/update a workspace file (editor save)."""
    filepath = WORKSPACE_DIR / filename
    filepath.write_text(body.content, encoding="utf-8")
    return {"name": filename, "saved": True}


@router.post("/files/{filename}")
async def create_file(filename: str):
    """Create a new empty file."""
    filepath = WORKSPACE_DIR / filename
    if filepath.exists():
        raise HTTPException(status_code=409, detail="File already exists")
    filepath.write_text("", encoding="utf-8")
    return {"name": filename, "created": True}


@router.delete("/files/{filename}")
async def delete_file(filename: str):
    """Delete a workspace file."""
    filepath = WORKSPACE_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    filepath.unlink()
    return {"name": filename, "deleted": True}


# ============================================================
# Chat: Claude API with file context awareness
# ============================================================

from openai import OpenAI
from fastapi.responses import StreamingResponse
from fastapi import Request

# AIHubMix aggregated API
AIHUBMIX_BASE_URL = "https://aihubmix.com/v1"
AIHUBMIX_API_KEY = "sk-dQCnrL6HHBZOjqgtBc80C9672f81411195C49c80C7B670D0"
STUDIO_MODEL = "claude-sonnet-4-20250514"


class ChatRequest(BaseModel):
    message: str
    filename: Optional[str] = None
    selection: Optional[str] = None
    history: list[dict] = []


@router.post("/chat")
async def studio_chat(req: ChatRequest):
    """
    Stream chat with Claude via AIHubMix.
    Automatically injects current file content as context.
    """
    # Build system prompt with file context
    system_parts = [
        "你是一个专业的写作助手，帮助用户创作和改进文章。",
        "用户正在使用 Muses Studio 编辑器写作。",
        f"工作目录: {WORKSPACE_DIR}",
    ]

    if req.filename:
        filepath = WORKSPACE_DIR / req.filename
        if filepath.exists():
            file_content = filepath.read_text(encoding="utf-8")
            system_parts.append(f"\n当前编辑的文件: {req.filename}\n文件内容:\n```markdown\n{file_content}\n```")

    if req.selection:
        system_parts.append(f"\n用户选中的文本:\n> {req.selection}")

    system_parts.append("""
## 重要：回复格式规则

你有两种回复模式，根据用户意图自动判断：

**模式 1：对话回答**（用户在问问题、讨论、头脑风暴）
直接用普通文本回复，不要包含 <article_edit> 标签。

**模式 2：编辑文章**（用户要求修改、改写、添加、删除文章内容）
先简短说明你做了什么修改，然后输出完整的修改后文章，用以下标签包裹：

<article_edit>
修改后的完整文章内容
</article_edit>

注意：
- <article_edit> 内必须是完整的文章内容（不是片段），因为会直接替换编辑器中的全部内容
- 只有用户明确要求"修改""改写""添加""删除""优化"等编辑操作时才使用模式 2
- 回复使用中文，除非用户用英文提问
""")

    system = "\n".join(system_parts)

    # Build messages (OpenAI format)
    messages = [{"role": "system", "content": system}]
    for h in req.history[-20:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": req.message})

    client = OpenAI(base_url=AIHUBMIX_BASE_URL, api_key=AIHUBMIX_API_KEY)

    def generate():
        try:
            stream = client.chat.completions.create(
                model=STUDIO_MODEL,
                messages=messages,
                max_tokens=4096,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and delta.content:
                    yield f"data: {json.dumps({'type': 'text', 'content': delta.content})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ============================================================
# WebSocket: File Watcher + Diff Engine
# ============================================================

# Store file snapshots for diff computation
_file_snapshots: dict[str, str] = {}


def compute_diff(old_text: str, new_text: str, filename: str) -> Optional[dict]:
    """Compute unified diff between old and new content."""
    old_lines = old_text.splitlines(keepends=True)
    new_lines = new_text.splitlines(keepends=True)

    diff = list(difflib.unified_diff(old_lines, new_lines, fromfile=f"a/{filename}", tofile=f"b/{filename}"))
    if not diff:
        return None

    # Parse into structured hunks for the frontend
    hunks = []
    current_hunk = None

    for line in diff:
        if line.startswith("@@"):
            if current_hunk:
                hunks.append(current_hunk)
            current_hunk = {"header": line.strip(), "changes": []}
        elif current_hunk is not None:
            if line.startswith("-") and not line.startswith("---"):
                current_hunk["changes"].append({"type": "delete", "content": line[1:].rstrip("\n")})
            elif line.startswith("+") and not line.startswith("+++"):
                current_hunk["changes"].append({"type": "add", "content": line[1:].rstrip("\n")})
            else:
                current_hunk["changes"].append({"type": "context", "content": line[1:].rstrip("\n") if line.startswith(" ") else line.rstrip("\n")})

    if current_hunk:
        hunks.append(current_hunk)

    return {
        "filename": filename,
        "hunks": hunks,
        "raw": "".join(diff),
    }


def snapshot_workspace():
    """Take a snapshot of all workspace files."""
    snapshots = {}
    for f in WORKSPACE_DIR.glob("*.md"):
        try:
            snapshots[f.name] = f.read_text(encoding="utf-8")
        except Exception:
            pass
    return snapshots


@router.websocket("/filewatcher")
async def filewatcher_websocket(ws: WebSocket):
    """
    Watches workspace directory for file changes.
    When a file is modified externally (e.g., by Claude Code CLI),
    computes diff and sends it to the frontend for accept/reject UI.
    """
    await ws.accept()
    global _file_snapshots

    # Initial snapshot
    _file_snapshots = snapshot_workspace()
    await ws.send_json({"type": "ready", "files": list(_file_snapshots.keys())})

    try:
        while True:
            # Poll for changes every 500ms
            await asyncio.sleep(0.5)

            current = snapshot_workspace()

            for filename, content in current.items():
                old_content = _file_snapshots.get(filename, "")
                if content != old_content:
                    diff = compute_diff(old_content, content, filename)
                    if diff:
                        await ws.send_json({
                            "type": "diff",
                            "filename": filename,
                            "diff": diff,
                            "newContent": content,
                        })

            # Check for deleted files
            for filename in set(_file_snapshots.keys()) - set(current.keys()):
                await ws.send_json({"type": "deleted", "filename": filename})

            # Check for new files
            for filename in set(current.keys()) - set(_file_snapshots.keys()):
                await ws.send_json({"type": "created", "filename": filename})

            _file_snapshots = current

    except WebSocketDisconnect:
        pass


@router.post("/snapshot/{filename}")
async def update_snapshot(filename: str, body: FileContent):
    """Update the file snapshot after user accepts changes (prevents re-diffing)."""
    _file_snapshots[filename] = body.content
    return {"updated": True}

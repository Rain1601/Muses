"""
Studio API — Claude Chat + file management + diff engine.

Endpoints:
  POST /api/studio/chat         — Stream chat with Claude (AIHubMix)
  WS /api/studio/filewatcher    — Pushes file diffs when workspace files change
  GET /api/studio/files          — List workspace article files (recursive, with folders)
  GET/PUT/POST/DELETE /api/studio/files/{filepath:path} — File CRUD (supports nested paths)
  POST /api/studio/folders/{folderpath:path} — Create folder
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


def _safe_resolve(relative_path: str) -> Path:
    """Resolve a relative path within WORKSPACE_DIR, preventing path traversal."""
    resolved = (WORKSPACE_DIR / relative_path).resolve()
    if not str(resolved).startswith(str(WORKSPACE_DIR.resolve())):
        raise HTTPException(status_code=403, detail="Path traversal not allowed")
    return resolved


@router.get("/files")
async def list_files():
    """List all markdown files in workspace recursively, plus folder list."""
    files = []
    folders_set: set[str] = set()

    for f in sorted(WORKSPACE_DIR.rglob("*.md")):
        rel = f.relative_to(WORKSPACE_DIR)
        stat = f.stat()
        files.append({
            "name": f.name,
            "size": stat.st_size,
            "modified": stat.st_mtime,
            "path": str(rel).replace(os.sep, "/"),
        })

    # Collect all directories (recursively, as flat relative paths)
    for d in sorted(WORKSPACE_DIR.rglob("*")):
        if d.is_dir():
            rel = str(d.relative_to(WORKSPACE_DIR)).replace(os.sep, "/")
            folders_set.add(rel)

    return {"files": files, "folders": sorted(folders_set)}


@router.post("/folders/{folderpath:path}")
async def create_folder(folderpath: str):
    """Create a new folder (supports nested paths like agents/research)."""
    resolved = _safe_resolve(folderpath)
    if resolved.exists():
        raise HTTPException(status_code=409, detail="Folder already exists")
    resolved.mkdir(parents=True, exist_ok=True)
    return {"folder": folderpath, "created": True}


@router.get("/files/{filepath:path}")
async def read_file(filepath: str):
    """Read a workspace file."""
    resolved = _safe_resolve(filepath)
    if not resolved.exists() or not resolved.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    content = resolved.read_text(encoding="utf-8")
    return {"name": resolved.name, "path": filepath, "content": content}


@router.put("/files/{filepath:path}")
async def write_file(filepath: str, body: FileContent):
    """Write/update a workspace file (editor save)."""
    resolved = _safe_resolve(filepath)
    # Auto-create parent directories if needed
    resolved.parent.mkdir(parents=True, exist_ok=True)
    resolved.write_text(body.content, encoding="utf-8")
    return {"name": resolved.name, "path": filepath, "saved": True}


@router.post("/files/{filepath:path}")
async def create_file(filepath: str):
    """Create a new empty file."""
    resolved = _safe_resolve(filepath)
    if resolved.exists():
        raise HTTPException(status_code=409, detail="File already exists")
    # Auto-create parent directories if needed
    resolved.parent.mkdir(parents=True, exist_ok=True)
    resolved.write_text("", encoding="utf-8")
    return {"name": resolved.name, "path": filepath, "created": True}


@router.delete("/files/{filepath:path}")
async def delete_file(filepath: str):
    """Delete a workspace file."""
    resolved = _safe_resolve(filepath)
    if not resolved.exists():
        raise HTTPException(status_code=404, detail="File not found")
    resolved.unlink()
    return {"name": resolved.name, "path": filepath, "deleted": True}


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
        """你是一位资深的技术写作助手。你的职责是帮助用户创作和改进技术文章，保持与用户一致的写作风格。

## 写作风格

你必须严格遵循以下风格特征，这是用户的写作习惯：

### 结构与逻辑
- 开头直接切入问题或提出反直觉的现象，不用个人感慨、反问句或故事开场
- 典型开头结构："在X的过程中，有一个Y问题"或"X是一个容易被Z的环节"
- 逻辑链：问题定义→原因分析→权威引用→工程方案→可操作的结论
- 每句话都在推进论证，不绕弯，不重复已经说过的观点

### 语言风格
- 客观理性，像一个资深工程师在写技术分享，不学术也不口水
- 简洁不废话，能一句说清的不用两句
- 不煽情、不自嘲、不用"大家有没有体验过""不知道大家怎么看"这类口语化套话
- 类比克制使用，只在辅助理解时用，不为修辞效果而用

### 中英文混合
- 技术术语保留英文原文：Agent、Prompt、Context、Tool Use、Function Calling、SDK、API、JSON
- 行文使用中文，不刻意翻译已被广泛接受的英文术语
- 首次出现的专业概念可以附上中文解释，后续直接用英文

### 引用与论证
- 适度引用 Anthropic、OpenAI、Google 等一手技术来源，给出具体出处
- 引用后用自己的话解释和延伸，不堆砌引用
- 优先引用官方文档和工程博客，而非二手解读文章

### 内容深度
- 技术内容要具体到 API 名、方法名、工程概念，不停留在抽象层面
- 每个论点都应该有实践基础或权威来源支撑
- 给出可操作的工程建议和结论，不空谈理论""",
        f"\n工作目录: {WORKSPACE_DIR}",
    ]

    if req.filename:
        filepath = WORKSPACE_DIR / req.filename
        if filepath.exists():
            file_content = filepath.read_text(encoding="utf-8")
            system_parts.append(f"\n当前编辑的文件: {req.filename}\n文件内容:\n```markdown\n{file_content}\n```")

    if req.selection:
        system_parts.append(f"\n用户选中的文本:\n> {req.selection}")

    system_parts.append("""
## 回复格式

根据用户意图选择回复模式：

**模式 1：对话**（用户在提问、讨论、头脑风暴）
直接用文本回复。不包含 <article_edit> 标签。回复风格与上述写作风格一致。

**模式 2：编辑文章**（用户要求修改、改写、添加、删除、优化文章内容）
先用一两句话说明修改要点，然后输出完整的修改后文章：

<article_edit>
修改后的完整文章内容（Markdown 格式）
</article_edit>

规则：
- <article_edit> 内必须是完整文章（不是片段），会直接替换编辑器全部内容
- 修改时保持用户原有的写作风格和术语习惯，不要"改善"用户的风格
- 只有用户明确要求编辑操作时才使用模式 2
- 默认使用中文回复，除非用户用英文提问
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
    """Take a snapshot of all workspace files (recursive)."""
    snapshots = {}
    for f in WORKSPACE_DIR.rglob("*.md"):
        try:
            rel = str(f.relative_to(WORKSPACE_DIR)).replace(os.sep, "/")
            snapshots[rel] = f.read_text(encoding="utf-8")
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


@router.post("/snapshot/{filepath:path}")
async def update_snapshot(filepath: str, body: FileContent):
    """Update the file snapshot after user accepts changes (prevents re-diffing)."""
    _file_snapshots[filepath] = body.content
    return {"updated": True}

"""Comment threads anchored to doc text, with Claude answering in the thread.

Phase 2 of docs/dev/claude-docs-refactor-plan.md.

  GET    /api/comments?docKey=…                 threads of a doc, oldest first
  POST   /api/comments                          new thread (anchorText) or reply (threadId)
  PATCH  /api/comments/threads/{id}             resolve / reopen
  DELETE /api/comments/threads/{id}             delete a thread and its replies
  POST   /api/comments/threads/{id}/claude      Claude reads the thread and replies in it;
                                                 when asked to change the commented words it
                                                 also returns `replacement` for them

docKey "article:<id>" (main tab) or "article:<id>#<tabId>" needs the article's owner; "file:<path>" (local workspace
files) is open only where the studio workspace is (settings.enable_studio).
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Article, Comment, User
from .docs import _call, _extract_json, _pick_provider, _resolve_user

router = APIRouter()

MAX_BODY = 4000
DOC_CONTEXT_CHARS = 6000


class CommentOut(BaseModel):
    id: str
    threadId: str
    author: str
    authorName: Optional[str] = None
    body: str
    toClaude: bool = False
    createdAt: Optional[datetime] = None


class ThreadOut(BaseModel):
    id: str
    anchorText: Optional[str] = None
    resolved: bool = False
    createdAt: Optional[datetime] = None
    comments: List[CommentOut]


class CreateRequest(BaseModel):
    docKey: str
    body: str = Field(..., min_length=1, max_length=MAX_BODY)
    anchorText: Optional[str] = Field(None, max_length=MAX_BODY)
    threadId: Optional[str] = None
    toClaude: bool = False
    # Client-chosen id for a new thread: the editor marks the words with it
    # before the request returns, so it must be known up front.
    id: Optional[str] = Field(None, max_length=64)


class PatchThreadRequest(BaseModel):
    resolved: bool


class ClaudeRequest(BaseModel):
    docText: Optional[str] = None
    # The commented words as they read now (they change once a suggestion is
    # accepted); falls back to the words quoted when the thread was opened.
    anchorText: Optional[str] = Field(None, max_length=MAX_BODY)
    provider: Optional[str] = None
    model: Optional[str] = None


class ClaudeResponse(BaseModel):
    comment: CommentOut
    replacement: Optional[str] = None


def _authorize(doc_key: str, user: Optional[User], db: Session) -> None:
    kind, _, ref = doc_key.partition(":")
    if not ref:
        raise HTTPException(400, "docKey must be article:<id> or file:<path>")
    if kind == "article":
        if user is None:
            raise HTTPException(401, "Login required")
        article_id = ref.split("#", 1)[0]  # "article:<id>#<tabId>" = a comment on one of its tabs
        owned = db.query(Article.id).filter(Article.id == article_id, Article.userId == user.id).first()
        if not owned:
            raise HTTPException(404, "Article not found")
    elif kind == "file":
        if not settings.enable_studio:
            raise HTTPException(403, "Workspace files are disabled")
    else:
        raise HTTPException(400, "docKey must be article:<id> or file:<path>")


def _out(c: Comment) -> CommentOut:
    return CommentOut(
        id=c.id, threadId=c.threadId, author=c.author, authorName=c.authorName,
        body=c.body, toClaude=bool(c.toClaude), createdAt=c.createdAt,
    )


def _thread_rows(db: Session, thread_id: str) -> List[Comment]:
    return (
        db.query(Comment)
        .filter(Comment.threadId == thread_id)
        .order_by(Comment.createdAt, Comment.id)
        .all()
    )


def _root_or_404(db: Session, thread_id: str, user: Optional[User]) -> Comment:
    root = db.query(Comment).filter(Comment.id == thread_id, Comment.threadId == thread_id).first()
    if not root:
        raise HTTPException(404, "Thread not found")
    _authorize(root.docKey, user, db)
    return root


@router.get("", response_model=List[ThreadOut])
async def list_threads(docKey: str, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    user = _resolve_user(authorization, db)
    _authorize(docKey, user, db)
    rows = db.query(Comment).filter(Comment.docKey == docKey).order_by(Comment.createdAt, Comment.id).all()
    threads: dict[str, ThreadOut] = {}
    for c in rows:
        if c.id == c.threadId:
            threads[c.id] = ThreadOut(
                id=c.id, anchorText=c.anchorText, resolved=bool(c.resolved),
                createdAt=c.createdAt, comments=[],
            )
    for c in rows:
        if c.threadId in threads:
            threads[c.threadId].comments.append(_out(c))
    return list(threads.values())


@router.post("", response_model=CommentOut)
async def create_comment(req: CreateRequest, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    user = _resolve_user(authorization, db)
    _authorize(req.docKey, user, db)
    name = (user.username if user else None) or "访客"
    if req.threadId:
        root = _root_or_404(db, req.threadId, user)
        if root.docKey != req.docKey:
            raise HTTPException(400, "Thread belongs to another doc")
        c = Comment(docKey=req.docKey, threadId=root.id, userId=user.id if user else None,
                    author="user", authorName=name, body=req.body.strip(), toClaude=req.toClaude)
    else:
        if not (req.anchorText and req.anchorText.strip()):
            raise HTTPException(400, "A new thread needs anchorText")
        cid = req.id or str(uuid.uuid4())
        if db.query(Comment.id).filter(Comment.id == cid).first():
            raise HTTPException(409, "Comment id already exists")
        c = Comment(id=cid, threadId=cid, docKey=req.docKey, userId=user.id if user else None,
                    author="user", authorName=name, body=req.body.strip(),
                    anchorText=req.anchorText.strip(), toClaude=req.toClaude)
    db.add(c)
    db.commit()
    db.refresh(c)
    return _out(c)


@router.patch("/threads/{thread_id}", response_model=ThreadOut)
async def patch_thread(thread_id: str, req: PatchThreadRequest, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    user = _resolve_user(authorization, db)
    root = _root_or_404(db, thread_id, user)
    root.resolved = req.resolved
    db.commit()
    return ThreadOut(id=root.id, anchorText=root.anchorText, resolved=bool(root.resolved),
                     createdAt=root.createdAt, comments=[_out(c) for c in _thread_rows(db, root.id)])


@router.delete("/threads/{thread_id}")
async def delete_thread(thread_id: str, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    user = _resolve_user(authorization, db)
    root = _root_or_404(db, thread_id, user)
    db.query(Comment).filter(Comment.threadId == root.id).delete()
    db.commit()
    return {"deleted": thread_id}


CLAUDE_SYSTEM = """你是写作平台 Muses 里的 Claude。用户在文档的一段文字上留了评论线程，并 @ 了你。
只输出一个 JSON 对象，不要任何其他文字：
{"reply": "你在线程里的回复", "replacement": "被评论文字的新版本，或 null"}
规则：
- 只回应线程里最新一条发给你的请求；之前的对话是上下文
- 请求是修改被评论的文字（改写、精简、扩写、翻译、纠错、换语气等）→ replacement 给出那段文字的完整新版本，只替换那段文字本身，不要带上前后文；reply 用一句话说你改了什么，不要复述新文字
- 请求是提问或讨论 → replacement 为 null，reply 直接回答，依据文档内容
- 做不到或缺信息 → replacement 为 null，reply 说明缺什么
- reply 简短：一般不超过 60 个字；用用户的语言"""


@router.post("/threads/{thread_id}/claude", response_model=ClaudeResponse)
async def ask_claude(thread_id: str, req: ClaudeRequest, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    user = _resolve_user(authorization, db)
    root = _root_or_404(db, thread_id, user)
    rows = _thread_rows(db, root.id)

    convo = "\n".join(
        f"[{'Claude' if c.author == 'claude' else (c.authorName or '用户')}{' → @Claude' if c.toClaude else ''}] {c.body}"
        for c in rows
    )
    anchor = (req.anchorText or "").strip() or (root.anchorText or "")
    parts = [f"被评论的文字：\n「{anchor}」", f"评论线程（从旧到新）：\n{convo}"]
    if req.docText and req.docText.strip():
        parts.append(f"文档全文（供参考）：\n{req.docText.strip()[:DOC_CONTEXT_CHARS]}")
    prompt = "\n\n".join(parts)

    provider = _pick_provider(user, req.provider)
    raw = await _call(user, provider, req.model, CLAUDE_SYSTEM, prompt, max_tokens=1500, json_mode=True)
    try:
        data = _extract_json(raw)
        reply = str(data.get("reply") or "").strip()
        replacement = data.get("replacement")
        replacement = str(replacement).strip() if isinstance(replacement, str) and replacement.strip() else None
    except (ValueError, TypeError):
        # Not JSON: treat the whole output as a plain reply, change nothing.
        reply, replacement = raw.strip(), None
    if not reply:
        reply = "已修改。" if replacement else "（Claude 没有给出回复）"
    if replacement is not None and replacement == anchor.strip():
        replacement = None

    c = Comment(docKey=root.docKey, threadId=root.id, userId=None, author="claude",
                authorName="Claude", body=reply[:MAX_BODY])
    db.add(c)
    db.commit()
    db.refresh(c)
    return ClaudeResponse(comment=_out(c), replacement=replacement)

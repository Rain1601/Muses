from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api import comments
from app.config import settings
from app.database import Base
from app.models import Agent, Article, User
from app.services.unified_ai import UnifiedAIClient


@pytest.fixture
def comments_db(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'comments.db'}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    with sessions() as db:
        owner = User(id="owner", username="Owner")
        other = User(id="other", username="Other")
        db.add_all([owner, other, Agent(id="agent", userId="owner", name="A")])
        db.flush()
        db.add(Article(id="art", userId="owner", agentId="agent", title="T", content="<p>x</p>"))
        db.commit()
        users = {"owner": owner, "other": other}
        # Auth header "Bearer <user id>" → that user; none → guest.
        monkeypatch.setattr(comments, "_resolve_user", lambda auth, _db: users.get((auth or "").replace("Bearer ", "")))
        yield db
    engine.dispose()


OWNER = "Bearer owner"


@pytest.mark.asyncio
async def test_thread_lifecycle_on_article(comments_db):
    db = comments_db
    root = await comments.create_comment(
        comments.CreateRequest(docKey="article:art", id="t1", body="太长了", anchorText="一段很长的话"), OWNER, db)
    assert root.id == root.threadId == "t1"
    await comments.create_comment(comments.CreateRequest(docKey="article:art", threadId="t1", body="同意"), OWNER, db)

    threads = await comments.list_threads("article:art", OWNER, db)
    assert len(threads) == 1 and threads[0].anchorText == "一段很长的话"
    assert [c.body for c in threads[0].comments] == ["太长了", "同意"]

    t = await comments.patch_thread("t1", comments.PatchThreadRequest(resolved=True), OWNER, db)
    assert t.resolved and len(t.comments) == 2

    await comments.delete_thread("t1", OWNER, db)
    assert await comments.list_threads("article:art", OWNER, db) == []


@pytest.mark.asyncio
async def test_article_threads_are_owner_only(comments_db):
    db = comments_db
    await comments.create_comment(comments.CreateRequest(docKey="article:art", id="t1", body="b", anchorText="a"), OWNER, db)
    for auth, code in [(None, 401), ("Bearer other", 404)]:
        with pytest.raises(HTTPException) as e:
            await comments.list_threads("article:art", auth, db)
        assert e.value.status_code == code
        with pytest.raises(HTTPException):
            await comments.patch_thread("t1", comments.PatchThreadRequest(resolved=True), auth, db)


@pytest.mark.asyncio
async def test_file_docs_follow_studio_gate_and_need_anchor(comments_db, monkeypatch):
    db = comments_db
    with pytest.raises(HTTPException) as e:
        await comments.create_comment(comments.CreateRequest(docKey="file:a.md", body="b"), None, db)
    assert e.value.status_code == 400  # new thread without anchorText
    c = await comments.create_comment(comments.CreateRequest(docKey="file:a.md", body="b", anchorText="w"), None, db)
    assert c.authorName == "访客"
    with pytest.raises(HTTPException) as e:
        await comments.create_comment(comments.CreateRequest(docKey="file:a.md", id=c.id, body="b", anchorText="w"), None, db)
    assert e.value.status_code == 409
    monkeypatch.setattr(settings, "enable_studio", False)
    with pytest.raises(HTTPException) as e:
        await comments.list_threads("file:a.md", None, db)
    assert e.value.status_code == 403


@pytest.mark.asyncio
async def test_claude_reply_with_replacement_is_stored_in_thread(comments_db, monkeypatch):
    db = comments_db
    call = AsyncMock(return_value='{"reply": "精简成了一句。", "replacement": "短的话"}')
    monkeypatch.setattr(UnifiedAIClient, "call", call)
    await comments.create_comment(
        comments.CreateRequest(docKey="article:art", id="t1", body="精简一下", anchorText="一段很长的话", toClaude=True), OWNER, db)
    res = await comments.ask_claude("t1", comments.ClaudeRequest(docText="全文"), OWNER, db)
    assert res.replacement == "短的话"
    assert res.comment.author == "claude" and res.comment.body == "精简成了一句。"
    prompt = call.await_args.kwargs["messages"][1]["content"]
    assert "「一段很长的话」" in prompt and "→ @Claude] 精简一下" in prompt
    threads = await comments.list_threads("article:art", OWNER, db)
    assert [c.author for c in threads[0].comments] == ["user", "claude"]


@pytest.mark.asyncio
async def test_claude_plain_text_or_unchanged_replacement_changes_nothing(comments_db, monkeypatch):
    db = comments_db
    await comments.create_comment(comments.CreateRequest(docKey="article:art", id="t1", body="?", anchorText="原文"), OWNER, db)
    monkeypatch.setattr(UnifiedAIClient, "call", AsyncMock(return_value="这是在说成本。"))
    res = await comments.ask_claude("t1", comments.ClaudeRequest(), OWNER, db)
    assert res.replacement is None and res.comment.body == "这是在说成本。"
    monkeypatch.setattr(UnifiedAIClient, "call", AsyncMock(return_value='{"reply": "不用改", "replacement": "原文"}'))
    res = await comments.ask_claude("t1", comments.ClaudeRequest(), OWNER, db)
    assert res.replacement is None


@pytest.mark.asyncio
async def test_claude_sees_current_anchor_words_when_given(comments_db, monkeypatch):
    db = comments_db
    await comments.create_comment(comments.CreateRequest(docKey="article:art", id="t1", body="改", anchorText="旧词"), OWNER, db)
    call = AsyncMock(return_value='{"reply": "不用改", "replacement": "新词"}')
    monkeypatch.setattr(UnifiedAIClient, "call", call)
    res = await comments.ask_claude("t1", comments.ClaudeRequest(anchorText="新词"), OWNER, db)
    assert "「新词」" in call.await_args.kwargs["messages"][1]["content"]
    assert res.replacement is None  # same as the words now → nothing to suggest

import asyncio
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api import articles
from app.database import Base
from app.models import Agent, Article, User
from app.services.ai_service_enhanced import EnhancedAIService
from app.utils.exceptions import HTTPValidationError
from app.utils.security import encrypt
from app.utils.task_tracker import TaskStatus


@pytest.fixture
def translation_db(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'translation.db'}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr(articles, 'SessionLocal', sessions)
    monkeypatch.setattr(articles.task_tracker, '_tasks', {})
    with sessions() as db:
        user = User(id='user', username='Test')
        agent = Agent(id='agent', userId='user', name='Test')
        db.add_all([user, agent])
        db.flush()
        db.add(Article(id='source', userId='user', agentId='agent', title='Source', content='<p>Original</p>'))
        db.commit()
        yield db, user
    engine.dispose()


@pytest.mark.asyncio
async def test_missing_key_does_not_start_task(translation_db):
    db, user = translation_db
    with pytest.raises(HTTPValidationError, match='API Key'):
        await articles.translate_article('source', articles.TranslateRequest(), user, db)
    assert not articles.task_tracker._tasks


@pytest.mark.asyncio
@pytest.mark.parametrize('failure', ['exception', 'empty'])
async def test_failed_translation_does_not_publish_original_as_translation(translation_db, monkeypatch, failure):
    db, _ = translation_db
    action = AsyncMock(side_effect=RuntimeError('Provider unavailable')) if failure == 'exception' else AsyncMock(return_value={'processedText': ''})
    monkeypatch.setattr(EnhancedAIService, 'perform_text_action', action)
    task = articles.task_tracker.create_task('translate_article')
    await articles._translate_article_background(task, 'source', 'user', 'zh-CN')
    state = articles.task_tracker.get_task(task)
    assert state['status'] == TaskStatus.FAILED
    assert '第 1/1 段翻译失败' in state['error']
    assert db.query(Article).count() == 1
    assert db.get(Article, 'source').content == '<p>Original</p>'


@pytest.mark.asyncio
@pytest.mark.parametrize('mode', ['translated', 'bilingual'])
async def test_translation_mode_and_traditional_chinese(translation_db, monkeypatch, mode):
    db, user = translation_db
    action = AsyncMock(return_value={'processedText': '譯文'})
    monkeypatch.setattr(EnhancedAIService, 'perform_text_action', action)
    task = articles.task_tracker.create_task('translate_article', user_id=user.id)
    await articles._translate_article_background(task, 'source', 'user', 'zh-TW', mode)
    state = articles.task_tracker.get_task(task)
    assert state['status'] == TaskStatus.COMPLETED
    result = db.get(Article, state['result']['article_id'])
    assert '譯文' in result.content
    assert ('Original' in result.content) == (mode == 'bilingual')
    assert action.call_args.kwargs['language'] == '繁體中文'
    assert db.get(Article, 'source').content == '<p>Original</p>'
    assert (await articles.cancel_article_task(task, user))['result']['article_id'] == result.id


@pytest.mark.asyncio
@pytest.mark.parametrize('in_progress', [False, True], ids=['pending', 'running'])
async def test_cancel_translation_stops_work_and_keeps_original(translation_db, monkeypatch, in_progress):
    db, user = translation_db
    user.deepseekKey = encrypt('test-key')
    db.commit()
    started = asyncio.Event()

    async def translate_block(**kwargs):
        started.set()
        await asyncio.Future()

    monkeypatch.setattr(EnhancedAIService, 'perform_text_action', translate_block)
    submission = await articles.translate_article('source', articles.TranslateRequest(), user, db)
    task_id = submission['taskId']
    worker = articles.task_tracker.get_task(task_id)['worker']
    if in_progress:
        await asyncio.wait_for(started.wait(), timeout=1)
    expected = TaskStatus.RUNNING if in_progress else TaskStatus.PENDING
    assert (await articles.get_task_status(task_id, user))['status'] == expected

    with pytest.raises(HTTPValidationError, match='无权访问'):
        await articles.cancel_article_task(task_id, User(id='other', username='Other'))
    assert (await articles.get_task_status(task_id, user))['status'] == expected

    assert (await articles.cancel_article_task(task_id, user))['status'] == TaskStatus.CANCELLED
    with pytest.raises(asyncio.CancelledError):
        await worker
    assert (await articles.cancel_article_task(task_id, user))['status'] == TaskStatus.CANCELLED
    assert (await articles.get_task_status(task_id, user))['status'] == TaskStatus.CANCELLED
    assert started.is_set() == in_progress
    assert db.query(Article).count() == 1
    assert db.get(Article, 'source').content == '<p>Original</p>'


@pytest.mark.asyncio
@pytest.mark.parametrize('mode', ['translated', 'bilingual'])
async def test_list_items_translated_once_and_structure_kept(translation_db, monkeypatch, mode):
    """TipTap list items are <li><p>…</p></li>: each must be translated once, inside its list."""
    db, user = translation_db
    db.get(Article, 'source').content = (
        '<h2>Title</h2><ul><li><p>Alpha</p></li><li><p>Beta</p></li></ul>'
        '<p>Gamma</p><img src="x.png"><ol><li>Delta</li></ol>'
    )
    db.commit()

    async def translate(**kwargs):
        return {'processedText': f"T[{kwargs['text']}] <b>&"}

    action = AsyncMock(side_effect=translate)
    monkeypatch.setattr(EnhancedAIService, 'perform_text_action', action)
    task = articles.task_tracker.create_task('translate_article', user_id=user.id)
    await articles._translate_article_background(task, 'source', 'user', 'zh-CN', mode)
    state = articles.task_tracker.get_task(task)
    assert state['status'] == TaskStatus.COMPLETED

    assert sorted(c.kwargs['text'] for c in action.call_args_list) == ['Alpha', 'Beta', 'Delta', 'Gamma', 'Title']
    html = db.get(Article, state['result']['article_id']).content
    for word in ['Alpha', 'Beta', 'Gamma', 'Delta', 'Title']:
        assert html.count(f'T[{word}]') == 1
        assert html.count(f'>{word}<') == (1 if mode == 'bilingual' else 0)
    # Lists, headings and the image stay where they were; model output is text, not markup.
    assert '<ul><li><p>' in html and '<ol><li>' in html and html.count('<li>') == 3
    assert html.index('T[Gamma]') < html.index('<img src="x.png"/>') < html.index('T[Delta]')
    assert '&lt;b&gt;&amp;' in html and '<b>' not in html

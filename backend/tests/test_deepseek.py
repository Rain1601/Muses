import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import create_engine, inspect, text

from app import database
from app.api import articles, users
from app.config import settings
from app.models import User
from app.schemas.user import UserSettingsRequest, GetApiKeyRequest, VerifyApiKeyRequest
from app.services.unified_ai import UnifiedAIClient
from app.utils.security import encrypt, decrypt
from test_translation import translation_db


@pytest.mark.asyncio
async def test_key_roundtrip_and_partial_settings_update(translation_db):
    db, user = translation_db
    await users.update_user_settings(UserSettingsRequest(deepseekKey=' sk-test-deepseek '), user, db)
    db.expire_all()
    assert user.deepseekKey != 'sk-test-deepseek'
    assert decrypt(user.deepseekKey) == 'sk-test-deepseek'
    profile = await users.get_user_profile(user, db)
    assert profile.hasDeepseekKey
    assert 'deepseekKey' not in profile.model_dump()
    key = await users.get_api_key(GetApiKeyRequest(keyType='deepseek'), user)
    assert key.key == 'sk-test-deepseek'
    await users.update_user_settings(UserSettingsRequest(language='en'), user, db)
    assert decrypt(user.deepseekKey) == 'sk-test-deepseek'
    await users.update_user_settings(UserSettingsRequest(deepseekKey=''), user, db)
    assert user.deepseekKey is None


def test_migration_preserves_legacy_data_and_is_repeatable(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    with engine.begin() as conn:
        conn.execute(text('CREATE TABLE "User" (id VARCHAR PRIMARY KEY, username VARCHAR)'))
        conn.execute(text("INSERT INTO \"User\" VALUES ('old', 'Legacy')"))
    monkeypatch.setattr(database, 'engine', engine)
    database.run_migrations()
    database.run_migrations()
    assert 'deepseekKey' in {c['name'] for c in inspect(engine).get_columns('User')}
    with engine.connect() as conn:
        assert conn.execute(text('SELECT username, "deepseekKey" FROM "User"')).one() == ('Legacy', None)
    engine.dispose()


def test_provider_priority_and_env_compatibility(monkeypatch):
    monkeypatch.setattr(settings, 'deepseek_api_key', 'env-test')
    user = User(username='Test', deepseekKey=encrypt('user-test'))
    assert UnifiedAIClient._determine_provider(user) == 'deepseek'
    assert UnifiedAIClient._get_api_key(user, 'deepseek') == 'user-test'
    user.aihubmixKey = encrypt('existing-test')
    assert UnifiedAIClient._determine_provider(user) == 'aihubmix'
    user.deepseekKey = None
    assert UnifiedAIClient._get_api_key(user, 'deepseek') == 'env-test'


@pytest.mark.asyncio
@pytest.mark.parametrize('model', ['deepseek-flash', 'deepseek-v4-pro'])
async def test_call_uses_deepseek_endpoint_and_model(monkeypatch, model):
    client = MagicMock()
    client.chat.completions.create.return_value = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content='译文'))])
    factory = MagicMock(return_value=client)
    monkeypatch.setattr('app.services.unified_ai.openai.OpenAI', factory)
    user = User(username='Test', deepseekKey=encrypt('test-key'))
    result = await UnifiedAIClient.call(user, [{'role': 'user', 'content': 'Hello'}], provider='deepseek', model=model)
    assert result == '译文'
    assert factory.call_args.kwargs['base_url'] == settings.deepseek_base_url
    assert factory.call_args.kwargs['api_key'] == 'test-key'
    assert client.chat.completions.create.call_args.kwargs['model'] == model
    assert client.chat.completions.create.call_args.kwargs['extra_body'] == {'thinking': {'type': 'disabled'}}
    client.close.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.parametrize('model', [None, 'deepseek-flash', 'deepseek-v4-pro'])
async def test_translation_captures_selected_model(translation_db, monkeypatch, model):
    db, user = translation_db
    user.deepseekKey = encrypt('test-key')
    db.commit()
    background = AsyncMock()
    monkeypatch.setattr(articles, '_translate_article_background', background)
    result = await articles.translate_article('source', articles.TranslateRequest(model=model), user, db)
    await asyncio.sleep(0)
    task = articles.task_tracker.get_task(result['taskId'])
    assert task['provider'] == 'deepseek'
    assert task['model'] == (model or 'deepseek-flash')
    assert background.call_args.args[-2:] == ('deepseek', model or 'deepseek-flash')


@pytest.mark.asyncio
async def test_key_verification_accepts_body_and_legacy_query(monkeypatch):
    client = AsyncMock()
    client.__aenter__.return_value = client
    factory = MagicMock(return_value=client)
    monkeypatch.setattr(users.openai, 'AsyncOpenAI', factory)
    assert (await users.verify_api_key(VerifyApiKeyRequest(provider='deepseek', key='test-key')))['valid']
    assert (await users.verify_api_key(provider='aihubmix', key='old-test'))['valid']
    assert client.models.list.await_count == 2
    assert factory.call_args.kwargs['timeout'] == 15.0

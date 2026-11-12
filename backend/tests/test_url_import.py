import httpx
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.api import upload
from app.database import Base
from app.models import Agent, Article, User


@pytest.fixture
def import_context(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    with sessions() as db:
        user = User(id="importer", username="Importer")
        db.add_all([user, User(id="other", username="Other")])
        db.commit()

    client = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(
        200,
        text='<title>Imported page</title><article><h1>Hello</h1>'
             '<p>Saved content <a href="/next">next</a></p></article>',
    ))
    monkeypatch.setattr(upload.httpx, "AsyncClient", lambda **kwargs: client(
        transport=transport, **kwargs
    ))
    monkeypatch.setattr(upload, "SessionLocal", sessions)
    monkeypatch.setattr(upload.settings, "upload_dir", str(tmp_path))
    monkeypatch.setattr(upload, "uploaded_files", {})
    yield sessions, user
    engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize("existing", ["none", "other-user", "non-default", "default"])
async def test_url_import_selects_or_creates_user_agent(import_context, existing):
    sessions, user = import_context
    with sessions() as db:
        if existing == "other-user":
            db.add(Agent(id="foreign", userId="other", name="Other", isDefault=True))
        elif existing in {"non-default", "default"}:
            db.add(Agent(id="first", userId=user.id, name="First"))
            if existing == "default":
                db.add(Agent(id="preferred", userId=user.id, name="Default", isDefault=True))
        db.commit()

    request = upload.URLFetchRequest(url="https://example.test/article")
    first = await upload.fetch_url_content(request, current_user=user)
    second = await upload.fetch_url_content(request, current_user=user)

    with sessions() as db:
        agents = db.query(Agent).filter_by(userId=user.id).all()
        assert len(agents) == (2 if existing == "default" else 1)
        article = db.get(Article, first["article"]["id"])
        repeated = db.get(Article, second["article"]["id"])
        assert first["success"] is True
        assert article.userId == user.id
        assert article.agentId == repeated.agentId
        assert article.title == "Imported page"
        assert "Saved content" in article.content
        assert 'href="https://example.test/next"' in article.content
        assert article.sourceFiles == request.url
        assert article.publishStatus == "draft"
        if existing == "default":
            assert article.agentId == "preferred"
        elif existing == "non-default":
            assert article.agentId == "first"
            assert agents[0].isDefault is False
        else:
            assert article.agentId == agents[0].id
            assert agents[0].name == "导入助手"
            assert agents[0].isDefault is True

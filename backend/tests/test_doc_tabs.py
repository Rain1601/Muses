from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app import database
from app.api import articles, doc_tabs
from app.database import Base
from app.models import Agent, Article, ArticleRevision, Comment, User
from app.schemas.article import ArticleUpdate
from app.services.revisions import GROUP_WINDOW, record_revision


@pytest.fixture
def tabs_db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'tabs.db'}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    with sessions() as db:
        owner, other = User(id="owner", username="O"), User(id="other", username="X")
        db.add_all([owner, other, Agent(id="agent", userId="owner", name="A")])
        db.flush()
        db.add(Article(id="art", userId="owner", agentId="agent", title="T", content="<p>v0</p>"))
        db.commit()
        yield db, owner, other
    engine.dispose()


def revs(db, tab="main"):
    return (db.query(ArticleRevision).filter_by(articleId="art", tabId=tab)
            .order_by(ArticleRevision.updatedAt).all())


def test_record_revision_baseline_grouping_and_restore_split(tabs_db):
    db, *_ = tabs_db
    t0 = datetime(2026, 11, 12, 10, 0)
    record_revision(db, "art", "main", "<p>v0</p>", "<p>v1</p>", now=t0)
    assert [(r.source, r.content) for r in revs(db)] == [("baseline", "<p>v0</p>"), ("save", "<p>v1</p>")]

    record_revision(db, "art", "main", "<p>v1</p>", "<p>v2</p>", now=t0 + timedelta(minutes=3))
    assert [r.content for r in revs(db)] == ["<p>v0</p>", "<p>v2</p>"]  # folded into the open burst

    record_revision(db, "art", "main", "<p>v2</p>", "<p>v2</p>", now=t0 + timedelta(minutes=4))
    assert len(revs(db)) == 2  # no change, no revision

    record_revision(db, "art", "main", "<p>v2</p>", "<p>v3</p>", now=t0 + timedelta(minutes=3) + GROUP_WINDOW)
    assert [r.content for r in revs(db)] == ["<p>v0</p>", "<p>v2</p>", "<p>v3</p>"]

    record_revision(db, "art", "main", "<p>v3</p>", "<p>v0</p>", source="restore", now=t0 + timedelta(minutes=30))
    record_revision(db, "art", "main", "<p>v0</p>", "<p>v4</p>", now=t0 + timedelta(minutes=31))
    assert [r.source for r in revs(db)][-2:] == ["restore", "save"]  # a save never folds into a restore


@pytest.mark.asyncio
async def test_article_put_records_main_tab_history(tabs_db):
    db, owner, _ = tabs_db
    await articles.update_article(ArticleUpdate(content="<p>new</p>"), "art", owner, db)
    assert [r.content for r in revs(db)] == ["<p>v0</p>", "<p>new</p>"]
    await articles.update_article(ArticleUpdate(title="Renamed"), "art", owner, db)
    assert len(revs(db)) == 2  # a title-only update is not a content revision


@pytest.mark.asyncio
async def test_tabs_crud_and_per_tab_history(tabs_db):
    db, owner, _ = tabs_db
    tabs = await doc_tabs.list_tabs("art", owner, db)
    assert [(t.id, t.name, t.isMain) for t in tabs] == [("main", "正文", True)]

    notes = await doc_tabs.create_tab("art", doc_tabs.CreateTabRequest(name="笔记"), owner, db)
    src = await doc_tabs.create_tab("art", doc_tabs.CreateTabRequest(name="来源"), owner, db)
    await doc_tabs.patch_tab("art", "main", doc_tabs.PatchTabRequest(name="草稿"), owner, db)
    assert [t.name for t in await doc_tabs.list_tabs("art", owner, db)] == ["草稿", "笔记", "来源"]

    await doc_tabs.patch_tab("art", notes.id, doc_tabs.PatchTabRequest(content="<p>n1</p>"), owner, db)
    assert (await doc_tabs.get_tab("art", notes.id, owner, db)).content == "<p>n1</p>"
    assert [r.source for r in revs(db, notes.id)] == ["save"]  # empty tab → no baseline
    assert revs(db) == []  # main tab untouched

    db.add(Comment(id="c1", threadId="c1", docKey=f"article:art#{src.id}", body="b", anchorText="a"))
    db.commit()
    await doc_tabs.delete_tab("art", src.id, owner, db)
    assert db.query(Comment).count() == 0
    with pytest.raises(HTTPException) as e:
        await doc_tabs.delete_tab("art", "main", owner, db)
    assert e.value.status_code == 400


@pytest.mark.asyncio
async def test_restore_writes_tab_and_new_revision(tabs_db):
    db, owner, _ = tabs_db
    await doc_tabs.patch_tab("art", "main", doc_tabs.PatchTabRequest(content="<p>v1</p>"), owner, db)
    baseline = revs(db)[0]
    listed = await doc_tabs.list_revisions("art", "main", owner, db)
    assert [r.source for r in listed] == ["save", "baseline"] and listed[1].chars == len("v0")
    assert (await doc_tabs.get_revision("art", baseline.id, owner, db)).content == "<p>v0</p>"

    out = await doc_tabs.restore_revision("art", baseline.id, owner, db)
    assert out.content == "<p>v0</p>"
    assert db.get(Article, "art").content == "<p>v0</p>"
    assert [r.source for r in revs(db)] == ["baseline", "save", "restore"]


@pytest.mark.asyncio
async def test_other_users_cannot_see_tabs_or_history(tabs_db):
    db, _, other = tabs_db
    for call in (doc_tabs.list_tabs("art", other, db), doc_tabs.list_revisions("art", "main", other, db)):
        with pytest.raises(HTTPException) as e:
            await call
        assert e.value.status_code == 404


def test_migration_adds_main_tab_name_to_existing_article_table(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    with engine.begin() as conn:
        conn.execute(text('CREATE TABLE "User" (id VARCHAR PRIMARY KEY)'))
        conn.execute(text('CREATE TABLE "Article" (id VARCHAR PRIMARY KEY, content TEXT)'))
        conn.execute(text("INSERT INTO \"Article\" VALUES ('a', '<p>x</p>')"))
    monkeypatch.setattr(database, "engine", engine)
    database.run_migrations()
    database.run_migrations()  # repeatable
    cols = {c["name"] for c in inspect(engine).get_columns("Article")}
    assert "mainTabName" in cols
    with engine.connect() as conn:
        assert conn.execute(text('SELECT content FROM "Article"')).scalar() == "<p>x</p>"

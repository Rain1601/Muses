"""Tabs and version history of an article (Claude Docs model).

Phase 4 of docs/dev/claude-docs-refactor-plan.md. Mounted under /api/articles.

  GET    /{aid}/tabs                       [{id, name, order, isMain}] — main first
  POST   /{aid}/tabs                       {name} → new tab, placed last
  GET    /{aid}/tabs/{tid}                 {id, name, content}  (tid "main" = Article.content)
  PATCH  /{aid}/tabs/{tid}                 {name?, content?, order?} — content records a revision
  DELETE /{aid}/tabs/{tid}                 an extra tab, with its revisions and comments
  GET    /{aid}/revisions?tabId=main       newest first, without content
  GET    /{aid}/revisions/{rid}            one revision with content
  POST   /{aid}/revisions/{rid}/restore    puts that content back into its tab (a new revision)

Workspace .md files have neither: they live on disk, not in the DB.
"""
from __future__ import annotations

import html
import re
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user_db
from ..models import Article, ArticleRevision, ArticleTab, Comment
from ..services.revisions import record_revision

router = APIRouter()

MAIN = "main"
DEFAULT_MAIN_NAME = "正文"
MAX_TABS = 50


class TabOut(BaseModel):
    id: str
    name: str
    order: str
    isMain: bool = False


class TabContentOut(TabOut):
    content: str


class CreateTabRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class PatchTabRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    content: Optional[str] = None
    order: Optional[str] = Field(None, max_length=32)


class RevisionOut(BaseModel):
    id: str
    tabId: str
    title: Optional[str] = None
    source: str
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    chars: int = 0


class RevisionContentOut(RevisionOut):
    content: str


def _article(db: Session, article_id: str, user) -> Article:
    a = db.query(Article).filter(Article.id == article_id, Article.userId == user.id).first()
    if not a:
        raise HTTPException(404, "Article not found")
    return a


def _tab(db: Session, article: Article, tab_id: str) -> ArticleTab:
    t = db.query(ArticleTab).filter(ArticleTab.id == tab_id, ArticleTab.articleId == article.id).first()
    if not t:
        raise HTTPException(404, "Tab not found")
    return t


def _main_out(a: Article) -> TabOut:
    return TabOut(id=MAIN, name=a.mainTabName or DEFAULT_MAIN_NAME, order="a0", isMain=True)


def _text_len(content: str) -> int:
    """Visible characters (tags stripped, whitespace collapsed) — what "字数" means to a writer."""
    text = html.unescape(re.sub(r"<[^>]+>", "", content or ""))
    return len(re.sub(r"\s+", "", text))


def _rev_out(r: ArticleRevision) -> RevisionOut:
    return RevisionOut(id=r.id, tabId=r.tabId, title=r.title, source=r.source,
                       createdAt=r.createdAt, updatedAt=r.updatedAt, chars=_text_len(r.content))


def _next_order(db: Session, article_id: str) -> str:
    n = db.query(ArticleTab).filter(ArticleTab.articleId == article_id).count()
    return f"b{n + 1:03d}"


@router.get("/{article_id}/tabs", response_model=List[TabOut])
async def list_tabs(article_id: str, user=Depends(get_current_user_db), db: Session = Depends(get_db)):
    a = _article(db, article_id, user)
    extra = (db.query(ArticleTab).filter(ArticleTab.articleId == a.id)
             .order_by(ArticleTab.order, ArticleTab.createdAt).all())
    return [_main_out(a)] + [TabOut(id=t.id, name=t.name, order=t.order) for t in extra]


@router.post("/{article_id}/tabs", response_model=TabOut)
async def create_tab(article_id: str, req: CreateTabRequest, user=Depends(get_current_user_db), db: Session = Depends(get_db)):
    a = _article(db, article_id, user)
    if db.query(ArticleTab).filter(ArticleTab.articleId == a.id).count() >= MAX_TABS:
        raise HTTPException(400, f"最多 {MAX_TABS} 个 tab")
    t = ArticleTab(articleId=a.id, name=req.name.strip(), order=_next_order(db, a.id), content="")
    db.add(t)
    db.commit()
    return TabOut(id=t.id, name=t.name, order=t.order)


@router.get("/{article_id}/tabs/{tab_id}", response_model=TabContentOut)
async def get_tab(article_id: str, tab_id: str, user=Depends(get_current_user_db), db: Session = Depends(get_db)):
    a = _article(db, article_id, user)
    if tab_id == MAIN:
        return TabContentOut(**_main_out(a).model_dump(), content=a.content or "")
    t = _tab(db, a, tab_id)
    return TabContentOut(id=t.id, name=t.name, order=t.order, content=t.content or "")


@router.patch("/{article_id}/tabs/{tab_id}", response_model=TabOut)
async def patch_tab(article_id: str, tab_id: str, req: PatchTabRequest, user=Depends(get_current_user_db), db: Session = Depends(get_db)):
    a = _article(db, article_id, user)
    if tab_id == MAIN:
        if req.name is not None:
            a.mainTabName = req.name.strip()
        if req.content is not None:
            old = a.content
            a.content = req.content
            record_revision(db, a.id, MAIN, old, req.content, title=a.title)
        db.commit()
        return _main_out(a)
    t = _tab(db, a, tab_id)
    if req.name is not None:
        t.name = req.name.strip()
    if req.order is not None:
        t.order = req.order
    if req.content is not None:
        old = t.content
        t.content = req.content
        record_revision(db, a.id, t.id, old, req.content, title=t.name)
    db.commit()
    return TabOut(id=t.id, name=t.name, order=t.order)


@router.delete("/{article_id}/tabs/{tab_id}")
async def delete_tab(article_id: str, tab_id: str, user=Depends(get_current_user_db), db: Session = Depends(get_db)):
    a = _article(db, article_id, user)
    if tab_id == MAIN:
        raise HTTPException(400, "主 tab 不能删除")
    t = _tab(db, a, tab_id)
    db.query(ArticleRevision).filter(ArticleRevision.articleId == a.id, ArticleRevision.tabId == t.id).delete()
    db.query(Comment).filter(Comment.docKey == f"article:{a.id}#{t.id}").delete()
    db.delete(t)
    db.commit()
    return {"deleted": tab_id}


@router.get("/{article_id}/revisions", response_model=List[RevisionOut])
async def list_revisions(article_id: str, tabId: str = MAIN, user=Depends(get_current_user_db), db: Session = Depends(get_db)):
    a = _article(db, article_id, user)
    rows = (db.query(ArticleRevision)
            .filter(ArticleRevision.articleId == a.id, ArticleRevision.tabId == tabId)
            .order_by(ArticleRevision.updatedAt.desc()).all())
    return [_rev_out(r) for r in rows]


def _revision(db: Session, a: Article, rev_id: str) -> ArticleRevision:
    r = db.query(ArticleRevision).filter(ArticleRevision.id == rev_id, ArticleRevision.articleId == a.id).first()
    if not r:
        raise HTTPException(404, "Revision not found")
    return r


@router.get("/{article_id}/revisions/{rev_id}", response_model=RevisionContentOut)
async def get_revision(article_id: str, rev_id: str, user=Depends(get_current_user_db), db: Session = Depends(get_db)):
    a = _article(db, article_id, user)
    r = _revision(db, a, rev_id)
    return RevisionContentOut(**_rev_out(r).model_dump(), content=r.content)


@router.post("/{article_id}/revisions/{rev_id}/restore", response_model=TabContentOut)
async def restore_revision(article_id: str, rev_id: str, user=Depends(get_current_user_db), db: Session = Depends(get_db)):
    a = _article(db, article_id, user)
    r = _revision(db, a, rev_id)
    if r.tabId == MAIN:
        old, a.content = a.content, r.content
        record_revision(db, a.id, MAIN, old, r.content, title=a.title, source="restore")
        db.commit()
        return TabContentOut(**_main_out(a).model_dump(), content=a.content)
    t = db.query(ArticleTab).filter(ArticleTab.id == r.tabId, ArticleTab.articleId == a.id).first()
    if not t:
        raise HTTPException(404, "这个版本所在的 tab 已删除")
    old, t.content = t.content, r.content
    record_revision(db, a.id, t.id, old, r.content, title=t.name, source="restore")
    db.commit()
    return TabContentOut(id=t.id, name=t.name, order=t.order, content=t.content)

"""Version history for article tabs.

record_revision() is called with a tab's content before and after a change:
  - the first change to a tab with no history stores the old content as a
    "baseline" revision, so existing articles get their pre-edit state kept;
  - saves within GROUP_WINDOW of the latest "save" revision are folded into it
    (autosave runs every few seconds; one revision per editing burst);
  - a restore always starts a new revision;
  - at most MAX_PER_TAB revisions are kept per tab, oldest dropped first.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from ..models import ArticleRevision

GROUP_WINDOW = timedelta(minutes=10)
MAX_PER_TAB = 200


def _latest(db: Session, article_id: str, tab_id: str) -> Optional[ArticleRevision]:
    return (
        db.query(ArticleRevision)
        .filter(ArticleRevision.articleId == article_id, ArticleRevision.tabId == tab_id)
        .order_by(ArticleRevision.updatedAt.desc(), ArticleRevision.createdAt.desc())
        .first()
    )


def record_revision(
    db: Session,
    article_id: str,
    tab_id: str,
    old_content: Optional[str],
    new_content: str,
    *,
    title: Optional[str] = None,
    source: str = "save",
    now: Optional[datetime] = None,
) -> Optional[ArticleRevision]:
    """Record new_content for a tab. Does not commit."""
    now = now or datetime.now()
    latest = _latest(db, article_id, tab_id)
    if latest is None and old_content and old_content != new_content:
        db.add(ArticleRevision(articleId=article_id, tabId=tab_id, title=title, content=old_content,
                               source="baseline", createdAt=now - timedelta(microseconds=1),
                               updatedAt=now - timedelta(microseconds=1)))
        db.flush()
        latest = None  # the baseline never absorbs a save
    elif latest is not None and latest.content == new_content:
        return latest

    if (
        source == "save" and latest is not None and latest.source == "save"
        and now - (latest.updatedAt or latest.createdAt) < GROUP_WINDOW
    ):
        latest.content = new_content
        latest.title = title or latest.title
        latest.updatedAt = now
        return latest

    rev = ArticleRevision(articleId=article_id, tabId=tab_id, title=title, content=new_content,
                          source=source, createdAt=now, updatedAt=now)
    db.add(rev)
    db.flush()
    _trim(db, article_id, tab_id)
    return rev


def _trim(db: Session, article_id: str, tab_id: str) -> None:
    extra = (
        db.query(ArticleRevision.id)
        .filter(ArticleRevision.articleId == article_id, ArticleRevision.tabId == tab_id)
        .order_by(ArticleRevision.updatedAt.desc())
        .offset(MAX_PER_TAB)
        .all()
    )
    if extra:
        db.query(ArticleRevision).filter(ArticleRevision.id.in_([r.id for r in extra])).delete(synchronize_session=False)

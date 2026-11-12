from datetime import datetime
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text

from ..database import Base


def generate_uuid():
    return str(uuid.uuid4())


class ArticleTab(Base):
    """An extra tab of an article (Claude Docs model: a doc holds tabs).

    The article's own `content` is its main tab (id "main", named by
    `Article.mainTabName`), so publish / translate / import keep working on
    `Article.content` unchanged. Extra tabs live here.
    """

    __tablename__ = "ArticleTab"

    id = Column(String, primary_key=True, default=generate_uuid)
    articleId = Column(String, ForeignKey("Article.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    order = Column(String, nullable=False, default="b0")  # sorts as a string, main tab always first
    content = Column(Text, nullable=False, default="")

    createdAt = Column(DateTime, default=datetime.now)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class ArticleRevision(Base):
    """A saved version of one tab. Saves close together are grouped into one
    revision (see app/services/revisions.py)."""

    __tablename__ = "ArticleRevision"

    id = Column(String, primary_key=True, default=generate_uuid)
    articleId = Column(String, ForeignKey("Article.id", ondelete="CASCADE"), nullable=False, index=True)
    tabId = Column(String, nullable=False, default="main")
    title = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    source = Column(String, nullable=False, default="save")  # baseline | save | restore

    createdAt = Column(DateTime, default=datetime.now)
    updatedAt = Column(DateTime, default=datetime.now)

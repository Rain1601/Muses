from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from datetime import datetime

from ..database import Base
import uuid


def generate_uuid():
    return str(uuid.uuid4())


class Comment(Base):
    """A comment in a thread anchored to words of a doc (Claude Docs model).

    A thread = its root comment (threadId == id). Replies point at the root.
    The anchor lives in the doc itself as a CommentAnchor mark carrying the
    thread id; `anchorText` keeps the quoted words so a thread whose words were
    deleted can still say what it was on.

    `docKey` = "article:<Article.id>" or "file:<workspace path>".
    """

    __tablename__ = "Comment"

    id = Column(String, primary_key=True, default=generate_uuid)
    docKey = Column(String, nullable=False, index=True)
    threadId = Column(String, nullable=False, index=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=True)

    author = Column(String, nullable=False, default="user")  # user | claude
    authorName = Column(String, nullable=True)
    body = Column(Text, nullable=False)
    anchorText = Column(Text, nullable=True)  # root only
    toClaude = Column(Boolean, default=False)  # this comment asks Claude
    resolved = Column(Boolean, default=False)  # root only

    # Python-side timestamps: SQLite's now() is per-second, and a thread's
    # comments are ordered by createdAt (a reply can land in the same second).
    createdAt = Column(DateTime, default=datetime.now)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

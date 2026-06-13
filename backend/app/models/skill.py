from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.sql import func
from ..database import Base
import uuid


def generate_uuid():
    return str(uuid.uuid4())


class Skill(Base):
    __tablename__ = "Skill"

    id = Column(String, primary_key=True, default=generate_uuid)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)

    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String, nullable=True)        # emoji or short token (e.g. "✍️", "story")
    category = Column(String, default="general")  # general, opening, structure, polish, style
    prompt = Column(Text, nullable=False)        # the actual prompt template
    isPreset = Column(Boolean, default=False)    # seeded by system, read-only

    createdAt = Column(DateTime, default=func.now())
    updatedAt = Column(DateTime, default=func.now(), onupdate=func.now())

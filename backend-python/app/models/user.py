from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base
import uuid


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "User"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    githubId = Column(String, unique=True, nullable=False)
    username = Column(String, nullable=False)
    email = Column(String, nullable=True)
    avatarUrl = Column(String, nullable=True)
    openaiKey = Column(String, nullable=True)  # 加密存储
    claudeKey = Column(String, nullable=True)  # 加密存储
    geminiKey = Column(String, nullable=True)  # 加密存储
    githubToken = Column(String, nullable=True)  # 加密存储
    defaultRepoUrl = Column(String, nullable=True)
    createdAt = Column(DateTime, default=func.now())
    updatedAt = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    agents = relationship("Agent", back_populates="user", cascade="all, delete-orphan")
    articles = relationship("Article", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")


class UserSettings(Base):
    __tablename__ = "UserSettings"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), unique=True, nullable=False)
    language = Column(String, default="zh-CN")
    theme = Column(String, default="light")
    autoSave = Column(Boolean, default=True)
    createdAt = Column(DateTime, default=func.now())
    updatedAt = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    user = relationship("User", back_populates="settings")
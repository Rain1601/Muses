from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base
import uuid


def generate_uuid():
    return str(uuid.uuid4())


class Agent(Base):
    __tablename__ = "Agent"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    avatar = Column(String, nullable=True)
    
    # 写作风格配置
    language = Column(String, default="zh-CN")
    tone = Column(String, default="professional")  # professional, casual, humorous, serious
    lengthPreference = Column(String, default="medium")  # short, medium, long
    targetAudience = Column(String, nullable=True)
    
    # 高级配置
    customPrompt = Column(Text, nullable=True)
    outputFormat = Column(String, default="markdown")  # markdown, mdx
    specialRules = Column(Text, nullable=True)  # JSON字符串
    
    isDefault = Column(Boolean, default=False)
    createdAt = Column(DateTime, default=func.now())
    updatedAt = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    user = relationship("User", back_populates="agents")
    articles = relationship("Article", back_populates="agent")
    muses_configs = relationship("AgentMusesConfig", back_populates="agent", cascade="all, delete-orphan")
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base
import uuid


def generate_uuid():
    return str(uuid.uuid4())


class ChatHistory(Base):
    """对话历史模型 - 存储用户与AI的对话记录"""
    __tablename__ = "ChatHistory"

    id = Column(String, primary_key=True, default=generate_uuid)
    articleId = Column(String, ForeignKey("Article.id", ondelete="CASCADE"), nullable=False)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    agentId = Column(String, ForeignKey("Agent.id"), nullable=False)

    # 消息内容
    role = Column(String, nullable=False)  # user 或 assistant
    content = Column(Text, nullable=False)  # 消息内容

    # 消息顺序
    sequence = Column(Integer, nullable=False)  # 消息在对话中的序号

    # 元数据
    createdAt = Column(DateTime, default=func.now())

    # 关系
    article = relationship("Article")
    user = relationship("User")
    agent = relationship("Agent")

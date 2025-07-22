from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base
import uuid


def generate_uuid():
    return str(uuid.uuid4())


class Article(Base):
    __tablename__ = "Article"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    agentId = Column(String, ForeignKey("Agent.id"), nullable=False)
    
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)  # HTML内容（从Markdown转换而来）
    summary = Column(Text, nullable=True)
    
    # 发布信息
    publishStatus = Column(String, default="draft")  # draft, published, scheduled
    publishedAt = Column(DateTime, nullable=True)
    githubUrl = Column(String, nullable=True)  # 发布到GitHub后的URL
    repoPath = Column(String, nullable=True)  # 在仓库中的路径
    
    # 元数据
    sourceFiles = Column(Text, nullable=True)  # 原始素材文件信息JSON字符串
    article_metadata = Column(Text, nullable=True)  # 其他元数据JSON字符串
    
    createdAt = Column(DateTime, default=func.now())
    updatedAt = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    user = relationship("User", back_populates="articles")
    agent = relationship("Agent", back_populates="articles")
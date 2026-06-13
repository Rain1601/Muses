from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base
import uuid


def generate_uuid():
    return str(uuid.uuid4())


class SyncHistory(Base):
    __tablename__ = "SyncHistory"

    id = Column(String, primary_key=True, default=generate_uuid)
    articleId = Column(String, ForeignKey("Article.id", ondelete="CASCADE"), nullable=False)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)

    # 同步信息
    syncType = Column(String, nullable=False)  # "pull_from_github", "push_to_github", "conflict_resolved"
    syncDirection = Column(String, nullable=False)  # "local_to_github", "github_to_local", "bidirectional"
    syncStatus = Column(String, nullable=False)  # "success", "failed", "conflict"

    # 内容变化
    contentBefore = Column(Text, nullable=True)  # 同步前的内容
    contentAfter = Column(Text, nullable=True)   # 同步后的内容
    hasChanges = Column(String, default="false")  # 是否有内容变化

    # GitHub信息
    githubSha = Column(String, nullable=True)  # GitHub文件的SHA值
    githubUrl = Column(String, nullable=True)  # GitHub文件URL
    repoPath = Column(String, nullable=True)   # 仓库路径

    # 冲突信息
    conflictType = Column(String, nullable=True)  # "content_conflict", "timestamp_conflict"
    conflictResolution = Column(String, nullable=True)  # "use_local", "use_github", "manual_merge"

    # 元数据
    errorMessage = Column(Text, nullable=True)  # 错误信息
    syncDuration = Column(Integer, nullable=True)  # 同步耗时（毫秒）
    fileSize = Column(Integer, nullable=True)  # 文件大小

    createdAt = Column(DateTime, default=func.now())

    # 关系
    article = relationship("Article")
    user = relationship("User")
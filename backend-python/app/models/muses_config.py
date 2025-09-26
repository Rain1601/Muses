from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base
import uuid


class MusesConfig(Base):
    __tablename__ = "muses_configs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("User.id"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    content = Column(Text, nullable=False)
    config_type = Column(String(50), default="user")  # 'user' | 'agent' | 'template'
    is_active = Column(Boolean, default=False)
    is_default = Column(Boolean, default=False)
    parent_config_id = Column(String(36), ForeignKey("muses_configs.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="muses_configs")
    parent = relationship("MusesConfig", remote_side=[id])
    histories = relationship("ConfigHistory", back_populates="config", cascade="all, delete-orphan")
    agent_configs = relationship("AgentMusesConfig", back_populates="muses_config", cascade="all, delete-orphan")


class ConfigHistory(Base):
    __tablename__ = "config_histories"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    config_id = Column(String(36), ForeignKey("muses_configs.id"), nullable=False)
    content = Column(Text, nullable=False)
    change_description = Column(Text)
    version_number = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    config = relationship("MusesConfig", back_populates="histories")


class ConfigTemplate(Base):
    __tablename__ = "config_templates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(100))  # 'writing-style' | 'content-type' | 'workflow'
    template_content = Column(Text, nullable=False)
    is_system = Column(Boolean, default=False)
    usage_count = Column(Integer, default=0)
    created_by = Column(String(36), ForeignKey("User.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Relationships
    creator = relationship("User")


class AgentMusesConfig(Base):
    __tablename__ = "agent_muses_configs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id = Column(String(36), ForeignKey("Agent.id"), nullable=False)
    muses_config_id = Column(String(36), ForeignKey("muses_configs.id"), nullable=False)
    priority = Column(Integer, default=0)  # 数字越大优先级越高
    is_inherited = Column(Boolean, default=True)  # 是否继承全局配置
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    agent = relationship("Agent", back_populates="muses_configs")
    muses_config = relationship("MusesConfig", back_populates="agent_configs")
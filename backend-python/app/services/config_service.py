from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime

from ..models.muses_config import MusesConfig, ConfigHistory, ConfigTemplate, AgentMusesConfig
from ..schemas.muses_config import (
    MusesConfigCreate, MusesConfigUpdate,
    ConfigHistoryCreate, ConfigTemplateCreate, ConfigTemplateUpdate
)


class ConfigService:
    @staticmethod
    def create_config(db: Session, user_id: str, config: MusesConfigCreate) -> MusesConfig:
        """创建新的MUSES配置"""
        # 如果设置为默认，先将其他配置的默认状态取消
        if config.is_default:
            db.query(MusesConfig).filter(
                MusesConfig.user_id == user_id,
                MusesConfig.is_default == True
            ).update({"is_default": False})

        # 如果设置为活跃，先将其他配置的活跃状态取消
        if config.is_active:
            db.query(MusesConfig).filter(
                MusesConfig.user_id == user_id,
                MusesConfig.is_active == True
            ).update({"is_active": False})

        db_config = MusesConfig(
            id=str(uuid.uuid4()),
            user_id=user_id,
            **config.dict()
        )
        db.add(db_config)

        # 创建初始版本历史
        initial_history = ConfigHistory(
            id=str(uuid.uuid4()),
            config_id=db_config.id,
            content=config.content,
            change_description="Initial version",
            version_number=1
        )
        db.add(initial_history)

        db.commit()
        db.refresh(db_config)
        return db_config

    @staticmethod
    def get_user_configs(db: Session, user_id: str) -> List[MusesConfig]:
        """获取用户的所有配置"""
        return db.query(MusesConfig).filter(
            MusesConfig.user_id == user_id
        ).order_by(MusesConfig.created_at.desc()).all()

    @staticmethod
    def get_config(db: Session, config_id: str, user_id: str) -> Optional[MusesConfig]:
        """获取特定配置"""
        return db.query(MusesConfig).filter(
            MusesConfig.id == config_id,
            MusesConfig.user_id == user_id
        ).first()

    @staticmethod
    def update_config(db: Session, config_id: str, user_id: str, config_update: MusesConfigUpdate) -> Optional[MusesConfig]:
        """更新配置"""
        db_config = db.query(MusesConfig).filter(
            MusesConfig.id == config_id,
            MusesConfig.user_id == user_id
        ).first()

        if not db_config:
            return None

        # 如果内容有变化，创建新的版本历史
        if config_update.content and config_update.content != db_config.content:
            # 获取最新版本号
            latest_history = db.query(ConfigHistory).filter(
                ConfigHistory.config_id == config_id
            ).order_by(ConfigHistory.version_number.desc()).first()

            new_version_number = (latest_history.version_number + 1) if latest_history else 1

            new_history = ConfigHistory(
                id=str(uuid.uuid4()),
                config_id=config_id,
                content=db_config.content,  # 保存旧内容
                change_description=f"Version {new_version_number}",
                version_number=new_version_number
            )
            db.add(new_history)

        # 处理默认和活跃状态
        if config_update.is_default is True:
            db.query(MusesConfig).filter(
                MusesConfig.user_id == user_id,
                MusesConfig.is_default == True,
                MusesConfig.id != config_id
            ).update({"is_default": False})

        if config_update.is_active is True:
            db.query(MusesConfig).filter(
                MusesConfig.user_id == user_id,
                MusesConfig.is_active == True,
                MusesConfig.id != config_id
            ).update({"is_active": False})

        # 更新配置
        for key, value in config_update.dict(exclude_unset=True).items():
            setattr(db_config, key, value)

        db_config.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_config)
        return db_config

    @staticmethod
    def delete_config(db: Session, config_id: str, user_id: str) -> bool:
        """删除配置"""
        db_config = db.query(MusesConfig).filter(
            MusesConfig.id == config_id,
            MusesConfig.user_id == user_id
        ).first()

        if not db_config:
            return False

        db.delete(db_config)
        db.commit()
        return True

    @staticmethod
    def activate_config(db: Session, config_id: str, user_id: str) -> Optional[MusesConfig]:
        """激活配置"""
        # 先取消其他配置的激活状态
        db.query(MusesConfig).filter(
            MusesConfig.user_id == user_id,
            MusesConfig.is_active == True
        ).update({"is_active": False})

        # 激活指定配置
        db_config = db.query(MusesConfig).filter(
            MusesConfig.id == config_id,
            MusesConfig.user_id == user_id
        ).first()

        if not db_config:
            return None

        db_config.is_active = True
        db.commit()
        db.refresh(db_config)
        return db_config

    @staticmethod
    def get_active_config(db: Session, user_id: str) -> Optional[MusesConfig]:
        """获取用户当前活跃配置"""
        return db.query(MusesConfig).filter(
            MusesConfig.user_id == user_id,
            MusesConfig.is_active == True
        ).first()

    @staticmethod
    def get_config_history(db: Session, config_id: str, user_id: str) -> List[ConfigHistory]:
        """获取配置的历史版本"""
        # 验证配置属于该用户
        config = db.query(MusesConfig).filter(
            MusesConfig.id == config_id,
            MusesConfig.user_id == user_id
        ).first()

        if not config:
            return []

        return db.query(ConfigHistory).filter(
            ConfigHistory.config_id == config_id
        ).order_by(ConfigHistory.version_number.desc()).all()

    @staticmethod
    def revert_config(db: Session, config_id: str, version_number: int, user_id: str) -> Optional[MusesConfig]:
        """回滚配置到指定版本"""
        # 验证配置属于该用户
        db_config = db.query(MusesConfig).filter(
            MusesConfig.id == config_id,
            MusesConfig.user_id == user_id
        ).first()

        if not db_config:
            return None

        # 获取指定版本的历史
        history = db.query(ConfigHistory).filter(
            ConfigHistory.config_id == config_id,
            ConfigHistory.version_number == version_number
        ).first()

        if not history:
            return None

        # 保存当前版本到历史
        latest_history = db.query(ConfigHistory).filter(
            ConfigHistory.config_id == config_id
        ).order_by(ConfigHistory.version_number.desc()).first()

        new_version_number = (latest_history.version_number + 1) if latest_history else 1

        current_history = ConfigHistory(
            id=str(uuid.uuid4()),
            config_id=config_id,
            content=db_config.content,
            change_description=f"Before revert to version {version_number}",
            version_number=new_version_number
        )
        db.add(current_history)

        # 恢复到指定版本
        db_config.content = history.content
        db_config.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(db_config)
        return db_config


class TemplateService:
    @staticmethod
    def get_templates(db: Session, category: Optional[str] = None) -> List[ConfigTemplate]:
        """获取模板列表"""
        query = db.query(ConfigTemplate)

        if category:
            query = query.filter(ConfigTemplate.category == category)

        return query.order_by(
            ConfigTemplate.is_system.desc(),
            ConfigTemplate.usage_count.desc()
        ).all()

    @staticmethod
    def create_template(db: Session, template: ConfigTemplateCreate, user_id: Optional[str] = None) -> ConfigTemplate:
        """创建模板"""
        db_template = ConfigTemplate(
            id=str(uuid.uuid4()),
            created_by=user_id,
            **template.dict()
        )
        db.add(db_template)
        db.commit()
        db.refresh(db_template)
        return db_template

    @staticmethod
    def use_template(db: Session, template_id: str) -> Optional[ConfigTemplate]:
        """使用模板（增加使用次数）"""
        db_template = db.query(ConfigTemplate).filter(
            ConfigTemplate.id == template_id
        ).first()

        if db_template:
            db_template.usage_count += 1
            db.commit()
            db.refresh(db_template)

        return db_template
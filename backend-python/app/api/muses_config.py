from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..dependencies import get_current_user
from ..models.user import User
from ..services.config_service import ConfigService, TemplateService
from ..schemas.muses_config import (
    MusesConfigCreate, MusesConfigUpdate, MusesConfigInDB,
    MusesConfigWithHistory, ConfigHistoryInDB, MusesConfigActivate,
    ConfigTemplateInDB, ConfigTemplateCreate
)

router = APIRouter()


@router.get("/muses-configs", response_model=List[MusesConfigInDB])
async def get_user_configs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取用户的所有MUSES配置"""
    configs = ConfigService.get_user_configs(db, current_user.id)
    return configs


@router.get("/muses-configs/active", response_model=Optional[MusesConfigInDB])
async def get_active_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取用户当前活跃的配置"""
    config = ConfigService.get_active_config(db, current_user.id)
    return config


@router.get("/muses-configs/{config_id}", response_model=MusesConfigInDB)
async def get_config(
    config_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取特定配置"""
    config = ConfigService.get_config(db, config_id, current_user.id)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Config not found"
        )
    return config


@router.post("/muses-configs", response_model=MusesConfigInDB)
async def create_config(
    config: MusesConfigCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建新的MUSES配置"""
    db_config = ConfigService.create_config(db, current_user.id, config)
    return db_config


@router.put("/muses-configs/{config_id}", response_model=MusesConfigInDB)
async def update_config(
    config_id: str,
    config_update: MusesConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新配置"""
    db_config = ConfigService.update_config(db, config_id, current_user.id, config_update)
    if not db_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Config not found"
        )
    return db_config


@router.delete("/muses-configs/{config_id}")
async def delete_config(
    config_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除配置"""
    success = ConfigService.delete_config(db, config_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Config not found"
        )
    return {"message": "Config deleted successfully"}


@router.post("/muses-configs/{config_id}/activate", response_model=MusesConfigInDB)
async def activate_config(
    config_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """激活配置"""
    db_config = ConfigService.activate_config(db, config_id, current_user.id)
    if not db_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Config not found"
        )
    return db_config


@router.get("/muses-configs/{config_id}/history", response_model=List[ConfigHistoryInDB])
async def get_config_history(
    config_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取配置的历史版本"""
    histories = ConfigService.get_config_history(db, config_id, current_user.id)
    return histories


@router.post("/muses-configs/{config_id}/revert/{version_number}", response_model=MusesConfigInDB)
async def revert_config(
    config_id: str,
    version_number: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """回滚配置到指定版本"""
    db_config = ConfigService.revert_config(db, config_id, version_number, current_user.id)
    if not db_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Config or version not found"
        )
    return db_config


# 模板相关端点
@router.get("/config-templates", response_model=List[ConfigTemplateInDB])
async def get_templates(
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取配置模板列表"""
    templates = TemplateService.get_templates(db, category)
    return templates


@router.post("/config-templates", response_model=ConfigTemplateInDB)
async def create_template(
    template: ConfigTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建配置模板"""
    db_template = TemplateService.create_template(db, template, current_user.id)
    return db_template


@router.post("/config-templates/{template_id}/use", response_model=ConfigTemplateInDB)
async def use_template(
    template_id: str,
    db: Session = Depends(get_db)
):
    """使用模板（增加使用次数）"""
    db_template = TemplateService.use_template(db, template_id)
    if not db_template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    return db_template
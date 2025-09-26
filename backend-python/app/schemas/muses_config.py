from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class MusesConfigBase(BaseModel):
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    content: str
    config_type: str = Field(default="user", pattern="^(user|agent|template)$")
    is_active: bool = False
    is_default: bool = False
    parent_config_id: Optional[str] = None


class MusesConfigCreate(MusesConfigBase):
    pass


class MusesConfigUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    content: Optional[str] = None
    config_type: Optional[str] = Field(None, pattern="^(user|agent|template)$")
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    parent_config_id: Optional[str] = None


class MusesConfigInDB(MusesConfigBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConfigHistoryBase(BaseModel):
    content: str
    change_description: Optional[str] = None
    version_number: int


class ConfigHistoryCreate(ConfigHistoryBase):
    config_id: str


class ConfigHistoryInDB(ConfigHistoryBase):
    id: str
    config_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class ConfigTemplateBase(BaseModel):
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    template_content: str
    is_system: bool = False


class ConfigTemplateCreate(ConfigTemplateBase):
    pass


class ConfigTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    template_content: Optional[str] = None


class ConfigTemplateInDB(ConfigTemplateBase):
    id: str
    usage_count: int = 0
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AgentMusesConfigBase(BaseModel):
    agent_id: str
    muses_config_id: str
    priority: int = 0
    is_inherited: bool = True


class AgentMusesConfigCreate(AgentMusesConfigBase):
    pass


class AgentMusesConfigInDB(AgentMusesConfigBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class MusesConfigWithHistory(MusesConfigInDB):
    histories: List[ConfigHistoryInDB] = []


class MusesConfigActivate(BaseModel):
    config_id: str
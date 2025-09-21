from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    username: str
    email: Optional[str] = None
    avatarUrl: Optional[str] = None


class UserCreate(UserBase):
    githubId: str


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    avatarUrl: Optional[str] = None
    defaultRepoUrl: Optional[str] = None


class UserSettingsBase(BaseModel):
    language: str = "zh-CN"
    theme: str = "light"
    autoSave: bool = True


class UserSettingsCreate(UserSettingsBase):
    pass


class UserSettingsUpdate(BaseModel):
    language: Optional[str] = None
    theme: Optional[str] = None
    autoSave: Optional[bool] = None


class UserSettings(UserSettingsBase):
    id: str
    userId: str
    createdAt: datetime
    updatedAt: datetime
    
    class Config:
        from_attributes = True


class User(UserBase):
    id: str
    githubId: str
    hasOpenAIKey: bool = False
    hasClaudeKey: bool = False
    hasGeminiKey: bool = False
    hasGitHubToken: bool = False
    defaultRepoUrl: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime
    settings: Optional[UserSettings] = None
    
    class Config:
        from_attributes = True


class UserProfile(User):
    """用户详细信息，包含设置"""
    pass


class UserSettingsRequest(BaseModel):
    """用户设置更新请求"""
    openaiKey: Optional[str] = None
    claudeKey: Optional[str] = None
    geminiKey: Optional[str] = None
    githubToken: Optional[str] = None
    defaultRepoUrl: Optional[str] = None
    language: Optional[str] = None
    theme: Optional[str] = None


class VerifyOpenAIKeyRequest(BaseModel):
    """验证OpenAI Key请求"""
    openaiKey: str


class VerifyOpenAIKeyResponse(BaseModel):
    """验证OpenAI Key响应"""
    valid: bool


class VerifyClaudeKeyRequest(BaseModel):
    """验证Claude Key请求"""
    claudeKey: str


class VerifyClaudeKeyResponse(BaseModel):
    """验证Claude Key响应"""
    valid: bool


class VerifyGeminiKeyRequest(BaseModel):
    """验证Gemini Key请求"""
    geminiKey: str


class VerifyGeminiKeyResponse(BaseModel):
    """验证Gemini Key响应"""
    valid: bool


class GetApiKeyRequest(BaseModel):
    """获取API Key请求"""
    keyType: str  # "openai", "claude", "gemini", "github"


class GetApiKeyResponse(BaseModel):
    """获取API Key响应"""
    key: str
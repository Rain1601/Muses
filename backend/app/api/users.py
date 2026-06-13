from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import openai

from ..database import get_db
from ..models import User, UserSettings
from ..schemas.user import (
    UserProfile, UserSettingsRequest,
    UserSettings as UserSettingsSchema,
    GetApiKeyRequest, GetApiKeyResponse
)
from ..schemas.auth import SuccessResponse
from ..dependencies import get_current_user, get_current_user_db
from ..utils.security import encrypt, decrypt
from ..utils.exceptions import HTTPValidationError

router = APIRouter()

# 聚合 API provider base URLs
PROVIDER_BASE_URLS = {
    "aihubmix": "https://aihubmix.com/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "bailian": "https://dashscope.aliyuncs.com/compatible-mode/v1",
}


@router.get("/profile", response_model=UserProfile)
async def get_user_profile(
    current_user_db: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """获取用户详细信息"""
    settings = db.query(UserSettings).filter(
        UserSettings.userId == current_user_db.id
    ).first()

    user_data = {
        "id": current_user_db.id,
        "githubId": current_user_db.githubId,
        "username": current_user_db.username,
        "email": current_user_db.email,
        "avatarUrl": current_user_db.avatarUrl,
        "hasAihubmixKey": bool(current_user_db.aihubmixKey),
        "hasOpenrouterKey": bool(current_user_db.openrouterKey),
        "hasBailianKey": bool(current_user_db.bailianKey),
        "hasOpenAIKey": bool(current_user_db.openaiKey),
        "hasClaudeKey": bool(current_user_db.claudeKey),
        "hasGeminiKey": bool(current_user_db.geminiKey),
        "hasGitHubToken": bool(current_user_db.githubToken),
        "defaultRepoUrl": current_user_db.defaultRepoUrl,
        "createdAt": current_user_db.createdAt,
        "updatedAt": current_user_db.updatedAt,
    }

    if settings:
        user_data["settings"] = UserSettingsSchema(
            id=settings.id,
            userId=settings.userId,
            language=settings.language,
            theme=settings.theme,
            autoSave=settings.autoSave,
            createdAt=settings.createdAt,
            updatedAt=settings.updatedAt
        )

    return UserProfile(**user_data)


@router.post("/settings", response_model=SuccessResponse)
async def update_user_settings(
    request: UserSettingsRequest,
    current_user_db: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """更新用户设置"""
    try:
        if request.defaultRepoUrl is not None:
            current_user_db.defaultRepoUrl = request.defaultRepoUrl

        # 加密存储各 API key
        key_fields = [
            ("aihubmixKey", request.aihubmixKey),
            ("openrouterKey", request.openrouterKey),
            ("bailianKey", request.bailianKey),
            ("openaiKey", request.openaiKey),
            ("claudeKey", request.claudeKey),
            ("geminiKey", request.geminiKey),
            ("githubToken", request.githubToken),
        ]
        for field_name, value in key_fields:
            if value is not None:
                if value.strip():
                    setattr(current_user_db, field_name, encrypt(value.strip()))
                else:
                    setattr(current_user_db, field_name, None)

        # 更新用户偏好设置
        settings = db.query(UserSettings).filter(
            UserSettings.userId == current_user_db.id
        ).first()

        if not settings:
            settings = UserSettings(
                userId=current_user_db.id,
                language=request.language or "zh-CN",
                theme=request.theme or "light"
            )
            db.add(settings)
        else:
            if request.language is not None:
                settings.language = request.language
            if request.theme is not None:
                settings.theme = request.theme

        db.commit()
        return SuccessResponse()

    except Exception as e:
        db.rollback()
        raise HTTPValidationError(f"Failed to update settings: {str(e)}")


@router.post("/verify-api-key")
async def verify_api_key(provider: str, key: str):
    """验证聚合 API Key（通过 OpenAI 兼容接口 list models）"""
    base_url = PROVIDER_BASE_URLS.get(provider)
    if not base_url:
        return {"valid": False, "error": f"Unknown provider: {provider}"}

    try:
        client = openai.OpenAI(api_key=key, base_url=base_url)
        client.models.list()
        return {"valid": True}
    except Exception as e:
        return {"valid": False, "error": str(e)}


@router.post("/get-api-key", response_model=GetApiKeyResponse)
async def get_api_key(
    request: GetApiKeyRequest,
    current_user_db: User = Depends(get_current_user_db)
):
    """获取用户的API Key（解密后返回）"""
    key_mapping = {
        "aihubmix": current_user_db.aihubmixKey,
        "openrouter": current_user_db.openrouterKey,
        "bailian": current_user_db.bailianKey,
        "openai": current_user_db.openaiKey,
        "claude": current_user_db.claudeKey,
        "gemini": current_user_db.geminiKey,
        "github": current_user_db.githubToken,
    }

    encrypted_key = key_mapping.get(request.keyType)
    if not encrypted_key:
        raise HTTPValidationError(f"No {request.keyType} key found for user")

    decrypted_key = decrypt(encrypted_key)
    return GetApiKeyResponse(key=decrypted_key)

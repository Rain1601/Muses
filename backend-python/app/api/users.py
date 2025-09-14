from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import openai

from ..database import get_db
from ..models import User, UserSettings
from ..schemas.user import (
    UserProfile, UserSettingsRequest, VerifyOpenAIKeyRequest, 
    VerifyOpenAIKeyResponse, UserSettings as UserSettingsSchema
)
from ..schemas.auth import SuccessResponse
from ..dependencies import get_current_user, get_current_user_db
from ..utils.security import encrypt, decrypt
from ..utils.exceptions import HTTPValidationError

router = APIRouter()


@router.get("/profile", response_model=UserProfile)
async def get_user_profile(
    current_user_db: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """获取用户详细信息"""
    
    # 获取用户设置
    settings = db.query(UserSettings).filter(
        UserSettings.userId == current_user_db.id
    ).first()
    
    # 构建响应
    user_data = {
        "id": current_user_db.id,
        "githubId": current_user_db.githubId,
        "username": current_user_db.username,
        "email": current_user_db.email,
        "avatarUrl": current_user_db.avatarUrl,
        "hasOpenAIKey": bool(current_user_db.openaiKey),
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
        # 更新用户基本信息
        if request.defaultRepoUrl is not None:
            current_user_db.defaultRepoUrl = request.defaultRepoUrl
        
        if request.openaiKey is not None:
            if request.openaiKey.strip():
                # 加密存储OpenAI Key
                encrypted_key = encrypt(request.openaiKey.strip())
                current_user_db.openaiKey = encrypted_key
            else:
                # 清除OpenAI Key
                current_user_db.openaiKey = None

        if request.githubToken is not None:
            if request.githubToken.strip():
                # 加密存储GitHub Token
                encrypted_token = encrypt(request.githubToken.strip())
                current_user_db.githubToken = encrypted_token
            else:
                # 清除GitHub Token
                current_user_db.githubToken = None
        
        # 更新用户设置
        settings = db.query(UserSettings).filter(
            UserSettings.userId == current_user_db.id
        ).first()
        
        if not settings:
            # 创建新的用户设置
            settings = UserSettings(
                userId=current_user_db.id,
                language=request.language or "zh-CN",
                theme=request.theme or "light"
            )
            db.add(settings)
        else:
            # 更新现有设置
            if request.language is not None:
                settings.language = request.language
            if request.theme is not None:
                settings.theme = request.theme
        
        db.commit()
        return SuccessResponse()
        
    except Exception as e:
        db.rollback()
        raise HTTPValidationError(f"Failed to update settings: {str(e)}")


@router.post("/verify-openai-key", response_model=VerifyOpenAIKeyResponse)
async def verify_openai_key(request: VerifyOpenAIKeyRequest):
    """验证OpenAI API Key"""
    
    try:
        # 创建OpenAI客户端测试连接
        client = openai.OpenAI(api_key=request.openaiKey)
        
        # 尝试调用API (使用最小的请求)
        response = client.models.list()
        
        return VerifyOpenAIKeyResponse(valid=True)
        
    except Exception as e:
        return VerifyOpenAIKeyResponse(valid=False)
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .database import get_db
from .services.auth_service import AuthService
from .models import User
from .schemas.user import User as UserSchema
from .utils.exceptions import HTTPAuthenticationError

# HTTP Bearer token安全scheme
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> UserSchema:
    """获取当前认证用户"""
    
    token = credentials.credentials
    user = AuthService.verify_user_token(token, db)
    
    if not user:
        raise HTTPAuthenticationError("Invalid authentication credentials")
    
    # 检查用户是否有OpenAI Key
    has_openai_key = bool(user.openaiKey)
    
    # 转换为Pydantic模型
    user_data = {
        "id": user.id,
        "githubId": user.githubId,
        "username": user.username,
        "email": user.email,
        "avatarUrl": user.avatarUrl,
        "hasOpenAIKey": has_openai_key,
        "defaultRepoUrl": user.defaultRepoUrl,
        "createdAt": user.createdAt,
        "updatedAt": user.updatedAt,
    }
    
    return UserSchema(**user_data)


def get_current_user_db(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """获取当前认证用户（数据库模型）"""
    
    token = credentials.credentials
    user = AuthService.verify_user_token(token, db)
    
    if not user:
        raise HTTPAuthenticationError("Invalid authentication credentials")
    
    return user
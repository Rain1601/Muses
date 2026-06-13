from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.auth_service import AuthService
from ..schemas.auth import AuthResponse, SuccessResponse
from ..schemas.user import User as UserSchema
from ..config import settings
from ..utils.exceptions import HTTPAuthenticationError
from ..dependencies import get_current_user

router = APIRouter()


@router.get("/github")
async def github_login():
    """开始GitHub OAuth登录流程"""
    redirect_uri = f"{settings.backend_url}/api/auth/github/callback"
    github_auth_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={settings.github_client_id}"
        f"&scope=user:email,repo"
        f"&redirect_uri={redirect_uri}"
    )
    return RedirectResponse(url=github_auth_url)


@router.get("/github/callback")
async def github_callback(
    code: str = Query(..., description="GitHub OAuth authorization code"),
    db: Session = Depends(get_db)
):
    """处理GitHub OAuth回调"""
    try:
        user, jwt_token, is_new_user = await AuthService.github_oauth_callback(code, db)
        
        # 根据是否新用户重定向到不同页面
        redirect_path = "/onboarding" if is_new_user else "/dashboard"
        redirect_url = f"{settings.frontend_url}{redirect_path}?token={jwt_token}"
        
        return RedirectResponse(url=redirect_url)
        
    except ValueError as e:
        print(f"ValueError in GitHub callback: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Exception in GitHub callback: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"GitHub authentication failed: {str(e)}")


@router.get("/google")
async def google_login():
    """开始Google OAuth登录流程"""
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")
    redirect_uri = f"{settings.backend_url}/api/auth/google/callback"
    google_auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={settings.google_client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope=openid+email+profile"
        f"&access_type=offline"
    )
    return RedirectResponse(url=google_auth_url)


@router.get("/google/callback")
async def google_callback(
    code: str = Query(..., description="Google OAuth authorization code"),
    db: Session = Depends(get_db)
):
    """处理Google OAuth回调"""
    try:
        user, jwt_token, is_new_user = await AuthService.google_oauth_callback(code, db)
        redirect_path = "/onboarding" if is_new_user else "/dashboard"
        redirect_url = f"{settings.frontend_url}{redirect_path}?token={jwt_token}"
        return RedirectResponse(url=redirect_url)
    except ValueError as e:
        print(f"ValueError in Google callback: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Exception in Google callback: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Google authentication failed: {str(e)}")


@router.get("/verify", response_model=AuthResponse)
async def verify_token(current_user: UserSchema = Depends(get_current_user)):
    """验证JWT token"""
    return AuthResponse(user=current_user)


@router.post("/logout", response_model=SuccessResponse)
async def logout():
    """登出（前端处理token清除）"""
    return SuccessResponse()
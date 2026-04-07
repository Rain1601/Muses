import httpx
from sqlalchemy.orm import Session
from typing import Optional

from ..models import User, UserSettings
from ..schemas import UserCreate
from ..utils.security import create_access_token, encrypt
from ..config import settings


class AuthService:
    
    @staticmethod
    async def github_oauth_callback(code: str, db: Session) -> tuple[User, str]:
        """处理GitHub OAuth回调"""
        
        # 1. 用code换取access_token
        token_data = {
            "client_id": settings.github_client_id,
            "client_secret": settings.github_client_secret,
            "code": code,
        }
        
        async with httpx.AsyncClient() as client:
            # 获取GitHub access token
            token_response = await client.post(
                "https://github.com/login/oauth/access_token",
                data=token_data,
                headers={"Accept": "application/json"}
            )
            
            if token_response.status_code != 200:
                raise ValueError(f"Failed to get GitHub access token: {token_response.text}")
            
            token_info = token_response.json()
            access_token = token_info.get("access_token")
            
            if not access_token:
                raise ValueError(f"No access token received from GitHub. Response: {token_info}")
            
            # 获取用户信息
            user_response = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if user_response.status_code != 200:
                raise ValueError(f"Failed to get user info from GitHub: {user_response.text}")
            
            github_user = user_response.json()
        
        # 2. 创建或更新用户
        try:
            github_id = str(github_user["id"])
            user = db.query(User).filter(User.githubId == github_id).first()
            
            is_new_user = False
            if not user:
                is_new_user = True
                user_data = UserCreate(
                    githubId=github_id,
                    username=github_user["login"],
                    email=github_user.get("email"),
                    avatarUrl=github_user.get("avatar_url")
                )
                user = User(**user_data.dict())
                db.add(user)
                db.flush()  # 获取用户ID
                
                # 创建默认用户设置
                user_settings = UserSettings(userId=user.id)
                db.add(user_settings)
                
            else:
                # 更新现有用户信息
                user.username = github_user["login"]
                user.email = github_user.get("email")
                user.avatarUrl = github_user.get("avatar_url")
            
            # 3. 保存加密的GitHub token
            encrypted_token = encrypt(access_token)
            user.githubToken = encrypted_token
            
            db.commit()
            db.refresh(user)
            
            # 4. 生成JWT token
            jwt_token = create_access_token({"user_id": user.id})
            
            return user, jwt_token, is_new_user
            
        except Exception as e:
            db.rollback()
            raise ValueError(f"Database operation failed: {str(e)}")
    
    @staticmethod
    async def google_oauth_callback(code: str, db: Session) -> tuple[User, str, bool]:
        """处理Google OAuth回调"""
        redirect_uri = f"{settings.backend_url}/api/auth/google/callback"

        async with httpx.AsyncClient() as client:
            # 1. 用 code 换取 access_token
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                },
                headers={"Accept": "application/json"},
            )
            if token_response.status_code != 200:
                raise ValueError(f"Failed to get Google access token: {token_response.text}")

            token_info = token_response.json()
            access_token = token_info.get("access_token")
            if not access_token:
                raise ValueError(f"No access token from Google: {token_info}")

            # 2. 获取用户信息
            user_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if user_response.status_code != 200:
                raise ValueError(f"Failed to get Google user info: {user_response.text}")

            google_user = user_response.json()

        # 3. 创建或更新用户
        try:
            google_id = str(google_user["id"])
            user = db.query(User).filter(User.googleId == google_id).first()

            is_new_user = False
            if not user:
                # 检查是否有同 email 的 GitHub 用户（账号合并）
                email = google_user.get("email")
                if email:
                    user = db.query(User).filter(User.email == email).first()
                    if user:
                        user.googleId = google_id
                        user.avatarUrl = user.avatarUrl or google_user.get("picture")
                        db.commit()
                        db.refresh(user)
                        jwt_token = create_access_token({"user_id": user.id})
                        return user, jwt_token, False

                is_new_user = True
                user_data = UserCreate(
                    googleId=google_id,
                    username=google_user.get("name", google_user.get("email", "user")),
                    email=google_user.get("email"),
                    avatarUrl=google_user.get("picture"),
                )
                user = User(**user_data.dict())
                db.add(user)
                db.flush()

                user_settings = UserSettings(userId=user.id)
                db.add(user_settings)
            else:
                user.username = google_user.get("name", user.username)
                user.email = google_user.get("email")
                user.avatarUrl = google_user.get("picture")

            db.commit()
            db.refresh(user)

            jwt_token = create_access_token({"user_id": user.id})
            return user, jwt_token, is_new_user

        except Exception as e:
            db.rollback()
            raise ValueError(f"Database operation failed: {str(e)}")

    @staticmethod
    def verify_user_token(token: str, db: Session) -> Optional[User]:
        """验证JWT token并返回用户"""
        try:
            from ..utils.security import verify_token
            payload = verify_token(token)
            user_id = payload.get("user_id")
            
            if not user_id:
                return None
            
            user = db.query(User).filter(User.id == user_id).first()
            return user
            
        except ValueError:
            return None
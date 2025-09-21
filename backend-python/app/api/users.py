from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import openai
import anthropic
import google.generativeai as genai

from ..database import get_db
from ..models import User, UserSettings
from ..schemas.user import (
    UserProfile, UserSettingsRequest, VerifyOpenAIKeyRequest,
    VerifyOpenAIKeyResponse, VerifyClaudeKeyRequest, VerifyClaudeKeyResponse,
    VerifyGeminiKeyRequest, VerifyGeminiKeyResponse, UserSettings as UserSettingsSchema,
    GetApiKeyRequest, GetApiKeyResponse
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
    print(f"🔍 [PROFILE] User {current_user_db.id} profile request - checking saved keys:")
    print(f"   openaiKey exists: {bool(current_user_db.openaiKey)} (length: {len(current_user_db.openaiKey) if current_user_db.openaiKey else 0})")
    print(f"   claudeKey exists: {bool(current_user_db.claudeKey)} (length: {len(current_user_db.claudeKey) if current_user_db.claudeKey else 0})")
    print(f"   geminiKey exists: {bool(current_user_db.geminiKey)} (length: {len(current_user_db.geminiKey) if current_user_db.geminiKey else 0})")
    print(f"   githubToken exists: {bool(current_user_db.githubToken)} (length: {len(current_user_db.githubToken) if current_user_db.githubToken else 0})")

    user_data = {
        "id": current_user_db.id,
        "githubId": current_user_db.githubId,
        "username": current_user_db.username,
        "email": current_user_db.email,
        "avatarUrl": current_user_db.avatarUrl,
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

    # 🚨 DEBUG: Log exactly what we're returning
    print(f"📤 [PROFILE RESPONSE] User {current_user_db.id} response data:")
    print(f"   hasOpenAIKey: {user_data['hasOpenAIKey']}")
    print(f"   hasClaudeKey: {user_data['hasClaudeKey']}")
    print(f"   hasGeminiKey: {user_data['hasGeminiKey']}")
    print(f"   hasGitHubToken: {user_data['hasGitHubToken']}")
    print(f"   defaultRepoUrl: {user_data['defaultRepoUrl']}")

    response = UserProfile(**user_data)
    print(f"📦 [FINAL RESPONSE] UserProfile object created successfully")
    return response


@router.post("/settings", response_model=SuccessResponse)
async def update_user_settings(
    request: UserSettingsRequest,
    current_user_db: User = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """更新用户设置"""

    try:
        print(f"🔧 Updating settings for user {current_user_db.id}")
        print(f"📥 [SETTINGS] Raw request data received:")
        print(f"   openaiKey: {request.openaiKey if request.openaiKey else 'None'}")
        print(f"   claudeKey: {request.claudeKey if request.claudeKey else 'None'}")
        print(f"   geminiKey: {request.geminiKey if request.geminiKey else 'None'}")
        print(f"   githubToken: {request.githubToken if request.githubToken else 'None'}")
        print(f"   defaultRepoUrl: {request.defaultRepoUrl if request.defaultRepoUrl else 'None'}")

        # 检查前端发送的 key 类型
        if request.openaiKey:
            if request.openaiKey.startswith('sk-'):
                print(f"✅ [OPENAI] Valid OpenAI key format detected")
            elif request.openaiKey.startswith('ghp_') or request.openaiKey.startswith('gho_'):
                print(f"🚨 [ERROR] GitHub token detected in OpenAI field: {request.openaiKey}")
            elif request.openaiKey == "••••••••":
                print(f"🔄 [OPENAI] Placeholder detected, ignoring update")
            else:
                print(f"⚠️ [OPENAI] Unknown key format: {request.openaiKey[:10]}...")

        if request.githubToken:
            if request.githubToken.startswith('ghp_') or request.githubToken.startswith('gho_'):
                print(f"✅ [GITHUB] Valid GitHub token format detected")
            elif request.githubToken.startswith('sk-'):
                print(f"🚨 [ERROR] OpenAI key detected in GitHub field: {request.githubToken}")
            elif request.githubToken == "••••••••":
                print(f"🔄 [GITHUB] Placeholder detected, ignoring update")
            else:
                print(f"⚠️ [GITHUB] Unknown token format: {request.githubToken[:10]}...")
        # 更新用户基本信息
        if request.defaultRepoUrl is not None:
            current_user_db.defaultRepoUrl = request.defaultRepoUrl
        
        if request.openaiKey is not None:
            if request.openaiKey.strip():
                # 加密存储OpenAI Key
                encrypted_key = encrypt(request.openaiKey.strip())
                current_user_db.openaiKey = encrypted_key
                print(f"💾 Saved OpenAI key: {request.openaiKey.strip()[:8]}...{request.openaiKey.strip()[-4:]} -> encrypted length: {len(encrypted_key)}")
            else:
                # 清除OpenAI Key
                current_user_db.openaiKey = None
                print(f"🗑️ Cleared OpenAI key")

        if request.claudeKey is not None:
            if request.claudeKey.strip():
                # 加密存储Claude Key
                encrypted_key = encrypt(request.claudeKey.strip())
                current_user_db.claudeKey = encrypted_key
            else:
                # 清除Claude Key
                current_user_db.claudeKey = None

        if request.geminiKey is not None:
            if request.geminiKey.strip():
                # 加密存储Gemini Key
                encrypted_key = encrypt(request.geminiKey.strip())
                current_user_db.geminiKey = encrypted_key
            else:
                # 清除Gemini Key
                current_user_db.geminiKey = None

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
        # 记录接收到的密钥（脱敏显示）
        masked_key = f"{request.openaiKey[:8]}{'*' * 40}{request.openaiKey[-4:]}" if len(request.openaiKey) > 12 else "***"
        print(f"Verifying OpenAI key: {masked_key}")

        # 创建OpenAI客户端测试连接
        client = openai.OpenAI(api_key=request.openaiKey)

        # 尝试调用API (使用最小的请求)
        response = client.models.list()

        print(f"OpenAI key verification successful: {masked_key}")
        return VerifyOpenAIKeyResponse(valid=True)

    except Exception as e:
        # 记录错误信息到日志
        print(f"OpenAI key verification failed: {str(e)}")
        return VerifyOpenAIKeyResponse(valid=False)


@router.post("/verify-claude-key", response_model=VerifyClaudeKeyResponse)
async def verify_claude_key(request: VerifyClaudeKeyRequest):
    """验证Claude API Key"""

    try:
        # 创建Anthropic客户端测试连接
        client = anthropic.Anthropic(api_key=request.claudeKey)

        # 尝试调用API (使用最小的请求)
        response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=10,
            messages=[{"role": "user", "content": "test"}]
        )

        return VerifyClaudeKeyResponse(valid=True)

    except Exception as e:
        return VerifyClaudeKeyResponse(valid=False)


@router.post("/verify-gemini-key", response_model=VerifyGeminiKeyResponse)
async def verify_gemini_key(request: VerifyGeminiKeyRequest):
    """验证Gemini API Key"""

    try:
        # 配置Gemini客户端
        genai.configure(api_key=request.geminiKey)

        # 尝试调用API (使用最小的请求)
        model = genai.GenerativeModel('gemini-pro')
        response = model.generate_content("test", generation_config=genai.types.GenerationConfig(max_output_tokens=10))

        return VerifyGeminiKeyResponse(valid=True)

    except Exception as e:
        return VerifyGeminiKeyResponse(valid=False)


@router.post("/get-api-key", response_model=GetApiKeyResponse)
async def get_api_key(
    request: GetApiKeyRequest,
    current_user_db: User = Depends(get_current_user_db)
):
    """获取用户的API Key用于测试（解密后返回）"""

    try:
        print(f"🔍 [GET-API-KEY] Request for keyType: {request.keyType}")
        print(f"🔍 [GET-API-KEY] Current user DB fields:")
        print(f"   openaiKey exists: {bool(current_user_db.openaiKey)} (length: {len(current_user_db.openaiKey) if current_user_db.openaiKey else 0})")
        print(f"   claudeKey exists: {bool(current_user_db.claudeKey)} (length: {len(current_user_db.claudeKey) if current_user_db.claudeKey else 0})")
        print(f"   geminiKey exists: {bool(current_user_db.geminiKey)} (length: {len(current_user_db.geminiKey) if current_user_db.geminiKey else 0})")
        print(f"   githubToken exists: {bool(current_user_db.githubToken)} (length: {len(current_user_db.githubToken) if current_user_db.githubToken else 0})")

        key_mapping = {
            "openai": current_user_db.openaiKey,
            "claude": current_user_db.claudeKey,
            "gemini": current_user_db.geminiKey,
            "github": current_user_db.githubToken
        }

        encrypted_key = key_mapping.get(request.keyType)
        print(f"🔍 [GET-API-KEY] Looking up keyType '{request.keyType}' -> encrypted_key exists: {bool(encrypted_key)}")

        if not encrypted_key:
            raise HTTPValidationError(f"No {request.keyType} key found for user")

        # 解密API Key
        decrypted_key = decrypt(encrypted_key)
        print(f"🔑 [GET-API-KEY] Retrieved {request.keyType} key for testing:")
        print(f"   Decrypted key preview: {decrypted_key[:8]}...{decrypted_key[-4:]}")
        print(f"   Decrypted key starts with: {decrypted_key[:10]}")
        print(f"   Decrypted key length: {len(decrypted_key)}")

        # 🚨 CONTAMINATION CHECK: Verify key type matches expected format
        if request.keyType == "openai" and not decrypted_key.startswith("sk-"):
            print(f"🚨 [CONTAMINATION ALERT] OpenAI key does not start with 'sk-': {decrypted_key[:15]}")
        elif request.keyType == "github" and not (decrypted_key.startswith("ghp_") or decrypted_key.startswith("gho_")):
            print(f"🚨 [CONTAMINATION ALERT] GitHub token does not start with 'ghp_' or 'gho_': {decrypted_key[:15]}")

        return GetApiKeyResponse(key=decrypted_key)

    except Exception as e:
        print(f"❌ Failed to get {request.keyType} key: {str(e)}")
        raise HTTPValidationError(f"Failed to retrieve {request.keyType} key: {str(e)}")
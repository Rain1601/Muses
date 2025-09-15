from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import httpx
import base64
import logging
import uuid
from datetime import datetime

from ..dependencies import get_current_user_db
from ..models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

class ImageUploadRequest(BaseModel):
    base64Data: str
    filename: str = None
    contentType: str = "image/jpeg"

@router.post("/upload-image")
async def upload_image_to_github(request: ImageUploadRequest, current_user: User = Depends(get_current_user_db)):
    """上传图片到GitHub仓库作为图床"""
    try:
        logger.info(f"🖼️ Starting image upload for user: {current_user.username}")
        logger.info(f"📊 Request details - filename: {request.filename}, content_type: {request.contentType}")
        logger.info(f"📊 Base64 data length: {len(request.base64Data)} characters")

        # 获取用户的GitHub配置
        if not current_user.githubToken:
            logger.error("❌ No GitHub token found for user")
            raise HTTPException(status_code=400, detail="请先配置GitHub访问token")

        if not current_user.defaultRepoUrl:
            logger.error("❌ No default repo URL found for user")
            raise HTTPException(status_code=400, detail="请先配置默认仓库URL")

        logger.info(f"✅ User has GitHub token: {len(current_user.githubToken)} chars (encrypted)")
        logger.info(f"✅ User repo URL: {current_user.defaultRepoUrl}")

        # 从仓库URL中提取用户名和仓库名
        # https://github.com/Rain1601/rain.blog.repo -> Rain1601, rain.blog.repo
        repo_url = current_user.defaultRepoUrl
        if not repo_url.startswith('https://github.com/'):
            raise HTTPException(status_code=400, detail="无效的GitHub仓库URL")

        parts = repo_url.replace('https://github.com/', '').split('/')
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail="无效的GitHub仓库URL格式")

        username, repo_name = parts
        logger.info(f"🔍 Parsed repository - username: {username}, repo: {repo_name}")

        # 解密GitHub Token
        try:
            from ..utils.security import decrypt
            github_token = decrypt(current_user.githubToken)
            logger.info(f"🔑 Successfully decrypted GitHub token, length: {len(github_token)}")
        except Exception as e:
            logger.error(f"❌ Failed to decrypt GitHub token: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Token解密失败: {str(e)}")

        # 生成文件名
        if not request.filename:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_id = str(uuid.uuid4())[:8]
            ext = request.contentType.split('/')[-1]
            if ext not in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
                ext = 'jpg'
            request.filename = f"image_{timestamp}_{unique_id}.{ext}"

        # GitHub文件路径
        file_path = f"assets/images/{request.filename}"

        # GitHub API URL
        api_url = f"https://api.github.com/repos/{username}/{repo_name}/contents/{file_path}"
        logger.info(f"🌐 GitHub API URL: {api_url}")

        # 准备请求数据
        data = {
            "message": f"上传图片: {request.filename}",
            "content": request.base64Data,
            "branch": "main"
        }
        logger.info(f"📤 Request data prepared - message: {data['message']}, branch: {data['branch']}")
        logger.info(f"📤 Content length: {len(data['content'])} characters")

        headers = {
            "Authorization": f"token {github_token}",
            "Accept": "application/vnd.github.v3+json"
        }
        logger.info(f"🔑 Headers prepared with decrypted token: {github_token[:10]}...")

        async with httpx.AsyncClient(timeout=30.0) as client:
            # 首先检查文件是否已存在
            logger.info("🔍 Checking if file already exists...")
            check_response = await client.get(api_url, headers=headers)
            logger.info(f"🔍 File check response status: {check_response.status_code}")

            # 如果文件已存在（200），需要获取其SHA值来更新
            if check_response.status_code == 200:
                existing_file = check_response.json()
                file_sha = existing_file.get("sha")
                data["sha"] = file_sha
                logger.info(f"📝 File exists, adding SHA for update: {file_sha[:10]}...")
            elif check_response.status_code == 404:
                logger.info("📝 File does not exist, creating new file...")
            else:
                logger.warning(f"⚠️ Unexpected check response status: {check_response.status_code}")

            logger.info("🚀 Sending upload request to GitHub API...")
            response = await client.put(api_url, json=data, headers=headers)

            logger.info(f"📡 Response status: {response.status_code}")
            logger.info(f"📡 Response headers: {dict(response.headers)}")

            if response.status_code not in [201, 200]:
                logger.error(f"❌ GitHub API error - Status: {response.status_code}")
                logger.error(f"❌ Response text: {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"GitHub上传失败: {response.text}"
                )

            result = response.json()
            logger.info(f"✅ GitHub API response successful - keys: {list(result.keys())}")
            logger.info(f"✅ Content info: {result.get('content', {}).get('name', 'N/A')}")

            # 生成图片的原始访问URL
            image_url = f"https://raw.githubusercontent.com/{username}/{repo_name}/main/{file_path}"

            logger.info(f"Image uploaded successfully: {image_url}")

            return {
                "url": image_url,
                "filename": request.filename,
                "path": file_path,
                "sha": result.get("content", {}).get("sha")
            }

    except httpx.TimeoutException as e:
        logger.error(f"Upload timeout: {str(e)}")
        raise HTTPException(status_code=408, detail=f"上传超时，请重试: {str(e)}")
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error uploading image: {e}")
        logger.error(f"Response status: {e.response.status_code}")
        logger.error(f"Response content: {e.response.text}")
        raise HTTPException(status_code=e.response.status_code, detail=f"GitHub API错误: {e.response.status_code} - {e.response.text}")
    except Exception as e:
        logger.error(f"Unexpected error uploading image: {str(e)}")
        logger.error(f"Exception type: {type(e).__name__}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"上传失败: {type(e).__name__} - {str(e)}")
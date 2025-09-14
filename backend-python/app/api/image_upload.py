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
        # 获取用户的GitHub配置
        if not current_user.githubToken:
            raise HTTPException(status_code=400, detail="请先配置GitHub访问token")

        if not current_user.defaultRepoUrl:
            raise HTTPException(status_code=400, detail="请先配置默认仓库URL")

        # 从仓库URL中提取用户名和仓库名
        # https://github.com/Rain1601/rain.blog.repo -> Rain1601, rain.blog.repo
        repo_url = current_user.defaultRepoUrl
        if not repo_url.startswith('https://github.com/'):
            raise HTTPException(status_code=400, detail="无效的GitHub仓库URL")

        parts = repo_url.replace('https://github.com/', '').split('/')
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail="无效的GitHub仓库URL格式")

        username, repo_name = parts

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

        # 准备请求数据
        data = {
            "message": f"上传图片: {request.filename}",
            "content": request.base64Data,
            "branch": "main"
        }

        headers = {
            "Authorization": f"token {current_user.githubToken}",
            "Accept": "application/vnd.github.v3+json"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.put(api_url, json=data, headers=headers)

            if response.status_code not in [201, 200]:
                logger.error(f"GitHub API error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"GitHub上传失败: {response.text}"
                )

            result = response.json()

            # 生成图片的原始访问URL
            image_url = f"https://raw.githubusercontent.com/{username}/{repo_name}/main/{file_path}"

            logger.info(f"Image uploaded successfully: {image_url}")

            return {
                "url": image_url,
                "filename": request.filename,
                "path": file_path,
                "sha": result.get("content", {}).get("sha")
            }

    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="上传超时，请重试")
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error uploading image: {e}")
        raise HTTPException(status_code=e.response.status_code, detail=f"GitHub API错误: {e.response.status_code}")
    except Exception as e:
        logger.error(f"Error uploading image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")
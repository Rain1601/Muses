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


class ImageUrlRequest(BaseModel):
    imageUrl: str


@router.post("/convert-image-url")
async def convert_image_url_to_github(request: ImageUrlRequest, current_user: User = Depends(get_current_user_db)):
    """将外部图片URL转换为GitHub图床链接"""
    try:
        logger.info(f"🌐 Converting image URL for user: {current_user.username}")
        logger.info(f"📡 Image URL: {request.imageUrl}")

        # 设置用户代理和referer头来绕过防盗链，尝试多种策略
        base_url = request.imageUrl.split('?')[0]
        domain = '/'.join(request.imageUrl.split('/')[0:3])

        headers_list = [
            # 策略1：使用沃斯托自己的referer
            {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": f"{domain}/",
                "Accept": "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
                "Sec-Fetch-Dest": "image",
                "Sec-Fetch-Mode": "no-cors",
                "Sec-Fetch-Site": "cross-site",
            },
            # 策略2：完全模拟浏览器请求
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://www.wostatic.cn/",
                "Accept": "*/*",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive",
                "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"Windows"',
                "Sec-Fetch-Dest": "image",
                "Sec-Fetch-Mode": "no-cors",
                "Sec-Fetch-Site": "cross-site",
            },
            # 策略3：无referer
            {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Cache-Control": "no-cache",
            }
        ]

        # 尝试多种策略下载图片
        response = None
        for i, headers in enumerate(headers_list):
            try:
                logger.info(f"📥 尝试策略 {i+1}: 下载图片 {request.imageUrl}")
                logger.info(f"🔑 使用请求头: {headers}")

                async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                    response = await client.get(request.imageUrl, headers=headers)

                if response.status_code == 200:
                    logger.info(f"✅ 策略 {i+1} 成功! Status: {response.status_code}")
                    break
                else:
                    logger.warning(f"⚠️ 策略 {i+1} 失败: Status {response.status_code}")

            except Exception as e:
                logger.warning(f"⚠️ 策略 {i+1} 异常: {str(e)}")
                continue

        if not response or response.status_code != 200:
            logger.error(f"❌ 所有策略都失败了 - 最终状态: {response.status_code if response else 'No response'}")
            raise HTTPException(
                status_code=400,
                detail=f"无法下载图片: 所有下载策略都失败了 (HTTP {response.status_code if response else 'No response'})"
            )

        # 检查内容类型
        content_type = response.headers.get("content-type", "").lower()
        if not content_type.startswith("image/"):
            logger.error(f"❌ Invalid content type: {content_type}")
            raise HTTPException(
                status_code=400,
                detail=f"URL不是有效的图片: {content_type}"
            )

        logger.info(f"✅ Image downloaded successfully - Size: {len(response.content)} bytes, Type: {content_type}")

        # 转换为base64
        image_base64 = base64.b64encode(response.content).decode('utf-8')

        # 生成文件名
        url_parts = request.imageUrl.split('/')
        original_filename = url_parts[-1].split('?')[0] if url_parts else 'image'

        # 确保文件名有扩展名
        if '.' not in original_filename:
            ext = content_type.split('/')[-1]
            if ext not in ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']:
                ext = 'jpg'
            original_filename = f"{original_filename}.{ext}"

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_id = str(uuid.uuid4())[:8]
        filename = f"url_{timestamp}_{unique_id}_{original_filename}"

        logger.info(f"📝 Generated filename: {filename}")

        # 调用现有的上传逻辑
        upload_request = ImageUploadRequest(
            base64Data=image_base64,
            filename=filename,
            contentType=content_type
        )

        # 重用现有的上传函数逻辑
        return await upload_image_to_github(upload_request, current_user)

    except httpx.TimeoutException as e:
        logger.error(f"Download timeout: {str(e)}")
        raise HTTPException(status_code=408, detail=f"下载图片超时: {str(e)}")
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error downloading image: {e}")
        raise HTTPException(status_code=400, detail=f"下载图片失败: HTTP {e.response.status_code}")
    except Exception as e:
        logger.error(f"Unexpected error converting image URL: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"转换失败: {str(e)}")
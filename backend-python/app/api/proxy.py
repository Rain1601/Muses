from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import base64
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class ImageProxyRequest(BaseModel):
    url: str

@router.post("/proxy-image")
async def proxy_image(request: ImageProxyRequest):
    """代理下载外部图片并转换为Base64"""
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(30.0),  # 30秒超时
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        ) as client:
            response = await client.get(request.url)
            response.raise_for_status()

            # 获取内容类型
            content_type = response.headers.get('content-type', 'image/jpeg')

            # 验证是否为图片
            if not content_type.startswith('image/'):
                raise HTTPException(status_code=400, detail="URL does not point to an image")

            # 转换为Base64
            image_data = response.content
            base64_data = base64.b64encode(image_data).decode('utf-8')

            logger.info(f"Successfully downloaded and encoded image: {request.url}")

            return {
                "base64Data": base64_data,
                "contentType": content_type,
                "size": len(image_data)
            }

    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Request timeout while downloading image")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"HTTP error: {e.response.status_code}")
    except Exception as e:
        logger.error(f"Error downloading image {request.url}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to download image: {str(e)}")
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os
import uuid
import PyPDF2
import io
from PIL import Image

from ..database import get_db
from ..dependencies import get_current_user_db
from ..config import settings
from ..utils.exceptions import HTTPValidationError

router = APIRouter()


class FileUploadResponse:
    def __init__(self, file_info: dict):
        self.success = True
        self.file = file_info


class FileParseResponse:
    def __init__(self, content: str, word_count: int):
        self.success = True
        self.content = content
        self.word_count = word_count


# 简化的文件存储（生产环境应使用数据库）
uploaded_files = {}


@router.post("/file")
async def upload_file(
    file: UploadFile = File(...),
    current_user = Depends(get_current_user_db)
):
    """上传文件"""
    
    # 验证文件类型
    allowed_extensions = {'.pdf', '.md', '.txt', '.doc', '.docx'}
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPValidationError("Unsupported file type")
    
    # 验证文件大小
    file_size = 0
    content = await file.read()
    file_size = len(content)
    
    if file_size > settings.max_file_size:
        raise HTTPValidationError("File too large")
    
    try:
        # 生成唯一文件ID
        file_id = str(uuid.uuid4())
        file_path = os.path.join(settings.upload_dir, f"{file_id}{file_ext}")
        
        # 保存文件
        with open(file_path, "wb") as f:
            f.write(content)
        
        # 存储文件信息
        file_info = {
            "id": file_id,
            "originalName": file.filename,
            "size": file_size,
            "type": file.content_type,
            "path": file_path,
            "userId": current_user.id
        }
        
        uploaded_files[file_id] = file_info
        
        return FileUploadResponse(file_info).__dict__
        
    except Exception as e:
        raise HTTPValidationError(f"File upload failed: {str(e)}")


@router.post("/parse")
async def parse_file(
    request: dict,
    current_user = Depends(get_current_user_db)
):
    """解析文件内容"""
    
    file_id = request.get("fileId")
    if not file_id or file_id not in uploaded_files:
        raise HTTPValidationError("File not found")
    
    file_info = uploaded_files[file_id]
    
    # 验证文件属于当前用户
    if file_info["userId"] != current_user.id:
        raise HTTPValidationError("Access denied")
    
    try:
        file_path = file_info["path"]
        file_ext = os.path.splitext(file_path)[1].lower()
        
        content = ""
        
        if file_ext == '.pdf':
            # 解析PDF
            with open(file_path, 'rb') as f:
                pdf_reader = PyPDF2.PdfReader(f)
                for page in pdf_reader.pages:
                    content += page.extract_text() + "\n"
        
        elif file_ext in ['.txt', '.md']:
            # 解析文本文件
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        
        else:
            # 其他格式暂不支持详细解析
            content = f"文件 {file_info['originalName']} 已上传，但暂不支持自动解析此格式。"
        
        word_count = len(content.replace(' ', '').replace('\n', ''))
        
        return FileParseResponse(content, word_count).__dict__
        
    except Exception as e:
        raise HTTPValidationError(f"File parsing failed: {str(e)}")


@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    current_user = Depends(get_current_user_db)
):
    """删除文件"""
    
    if file_id not in uploaded_files:
        raise HTTPValidationError("File not found")
    
    file_info = uploaded_files[file_id]
    
    # 验证文件属于当前用户
    if file_info["userId"] != current_user.id:
        raise HTTPValidationError("Access denied")
    
    try:
        # 删除物理文件
        if os.path.exists(file_info["path"]):
            os.remove(file_info["path"])
        
        # 删除记录
        del uploaded_files[file_id]
        
        return {"success": True}
        
    except Exception as e:
        raise HTTPValidationError(f"File deletion failed: {str(e)}")


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    current_user = Depends(get_current_user_db)
):
    """上传图片文件"""
    
    # 验证文件类型
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'}
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPValidationError("Unsupported image type")
    
    # 验证文件大小（图片限制5MB）
    content = await file.read()
    file_size = len(content)
    
    max_image_size = 5 * 1024 * 1024  # 5MB
    if file_size > max_image_size:
        raise HTTPValidationError("Image file too large (max 5MB)")
    
    try:
        # 创建用户专用的图片目录
        user_image_dir = os.path.join(settings.upload_dir, "images", str(current_user.id))
        os.makedirs(user_image_dir, exist_ok=True)
        
        # 生成唯一文件名
        file_id = str(uuid.uuid4())
        filename = f"{file_id}{file_ext}"
        file_path = os.path.join(user_image_dir, filename)
        
        # 如果是图片文件且非SVG，进行压缩优化
        if file_ext != '.svg':
            try:
                # 使用PIL优化图片
                image = Image.open(io.BytesIO(content))
                
                # 如果图片过大，进行等比缩放
                max_size = (1920, 1080)  # 最大尺寸
                if image.size[0] > max_size[0] or image.size[1] > max_size[1]:
                    image.thumbnail(max_size, Image.Resampling.LANCZOS)
                
                # 保存优化后的图片
                if file_ext in ['.jpg', '.jpeg']:
                    image = image.convert('RGB')  # JPEG不支持透明度
                    image.save(file_path, 'JPEG', quality=85, optimize=True)
                elif file_ext == '.png':
                    image.save(file_path, 'PNG', optimize=True)
                elif file_ext == '.webp':
                    image.save(file_path, 'WEBP', quality=85, optimize=True)
                else:
                    # 其他格式直接保存原文件
                    with open(file_path, "wb") as f:
                        f.write(content)
            except Exception as img_error:
                print(f"Image optimization failed: {img_error}")
                # 如果优化失败，直接保存原文件
                with open(file_path, "wb") as f:
                    f.write(content)
        else:
            # SVG文件直接保存
            with open(file_path, "wb") as f:
                f.write(content)
        
        # 生成可访问的URL
        image_url = f"/api/upload/images/{current_user.id}/{filename}"
        
        # 存储文件信息
        file_info = {
            "id": file_id,
            "originalName": file.filename,
            "size": os.path.getsize(file_path),  # 使用实际保存后的文件大小
            "type": file.content_type,
            "path": file_path,
            "url": image_url,  # 可访问的URL
            "userId": current_user.id
        }
        
        uploaded_files[file_id] = file_info
        
        return FileUploadResponse(file_info).__dict__
        
    except Exception as e:
        raise HTTPValidationError(f"Image upload failed: {str(e)}")


@router.get("/images/{user_id}/{filename}")
async def get_image(user_id: str, filename: str):
    """获取用户上传的图片"""
    
    # 构建文件路径
    file_path = os.path.join(settings.upload_dir, "images", user_id, filename)
    
    # 检查文件是否存在
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    # 返回文件
    return FileResponse(file_path)
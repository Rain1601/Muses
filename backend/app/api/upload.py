from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os
import uuid
import PyPDF2
import io
from PIL import Image
import httpx
from bs4 import BeautifulSoup
import html2text
from pydantic import BaseModel
import markdown

from ..database import get_db, SessionLocal
from ..dependencies import get_current_user_db
from ..config import settings
from ..utils.exceptions import HTTPValidationError
from ..models.article import Article
from ..models.agent import Agent
from datetime import datetime

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


class URLFetchRequest(BaseModel):
    url: str


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


@router.post("/fetch-url")
async def fetch_url_content(
    request: URLFetchRequest,
    current_user = Depends(get_current_user_db)
):
    """从URL抓取网页内容并转换为Markdown"""

    try:
        print(f"🌐 URL Import Request: {request.url}")
        # 验证URL格式
        url = request.url.strip()
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        print(f"📍 Normalized URL: {url}")

        # 发送HTTP请求获取网页内容
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(
                url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            )
            response.raise_for_status()

        # 解析HTML
        soup = BeautifulSoup(response.text, 'html.parser')

        # 只移除脚本和样式标签,保留其他内容
        for script in soup(['script', 'style']):
            script.decompose()

        # 将相对URL转换为绝对URL,并移除无效链接
        from urllib.parse import urljoin
        for img in soup.find_all('img'):
            if img.get('src'):
                img['src'] = urljoin(url, img['src'])
            elif img.get('data-src'):  # 有些网站使用懒加载
                img['src'] = urljoin(url, img['data-src'])

        # 处理链接
        for link in soup.find_all('a'):
            href = link.get('href')
            if href:
                # 跳过JavaScript链接和锚点
                if href.startswith(('javascript:', '#', 'mailto:')):
                    # 将链接转换为纯文本
                    link.replace_with(link.get_text())
                else:
                    link['href'] = urljoin(url, href)
            else:
                # 如果没有href,将链接转换为纯文本
                link.replace_with(link.get_text())

        # 尝试提取主要内容区域
        main_content = None
        for selector in ['article', 'main', '[role="main"]', '.post-content', '.article-content', '.entry-content']:
            main_content = soup.select_one(selector)
            if main_content:
                print(f"📰 Found main content with selector: {selector}")
                break

        # 如果没有找到主要内容区域,使用整个body
        if not main_content:
            main_content = soup.find('body') or soup
            print(f"📰 Using body or full document")

        # 转换为Markdown,保留图片和链接
        h = html2text.HTML2Text()
        h.ignore_links = False
        h.ignore_images = False  # 保留图片
        h.ignore_emphasis = False
        h.body_width = 0  # 不限制行宽
        h.default_image_alt = 'Image'  # 为没有alt的图片提供默认文本
        h.images_to_alt = False  # 不要用alt替换图片,保留完整的markdown图片语法
        h.protect_links = True  # 保护链接格式
        h.wrap_links = False  # 不换行链接
        h.unicode_snob = True  # 使用unicode字符
        h.skip_internal_links = False  # 保留内部链接

        markdown_content = h.handle(str(main_content))

        # 清理空链接和无效格式
        import re
        # 移除空链接 [text]() 或 [text](#) 或 [text](javascript:...)
        markdown_content = re.sub(r'\[([^\]]+)\]\(\s*\)', r'\1', markdown_content)
        markdown_content = re.sub(r'\[([^\]]+)\]\(#\)', r'\1', markdown_content)
        markdown_content = re.sub(r'\[([^\]]+)\]\(javascript:[^\)]*\)', r'\1', markdown_content)

        # 清理多余的空行
        lines = markdown_content.split('\n')
        cleaned_lines = []
        prev_empty = False
        for line in lines:
            if line.strip():
                cleaned_lines.append(line)
                prev_empty = False
            elif not prev_empty:
                cleaned_lines.append('')
                prev_empty = True

        markdown_text = '\n'.join(cleaned_lines).strip()

        # 将 Markdown 转换为 HTML（用于编辑器渲染）
        html_content = markdown.markdown(
            markdown_text,
            extensions=['extra', 'codehilite', 'tables', 'toc', 'nl2br']
        )

        content = html_content

        # 获取网页标题
        title = soup.find('title')
        title_text = title.get_text().strip() if title else url

        # 计算字数
        word_count = len(markdown_text.replace(' ', '').replace('\n', ''))

        # 生成文件ID并保存
        file_id = str(uuid.uuid4())
        file_path = os.path.join(settings.upload_dir, f"{file_id}.md")

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(f"# {title_text}\n\n")
            f.write(f"**来源:** {url}\n\n")
            f.write("---\n\n")
            f.write(content)

        # 存储文件信息
        file_size = os.path.getsize(file_path)
        file_info = {
            "id": file_id,
            "originalName": f"{title_text}.md",
            "size": file_size,
            "type": "text/markdown",
            "path": file_path,
            "userId": current_user.id,
            "url": url,
            "title": title_text
        }

        uploaded_files[file_id] = file_info

        # 创建文章记录
        db = SessionLocal()
        try:
            # 获取用户的默认 Agent 或第一个可用 Agent
            default_agent = db.query(Agent).filter(
                Agent.userId == current_user.id,
                Agent.isDefault == True
            ).first()

            if not default_agent:
                default_agent = db.query(Agent).filter(
                    Agent.userId == current_user.id
                ).first()

            if not default_agent:
                default_agent = Agent(
                    userId=current_user.id,
                    name="导入助手",
                    description="用于导入文件的默认助手",
                    language="chinese",
                    tone="professional",
                    lengthPreference="medium",
                    targetAudience="general",
                    isDefault=True
                )
                db.add(default_agent)
                db.flush()

            print(f"📝 Using agent: {default_agent.id} - {default_agent.name}")

            # 创建文章
            article = Article(
                userId=current_user.id,
                agentId=default_agent.id,
                title=title_text,
                content=content,
                summary=f"从URL导入: {url}",
                publishStatus="draft",
                sourceFiles=url
            )
            db.add(article)
            db.commit()
            db.refresh(article)

            print(f"✅ Article created: {article.id} - {article.title}")

            return {
                "success": True,
                "file": file_info,
                "content": content,
                "word_count": word_count,
                "title": title_text,
                "article": {
                    "id": article.id,
                    "title": article.title,
                    "status": "imported",
                    "created_at": article.createdAt.isoformat() if article.createdAt else datetime.utcnow().isoformat()
                }
            }
        finally:
            db.close()

    except httpx.HTTPError as e:
        print(f"❌ HTTP Error: {str(e)}")
        raise HTTPValidationError(f"无法访问URL：{str(e)}")
    except Exception as e:
        print(f"❌ Unexpected Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPValidationError(f"内容抓取失败：{str(e)}")

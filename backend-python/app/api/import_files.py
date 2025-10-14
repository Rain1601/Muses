from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import List, Optional
import tempfile
import os
import shutil
import zipfile
import re
import base64
import logging
from pathlib import Path

from ..dependencies import get_current_user_db
from ..models.user import User
from ..models.article import Article
from ..database import SessionLocal
from ..utils.security import decrypt
import httpx

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/upload-files")
async def upload_files(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user_db)
):
    """上传文件或文件夹进行导入"""
    try:
        logger.info(f"📁 Starting file upload for user: {current_user.username}")
        logger.info(f"📊 Uploaded {len(files)} files")

        # 详细记录每个文件的信息
        for i, file in enumerate(files):
            logger.info(f"📄 File {i+1}: {file.filename} (size: {file.size if hasattr(file, 'size') else 'unknown'}, type: {file.content_type})")
            if hasattr(file, 'size') and file.size == 0:
                logger.warning(f"⚠️ Empty file detected: {file.filename}")
            if not file.filename or file.filename == '':
                logger.warning(f"⚠️ Empty filename detected")

        # 过滤掉空文件和无效文件
        valid_files = []
        for file in files:
            # 检查文件名和大小
            if (file.filename and
                file.filename.strip() and
                not file.filename.endswith('/') and
                not file.filename.endswith('.DS_Store') and
                file.filename != '.DS_Store'):

                # 检查文件大小（如果可用）
                if hasattr(file, 'size') and file.size == 0:
                    logger.warning(f"⚠️ Skipping empty file: {file.filename}")
                    continue

                valid_files.append(file)
                logger.info(f"✅ Valid file added: {file.filename}")
            else:
                logger.warning(f"⚠️ Skipping invalid file: {file.filename}")

        logger.info(f"✅ Valid files: {len(valid_files)}/{len(files)}")

        if len(valid_files) == 0:
            raise HTTPException(status_code=400, detail="没有找到有效的文件。请确保选择了包含 Markdown 文件的文件夹，并检查文件是否为空。")

        files = valid_files

        # 创建临时目录
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            # 处理上传的文件
            markdown_files = []
            image_files = {}

            for file in files:
                file_path = temp_path / file.filename

                # 创建必要的目录
                file_path.parent.mkdir(parents=True, exist_ok=True)

                # 保存文件
                content = await file.read()
                with open(file_path, 'wb') as f:
                    f.write(content)

                logger.info(f"📄 Saved file: {file.filename}")

                # 分类文件
                if file.filename.endswith('.md'):
                    markdown_files.append(file_path)
                elif any(file.filename.lower().endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.gif', '.svg']):
                    # 提取相对路径作为键，同时保存完整路径和文件名
                    rel_path = file.filename
                    filename_only = rel_path.split('/')[-1] if '/' in rel_path else rel_path

                    # 保存多种可能的键值映射
                    image_files[filename_only] = file_path  # 只有文件名
                    image_files[rel_path] = file_path       # 完整相对路径

                    logger.info(f"🖼️ Registered image: {filename_only} -> {file_path}")

            logger.info(f"📝 Found {len(markdown_files)} markdown files")
            logger.info(f"🖼️ Found {len(image_files)} image files")

            # 处理每个 Markdown 文件
            imported_articles = []

            for md_file in markdown_files:
                try:
                    article_data = await process_markdown_file(md_file, image_files, current_user)
                    imported_articles.append(article_data)
                except Exception as e:
                    logger.error(f"❌ Failed to process {md_file}: {str(e)}")
                    continue

            return {
                "success": True,
                "imported_count": len(imported_articles),
                "articles": imported_articles
            }

    except Exception as e:
        logger.error(f"❌ File upload failed: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"文件上传失败: {str(e)}")


async def process_markdown_file(md_file: Path, image_files: dict, current_user: User) -> dict:
    """处理单个 Markdown 文件"""
    logger.info(f"📖 Processing markdown file: {md_file.name}")

    # 读取 Markdown 内容
    with open(md_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # 提取标题（第一个 # 标题）
    title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
    title = title_match.group(1) if title_match else md_file.stem

    logger.info(f"📋 Article title: {title}")

    # 上传图片并替换链接
    processed_content = await process_images_in_markdown(content, image_files, current_user)

    # 在转换前保存所有iframe标签
    iframe_placeholders = {}
    iframe_pattern = r'<iframe[^>]*>.*?</iframe>'

    def preserve_iframe(match):
        placeholder = f"__IFRAME_PLACEHOLDER_{len(iframe_placeholders)}__"
        iframe_placeholders[placeholder] = match.group(0)
        logger.info(f"🎬 Preserving iframe: {match.group(0)[:100]}...")
        return placeholder

    processed_content = re.sub(iframe_pattern, preserve_iframe, processed_content, flags=re.DOTALL)

    # 将Markdown转换为HTML（TipTap编辑器需要HTML格式）
    try:
        import markdown
        html_content = markdown.markdown(processed_content, extensions=[
            'markdown.extensions.tables',
            'markdown.extensions.fenced_code',
            'markdown.extensions.codehilite',
            'markdown.extensions.toc'
        ])
        processed_content = html_content
    except ImportError:
        # 如果没有markdown库，保持原格式
        logger.warning("⚠️ Markdown library not found, saving as raw markdown")
        pass

    # 恢复所有iframe标签
    for placeholder, iframe_html in iframe_placeholders.items():
        processed_content = processed_content.replace(placeholder, iframe_html)
        logger.info(f"✅ Restored iframe from placeholder")

    # 创建文章记录
    db = SessionLocal()
    try:
        # 获取用户的默认Agent
        from ..models.agent import Agent
        default_agent = db.query(Agent).filter(
            Agent.userId == current_user.id,
            Agent.isDefault == True
        ).first()

        if not default_agent:
            # 如果没有默认Agent，创建一个
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
            db.flush()  # 获取ID但不提交

        article = Article(
            title=title,
            content=processed_content,
            publishStatus="draft",
            userId=current_user.id,
            agentId=default_agent.id
        )

        db.add(article)
        db.commit()
        db.refresh(article)

        logger.info(f"✅ Created article: {article.id}")

        return {
            "id": article.id,
            "title": article.title,
            "status": article.publishStatus,
            "created_at": article.createdAt.isoformat()
        }

    finally:
        db.close()


async def process_images_in_markdown(content: str, image_files: dict, current_user: User) -> str:
    """处理 Markdown 中的图片链接"""
    logger.info(f"🖼️ Processing images in markdown content")

    # 匹配 ![](image/filename) 格式的图片链接
    image_pattern = r'!\[([^\]]*)\]\(([^)]+)\)'

    async def replace_image(match):
        alt_text = match.group(1)
        image_path = match.group(2)

        # 提取文件名和完整路径
        filename_only = image_path.split('/')[-1] if '/' in image_path else image_path
        full_path = image_path

        logger.info(f"🔍 Looking for image: {image_path} (filename: {filename_only})")

        # 查找对应的图片文件，优先尝试完整路径，然后尝试文件名
        local_image_path = None
        if full_path in image_files:
            local_image_path = image_files[full_path]
            logger.info(f"📁 Found image by full path: {local_image_path}")
        elif filename_only in image_files:
            local_image_path = image_files[filename_only]
            logger.info(f"📁 Found image by filename: {local_image_path}")

        if local_image_path:
            try:
                # 上传图片到 GitHub
                github_url = await upload_image_to_github(local_image_path, current_user)
                logger.info(f"✅ Uploaded image to GitHub: {github_url}")

                # 返回新的 Markdown 链接
                return f"![{alt_text}]({github_url})"

            except Exception as e:
                logger.error(f"❌ Failed to upload image {filename_only}: {str(e)}")
                # 保持原链接
                return match.group(0)
        else:
            logger.warning(f"⚠️ Image not found: {image_path} (tried both full path and filename)")
            # 保持原链接
            return match.group(0)

    # 替换所有图片链接
    import asyncio

    # 收集所有匹配项
    matches = list(re.finditer(image_pattern, content))

    # 逐个处理替换
    processed_content = content
    offset = 0

    for match in matches:
        start = match.start() + offset
        end = match.end() + offset

        replacement = await replace_image(match)

        # 计算偏移量变化
        offset += len(replacement) - len(match.group(0))

        # 替换内容
        processed_content = processed_content[:start] + replacement + processed_content[end:]

    return processed_content


async def upload_image_to_github(image_path: Path, current_user: User) -> str:
    """上传图片到 GitHub 仓库"""
    logger.info(f"📤 Uploading image to GitHub: {image_path.name}")

    # 检查用户的 GitHub 配置
    if not current_user.githubToken or not current_user.defaultRepoUrl:
        raise Exception("GitHub 配置不完整")

    # 解密 GitHub Token
    from ..utils.security import decrypt
    github_token = decrypt(current_user.githubToken)

    # 解析仓库信息
    repo_url = current_user.defaultRepoUrl
    if not repo_url.startswith('https://github.com/'):
        raise Exception("无效的 GitHub 仓库 URL")

    parts = repo_url.replace('https://github.com/', '').split('/')
    if len(parts) != 2:
        raise Exception("无效的 GitHub 仓库 URL 格式")

    username, repo_name = parts

    # 读取图片文件
    with open(image_path, 'rb') as f:
        image_data = f.read()

    # 转换为 base64
    image_base64 = base64.b64encode(image_data).decode('utf-8')

    # 生成唯一文件名
    import uuid
    from datetime import datetime
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    unique_id = str(uuid.uuid4())[:8]
    file_extension = image_path.suffix
    github_filename = f"imported_{timestamp}_{unique_id}{file_extension}"

    # GitHub 文件路径
    file_path = f"assets/images/{github_filename}"

    # GitHub API URL
    api_url = f"https://api.github.com/repos/{username}/{repo_name}/contents/{file_path}"

    # 准备请求数据
    data = {
        "message": f"Import image: {github_filename}",
        "content": image_base64,
        "branch": "main"
    }

    headers = {
        "Authorization": f"token {github_token}",
        "Accept": "application/vnd.github.v3+json"
    }

    # 发送请求
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.put(api_url, json=data, headers=headers)

        if response.status_code not in [201, 200]:
            logger.error(f"❌ GitHub API error: {response.status_code} - {response.text}")
            raise Exception(f"GitHub 上传失败: {response.status_code}")

        # 生成图片的访问 URL
        image_url = f"https://raw.githubusercontent.com/{username}/{repo_name}/main/{file_path}"

        return image_url
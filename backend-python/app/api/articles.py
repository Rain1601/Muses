from fastapi import APIRouter, Depends, HTTPException, Path, Query, BackgroundTasks, Body
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_
from typing import Optional
from datetime import datetime
import logging
from bs4 import BeautifulSoup
from pydantic import BaseModel

from ..database import get_db, SessionLocal
from ..models import Article, Agent, User
from ..schemas.article import (
    Article as ArticleSchema, ArticleCreate, ArticleUpdate,
    ArticleListResponse, ArticleResponse, ArticleAgent
)
from ..schemas.auth import SuccessResponse
from ..dependencies import get_current_user_db
from ..utils.exceptions import HTTPNotFoundError, HTTPValidationError
from ..utils.task_tracker import task_tracker, TaskStatus

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=ArticleListResponse)
async def get_articles(
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=50, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    status: Optional[str] = Query(None, description="发布状态筛选"),
    sort_by: str = Query("createdAt", description="排序字段"),
    sort_order: str = Query("desc", description="排序方向")
):
    """获取用户的文章列表，支持分页、搜索和筛选"""
    
    # 构建基础查询
    query = db.query(Article).join(Agent).filter(
        Article.userId == current_user.id
    )
    
    # 添加搜索条件
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Article.title.ilike(search_term),
                Article.summary.ilike(search_term),
                Article.content.ilike(search_term)
            )
        )
    
    # 添加状态筛选
    if status:
        query = query.filter(Article.publishStatus == status)
    
    # 计算总数
    total = query.count()
    
    # 添加排序
    if sort_by == "createdAt":
        if sort_order == "asc":
            query = query.order_by(Article.createdAt)
        else:
            query = query.order_by(desc(Article.createdAt))
    elif sort_by == "title":
        if sort_order == "asc":
            query = query.order_by(Article.title)
        else:
            query = query.order_by(desc(Article.title))
    elif sort_by == "publishStatus":
        if sort_order == "asc":
            query = query.order_by(Article.publishStatus)
        else:
            query = query.order_by(desc(Article.publishStatus))
    
    # 添加分页
    offset = (page - 1) * page_size
    articles = query.offset(offset).limit(page_size).all()
    
    # 转换为响应格式，包含agent信息
    article_list = []
    for article in articles:
        agent_info = ArticleAgent(
            name=article.agent.name,
            avatar=article.agent.avatar
        )
        
        article_data = ArticleSchema(
            id=article.id,
            userId=article.userId,
            agentId=article.agentId,
            title=article.title,
            content=article.content,
            summary=article.summary,
            publishStatus=article.publishStatus,
            publishedAt=article.publishedAt,
            githubUrl=article.githubUrl,
            repoPath=article.repoPath,
            sourceFiles=article.sourceFiles,
            metadata=article.article_metadata,
            createdAt=article.createdAt,
            updatedAt=article.updatedAt,
            agent=agent_info
        )
        article_list.append(article_data)
    
    return ArticleListResponse(
        articles=article_list,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )


@router.get("/{article_id}", response_model=ArticleResponse)
async def get_article(
    article_id: str = Path(..., description="Article ID"),
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """获取单篇文章详情"""
    
    article = db.query(Article).join(Agent).filter(
        Article.id == article_id,
        Article.userId == current_user.id
    ).first()
    
    if not article:
        raise HTTPNotFoundError("Article not found")
    
    agent_info = ArticleAgent(
        name=article.agent.name,
        avatar=article.agent.avatar
    )
    
    article_data = ArticleSchema(
        id=article.id,
        userId=article.userId,
        agentId=article.agentId,
        title=article.title,
        content=article.content,
        summary=article.summary,
        publishStatus=article.publishStatus,
        publishedAt=article.publishedAt,
        githubUrl=article.githubUrl,
        repoPath=article.repoPath,
        sourceFiles=article.sourceFiles,
        metadata=article.article_metadata,
        createdAt=article.createdAt,
        updatedAt=article.updatedAt,
        agent=agent_info
    )
    
    return ArticleResponse(article=article_data)


@router.post("", response_model=ArticleResponse)
async def create_article(
    article_data: ArticleCreate,
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """创建新文章"""
    
    # 验证Agent是否属于当前用户
    agent = db.query(Agent).filter(
        Agent.id == article_data.agentId,
        Agent.userId == current_user.id
    ).first()
    
    if not agent:
        raise HTTPValidationError("Invalid agent ID")
    
    try:
        article = Article(
            userId=current_user.id,
            **article_data.dict()
        )
        
        db.add(article)
        db.commit()
        db.refresh(article)
        
        # 返回带agent信息的文章
        agent_info = ArticleAgent(name=agent.name, avatar=agent.avatar)
        article_response = ArticleSchema(
            **article.__dict__,
            agent=agent_info
        )
        
        return ArticleResponse(article=article_response)
        
    except Exception as e:
        db.rollback()
        raise HTTPValidationError(f"Failed to create article: {str(e)}")


@router.put("/{article_id}", response_model=ArticleResponse)
async def update_article(
    article_data: ArticleUpdate,
    article_id: str = Path(..., description="Article ID"),
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """更新文章"""
    
    article = db.query(Article).filter(
        Article.id == article_id,
        Article.userId == current_user.id
    ).first()
    
    if not article:
        raise HTTPNotFoundError("Article not found")
    
    try:
        update_data = article_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(article, field, value)
        
        db.commit()
        db.refresh(article)
        
        # 获取agent信息
        agent = db.query(Agent).filter(Agent.id == article.agentId).first()
        agent_info = ArticleAgent(name=agent.name, avatar=agent.avatar)
        
        article_response = ArticleSchema(
            **article.__dict__,
            agent=agent_info
        )
        
        return ArticleResponse(article=article_response)
        
    except Exception as e:
        db.rollback()
        raise HTTPValidationError(f"Failed to update article: {str(e)}")


@router.delete("/{article_id}", response_model=SuccessResponse)
async def delete_article(
    article_id: str = Path(..., description="Article ID"),
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """删除文章（包括从GitHub删除已同步的文章）"""

    article = db.query(Article).filter(
        Article.id == article_id,
        Article.userId == current_user.id
    ).first()

    if not article:
        raise HTTPNotFoundError("Article not found")

    try:
        # 如果文章已同步到GitHub，先从GitHub删除
        # 检查是否有GitHub URL和路径（不只依赖syncStatus，因为旧版发布的文章可能状态是local）
        if article.githubUrl and article.repoPath:
            await delete_article_from_github(article, current_user)
            logger.info(f"✅ Deleted article from GitHub: {article.repoPath}")

        # 从数据库删除文章
        db.delete(article)
        db.commit()

        logger.info(f"✅ Deleted article: {article.id}")
        return SuccessResponse()

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Failed to delete article: {str(e)}")
        raise HTTPValidationError(f"Failed to delete article: {str(e)}")


async def delete_article_from_github(article: Article, current_user):
    """从GitHub删除已同步的文章"""
    import httpx

    # 检查用户的 GitHub 配置
    if not current_user.githubToken or not current_user.defaultRepoUrl:
        logger.warning("⚠️ GitHub configuration incomplete, skipping GitHub deletion")
        return

    # 解密 GitHub Token
    from ..utils.security import decrypt
    github_token = decrypt(current_user.githubToken)

    # 解析仓库信息
    repo_url = current_user.defaultRepoUrl
    if not repo_url.startswith('https://github.com/'):
        logger.warning("⚠️ Invalid GitHub repository URL, skipping GitHub deletion")
        return

    parts = repo_url.replace('https://github.com/', '').split('/')
    if len(parts) != 2:
        logger.warning("⚠️ Invalid GitHub repository URL format, skipping GitHub deletion")
        return

    username, repo_name = parts

    # GitHub API URL for deleting file
    api_url = f"https://api.github.com/repos/{username}/{repo_name}/contents/{article.repoPath}"

    headers = {
        "Authorization": f"token {github_token}",
        "Accept": "application/vnd.github.v3+json"
    }

    try:
        # 首先获取文件的当前SHA值（删除时需要）
        async with httpx.AsyncClient(timeout=30.0) as client:
            # 获取文件信息
            response = await client.get(api_url, headers=headers)

            if response.status_code == 404:
                logger.warning(f"⚠️ File not found on GitHub: {article.repoPath}")
                return

            if response.status_code != 200:
                logger.error(f"❌ Failed to get file info from GitHub: {response.status_code}")
                return

            file_data = response.json()
            file_sha = file_data.get('sha')

            if not file_sha:
                logger.error("❌ Could not get file SHA from GitHub")
                return

            # 删除文件
            delete_data = {
                "message": f"Delete article: {article.title}",
                "sha": file_sha,
                "branch": "main"
            }

            # Use request method for DELETE with body
            delete_response = await client.request(
                method="DELETE",
                url=api_url,
                json=delete_data,
                headers=headers
            )

            if delete_response.status_code in [200, 204]:
                logger.info(f"✅ Successfully deleted file from GitHub: {article.repoPath}")
            else:
                logger.error(f"❌ Failed to delete file from GitHub: {delete_response.status_code} - {delete_response.text}")

    except Exception as e:
        logger.error(f"❌ Error deleting file from GitHub: {str(e)}")
        # 不抛出异常，因为本地删除仍然应该继续


class TranslateRequest(BaseModel):
    targetLanguage: str = "zh-CN"


async def _translate_article_background(
    task_id: str,
    article_id: str,
    user_id: str,
    target_language: str
):
    """
    后台翻译任务
    在独立的数据库会话中运行
    """
    from ..services.ai_service_enhanced import EnhancedAIService

    db = SessionLocal()

    try:
        # 更新任务状态
        task_tracker.update_task(task_id, status=TaskStatus.RUNNING)

        # 获取文章和用户
        article = db.query(Article).filter(Article.id == article_id).first()
        if not article:
            task_tracker.update_task(
                task_id,
                status=TaskStatus.FAILED,
                error="文章不存在"
            )
            return

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            task_tracker.update_task(
                task_id,
                status=TaskStatus.FAILED,
                error="用户不存在"
            )
            return

        # 获取Agent
        agent = db.query(Agent).filter(Agent.id == article.agentId).first()
        if not agent:
            task_tracker.update_task(
                task_id,
                status=TaskStatus.FAILED,
                error="Agent不存在"
            )
            return

        # 语言映射
        language_map = {
            "zh-CN": "简体中文",
            "en": "English",
            "ja": "日本語",
            "ko": "한국어",
            "fr": "Français",
            "de": "Deutsch",
            "es": "Español"
        }

        language_name = language_map.get(target_language, "简体中文")

        logger.info(f"🌍 [Task {task_id}] Translating article {article_id} to {language_name}")

        # 解析HTML内容
        soup = BeautifulSoup(article.content, 'html.parser')

        # 提取所有段落和标题
        elements = []
        for tag in soup.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote']):
            text = tag.get_text().strip()
            if text:
                elements.append({
                    'tag': tag.name,
                    'text': text,
                    'html': str(tag)
                })

        # 提取所有图片
        images = []
        for img in soup.find_all('img'):
            images.append(str(img))

        total = len(elements)
        logger.info(f"📝 [Task {task_id}] Found {total} text elements and {len(images)} images")

        # 更新任务总数
        task_tracker.update_task(task_id, total=total)

        # 翻译每个段落
        translated_elements = []

        for i, element in enumerate(elements):
            try:
                # 更新当前步骤
                task_tracker.update_task(
                    task_id,
                    progress=i,
                    current_step=f"正在翻译第 {i+1}/{total} 段"
                )

                # 使用 translate action 翻译文本（强制使用Claude）
                result = await EnhancedAIService.perform_text_action(
                    user=user,
                    agent=agent,
                    text=element['text'],
                    action_type='translate',
                    language=language_name,
                    provider='claude'  # 强制使用Claude
                )

                translated_text = result.get('processedText', element['text'])

                translated_elements.append({
                    'original': element,
                    'translation': translated_text.strip()
                })

                # 记录进度
                progress = int((i + 1) / total * 100)
                logger.info(f"✅ [Task {task_id}] 翻译进度: {i+1}/{total} ({progress}%)")

            except Exception as e:
                logger.error(f"❌ [Task {task_id}] Error translating element {i+1}: {str(e)}")
                # 翻译失败时使用原文
                translated_elements.append({
                    'original': element,
                    'translation': element['text']
                })

        # 构建双语对照HTML
        bilingual_html = []

        # 添加标题说明
        bilingual_html.append(f'<div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 12px; margin-bottom: 24px;">')
        bilingual_html.append(f'<p style="margin: 0; font-size: 14px; color: #0c4a6e;">💡 本文为双语对照版本 | This is a bilingual version</p>')
        bilingual_html.append(f'</div>')

        # 图片索引
        img_index = 0

        for item in translated_elements:
            original = item['original']
            translation = item['translation']
            tag = original['tag']

            # 原文（浅灰色背景）
            bilingual_html.append(f'<div style="background-color: #f9fafb; padding: 12px; margin: 8px 0; border-radius: 4px;">')
            bilingual_html.append(f'<{tag} style="margin: 0; color: #374151;">{original["text"]}</{tag}>')
            bilingual_html.append(f'</div>')

            # 译文（浅蓝色背景）
            bilingual_html.append(f'<div style="background-color: #eff6ff; padding: 12px; margin: 8px 0 24px 0; border-radius: 4px;">')
            bilingual_html.append(f'<{tag} style="margin: 0; color: #1e40af;">{translation}</{tag}>')
            bilingual_html.append(f'</div>')

            # 每隔几段插入一张图片
            if img_index < len(images) and (len(translated_elements) < 5 or (item == translated_elements[len(translated_elements) // (len(images) + 1) * (img_index + 1)])):
                bilingual_html.append(images[img_index])
                img_index += 1

        # 添加剩余的图片
        while img_index < len(images):
            bilingual_html.append(images[img_index])
            img_index += 1

        new_content = '\n'.join(bilingual_html)

        # 创建新文章
        new_article = Article(
            userId=user.id,
            agentId=article.agentId,
            title=f"{article.title} ({language_name}双语版)",
            content=new_content,
            summary=f"双语对照翻译版本 - {article.summary or ''}",
            publishStatus="draft",
            sourceFiles=article.sourceFiles
        )

        db.add(new_article)
        db.commit()
        db.refresh(new_article)

        logger.info(f"✅ [Task {task_id}] Created bilingual article: {new_article.id}")

        # 更新任务状态为完成
        task_tracker.update_task(
            task_id,
            status=TaskStatus.COMPLETED,
            progress=total,
            result={
                "article_id": new_article.id,
                "title": new_article.title
            }
        )

    except Exception as e:
        logger.error(f"❌ [Task {task_id}] Translation failed: {str(e)}")
        task_tracker.update_task(
            task_id,
            status=TaskStatus.FAILED,
            error=str(e)
        )
    finally:
        db.close()


@router.post("/{article_id}/translate")
async def translate_article(
    background_tasks: BackgroundTasks,
    article_id: str = Path(..., description="文章ID"),
    request: TranslateRequest = Body(default=TranslateRequest()),
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """
    启动文章翻译任务（异步）
    - 立即返回task_id
    - 翻译在后台进行
    - 通过 /tasks/{task_id} 查询进度
    """
    # 验证文章存在且属于用户
    article = db.query(Article).filter(
        Article.id == article_id,
        Article.userId == current_user.id
    ).first()

    if not article:
        raise HTTPNotFoundError("文章不存在")

    target_language = request.targetLanguage if request else "zh-CN"

    # 创建任务
    task_id = task_tracker.create_task(
        task_type="translate_article",
        article_id=article_id,
        user_id=current_user.id,
        target_language=target_language
    )

    logger.info(f"🚀 Created translation task {task_id} for article {article_id}")

    # 启动后台任务
    background_tasks.add_task(
        _translate_article_background,
        task_id,
        article_id,
        current_user.id,
        target_language
    )

    # 立即返回task_id
    return {
        "taskId": task_id,
        "status": "pending",
        "message": "翻译任务已启动，请稍后查询进度"
    }


@router.get("/tasks/{task_id}")
async def get_task_status(
    task_id: str = Path(..., description="任务ID"),
    current_user = Depends(get_current_user_db)
):
    """
    查询任务进度
    返回任务状态、进度、结果或错误信息
    """
    task = task_tracker.get_task(task_id)

    if not task:
        raise HTTPNotFoundError("任务不存在")

    # 验证任务属于当前用户
    if task.get("user_id") != current_user.id:
        raise HTTPValidationError("无权访问此任务")

    # 返回任务信息
    response = {
        "taskId": task["id"],
        "status": task["status"],
        "progress": task["progress"],
        "total": task["total"],
        "currentStep": task["current_step"],
        "createdAt": task["created_at"],
        "updatedAt": task["updated_at"]
    }

    # 如果任务完成，返回结果
    if task["status"] == TaskStatus.COMPLETED:
        response["result"] = task["result"]

    # 如果任务失败，返回错误信息
    if task["status"] == TaskStatus.FAILED:
        response["error"] = task["error"]

    return response
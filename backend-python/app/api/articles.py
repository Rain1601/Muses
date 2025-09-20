from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_
from typing import Optional
from datetime import datetime
import logging

from ..database import get_db
from ..models import Article, Agent
from ..schemas.article import (
    Article as ArticleSchema, ArticleCreate, ArticleUpdate,
    ArticleListResponse, ArticleResponse, ArticleAgent
)
from ..schemas.auth import SuccessResponse
from ..dependencies import get_current_user_db
from ..utils.exceptions import HTTPNotFoundError, HTTPValidationError

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
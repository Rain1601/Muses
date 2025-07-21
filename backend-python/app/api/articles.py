from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..database import get_db
from ..models import Article, Agent
from ..schemas.article import (
    Article as ArticleSchema, ArticleCreate, ArticleUpdate,
    ArticleListResponse, ArticleResponse, ArticleAgent
)
from ..schemas.auth import SuccessResponse
from ..dependencies import get_current_user_db
from ..utils.exceptions import HTTPNotFoundError, HTTPValidationError

router = APIRouter()


@router.get("", response_model=ArticleListResponse)
async def get_articles(
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """获取用户的所有文章"""
    
    articles = db.query(Article).join(Agent).filter(
        Article.userId == current_user.id
    ).order_by(desc(Article.createdAt)).all()
    
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
            metadata=article.metadata,
            createdAt=article.createdAt,
            updatedAt=article.updatedAt,
            agent=agent_info
        )
        article_list.append(article_data)
    
    return ArticleListResponse(articles=article_list)


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
        metadata=article.metadata,
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
    """删除文章"""
    
    article = db.query(Article).filter(
        Article.id == article_id,
        Article.userId == current_user.id
    ).first()
    
    if not article:
        raise HTTPNotFoundError("Article not found")
    
    try:
        db.delete(article)
        db.commit()
        return SuccessResponse()
        
    except Exception as e:
        db.rollback()
        raise HTTPValidationError(f"Failed to delete article: {str(e)}")
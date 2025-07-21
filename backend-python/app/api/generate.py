from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json

from ..database import get_db
from ..models import Agent, Article
from ..schemas.article import (
    GenerateArticleRequest, ImproveArticleRequest, ChatGenerateRequest,
    ChatStreamRequest, GenerateResponse, ChatStreamResponse, 
    GeneratedContent, Article as ArticleSchema, ArticleAgent
)
from ..dependencies import get_current_user_db
from ..services.ai_service import AIService
from ..utils.exceptions import HTTPNotFoundError, HTTPValidationError, HTTPOpenAIKeyError

router = APIRouter()


@router.post("/article", response_model=GenerateResponse)
async def generate_article(
    request: GenerateArticleRequest,
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """从素材生成文章"""
    
    # 验证用户是否配置了OpenAI Key
    if not current_user.openaiKey:
        raise HTTPOpenAIKeyError()
    
    # 验证Agent是否属于当前用户
    agent = db.query(Agent).filter(
        Agent.id == request.agentId,
        Agent.userId == current_user.id
    ).first()
    
    if not agent:
        raise HTTPNotFoundError("Agent not found")
    
    try:
        # 生成文章
        result = await AIService.generate_article(
            user=current_user,
            agent=agent,
            materials=request.materials,
            title=request.title,
            requirements=request.requirements
        )
        
        generated_content = GeneratedContent(**result)
        article = None
        
        # 如果需要保存为草稿
        if request.saveAsDraft:
            article_data = Article(
                userId=current_user.id,
                agentId=request.agentId,
                title=result["title"],
                content=result["content"],
                summary=result["summary"],
                publishStatus="draft",
                sourceFiles=json.dumps({"materials": request.materials})
            )
            
            db.add(article_data)
            db.commit()
            db.refresh(article_data)
            
            # 构建响应
            agent_info = ArticleAgent(name=agent.name, avatar=agent.avatar)
            article = ArticleSchema(
                **article_data.__dict__,
                agent=agent_info
            )
        
        return GenerateResponse(
            article=article,
            generated=generated_content
        )
        
    except Exception as e:
        db.rollback()
        if "OpenAI API Key" in str(e):
            raise HTTPOpenAIKeyError()
        raise HTTPValidationError(f"文章生成失败：{str(e)}")


@router.post("/improve", response_model=GenerateResponse)
async def improve_article(
    request: ImproveArticleRequest,
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """改进文章"""
    
    # 验证用户是否配置了OpenAI Key
    if not current_user.openaiKey:
        raise HTTPOpenAIKeyError()
    
    # 获取文章
    article = db.query(Article).filter(
        Article.id == request.articleId,
        Article.userId == current_user.id
    ).first()
    
    if not article:
        raise HTTPNotFoundError("Article not found")
    
    # 验证Agent
    agent = db.query(Agent).filter(
        Agent.id == request.agentId,
        Agent.userId == current_user.id
    ).first()
    
    if not agent:
        raise HTTPNotFoundError("Agent not found")
    
    try:
        # 改进文章
        improved_content = await AIService.improve_article(
            user=current_user,
            agent=agent,
            current_content=article.content,
            instructions=request.instructions
        )
        
        # 更新文章
        article.content = improved_content
        article.agentId = request.agentId
        
        db.commit()
        db.refresh(article)
        
        # 构建响应
        agent_info = ArticleAgent(name=agent.name, avatar=agent.avatar)
        article_response = ArticleSchema(
            **article.__dict__,
            agent=agent_info
        )
        
        return GenerateResponse(
            article=article_response,
            generated=GeneratedContent(
                title=article.title,
                content=improved_content,
                summary=article.summary or ""
            )
        )
        
    except Exception as e:
        db.rollback()
        if "OpenAI API Key" in str(e):
            raise HTTPOpenAIKeyError()
        raise HTTPValidationError(f"文章改进失败：{str(e)}")


@router.post("/chat", response_model=GenerateResponse)
async def chat_generate(
    request: ChatGenerateRequest,
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """对话式生成文章"""
    
    # 验证Agent
    agent = db.query(Agent).filter(
        Agent.id == request.agentId,
        Agent.userId == current_user.id
    ).first()
    
    if not agent:
        raise HTTPNotFoundError("Agent not found")
    
    try:
        # 将对话历史转换为素材
        combined_materials = "\n\n".join([
            f"{'用户' if msg.role == 'user' else 'AI'}: {msg.content}"
            for msg in request.messages
        ])
        
        if request.materials:
            combined_materials = f"参考素材：\n{request.materials}\n\n对话记录：\n{combined_materials}"
        
        # 生成文章
        result = await AIService.generate_article(
            user=current_user,
            agent=agent,
            materials=combined_materials,
            requirements="基于以上对话内容和素材生成一篇完整的博客文章"
        )
        
        generated_content = GeneratedContent(**result)
        article = None
        
        # 如果需要保存为草稿
        if request.saveAsDraft:
            source_files = {
                "chatHistory": [msg.dict() for msg in request.messages]
            }
            if request.materials:
                source_files["materials"] = request.materials
            
            article_data = Article(
                userId=current_user.id,
                agentId=request.agentId,
                title=result["title"],
                content=result["content"],
                summary=result["summary"],
                publishStatus="draft",
                sourceFiles=json.dumps(source_files)
            )
            
            db.add(article_data)
            db.commit()
            db.refresh(article_data)
            
            # 构建响应
            agent_info = ArticleAgent(name=agent.name, avatar=agent.avatar)
            article = ArticleSchema(
                **article_data.__dict__,
                agent=agent_info
            )
        
        return GenerateResponse(
            article=article,
            generated=generated_content
        )
        
    except Exception as e:
        db.rollback()
        if "OpenAI API Key" in str(e):
            raise HTTPOpenAIKeyError()
        raise HTTPValidationError(f"文章生成失败：{str(e)}")


@router.post("/chat-stream", response_model=ChatStreamResponse)
async def chat_stream(
    request: ChatStreamRequest,
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """对话流式响应"""
    
    # 验证用户是否配置了OpenAI Key
    if not current_user.openaiKey:
        raise HTTPOpenAIKeyError()
    
    # 验证Agent
    agent = db.query(Agent).filter(
        Agent.id == request.agentId,
        Agent.userId == current_user.id
    ).first()
    
    if not agent:
        raise HTTPNotFoundError("Agent not found")
    
    try:
        # 生成对话回复
        response = await AIService.generate_chat_response(
            user=current_user,
            agent=agent,
            messages=[msg.dict() for msg in request.messages],
            materials=request.materials
        )
        
        return ChatStreamResponse(response=response)
        
    except Exception as e:
        if "OpenAI API Key" in str(e):
            raise HTTPOpenAIKeyError()
        raise HTTPValidationError(f"对话失败：{str(e)}")
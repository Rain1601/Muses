from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from pydantic import BaseModel

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User, Agent
from ..services.ai_service import AIService
from ..utils.exceptions import OpenAIKeyError, ValidationError

router = APIRouter()


class ProcessTextRequest(BaseModel):
    input: str
    context: Optional[str] = None
    agentId: str
    options: Optional[Dict[str, Any]] = None


class ProcessTextResponse(BaseModel):
    type: str
    result: str
    metadata: Optional[Dict[str, Any]] = None
    debug: Optional[Dict[str, Any]] = None


@router.post("/process-text", response_model=ProcessTextResponse)
async def process_text(
    request: ProcessTextRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """处理文本并返回结构化响应"""
    
    # 获取Agent
    agent = db.query(Agent).filter(
        Agent.id == request.agentId,
        Agent.userId == current_user.id
    ).first()
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    try:
        # 调用AI服务处理文本
        result = await AIService.process_text_with_structure(
            user=current_user,
            agent=agent,
            input_text=request.input,
            context=request.context,
            options=request.options
        )
        
        return ProcessTextResponse(**result)
        
    except OpenAIKeyError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text processing failed: {str(e)}")


class ImproveArticleRequest(BaseModel):
    articleId: str
    agentId: str
    instructions: str
    taskType: Optional[str] = "rewrite"


@router.post("/improve-article", response_model=ProcessTextResponse)
async def improve_article_structured(
    request: ImproveArticleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """改进文章并返回结构化响应（包含差异信息）"""
    
    from ..models import Article
    
    # 获取文章
    article = db.query(Article).filter(
        Article.id == request.articleId,
        Article.userId == current_user.id
    ).first()
    
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # 获取Agent
    agent = db.query(Agent).filter(
        Agent.id == request.agentId,
        Agent.userId == current_user.id
    ).first()
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    try:
        # 使用结构化响应API
        result = await AIService.generate_structured_response(
            user=current_user,
            agent=agent,
            user_input=request.instructions,
            context=article.content,
            task_type=request.taskType,
            original_content=article.content
        )
        
        # 如果需要，更新文章内容
        if request.taskType == "rewrite":
            article.content = result["result"]
            db.commit()
        
        return ProcessTextResponse(**result)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Article improvement failed: {str(e)}")


class ChatWithStructureRequest(BaseModel):
    agentId: str
    messages: list[Dict[str, str]]
    materials: Optional[str] = None
    enableStructuredResponse: bool = False


@router.post("/chat-structured")
async def chat_with_structure(
    request: ChatWithStructureRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """对话API，可选择返回结构化响应"""
    
    # 获取Agent
    agent = db.query(Agent).filter(
        Agent.id == request.agentId,
        Agent.userId == current_user.id
    ).first()
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    try:
        if request.enableStructuredResponse and request.messages:
            # 使用结构化响应
            last_message = request.messages[-1]["content"]
            context = "\n".join([f"{msg['role']}: {msg['content']}" for msg in request.messages[:-1]])
            
            result = await AIService.process_text_with_structure(
                user=current_user,
                agent=agent,
                input_text=last_message,
                context=context
            )
            
            return result
        else:
            # 使用传统聊天响应
            response = await AIService.generate_chat_response(
                user=current_user,
                agent=agent,
                messages=request.messages,
                materials=request.materials
            )
            
            return {"response": response}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat generation failed: {str(e)}")
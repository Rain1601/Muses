from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Agent, Article
from ..schemas.agent import (
    Agent as AgentSchema, AgentCreate, AgentUpdate, 
    AgentListResponse, AgentResponse, AgentTemplatesResponse, AgentTemplate
)
from ..schemas.auth import SuccessResponse
from ..dependencies import get_current_user_db
from ..utils.exceptions import HTTPNotFoundError, HTTPValidationError

router = APIRouter()


# 预定义的Agent模板
AGENT_TEMPLATES = [
    {
        "id": "tech-writer",
        "name": "技术写作专家",
        "description": "专门撰写技术文档和教程的AI助手",
        "config": {
            "name": "技术写作专家",
            "description": "专门撰写技术文档、教程和开发指南",
            "avatar": "💻",
            "language": "zh-CN",
            "tone": "professional",
            "lengthPreference": "long",
            "targetAudience": "开发者和技术爱好者",
            "customPrompt": "注重代码示例、最佳实践和实际应用场景",
            "outputFormat": "markdown"
        }
    },
    {
        "id": "casual-blogger",
        "name": "生活博主",
        "description": "轻松随意的生活分享博客写手",
        "config": {
            "name": "生活博主",
            "description": "分享生活感悟、旅行体验和日常思考",
            "avatar": "✨",
            "language": "zh-CN",
            "tone": "casual",
            "lengthPreference": "medium",
            "targetAudience": "普通读者",
            "customPrompt": "语言亲切自然，多用生活化的例子",
            "outputFormat": "markdown"
        }
    }
]


@router.get("", response_model=AgentListResponse)
async def get_agents(
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """获取用户的所有Agent"""
    
    agents = db.query(Agent).filter(Agent.userId == current_user.id).order_by(
        Agent.isDefault.desc(), Agent.createdAt.desc()
    ).all()
    
    return AgentListResponse(agents=agents)


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str = Path(..., description="Agent ID"),
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """获取单个Agent详情"""
    
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.userId == current_user.id
    ).first()
    
    if not agent:
        raise HTTPNotFoundError("Agent not found")
    
    return AgentResponse(agent=agent)


@router.post("", response_model=AgentResponse)
async def create_agent(
    agent_data: AgentCreate,
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """创建新的Agent"""
    
    try:
        # 如果设置为默认Agent，先取消其他默认Agent
        if agent_data.isDefault:
            db.query(Agent).filter(
                Agent.userId == current_user.id,
                Agent.isDefault == True
            ).update({"isDefault": False})
        
        # 创建新Agent
        agent = Agent(
            userId=current_user.id,
            **agent_data.dict()
        )
        
        db.add(agent)
        db.commit()
        db.refresh(agent)
        
        return AgentResponse(agent=agent)
        
    except Exception as e:
        db.rollback()
        raise HTTPValidationError(f"Failed to create agent: {str(e)}")


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_data: AgentUpdate,
    agent_id: str = Path(..., description="Agent ID"),
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """更新Agent"""
    
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.userId == current_user.id
    ).first()
    
    if not agent:
        raise HTTPNotFoundError("Agent not found")
    
    try:
        # 如果设置为默认Agent，先取消其他默认Agent
        if agent_data.isDefault:
            db.query(Agent).filter(
                Agent.userId == current_user.id,
                Agent.isDefault == True,
                Agent.id != agent_id
            ).update({"isDefault": False})
        
        # 更新Agent字段
        update_data = agent_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(agent, field, value)
        
        db.commit()
        db.refresh(agent)
        
        return AgentResponse(agent=agent)
        
    except Exception as e:
        db.rollback()
        raise HTTPValidationError(f"Failed to update agent: {str(e)}")


@router.delete("/{agent_id}", response_model=SuccessResponse)
async def delete_agent(
    agent_id: str = Path(..., description="Agent ID"),
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """删除Agent"""
    
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.userId == current_user.id
    ).first()
    
    if not agent:
        raise HTTPNotFoundError("Agent not found")
    
    # 检查是否有关联的文章
    article_count = db.query(Article).filter(Article.agentId == agent_id).count()
    if article_count > 0:
        raise HTTPValidationError(f"Cannot delete agent: {article_count} articles are using this agent")
    
    try:
        db.delete(agent)
        db.commit()
        return SuccessResponse()
        
    except Exception as e:
        db.rollback()
        raise HTTPValidationError(f"Failed to delete agent: {str(e)}")


@router.get("/templates/list", response_model=AgentTemplatesResponse)
async def get_agent_templates():
    """获取Agent模板列表"""
    
    templates = [
        AgentTemplate(**template) for template in AGENT_TEMPLATES
    ]
    
    return AgentTemplatesResponse(templates=templates)
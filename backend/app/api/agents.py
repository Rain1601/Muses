from fastapi import APIRouter, Depends, HTTPException, Path, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import os
import json

from ..database import get_db
from ..models import Agent, Article
from ..schemas.agent import (
    Agent as AgentSchema, AgentCreate, AgentUpdate,
    AgentListResponse, AgentResponse, AgentTemplatesResponse, AgentTemplate,
    StyleAnalysisRequest, StyleAnalysisResponse, TextActionRequest, TextActionResponse,
    ModelsListResponse, ModelInfo, GenerateContentRequest, GenerateContentResponse,
    ValidateModelResponse, ChatRequest, ChatResponse
)
from ..schemas.auth import SuccessResponse
from ..dependencies import get_current_user_db
from ..utils.exceptions import HTTPNotFoundError, HTTPValidationError
from ..services.ai_service import AIService
from ..services.ai_service_enhanced import EnhancedAIService
from ..agent import agent_service

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


@router.post("/analyze-style", response_model=StyleAnalysisResponse)
async def analyze_writing_style(
    request: StyleAnalysisRequest,
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """分析文本内容并生成写作风格描述"""
    
    try:
        # 调用AI服务分析写作风格
        result = await AIService.analyze_writing_style(
            user=current_user,
            content=request.content,
            content_type=request.contentType
        )
        
        return StyleAnalysisResponse(**result)
        
    except Exception as e:
        raise HTTPValidationError(f"Failed to analyze writing style: {str(e)}")


@router.post("/analyze-style-file", response_model=StyleAnalysisResponse)
async def analyze_writing_style_from_file(
    file: UploadFile = File(...),
    content_type: str = None,
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """从上传的文件中分析写作风格"""
    
    # 验证文件类型
    allowed_extensions = {'.md', '.txt', '.json'}
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPValidationError(f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}")
    
    # 验证文件大小（限制为1MB）
    content = await file.read()
    file_size = len(content)
    max_size = 1 * 1024 * 1024  # 1MB
    
    if file_size > max_size:
        raise HTTPValidationError("File too large (max 1MB)")
    
    try:
        # 解析文件内容
        text_content = ""
        
        if file_ext in ['.txt', '.md']:
            text_content = content.decode('utf-8')
        elif file_ext == '.json':
            # 处理JSON格式（可能是对话记录）
            json_data = json.loads(content.decode('utf-8'))
            
            # 尝试提取对话内容
            if isinstance(json_data, list):
                # 假设是对话数组格式
                text_content = "\n".join([
                    f"{item.get('role', 'user')}: {item.get('content', '')}"
                    for item in json_data
                    if isinstance(item, dict) and 'content' in item
                ])
            elif isinstance(json_data, dict):
                # 尝试各种可能的格式
                if 'messages' in json_data:
                    messages = json_data['messages']
                    if isinstance(messages, list):
                        text_content = "\n".join([
                            f"{msg.get('role', 'user')}: {msg.get('content', '')}"
                            for msg in messages
                            if isinstance(msg, dict) and 'content' in msg
                        ])
                elif 'content' in json_data:
                    text_content = json_data['content']
                else:
                    # 将整个JSON转为文本
                    text_content = json.dumps(json_data, ensure_ascii=False, indent=2)
        
        if not text_content.strip():
            raise HTTPValidationError("File is empty or contains no readable content")
        
        # 调用AI服务分析写作风格
        result = await AIService.analyze_writing_style(
            user=current_user,
            content=text_content,
            content_type=content_type
        )
        
        return StyleAnalysisResponse(**result)
        
    except json.JSONDecodeError:
        raise HTTPValidationError("Invalid JSON format")
    except UnicodeDecodeError:
        raise HTTPValidationError("File encoding error. Please ensure the file is UTF-8 encoded")
    except Exception as e:
        raise HTTPValidationError(f"Failed to analyze writing style: {str(e)}")


@router.post("/text-action", response_model=TextActionResponse)
async def perform_text_action(
    request: TextActionRequest,
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """执行文本操作（改进、解释、扩展等）"""

    # 获取Agent
    agent = db.query(Agent).filter(
        Agent.id == request.agentId,
        Agent.userId == current_user.id
    ).first()

    if not agent:
        raise HTTPNotFoundError("Agent not found")

    try:
        # 使用增强版AI服务执行文本操作（带prompt系统）
        result = await EnhancedAIService.perform_text_action(
            user=current_user,
            agent=agent,
            text=request.text,
            action_type=request.actionType.value,  # 获取枚举的值
            context=request.context,
            language=request.language,
            provider=request.provider,
            model=request.model,
            instruction=request.context  # 将context作为用户指令
        )

        return TextActionResponse(**result)

    except ValueError as e:
        # 更具体的错误处理
        raise HTTPValidationError(str(e))
    except Exception as e:
        raise HTTPValidationError(f"Failed to perform text action: {str(e)}")


@router.get("/models", response_model=ModelsListResponse)
async def get_available_models():
    """获取可用的AI模型列表"""

    try:
        models = agent_service.get_available_models()
        model_info_list = [ModelInfo(**model) for model in models]
        return ModelsListResponse(models=model_info_list)

    except Exception as e:
        raise HTTPValidationError(f"Failed to get available models: {str(e)}")


@router.post("/{agent_id}/generate", response_model=GenerateContentResponse)
async def generate_content(
    request: GenerateContentRequest,
    agent_id: str = Path(..., description="Agent ID"),
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """使用指定Agent生成内容"""

    try:
        result = await agent_service.generate_content(
            agent_id=agent_id,
            prompt=request.prompt,
            user_id=current_user.id,
            db=db,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            system=request.system
        )

        return GenerateContentResponse(
            content=result.content,
            token_count=result.token_count,
            model_used=result.model_used,
            finish_reason=result.finish_reason
        )

    except ValueError as e:
        raise HTTPNotFoundError(str(e))
    except Exception as e:
        raise HTTPValidationError(f"Failed to generate content: {str(e)}")


@router.post("/{agent_id}/validate", response_model=ValidateModelResponse)
async def validate_agent_model(
    agent_id: str = Path(..., description="Agent ID"),
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """验证Agent的模型配置是否有效"""

    try:
        is_valid = await agent_service.validate_agent_model(
            agent_id=agent_id,
            user_id=current_user.id,
            db=db
        )

        return ValidateModelResponse(
            valid=is_valid,
            message="Model configuration is valid" if is_valid else "Model configuration is invalid"
        )

    except Exception as e:
        return ValidateModelResponse(
            valid=False,
            message=f"Validation failed: {str(e)}"
        )


@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(
    request: ChatRequest,
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """与Agent进行对话"""

    # 获取Agent
    agent = db.query(Agent).filter(
        Agent.id == request.agentId,
        Agent.userId == current_user.id
    ).first()

    if not agent:
        raise HTTPNotFoundError("Agent not found")

    try:
        # 构建系统提示
        system_prompt = f"""你是一个AI写作助手。你的任务是帮助用户创作文章。

Agent配置：
- 名称：{agent.name}
- 描述：{agent.description}
- 语言：{agent.language}
- 风格：{agent.tone}
- 目标受众：{agent.targetAudience}

{agent.customPrompt if agent.customPrompt else ''}

当前上下文：
{request.context if request.context else '用户正在开始新的创作'}

请根据用户的问题提供有帮助的回答，帮助他们完善文章内容。"""

        # 转换消息格式
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]

        # 调用AI服务
        result = await agent_service.generate_content(
            agent_id=request.agentId,
            prompt=messages[-1]["content"] if messages else "",
            user_id=current_user.id,
            db=db,
            system=system_prompt,
            max_tokens=2000,
            temperature=0.7
        )

        return ChatResponse(
            message=result.content,
            model_used=result.model_used
        )

    except Exception as e:
        raise HTTPValidationError(f"Chat failed: {str(e)}")
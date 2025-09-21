from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from enum import Enum


class ToneEnum(str, Enum):
    professional = "professional"
    casual = "casual"
    humorous = "humorous"
    serious = "serious"


class LengthPreferenceEnum(str, Enum):
    short = "short"
    medium = "medium"
    long = "long"


class OutputFormatEnum(str, Enum):
    markdown = "markdown"
    mdx = "mdx"


class AgentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None
    avatar: Optional[str] = None
    language: str = "zh-CN"
    tone: ToneEnum = ToneEnum.professional
    lengthPreference: LengthPreferenceEnum = LengthPreferenceEnum.medium
    targetAudience: Optional[str] = None
    customPrompt: Optional[str] = None
    outputFormat: OutputFormatEnum = OutputFormatEnum.markdown
    specialRules: Optional[Any] = None
    isDefault: bool = False


class AgentCreate(AgentBase):
    pass


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None
    avatar: Optional[str] = None
    language: Optional[str] = None
    tone: Optional[ToneEnum] = None
    lengthPreference: Optional[LengthPreferenceEnum] = None
    targetAudience: Optional[str] = None
    customPrompt: Optional[str] = None
    outputFormat: Optional[OutputFormatEnum] = None
    specialRules: Optional[Any] = None
    isDefault: Optional[bool] = None


class Agent(AgentBase):
    id: str
    userId: str
    createdAt: datetime
    updatedAt: datetime
    
    class Config:
        from_attributes = True


class AgentTemplate(BaseModel):
    id: str
    name: str
    description: str
    config: AgentBase


class AgentListResponse(BaseModel):
    agents: list[Agent]


class AgentResponse(BaseModel):
    agent: Agent


class AgentTemplatesResponse(BaseModel):
    templates: list[AgentTemplate]


class StyleAnalysisRequest(BaseModel):
    content: str = Field(..., description="The text content to analyze")
    contentType: Optional[str] = Field(None, description="Type of content: 'conversation', 'article', or auto-detect")


class StyleAnalysisResponse(BaseModel):
    detectedType: str = Field(..., description="Detected content type: conversation or article")
    styleDescription: str = Field(..., description="Generated style description for custom prompt")
    characteristics: dict = Field(..., description="Detailed style characteristics")


class TextActionTypeEnum(str, Enum):
    improve = "improve"
    explain = "explain"
    expand = "expand"
    summarize = "summarize"
    translate = "translate"
    rewrite = "rewrite"


class TextActionRequest(BaseModel):
    agentId: str = Field(..., description="ID of the agent to use for processing")
    text: str = Field(..., description="Text content to process")
    actionType: TextActionTypeEnum = Field(..., description="Type of action to perform")
    context: Optional[str] = Field(None, description="Additional context or instructions")
    language: Optional[str] = Field(None, description="Target language for translation (if applicable)")
    provider: Optional[str] = Field(None, description="AI provider to use (openai, claude, gemini)")
    model: Optional[str] = Field(None, description="Specific model to use (gpt-5, claude-sonnet-4-20250514, etc)")


class TextActionResponse(BaseModel):
    actionType: str = Field(..., description="Type of action performed")
    originalText: str = Field(..., description="Original text that was processed")
    processedText: str = Field(..., description="AI-generated result text")
    explanation: Optional[str] = Field(None, description="Explanation of changes made (for improve/rewrite actions)")


# 新增：多模型Agent系统相关schemas

class ModelInfo(BaseModel):
    """模型信息"""
    type: str = Field(..., description="模型类型 (claude, openai, gemini)")
    display_name: str = Field(..., description="模型显示名称")
    default_model: str = Field(..., description="默认模型名称")
    max_tokens: int = Field(..., description="最大token数")
    capabilities: dict = Field(..., description="模型能力信息")

class ModelsListResponse(BaseModel):
    """可用模型列表响应"""
    models: list[ModelInfo] = Field(..., description="可用模型列表")

class GenerateContentRequest(BaseModel):
    """生成内容请求"""
    prompt: str = Field(..., min_length=1, description="输入提示词")
    max_tokens: Optional[int] = Field(None, description="最大生成token数")
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0, description="温度参数")
    system: Optional[str] = Field(None, description="系统消息")

class GenerateContentResponse(BaseModel):
    """生成内容响应"""
    content: str = Field(..., description="生成的内容")
    token_count: Optional[int] = Field(None, description="使用的token数量")
    model_used: Optional[str] = Field(None, description="使用的模型", alias="model_used")
    finish_reason: Optional[str] = Field(None, description="完成原因")

    class Config:
        protected_namespaces = ()

class ValidateModelResponse(BaseModel):
    """验证模型配置响应"""
    valid: bool = Field(..., description="配置是否有效")
    message: Optional[str] = Field(None, description="验证消息")
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


class TextActionResponse(BaseModel):
    actionType: str = Field(..., description="Type of action performed")
    originalText: str = Field(..., description="Original text that was processed")
    processedText: str = Field(..., description="AI-generated result text")
    explanation: Optional[str] = Field(None, description="Explanation of changes made (for improve/rewrite actions)")
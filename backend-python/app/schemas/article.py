from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from enum import Enum


class PublishStatusEnum(str, Enum):
    draft = "draft"
    published = "published"
    scheduled = "scheduled"


class ArticleBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str
    summary: Optional[str] = None


class ArticleCreate(ArticleBase):
    agentId: str
    sourceFiles: Optional[Any] = None


class ArticleUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = None
    summary: Optional[str] = None
    publishStatus: Optional[PublishStatusEnum] = None


class ArticleAgent(BaseModel):
    """文章关联的Agent简化信息"""
    name: str
    avatar: Optional[str] = None


class Article(ArticleBase):
    id: str
    userId: str
    agentId: str
    publishStatus: PublishStatusEnum
    publishedAt: Optional[datetime] = None
    githubUrl: Optional[str] = None
    repoPath: Optional[str] = None
    sourceFiles: Optional[str] = None
    article_metadata: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime
    agent: Optional[ArticleAgent] = None
    
    class Config:
        from_attributes = True


class ArticleListResponse(BaseModel):
    articles: list[Article]


class ArticleResponse(BaseModel):
    article: Article


# AI生成相关schemas
class GenerateArticleRequest(BaseModel):
    agentId: str
    materials: str = Field(..., min_length=1)
    title: Optional[str] = None
    requirements: Optional[str] = None
    saveAsDraft: bool = True


class ImproveArticleRequest(BaseModel):
    articleId: str
    agentId: str
    instructions: str = Field(..., min_length=1)


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ChatGenerateRequest(BaseModel):
    agentId: str
    messages: list[ChatMessage]
    materials: Optional[str] = None
    saveAsDraft: bool = False


class ChatStreamRequest(BaseModel):
    agentId: str
    messages: list[ChatMessage]
    materials: Optional[str] = None


class GeneratedContent(BaseModel):
    title: str
    content: str
    summary: str


class GenerateResponse(BaseModel):
    success: bool = True
    article: Optional[Article] = None
    generated: GeneratedContent


class ChatStreamResponse(BaseModel):
    success: bool = True
    response: str
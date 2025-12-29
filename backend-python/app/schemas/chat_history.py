from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class ChatMessageBase(BaseModel):
    """聊天消息基础模型"""
    role: str = Field(..., description="消息角色: user 或 assistant")
    content: str = Field(..., description="消息内容")


class ChatHistoryCreate(BaseModel):
    """创建对话历史请求"""
    articleId: str = Field(..., description="文章ID")
    messages: List[ChatMessageBase] = Field(..., description="消息列表")


class ChatHistoryItem(ChatMessageBase):
    """对话历史项"""
    id: str = Field(..., description="消息ID")
    sequence: int = Field(..., description="消息序号")
    createdAt: datetime = Field(..., description="创建时间")

    class Config:
        from_attributes = True


class ChatHistoryResponse(BaseModel):
    """对话历史响应"""
    articleId: str = Field(..., description="文章ID")
    messages: List[ChatHistoryItem] = Field(..., description="消息列表")


class SaveChatHistoryRequest(BaseModel):
    """保存对话历史请求"""
    articleId: str = Field(..., description="文章ID")
    agentId: str = Field(..., description="Agent ID")
    messages: List[ChatMessageBase] = Field(..., description="消息列表")


class SaveChatHistoryResponse(BaseModel):
    """保存对话历史响应"""
    success: bool = Field(..., description="是否成功")
    message: str = Field(..., description="提示消息")
    savedCount: int = Field(..., description="保存的消息数量")

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import ChatHistory, Article
from ..schemas.chat_history import (
    ChatHistoryResponse, ChatHistoryItem, SaveChatHistoryRequest,
    SaveChatHistoryResponse
)
from ..dependencies import get_current_user_db
from ..utils.exceptions import HTTPNotFoundError, HTTPValidationError

router = APIRouter()


@router.get("/{article_id}", response_model=ChatHistoryResponse)
async def get_chat_history(
    article_id: str = Path(..., description="文章ID"),
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """获取文章的对话历史"""

    # 验证文章是否存在且属于当前用户
    article = db.query(Article).filter(
        Article.id == article_id,
        Article.userId == current_user.id
    ).first()

    if not article:
        raise HTTPNotFoundError("Article not found")

    # 获取对话历史，按序号排序
    chat_history = db.query(ChatHistory).filter(
        ChatHistory.articleId == article_id,
        ChatHistory.userId == current_user.id
    ).order_by(ChatHistory.sequence).all()

    messages = [
        ChatHistoryItem(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            sequence=msg.sequence,
            createdAt=msg.createdAt
        )
        for msg in chat_history
    ]

    return ChatHistoryResponse(
        articleId=article_id,
        messages=messages
    )


@router.post("/save", response_model=SaveChatHistoryResponse)
async def save_chat_history(
    request: SaveChatHistoryRequest,
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """保存对话历史"""

    # 验证文章是否存在且属于当前用户
    article = db.query(Article).filter(
        Article.id == request.articleId,
        Article.userId == current_user.id
    ).first()

    if not article:
        raise HTTPNotFoundError("Article not found")

    try:
        # 删除该文章的所有旧对话历史
        db.query(ChatHistory).filter(
            ChatHistory.articleId == request.articleId,
            ChatHistory.userId == current_user.id
        ).delete()

        # 保存新的对话历史
        for idx, message in enumerate(request.messages):
            chat_item = ChatHistory(
                articleId=request.articleId,
                userId=current_user.id,
                agentId=request.agentId,
                role=message.role,
                content=message.content,
                sequence=idx
            )
            db.add(chat_item)

        db.commit()

        return SaveChatHistoryResponse(
            success=True,
            message="对话历史保存成功",
            savedCount=len(request.messages)
        )

    except Exception as e:
        db.rollback()
        raise HTTPValidationError(f"Failed to save chat history: {str(e)}")


@router.delete("/{article_id}")
async def delete_chat_history(
    article_id: str = Path(..., description="文章ID"),
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """删除文章的对话历史"""

    # 验证文章是否存在且属于当前用户
    article = db.query(Article).filter(
        Article.id == article_id,
        Article.userId == current_user.id
    ).first()

    if not article:
        raise HTTPNotFoundError("Article not found")

    try:
        # 删除该文章的所有对话历史
        deleted_count = db.query(ChatHistory).filter(
            ChatHistory.articleId == article_id,
            ChatHistory.userId == current_user.id
        ).delete()

        db.commit()

        return {
            "success": True,
            "message": f"已删除 {deleted_count} 条对话记录"
        }

    except Exception as e:
        db.rollback()
        raise HTTPValidationError(f"Failed to delete chat history: {str(e)}")

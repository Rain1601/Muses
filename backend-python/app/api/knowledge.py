"""
Knowledge base API endpoints for testing RAG functionality.
知识库API端点，用于测试RAG功能。
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
import logging

from ..database import get_db
from ..models import User, Article
from ..dependencies import get_current_user
from ..agent.knowledge import KnowledgeRetriever

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])

# 请求/响应模型
class AddDocumentRequest(BaseModel):
    text: str
    metadata: Optional[Dict] = None
    source: str = "manual"

class SearchRequest(BaseModel):
    query: str
    n_results: int = 5
    filter_metadata: Optional[Dict] = None

class BuildKnowledgeRequest(BaseModel):
    article_ids: Optional[List[str]] = None  # 如果为空，使用所有文章

class DocumentResponse(BaseModel):
    ids: List[str]
    message: str

class SearchResult(BaseModel):
    text: str
    metadata: Dict
    score: float

class KnowledgeStats(BaseModel):
    total_documents: int
    embedding_dimension: int
    collection_name: str


# 为每个用户创建独立的知识库实例
def get_user_retriever(user_id: str) -> KnowledgeRetriever:
    """获取用户的知识库检索器"""
    collection_name = f"user_{user_id}_knowledge"
    return KnowledgeRetriever(
        persist_dir="./knowledge_db",
        collection_name=collection_name
    )


@router.post("/add", response_model=DocumentResponse)
async def add_document(
    request: AddDocumentRequest,
    current_user: User = Depends(get_current_user)
):
    """
    添加文档到知识库
    """
    try:
        retriever = get_user_retriever(current_user.id)

        # 添加用户信息到元数据
        metadata = request.metadata or {}
        metadata["user_id"] = current_user.id
        metadata["source"] = request.source

        ids = retriever.add_document(
            text=request.text,
            metadata=metadata
        )

        return DocumentResponse(
            ids=ids,
            message=f"Successfully added document with {len(ids)} chunks"
        )
    except Exception as e:
        logger.error(f"Failed to add document: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/search", response_model=List[SearchResult])
async def search_knowledge(
    request: SearchRequest,
    current_user: User = Depends(get_current_user)
):
    """
    搜索知识库
    """
    try:
        retriever = get_user_retriever(current_user.id)

        results = retriever.search(
            query=request.query,
            n_results=request.n_results,
            filter_metadata=request.filter_metadata
        )

        return [
            SearchResult(
                text=r["text"],
                metadata=r["metadata"],
                score=r["score"]
            )
            for r in results
        ]
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/build-from-articles", response_model=DocumentResponse)
async def build_from_articles(
    request: BuildKnowledgeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    从用户的文章构建知识库
    """
    try:
        retriever = get_user_retriever(current_user.id)

        # 获取文章
        query = db.query(Article).filter(Article.userId == current_user.id)

        if request.article_ids:
            query = query.filter(Article.id.in_(request.article_ids))

        articles = query.all()

        if not articles:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No articles found"
            )

        # 添加文章到知识库
        total_ids = []
        for article in articles:
            metadata = {
                "article_id": article.id,
                "title": article.title,
                "author": article.author,
                "created_at": article.createdAt.isoformat() if article.createdAt else None,
                "source": "article"
            }

            ids = retriever.add_document(
                text=article.content,
                metadata=metadata,
                chunk_strategy="markdown"
            )
            total_ids.extend(ids)

        return DocumentResponse(
            ids=total_ids,
            message=f"Successfully built knowledge base from {len(articles)} articles with {len(total_ids)} chunks"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to build knowledge base: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/stats", response_model=KnowledgeStats)
async def get_knowledge_stats(
    current_user: User = Depends(get_current_user)
):
    """
    获取知识库统计信息
    """
    try:
        retriever = get_user_retriever(current_user.id)
        stats = retriever.get_stats()

        return KnowledgeStats(
            total_documents=stats["total_documents"],
            embedding_dimension=stats["embedding_dimension"],
            collection_name=stats["collection_name"]
        )
    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/clear")
async def clear_knowledge(
    current_user: User = Depends(get_current_user)
):
    """
    清空知识库
    """
    try:
        retriever = get_user_retriever(current_user.id)
        retriever.store.clear()

        return {"message": "Knowledge base cleared successfully"}
    except Exception as e:
        logger.error(f"Failed to clear knowledge base: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/test-rag")
async def test_rag_generation(
    query: str,
    current_user: User = Depends(get_current_user)
):
    """
    测试RAG生成（简单示例）
    """
    try:
        retriever = get_user_retriever(current_user.id)

        # 获取相关上下文
        context = retriever.get_context(query, max_length=2000)

        if not context:
            return {
                "query": query,
                "context": None,
                "message": "No relevant context found in knowledge base"
            }

        # 返回找到的上下文（实际应用中这里会调用AI生成）
        return {
            "query": query,
            "context": context,
            "message": "Context retrieved successfully"
        }
    except Exception as e:
        logger.error(f"RAG test failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
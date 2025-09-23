"""
Knowledge retrieval module with semantic search.
知识检索模块，提供语义搜索能力。
"""

from typing import List, Dict, Optional, Tuple
import logging
from .embedder import TextEmbedder
from .storage import VectorStore
from .chunker import TextChunker

logger = logging.getLogger(__name__)


class KnowledgeRetriever:
    """知识检索器，整合嵌入、存储和检索功能"""

    def __init__(self,
                 persist_dir: str = "./chroma_db",
                 collection_name: str = "muses_knowledge",
                 embedding_model: str = "BAAI/bge-small-zh-v1.5"):
        """
        初始化检索器

        Args:
            persist_dir: 向量数据库持久化目录
            collection_name: 集合名称
            embedding_model: 嵌入模型名称
        """
        self.embedder = TextEmbedder(embedding_model)
        self.store = VectorStore(persist_dir, collection_name)
        self.chunker = TextChunker()

    def add_document(self,
                    text: str,
                    metadata: Optional[Dict] = None,
                    chunk_strategy: str = "auto") -> List[str]:
        """
        添加文档到知识库

        Args:
            text: 文档文本
            metadata: 文档元数据
            chunk_strategy: 分块策略 ("auto", "markdown", "fixed")

        Returns:
            添加的块ID列表
        """
        # 选择分块策略
        if chunk_strategy == "markdown" or (chunk_strategy == "auto" and self._is_markdown(text)):
            chunks = self.chunker.chunk_markdown(text, metadata)
        else:
            chunks = self.chunker.chunk_text(text, metadata)

        if not chunks:
            return []

        # 提取文本和元数据
        texts = [chunk["text"] for chunk in chunks]
        metadatas = [chunk["metadata"] for chunk in chunks]

        # 生成嵌入
        embeddings = self.embedder.embed(texts)

        # 存储
        ids = self.store.add(
            texts=texts,
            embeddings=embeddings.tolist(),
            metadatas=metadatas
        )

        logger.info(f"Added document with {len(chunks)} chunks")
        return ids

    def search(self,
              query: str,
              n_results: int = 5,
              filter_metadata: Optional[Dict] = None,
              rerank: bool = False) -> List[Dict]:
        """
        语义搜索

        Args:
            query: 查询文本
            n_results: 返回结果数
            filter_metadata: 元数据过滤条件
            rerank: 是否进行重排序

        Returns:
            搜索结果列表，每个结果包含text, metadata, score
        """
        # 生成查询向量
        query_embedding = self.embedder.embed_single(query)

        # 搜索
        results = self.store.search(
            query_embedding=query_embedding.tolist(),
            n_results=n_results * 2 if rerank else n_results,  # 如果重排序，多取一些
            where=filter_metadata
        )

        # 构建结果
        search_results = []
        for i in range(len(results["documents"])):
            search_results.append({
                "text": results["documents"][i],
                "metadata": results["metadatas"][i] if i < len(results["metadatas"]) else {},
                "score": 1 - results["distances"][i]  # 转换为相似度分数
            })

        # 重排序（可选）
        if rerank and len(search_results) > n_results:
            search_results = self._rerank(query, search_results)[:n_results]

        return search_results

    def hybrid_search(self,
                     query: str,
                     keywords: Optional[List[str]] = None,
                     n_results: int = 5) -> List[Dict]:
        """
        混合搜索（语义 + 关键词）

        Args:
            query: 查询文本
            keywords: 关键词列表
            n_results: 返回结果数

        Returns:
            搜索结果列表
        """
        # 语义搜索
        semantic_results = self.search(query, n_results * 2)

        if not keywords:
            return semantic_results[:n_results]

        # 关键词加权
        for result in semantic_results:
            keyword_boost = 0
            text_lower = result["text"].lower()
            for keyword in keywords:
                if keyword.lower() in text_lower:
                    # 每匹配一个关键词增加10%权重
                    keyword_boost += 0.1

            result["score"] *= (1 + keyword_boost)

        # 按新分数排序
        semantic_results.sort(key=lambda x: x["score"], reverse=True)

        return semantic_results[:n_results]

    def get_context(self,
                   query: str,
                   max_length: int = 2000,
                   n_chunks: int = 5) -> str:
        """
        获取查询相关的上下文

        Args:
            query: 查询文本
            max_length: 最大上下文长度
            n_chunks: 最多使用的块数

        Returns:
            拼接的上下文文本
        """
        results = self.search(query, n_chunks)

        context_parts = []
        current_length = 0

        for result in results:
            text = result["text"]
            if current_length + len(text) > max_length:
                # 截断以适应长度限制
                remaining = max_length - current_length
                if remaining > 100:  # 至少保留100字符
                    context_parts.append(text[:remaining])
                break
            else:
                context_parts.append(text)
                current_length += len(text)

        return "\n\n".join(context_parts)

    def update_document(self,
                       doc_id: str,
                       text: Optional[str] = None,
                       metadata: Optional[Dict] = None):
        """
        更新文档

        Args:
            doc_id: 文档ID
            text: 新文本
            metadata: 新元数据
        """
        updates = {}
        if text is not None:
            embedding = self.embedder.embed_single(text)
            updates["documents"] = [text]
            updates["embeddings"] = [embedding.tolist()]
        if metadata is not None:
            updates["metadatas"] = [metadata]

        if updates:
            self.store.update(ids=[doc_id], **updates)

    def delete_document(self, doc_ids: List[str]):
        """
        删除文档

        Args:
            doc_ids: 要删除的文档ID列表
        """
        self.store.delete(doc_ids)

    def get_stats(self) -> Dict:
        """
        获取知识库统计信息

        Returns:
            统计信息字典
        """
        return {
            "total_documents": self.store.count(),
            "embedding_dimension": self.embedder.dimension,
            "collection_name": self.store.collection.name
        }

    def _is_markdown(self, text: str) -> bool:
        """
        判断文本是否为Markdown格式

        Args:
            text: 输入文本

        Returns:
            是否为Markdown
        """
        markdown_indicators = [
            "# ",    # 标题
            "## ",
            "```",   # 代码块
            "- ",    # 列表
            "* ",
            "1. ",   # 有序列表
            "[",     # 链接
            "!["     # 图片
        ]

        for indicator in markdown_indicators:
            if indicator in text[:500]:  # 只检查前500字符
                return True
        return False

    def _rerank(self, query: str, results: List[Dict]) -> List[Dict]:
        """
        简单的重排序策略

        Args:
            query: 查询文本
            results: 初始结果

        Returns:
            重排序后的结果
        """
        # 这里可以实现更复杂的重排序逻辑
        # 比如使用交叉编码器、考虑多样性等
        # 目前只是按分数排序
        return sorted(results, key=lambda x: x["score"], reverse=True)
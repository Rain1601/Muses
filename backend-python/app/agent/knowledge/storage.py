"""
Vector storage using ChromaDB.
使用ChromaDB存储向量。
"""

from typing import List, Dict, Optional, Any
import chromadb
from chromadb.config import Settings
import logging
from datetime import datetime
import json

logger = logging.getLogger(__name__)


class VectorStore:
    """向量存储，使用ChromaDB作为持久化存储"""

    def __init__(self,
                 persist_directory: str = "./chroma_db",
                 collection_name: str = "muses_knowledge"):
        """
        初始化向量存储

        Args:
            persist_directory: 持久化目录
            collection_name: 集合名称
        """
        # 使用持久化存储
        self.client = chromadb.PersistentClient(
            path=persist_directory,
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )

        # 获取或创建集合
        try:
            self.collection = self.client.get_collection(collection_name)
            logger.info(f"Loaded existing collection: {collection_name}")
        except:
            self.collection = self.client.create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"}  # 使用余弦相似度
            )
            logger.info(f"Created new collection: {collection_name}")

    def add(self,
            texts: List[str],
            embeddings: List[List[float]],
            metadatas: Optional[List[Dict]] = None,
            ids: Optional[List[str]] = None) -> List[str]:
        """
        添加文本和向量到存储

        Args:
            texts: 原始文本列表
            embeddings: 向量列表
            metadatas: 元数据列表
            ids: ID列表（如果不提供会自动生成）

        Returns:
            添加的文档ID列表
        """
        if not texts:
            return []

        # 自动生成ID
        if ids is None:
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            ids = [f"{timestamp}_{i}" for i in range(len(texts))]

        # 确保元数据存在
        if metadatas is None:
            metadatas = [{} for _ in texts]

        # 添加创建时间
        for metadata in metadatas:
            if "created_at" not in metadata:
                metadata["created_at"] = datetime.now().isoformat()

        # 添加到集合
        self.collection.add(
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )

        logger.info(f"Added {len(texts)} documents to vector store")
        return ids

    def search(self,
               query_embedding: List[float],
               n_results: int = 5,
               where: Optional[Dict] = None) -> Dict[str, List]:
        """
        搜索相似文档

        Args:
            query_embedding: 查询向量
            n_results: 返回结果数量
            where: 过滤条件

        Returns:
            搜索结果字典，包含documents, metadatas, distances
        """
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=min(n_results, self.collection.count()),
            where=where
        )

        # 扁平化结果
        return {
            "documents": results["documents"][0] if results["documents"] else [],
            "metadatas": results["metadatas"][0] if results["metadatas"] else [],
            "distances": results["distances"][0] if results["distances"] else []
        }

    def update(self,
               ids: List[str],
               embeddings: Optional[List[List[float]]] = None,
               metadatas: Optional[List[Dict]] = None,
               documents: Optional[List[str]] = None):
        """
        更新已存在的文档

        Args:
            ids: 文档ID列表
            embeddings: 新的向量
            metadatas: 新的元数据
            documents: 新的文档内容
        """
        update_dict = {}
        if embeddings is not None:
            update_dict["embeddings"] = embeddings
        if metadatas is not None:
            update_dict["metadatas"] = metadatas
        if documents is not None:
            update_dict["documents"] = documents

        if update_dict:
            self.collection.update(ids=ids, **update_dict)
            logger.info(f"Updated {len(ids)} documents")

    def delete(self, ids: List[str]):
        """
        删除文档

        Args:
            ids: 要删除的文档ID列表
        """
        self.collection.delete(ids=ids)
        logger.info(f"Deleted {len(ids)} documents")

    def get_all(self, limit: int = 100) -> Dict[str, List]:
        """
        获取所有文档

        Args:
            limit: 最大返回数量

        Returns:
            所有文档的字典
        """
        return self.collection.get(limit=limit)

    def count(self) -> int:
        """获取文档总数"""
        return self.collection.count()

    def clear(self):
        """清空所有文档"""
        # ChromaDB不支持直接清空，需要删除并重建集合
        collection_name = self.collection.name
        self.client.delete_collection(collection_name)
        self.collection = self.client.create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        logger.info(f"Cleared collection: {collection_name}")
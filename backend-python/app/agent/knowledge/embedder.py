"""
Text embedding module using sentence-transformers.
使用sentence-transformers进行文本嵌入。
"""

from typing import List
import numpy as np
from sentence_transformers import SentenceTransformer
import logging

logger = logging.getLogger(__name__)


class TextEmbedder:
    """文本嵌入器，使用中文优化的模型"""

    def __init__(self, model_name: str = "BAAI/bge-small-zh-v1.5"):
        """
        初始化嵌入器

        Args:
            model_name: 模型名称，默认使用bge-small-zh-v1.5（中文效果好且轻量）
        """
        try:
            self.model = SentenceTransformer(model_name)
            logger.info(f"Loaded embedding model: {model_name}")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            # 退化到基础模型
            self.model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("Fallback to all-MiniLM-L6-v2")

        # 获取向量维度
        self.dimension = self.model.get_sentence_embedding_dimension()

    def embed(self, texts: List[str]) -> np.ndarray:
        """
        将文本转换为向量

        Args:
            texts: 文本列表

        Returns:
            向量数组 shape: (n_texts, dimension)
        """
        if not texts:
            return np.array([])

        # 批量嵌入，提高效率
        embeddings = self.model.encode(
            texts,
            normalize_embeddings=True,  # 归一化便于计算余弦相似度
            show_progress_bar=False
        )

        return embeddings

    def embed_single(self, text: str) -> np.ndarray:
        """
        嵌入单个文本

        Args:
            text: 输入文本

        Returns:
            向量 shape: (dimension,)
        """
        return self.embed([text])[0]
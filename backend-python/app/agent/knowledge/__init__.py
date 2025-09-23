"""
Knowledge base module for RAG-enhanced writing.
简化的知识库模块，用于增强写作质量。
"""

from .embedder import TextEmbedder
from .storage import VectorStore
from .retriever import KnowledgeRetriever
from .chunker import TextChunker

__all__ = [
    "TextEmbedder",
    "VectorStore",
    "KnowledgeRetriever",
    "TextChunker"
]
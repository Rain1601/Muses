"""
Test script for RAG functionality.
测试RAG功能的脚本。
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.agent.knowledge import TextEmbedder, VectorStore, KnowledgeRetriever, TextChunker


def test_basic_rag():
    """测试基础RAG功能"""
    print("=== 测试RAG系统 ===\n")

    # 1. 测试文本嵌入
    print("1. 测试文本嵌入...")
    embedder = TextEmbedder()
    test_texts = [
        "人工智能正在改变世界",
        "机器学习是AI的一个重要分支",
        "今天天气很好"
    ]

    embeddings = embedder.embed(test_texts)
    print(f"   生成了 {len(embeddings)} 个向量")
    print(f"   向量维度: {embeddings.shape[1]}\n")

    # 2. 测试文本分块
    print("2. 测试文本分块...")
    chunker = TextChunker(chunk_size=100, chunk_overlap=20)

    long_text = """
# 人工智能简介

人工智能（AI）是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。

## 机器学习

机器学习是AI的核心技术之一，它使计算机能够从数据中学习，而无需明确编程。

## 深度学习

深度学习是机器学习的一个子领域，使用神经网络来模拟人脑的工作方式。
"""

    chunks = chunker.chunk_markdown(long_text)
    print(f"   文本被分成 {len(chunks)} 个块")
    for i, chunk in enumerate(chunks):
        print(f"   块 {i+1}: {chunk['text'][:50]}...")
    print()

    # 3. 测试向量存储和检索
    print("3. 测试向量存储和检索...")
    retriever = KnowledgeRetriever(
        persist_dir="./test_knowledge_db",
        collection_name="test_collection"
    )

    # 清空测试数据
    retriever.store.clear()

    # 添加文档
    doc_ids = retriever.add_document(
        text=long_text,
        metadata={"source": "test", "topic": "AI"},
        chunk_strategy="markdown"
    )
    print(f"   添加了 {len(doc_ids)} 个文档块")

    # 搜索
    query = "什么是深度学习？"
    results = retriever.search(query, n_results=2)
    print(f"\n   查询: '{query}'")
    print(f"   找到 {len(results)} 个相关结果:")

    for i, result in enumerate(results):
        print(f"\n   结果 {i+1} (相似度: {result['score']:.3f}):")
        print(f"   {result['text'][:100]}...")

    # 4. 测试上下文获取
    print("\n4. 测试上下文获取...")
    context = retriever.get_context("机器学习", max_length=500)
    print(f"   获取的上下文长度: {len(context)} 字符")
    print(f"   上下文内容: {context[:200]}...")

    # 5. 获取统计信息
    print("\n5. 知识库统计:")
    stats = retriever.get_stats()
    for key, value in stats.items():
        print(f"   {key}: {value}")

    print("\n=== 测试完成 ===")


if __name__ == "__main__":
    test_basic_rag()
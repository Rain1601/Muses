"""
Enhanced agent with RAG capabilities.
增强版Agent，集成RAG能力。
"""

from typing import List, Dict, Optional
import logging
from datetime import datetime
from ..models import Agent, Article
from ..services.unified_ai import UnifiedAIClient
from .knowledge.retriever import KnowledgeRetriever

logger = logging.getLogger(__name__)


class EnhancedAgent:
    """增强版Agent，支持基于知识库的写作"""

    def __init__(self,
                 agent: Agent,
                 api_key: str,
                 knowledge_dir: str = "./agent_knowledge"):
        """
        初始化增强Agent

        Args:
            agent: Agent模型实例
            api_key: AI API密钥
            knowledge_dir: 知识库存储目录
        """
        self.agent = agent
        self.ai_client = UnifiedAIClient(api_key)

        # 为每个Agent创建独立的知识库
        collection_name = f"agent_{agent.id}_knowledge"
        self.retriever = KnowledgeRetriever(
            persist_dir=knowledge_dir,
            collection_name=collection_name
        )

    def build_knowledge_base(self, articles: List[Article], quality_threshold: float = 0.7):
        """
        构建知识库（从历史文章中学习）

        Args:
            articles: 文章列表
            quality_threshold: 质量阈值（可以基于用户反馈、发布状态等判断）
        """
        added_count = 0

        for article in articles:
            # 判断文章质量（这里简化处理，实际可以更复杂）
            is_high_quality = (
                article.publishStatus == "published" or
                article.githubUrl is not None
            )

            if not is_high_quality:
                continue

            # 添加到知识库
            metadata = {
                "article_id": article.id,
                "title": article.title,
                "author": article.author,
                "created_at": article.createdAt.isoformat() if article.createdAt else None,
                "published": article.publishStatus == "published",
                "source": "article"
            }

            try:
                self.retriever.add_document(
                    text=article.content,
                    metadata=metadata,
                    chunk_strategy="markdown"
                )
                added_count += 1
                logger.info(f"Added article {article.id} to knowledge base")
            except Exception as e:
                logger.error(f"Failed to add article {article.id}: {e}")

        logger.info(f"Built knowledge base with {added_count} articles")
        return added_count

    def add_external_knowledge(self, text: str, source: str, metadata: Optional[Dict] = None):
        """
        添加外部知识

        Args:
            text: 知识文本
            source: 来源标识
            metadata: 额外元数据
        """
        doc_metadata = {
            "source": source,
            "added_at": datetime.now().isoformat(),
            **(metadata or {})
        }

        return self.retriever.add_document(
            text=text,
            metadata=doc_metadata
        )

    def generate_with_context(self,
                             prompt: str,
                             use_knowledge: bool = True,
                             n_contexts: int = 3) -> str:
        """
        基于上下文生成内容

        Args:
            prompt: 用户提示
            use_knowledge: 是否使用知识库
            n_contexts: 使用的上下文数量

        Returns:
            生成的内容
        """
        # 构建系统提示
        system_prompt = self._build_system_prompt()

        # 如果使用知识库，检索相关上下文
        if use_knowledge and self.retriever.store.count() > 0:
            context = self.retriever.get_context(prompt, n_chunks=n_contexts)

            if context:
                # 增强提示
                enhanced_prompt = f"""参考以下相关内容：

{context}

---

基于以上参考内容和你的知识，{prompt}"""
            else:
                enhanced_prompt = prompt
        else:
            enhanced_prompt = prompt

        # 调用AI生成
        try:
            response = self.ai_client.generate(
                model=self.agent.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": enhanced_prompt}
                ],
                temperature=0.7
            )
            return response
        except Exception as e:
            logger.error(f"Generation failed: {e}")
            raise

    def improve_text(self,
                    text: str,
                    instruction: str,
                    use_knowledge: bool = True) -> str:
        """
        改进文本

        Args:
            text: 原始文本
            instruction: 改进指令
            use_knowledge: 是否使用知识库

        Returns:
            改进后的文本
        """
        # 检索相似的优秀文本作为参考
        references = []
        if use_knowledge and self.retriever.store.count() > 0:
            similar_texts = self.retriever.search(text, n_results=2)
            references = [r["text"] for r in similar_texts if r["score"] > 0.7]

        # 构建改进提示
        improve_prompt = f"""原文：
{text}

改进要求：{instruction}"""

        if references:
            improve_prompt += f"""

可参考以下优秀示例的风格和结构：
{chr(10).join([f'示例{i+1}：{ref[:200]}...' for i, ref in enumerate(references)])}"""

        return self.generate_with_context(improve_prompt, use_knowledge=False)

    def suggest_topics(self, context: str = "", n_suggestions: int = 5) -> List[str]:
        """
        基于知识库推荐写作主题

        Args:
            context: 上下文信息
            n_suggestions: 推荐数量

        Returns:
            主题列表
        """
        # 从知识库中获取文章元数据
        all_docs = self.retriever.store.get_all(limit=50)

        existing_titles = []
        if all_docs and "metadatas" in all_docs:
            existing_titles = [
                meta.get("title", "")
                for meta in all_docs["metadatas"]
                if meta.get("title")
            ]

        prompt = f"""基于以下已写过的文章主题：
{chr(10).join(existing_titles[:20])}

{"结合用户关注的内容：" + context if context else ""}

请推荐{n_suggestions}个新的写作主题，要求：
1. 与已有主题相关但不重复
2. 有价值和吸引力
3. 符合专业领域

直接列出主题，每行一个："""

        response = self.generate_with_context(prompt, use_knowledge=False)

        # 解析响应
        topics = [
            line.strip().lstrip("0123456789.- ")
            for line in response.split("\n")
            if line.strip()
        ]

        return topics[:n_suggestions]

    def _build_system_prompt(self) -> str:
        """
        构建系统提示

        Returns:
            系统提示文本
        """
        base_prompt = f"""你是一个专业的写作助手。

写作风格：{self.agent.tone}
文章长度偏好：{self.agent.lengthPreference}
目标受众：{self.agent.targetAudience}"""

        if self.agent.customPrompt:
            base_prompt += f"\n\n特殊要求：{self.agent.customPrompt}"

        return base_prompt

    def get_knowledge_stats(self) -> Dict:
        """
        获取知识库统计

        Returns:
            统计信息
        """
        stats = self.retriever.get_stats()
        stats["agent_id"] = self.agent.id
        stats["agent_name"] = self.agent.name

        return stats

    def clear_knowledge(self):
        """清空知识库"""
        self.retriever.store.clear()
        logger.info(f"Cleared knowledge base for agent {self.agent.id}")
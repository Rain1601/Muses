"""
续写文本prompt
延续内容发展
"""

from ..base import BasePromptBuilder


class ContinuePrompt(BasePromptBuilder):
    """续写文本的Prompt构建器"""

    def build_role(self) -> str:
        """构建角色描述"""
        return "你是一位富有创造力的写作专家，擅长延续和发展内容。"

    def build_task(self) -> str:
        """构建任务描述"""
        return "基于给定的文本，自然地续写后续内容。"

    def build_constraints(self) -> list:
        """构建约束条件"""
        return [
            "保持与原文风格一致",
            "逻辑连贯自然",
            "延续原文的主题和观点",
            "保持相同的人称和时态",
            "续写长度与原文相当",
            "自然过渡，不生硬"
        ]

    def build_quality_requirements(self) -> list:
        """构建质量要求"""
        return [
            "续写要流畅自然",
            "内容要有价值和深度",
            "保持叙述的连贯性",
            "符合上下文逻辑"
        ]
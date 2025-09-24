"""
润色文本prompt
提升文采和表达效果
"""

from ..base import BasePromptBuilder


class PolishPrompt(BasePromptBuilder):
    """润色文本的Prompt构建器"""

    def build_role(self) -> str:
        """构建角色描述"""
        return "你是一位文采斐然的写作大师，擅长润色和美化文本。"

    def build_task(self) -> str:
        """构建任务描述"""
        return "润色以下文本，提升其文采和表达效果。"

    def build_constraints(self) -> list:
        """构建约束条件"""
        return [
            "保持原意不变",
            "优化用词和修辞",
            "增强语言的感染力",
            "改善节奏和韵律",
            "适当使用修辞手法",
            "保持风格的一致性"
        ]

    def build_quality_requirements(self) -> list:
        """构建质量要求"""
        return [
            "文采要有明显提升",
            "表达要优美自然",
            "避免过度修饰",
            "保持阅读流畅性"
        ]
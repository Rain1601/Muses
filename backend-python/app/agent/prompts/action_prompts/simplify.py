"""
简化文本prompt
使文本更易理解
"""

from ..base import BasePromptBuilder


class SimplifyPrompt(BasePromptBuilder):
    """简化文本的Prompt构建器"""

    def build_role(self) -> str:
        """构建角色描述"""
        return "你是一位擅长简化复杂内容的沟通专家。"

    def build_task(self) -> str:
        """构建任务描述"""
        return "简化以下文本，使其更容易理解。"

    def build_constraints(self) -> list:
        """构建约束条件"""
        return [
            "保持核心意思不变",
            "使用简单易懂的词汇",
            "缩短复杂的句子",
            "去除专业术语或用通俗说法替代",
            "添加必要的解释",
            "保持逻辑清晰"
        ]

    def build_quality_requirements(self) -> list:
        """构建质量要求"""
        return [
            "简化后要容易理解",
            "不能丢失重要信息",
            "语言要自然",
            "适合普通读者阅读"
        ]
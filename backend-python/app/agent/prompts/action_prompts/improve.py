"""
改进文本prompt
提升文本质量和清晰度
"""

from ..base import BasePromptBuilder


class ImprovePrompt(BasePromptBuilder):
    """改进文本的Prompt构建器"""

    def build_role(self) -> str:
        """构建角色描述"""
        return "你是一位专业的文本编辑专家，擅长优化和改进各类文本内容。"

    def build_task(self) -> str:
        """构建任务描述"""
        return "改进以下文本，使其更加清晰、准确、有说服力。"

    def build_constraints(self) -> list:
        """构建约束条件"""
        return [
            "保持原文的核心意思不变",
            "修正语法和拼写错误",
            "优化句子结构和表达方式",
            "增强逻辑连贯性",
            "提升专业性和可读性",
            "保持原文的语言风格（正式/非正式）"
        ]

    def build_quality_requirements(self) -> list:
        """构建质量要求"""
        return [
            "改进后的文本要比原文更专业",
            "语言要自然流畅",
            "逻辑要更加清晰",
            "去除冗余和重复内容"
        ]
"""
翻译文本prompt
跨语言转换
"""

from typing import Optional
from ..base import BasePromptBuilder


class TranslatePrompt(BasePromptBuilder):
    """翻译文本的Prompt构建器"""

    def __init__(self, target_language: Optional[str] = None):
        """
        初始化翻译prompt

        Args:
            target_language: 目标语言
        """
        super().__init__()
        self.target_language = target_language or "英语"

    def build_role(self) -> str:
        """构建角色描述"""
        return f"你是一位精通多语言的专业翻译，尤其擅长翻译成{self.target_language}。"

    def build_task(self) -> str:
        """构建任务描述"""
        return f"将以下文本准确翻译成{self.target_language}。"

    def build_constraints(self) -> list:
        """构建约束条件"""
        return [
            "保持原文的完整意思",
            "使用目标语言的地道表达",
            "保持原文的语气和风格",
            "专有名词保持一致性",
            "文化相关内容要适当本地化",
            "保留原文的格式（如列表、段落）"
        ]

    def build_quality_requirements(self) -> list:
        """构建质量要求"""
        return [
            "翻译要准确无误",
            "表达要自然流畅",
            "符合目标语言的习惯",
            "保持专业水准"
        ]
"""
翻译文本prompt
跨语言转换
"""

from typing import Optional, List, Dict
from ..base import BasePromptBuilder


class TranslatePrompt(BasePromptBuilder):
    """翻译文本的Prompt构建器"""

    def __init__(self, target_language: Optional[str] = None):
        """
        初始化翻译prompt

        Args:
            target_language: 目标语言
        """
        self.target_language = target_language or "英语"

    def build_task_guidance(self) -> str:
        """构建任务执行指导"""
        return (
            f"对于翻译任务，你需要将文本准确转换为{self.target_language}。"
            f"执行这个任务的关键是既要保持原文的准确含义，又要使用{self.target_language}的地道表达方式。"
        )

    def build_execution_steps(self) -> List[str]:
        """构建具体执行步骤"""
        return [
            "通读原文，理解完整含义和语境",
            "识别文化特定的表达和习语",
            "确定专有名词的标准译法",
            f"选择符合{self.target_language}习惯的表达方式",
            "保持原文的语气和风格特点",
            "处理文化差异，进行必要的本地化",
            "检查译文的流畅性和准确性"
        ]

    def build_quality_criteria(self) -> List[str]:
        """构建质量标准"""
        return [
            "原文含义完整准确传达",
            f"符合{self.target_language}的语言习惯",
            "专业术语翻译准确",
            "保持原文风格和语气",
            "没有遗漏或添加信息",
            "译文自然流畅，易于理解"
        ]

    def build_attention_points(self) -> List[str]:
        """构建注意事项"""
        return [
            "注意文化背景差异",
            "保持专有名词的一致性",
            "避免直译导致的生硬表达",
            "处理好习语和俚语的翻译",
            "保留原文的格式和排版"
        ]
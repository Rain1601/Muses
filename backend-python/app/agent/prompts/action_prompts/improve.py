"""
改进文本prompt
提升文本质量和清晰度
"""

from typing import List, Dict
from ..base import BasePromptBuilder


class ImprovePrompt(BasePromptBuilder):
    """改进文本的Prompt构建器"""

    def build_task_guidance(self) -> str:
        """构建任务执行指导"""
        return (
            "对于改进文本任务，你需要全面提升文本的质量和表达效果。"
            "执行这个任务的关键是在保持原意不变的前提下，优化表达方式、修正错误并增强说服力。"
        )

    def build_execution_steps(self) -> List[str]:
        """构建具体执行步骤"""
        return [
            "仔细阅读原文，理解核心意思和写作意图",
            "识别并标记语法错误、拼写错误和不当表达",
            "分析句子结构，找出可以优化的地方",
            "检查逻辑连贯性，确保段落之间衔接自然",
            "提升专业词汇和表达的准确性",
            "去除冗余内容，精炼表达",
            "保持原文的语言风格和语气"
        ]

    def build_quality_criteria(self) -> List[str]:
        """构建质量标准"""
        return [
            "核心意思必须保持不变",
            "语言表达更加专业准确",
            "句子结构清晰流畅",
            "逻辑更加严密连贯",
            "无语法和拼写错误",
            "可读性明显提升"
        ]

    def build_attention_points(self) -> List[str]:
        """构建注意事项"""
        return [
            "不要改变作者的原意和立场",
            "保持原文的感情色彩",
            "避免过度修饰导致华而不实",
            "注意保持文体的一致性"
        ]
"""
扩展文本prompt
丰富和深化文本内容
"""

from typing import List, Dict
from ..base import BasePromptBuilder


class ExpandPrompt(BasePromptBuilder):
    """扩展文本的Prompt构建器"""

    def build_task_guidance(self) -> str:
        """构建任务执行指导"""
        return (
            "对于扩展文本任务，你需要在原文基础上添加深度和广度。"
            "执行这个任务的关键是围绕核心主题，通过增加细节、例子和背景信息来丰富内容。"
        )

    def build_execution_steps(self) -> List[str]:
        """构建具体执行步骤"""
        return [
            "理解原文的核心主题和主要观点",
            "识别可以深入展开的关键概念",
            "为每个要点添加具体的例子和案例",
            "补充相关的背景知识和上下文",
            "深化分析，增加不同角度的解释",
            "确保扩展内容与原文风格一致",
            "检查新增内容的逻辑连贯性"
        ]

    def build_quality_criteria(self) -> List[str]:
        """构建质量标准"""
        return [
            "保持原文主题和立场不变",
            "扩展内容有实质性价值",
            "新增信息准确可靠",
            "长度达到原文的2-3倍",
            "段落结构清晰有序",
            "避免重复和空洞的内容"
        ]

    def build_attention_points(self) -> List[str]:
        """构建注意事项"""
        return [
            "不要偏离原文的核心主题",
            "确保例子和案例的相关性",
            "避免为了扩展而添加无关内容",
            "保持整体风格的一致性"
        ]
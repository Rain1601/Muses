"""
解释文本prompt
详细阐述概念和含义
"""

from typing import List, Dict
from ..base import BasePromptBuilder


class ExplainPrompt(BasePromptBuilder):
    """解释文本的Prompt构建器"""

    def build_task_guidance(self) -> str:
        """构建任务执行指导"""
        return (
            "对于解释文本任务，你需要详细阐述文本的含义和背景。"
            "执行这个任务的关键是用通俗易懂的语言解释复杂概念，提供必要的背景信息，帮助读者深入理解。"
        )

    def build_execution_steps(self) -> List[str]:
        """构建具体执行步骤"""
        return [
            "识别需要解释的关键概念",
            "分析概念的内涵和外延",
            "提供必要的背景知识",
            "用通俗语言进行解释",
            "举例说明抽象概念",
            "解释隐含的意思和暗示",
            "说明实际应用和意义"
        ]

    def build_quality_criteria(self) -> List[str]:
        """构建质量标准"""
        return [
            "解释准确全面",
            "语言通俗易懂",
            "例子恰当贴切",
            "背景信息充分",
            "逻辑清晰有序",
            "有助于深入理解"
        ]

    def build_attention_points(self) -> List[str]:
        """构建注意事项"""
        return [
            "避免过于学术化的解释",
            "确保解释的准确性",
            "注意受众的知识水平",
            "不要偏离原文主题"
        ]

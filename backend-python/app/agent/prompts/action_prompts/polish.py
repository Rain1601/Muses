"""
润色文本prompt
提升文采和表达效果
"""

from typing import List, Dict
from ..base import BasePromptBuilder


class PolishPrompt(BasePromptBuilder):
    """润色文本的Prompt构建器"""
    def build_task_guidance(self) -> str:
        """构建任务执行指导"""
        return (
            "对于润色文本任务，你需要提升文本的文采和表达效果。执行这个任务的关键是优化用词、改善句式、增强语言的感染力，同时保持原意不变。"
        )

    def build_execution_steps(self) -> List[str]:
        """构建具体执行步骤"""
        return ['分析原文的风格基调', '优化词汇选择，使用更精准优美的词语', '改善句式结构，增加变化', '适当运用修辞手法', '调整语言节奏和韵律', '增强表达的感染力', '保持整体风格的统一']

    def build_quality_criteria(self) -> List[str]:
        """构建质量标准"""
        return ['文采有明显提升', '保持原意准确', '语言优美自然', '节奏流畅舒适', '修辞恰到好处', '整体风格协调']

    def build_attention_points(self) -> List[str]:
        """构建注意事项"""
        return ['避免过度修饰显得矫揉造作', '保持原文的基本风格', '不要改变作者的观点立场', '注意受众的接受度']

"""
续写文本prompt
延续内容发展
"""

from typing import List, Dict
from ..base import BasePromptBuilder


class ContinuePrompt(BasePromptBuilder):
    """续写文本的Prompt构建器"""
    def build_task_guidance(self) -> str:
        """构建任务执行指导"""
        return (
            "对于续写任务，你需要自然地延续原文内容。执行这个任务的关键是保持风格一致、逻辑连贯，让续写部分与原文浑然一体。"
        )

    def build_execution_steps(self) -> List[str]:
        """构建具体执行步骤"""
        return ['深入理解原文的内容和风格', '把握原文的写作思路和发展方向', '保持相同的人称和时态', '延续原文的语言风格和语气', '自然过渡，避免突兀', '合理发展情节或论述', '保持逻辑的连贯性']

    def build_quality_criteria(self) -> List[str]:
        """构建质量标准"""
        return ['与原文风格一致', '过渡自然流畅', '逻辑连贯合理', '内容有价值有深度', '保持相同的视角', '长度与原文相当']

    def build_attention_points(self) -> List[str]:
        """构建注意事项"""
        return ['不要偏离原文的主题', '避免风格突变', '保持时态和人称的一致', '注意前后逻辑的呼应']

"""
提取要点prompt
识别关键信息
"""

from typing import List, Dict
from ..base import BasePromptBuilder


class ExtractKeyPointsPrompt(BasePromptBuilder):
    """提取要点的Prompt构建器"""
    def build_task_guidance(self) -> str:
        """构建任务执行指导"""
        return (
            "对于提取要点任务，你需要识别文本中的关键信息。执行这个任务的关键是准确判断信息的重要性，提取核心观点和关键数据，形成清晰的要点列表。"
        )

    def build_execution_steps(self) -> List[str]:
        """构建具体执行步骤"""
        return ['通读全文，把握整体内容', '标记重要的观点和论述', '识别关键数据和事实', '评估各部分的重要性', '提取5-10个核心要点', '按重要性或逻辑顺序排列', '确保要点相互独立且完整']

    def build_quality_criteria(self) -> List[str]:
        """构建质量标准"""
        return ['要点准确全面', '不遗漏重要信息', '每个要点独立完整', '表述简洁明了', '按重要性排序', '便于快速理解']

    def build_attention_points(self) -> List[str]:
        """构建注意事项"""
        return ['避免重复和冗余', '保持客观中立', '不要添加个人解释', '确保要点的独立性']

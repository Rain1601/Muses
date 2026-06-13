"""
总结文本prompt
提取关键要点和核心内容
"""

from typing import List, Dict
from ..base import BasePromptBuilder


class SummarizePrompt(BasePromptBuilder):
    """总结文本的Prompt构建器"""

    def build_task_guidance(self) -> str:
        """构建任务执行指导"""
        return (
            "对于总结任务，你需要从文本中提取核心要点和关键信息。执行这个任务的关键是识别最重要的内容，去除细节，用简洁的语言概括主旨。"
        )

    def build_execution_steps(self) -> List[str]:
        """构建具体执行步骤"""
        return ['通读全文，理解整体内容', '识别文本的主题和核心观点', '提取3-5个关键要点', '按重要性对要点进行排序', '去除细节和例子，保留核心信息', '用简洁语言重新组织要点', '确保总结准确反映原文主旨']

    def build_quality_criteria(self) -> List[str]:
        """构建质量标准"""
        return ['准确反映原文核心内容', '要点完整且相互独立', '语言精炼简洁', '长度不超过原文的30%', '逻辑结构清晰', '无遗漏重要信息']

    def build_attention_points(self) -> List[str]:
        """构建注意事项"""
        return ['不要添加原文没有的信息', '保持客观中立的立场', '避免过度简化导致失真', '注意保留关键数据和事实']

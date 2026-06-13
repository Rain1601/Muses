"""
专业化文本prompt
转换为专业风格
"""

from typing import List, Dict
from ..base import BasePromptBuilder


class MakeProfessionalPrompt(BasePromptBuilder):
    """专业化文本的Prompt构建器"""
    def build_task_guidance(self) -> str:
        """构建任务执行指导"""
        return (
            "对于专业化文本任务，你需要将文本转换为正式的专业风格。执行这个任务的关键是使用专业术语、正式表达，去除口语化内容，使文本适合商务或学术场合。"
        )

    def build_execution_steps(self) -> List[str]:
        """构建具体执行步骤"""
        return ['识别口语化和非正式表达', '替换为专业术语和正式用语', '调整句式为正式风格', '增强逻辑性和条理性', '使用被动语态和客观表述', '去除个人化和情感化表达', '确保专业性和权威性']

    def build_quality_criteria(self) -> List[str]:
        """构建质量标准"""
        return ['专业度明显提升', '适合正式场合', '术语使用准确', '逻辑严谨清晰', '表述客观中立', '结构规范有序']

    def build_attention_points(self) -> List[str]:
        """构建注意事项"""
        return ['避免过于生硬晦涩', '保持信息的完整性', '注意行业术语的准确性', '考虑目标读者的专业水平']

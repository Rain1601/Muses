"""
生成大纲prompt
创建结构化大纲
"""

from typing import List, Dict
from ..base import BasePromptBuilder


class GenerateOutlinePrompt(BasePromptBuilder):
    """生成大纲的Prompt构建器"""
    def build_task_guidance(self) -> str:
        """构建任务执行指导"""
        return (
            "对于生成大纲任务，你需要创建文本的结构化框架。执行这个任务的关键是理清逻辑关系，建立层次分明的结构，形成清晰的内容框架。"
        )

    def build_execution_steps(self) -> List[str]:
        """构建具体执行步骤"""
        return ['分析文本的整体结构', '识别主要章节和段落', '提取各部分的核心主题', '建立层次关系', '组织成多级标题结构', '确保逻辑顺序合理', '添加必要的细节说明']

    def build_quality_criteria(self) -> List[str]:
        """构建质量标准"""
        return ['结构完整合理', '层次清晰分明', '逻辑关系正确', '覆盖所有重要内容', '标题概括准确', '便于理解和扩展']

    def build_attention_points(self) -> List[str]:
        """构建注意事项"""
        return ['保持适当的详细程度', '避免过于复杂的层级', '确保大纲的实用性', '注意逻辑的连贯性']

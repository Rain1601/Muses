"""
修正语法prompt
纠正语言错误
"""

from typing import List, Dict
from ..base import BasePromptBuilder


class FixGrammarPrompt(BasePromptBuilder):
    """修正语法的Prompt构建器"""
    def build_task_guidance(self) -> str:
        """构建任务执行指导"""
        return (
            "对于修正语法任务，你需要找出并纠正文本中的语言错误。执行这个任务的关键是仔细检查语法、拼写、标点等问题，确保文本规范准确。"
        )

    def build_execution_steps(self) -> List[str]:
        """构建具体执行步骤"""
        return ['逐句检查语法错误', '查找拼写错误', '检查标点符号使用', '确保主谓一致', '验证时态一致性', '检查词语搭配是否恰当', '确保句子结构完整']

    def build_quality_criteria(self) -> List[str]:
        """构建质量标准"""
        return ['消除所有语法错误', '拼写完全正确', '标点使用规范', '时态一致准确', '句子结构完整', '保持原意不变']

    def build_attention_points(self) -> List[str]:
        """构建注意事项"""
        return ['只修正错误，不改变风格', '保持原文的表达特点', '不要过度修改', '注意保留作者的语言特色']

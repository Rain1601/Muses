"""
解释文本prompt
详细阐述概念和含义
"""

from ..base import BasePromptBuilder


class ExplainPrompt(BasePromptBuilder):
    """解释文本的Prompt构建器"""

    def build_role(self) -> str:
        """构建角色描述"""
        return "你是一位善于解释复杂概念的教育专家。"

    def build_task(self) -> str:
        """构建任务描述"""
        return "详细解释以下文本的含义、背景和相关概念。"

    def build_constraints(self) -> list:
        """构建约束条件"""
        return [
            "解释核心概念和术语",
            "提供必要的背景信息",
            "使用通俗易懂的语言",
            "给出具体的例子",
            "解释隐含的意思",
            "说明实际应用场景"
        ]

    def build_quality_requirements(self) -> list:
        """构建质量要求"""
        return [
            "解释要准确全面",
            "要易于理解",
            "例子要恰当",
            "逻辑要清晰"
        ]
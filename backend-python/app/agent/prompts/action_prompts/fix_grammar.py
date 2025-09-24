"""
修正语法prompt
纠正语言错误
"""

from ..base import BasePromptBuilder


class FixGrammarPrompt(BasePromptBuilder):
    """修正语法的Prompt构建器"""

    def build_role(self) -> str:
        """构建角色描述"""
        return "你是一位严谨的语言专家，精通语法和拼写规则。"

    def build_task(self) -> str:
        """构建任务描述"""
        return "检查并修正以下文本中的语法和拼写错误。"

    def build_constraints(self) -> list:
        """构建约束条件"""
        return [
            "保持原意不变",
            "修正所有语法错误",
            "纠正拼写错误",
            "统一标点符号使用",
            "修正时态一致性",
            "确保主谓一致"
        ]

    def build_quality_requirements(self) -> list:
        """构建质量要求"""
        return [
            "修正要准确无误",
            "不改变原文意思",
            "保持原文风格",
            "语言要规范标准"
        ]
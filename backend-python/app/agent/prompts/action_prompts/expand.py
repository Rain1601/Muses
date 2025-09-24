"""
扩展文本prompt
丰富和深化文本内容
"""

from ..base import BasePromptBuilder


class ExpandPrompt(BasePromptBuilder):
    """扩展文本的Prompt构建器"""

    def build_role(self) -> str:
        """构建角色描述"""
        return "你是一位善于深化内容的写作专家，能够丰富和扩展现有文本。"

    def build_task(self) -> str:
        """构建任务描述"""
        return "扩展以下文本，添加更多细节、例子和相关信息。"

    def build_constraints(self) -> list:
        """构建约束条件"""
        return [
            "保持原文的主题和观点",
            "添加具体的例子和案例",
            "提供更深入的解释和分析",
            "增加相关的背景信息",
            "扩展到原文长度的2-3倍",
            "确保新增内容与原文风格一致"
        ]

    def build_quality_requirements(self) -> list:
        """构建质量要求"""
        return [
            "扩展的内容要有价值",
            "新增信息要准确可靠",
            "保持段落结构清晰",
            "避免无意义的填充内容"
        ]
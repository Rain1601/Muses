"""
提取要点prompt
识别关键信息
"""

from ..base import BasePromptBuilder


class ExtractKeyPointsPrompt(BasePromptBuilder):
    """提取要点的Prompt构建器"""

    def build_role(self) -> str:
        """构建角色描述"""
        return "你是一位善于分析和提炼信息的专家。"

    def build_task(self) -> str:
        """构建任务描述"""
        return "从以下文本中提取关键要点和重要信息。"

    def build_constraints(self) -> list:
        """构建约束条件"""
        return [
            "提取5-10个关键要点",
            "按重要性排序",
            "每个要点简洁明了",
            "避免重复信息",
            "保留核心观点和数据",
            "用列表形式呈现"
        ]

    def build_quality_requirements(self) -> list:
        """构建质量要求"""
        return [
            "要点要准确全面",
            "不遗漏重要信息",
            "表述要精炼",
            "便于快速理解"
        ]
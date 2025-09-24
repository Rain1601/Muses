"""
生成大纲prompt
创建结构化大纲
"""

from ..base import BasePromptBuilder


class GenerateOutlinePrompt(BasePromptBuilder):
    """生成大纲的Prompt构建器"""

    def build_role(self) -> str:
        """构建角色描述"""
        return "你是一位逻辑清晰的内容架构师，擅长组织和规划内容结构。"

    def build_task(self) -> str:
        """构建任务描述"""
        return "基于以下文本内容，生成一个结构化的大纲。"

    def build_constraints(self) -> list:
        """构建约束条件"""
        return [
            "使用多级标题结构",
            "逻辑层次清晰",
            "包含主要观点和支撑细节",
            "每个部分有明确主题",
            "保持3-4级深度",
            "使用标准大纲格式"
        ]

    def build_quality_requirements(self) -> list:
        """构建质量要求"""
        return [
            "结构要完整合理",
            "层次要分明",
            "便于理解和扩展",
            "覆盖所有重要内容"
        ]
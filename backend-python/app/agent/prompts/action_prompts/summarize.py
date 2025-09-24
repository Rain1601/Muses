"""
总结文本prompt
提取关键要点和核心内容
"""

from ..base import BasePromptBuilder


class SummarizePrompt(BasePromptBuilder):
    """总结文本的Prompt构建器"""

    def build_role(self) -> str:
        """构建角色描述"""
        return "你是一位精通信息提炼的分析专家，擅长抓住要点并简明表达。"

    def build_task(self) -> str:
        """构建任务描述"""
        return "总结以下文本的核心内容，提取关键要点。"

    def build_constraints(self) -> list:
        """构建约束条件"""
        return [
            "提取3-5个关键要点",
            "保留最重要的信息",
            "去除细节和例子",
            "使用简洁明了的语言",
            "总结长度不超过原文的30%",
            "按重要性排序要点"
        ]

    def build_quality_requirements(self) -> list:
        """构建质量要求"""
        return [
            "总结要准确反映原文主旨",
            "要点要完整且独立",
            "语言要精炼",
            "逻辑结构要清晰"
        ]
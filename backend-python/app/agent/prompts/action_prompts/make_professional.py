"""
专业化文本prompt
转换为专业风格
"""

from ..base import BasePromptBuilder


class MakeProfessionalPrompt(BasePromptBuilder):
    """专业化文本的Prompt构建器"""

    def build_role(self) -> str:
        """构建角色描述"""
        return "你是一位专业的商务写作专家，擅长将文本转化为专业风格。"

    def build_task(self) -> str:
        """构建任务描述"""
        return "将以下文本改写为专业、正式的风格。"

    def build_constraints(self) -> list:
        """构建约束条件"""
        return [
            "保持核心信息不变",
            "使用专业术语和表达",
            "采用正式的语言风格",
            "去除口语化表达",
            "增强逻辑性和条理性",
            "使用被动语态和客观表述"
        ]

    def build_quality_requirements(self) -> list:
        """构建质量要求"""
        return [
            "专业度要明显提升",
            "适合商务场合使用",
            "表达要准确严谨",
            "结构要清晰有序"
        ]
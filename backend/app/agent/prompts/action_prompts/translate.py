"""
翻译文本prompt
跨语言转换
"""

from typing import Optional, List, Dict
from ..base import BasePromptBuilder


class TranslatePrompt(BasePromptBuilder):
    """翻译文本的Prompt构建器"""

    def __init__(self, target_language: Optional[str] = None):
        """
        初始化翻译prompt

        Args:
            target_language: 目标语言
        """
        self.target_language = target_language or "英语"

    def build_task_guidance(self) -> str:
        """构建任务执行指导"""
        return (
            f"你是专业翻译。把用户给的一段文字准确翻译成{self.target_language}。"
            f"输入是从富文本编辑器里抽出的纯文本片段——结构(标题/段落/列表)已经由外层处理,"
            f"你只负责返回这一段的纯文本译文,不要补充任何 markdown 标记或排版符号。"
        )

    def build_execution_steps(self) -> List[str]:
        """构建具体执行步骤"""
        return [
            "通读原文,理解完整含义和语境",
            "识别文化特定的表达和习语",
            "确定专有名词的标准译法",
            f"选择符合{self.target_language}习惯的表达方式",
            "保持原文的语气和风格特点",
            "处理文化差异,进行必要的本地化",
            "检查译文的流畅性和准确性",
        ]

    def build_quality_criteria(self) -> List[str]:
        """构建质量标准"""
        return [
            "原文含义完整准确传达",
            f"符合{self.target_language}的语言习惯",
            "专业术语翻译准确",
            "保持原文风格和语气",
            "没有遗漏或添加信息",
            "译文自然流畅,易于理解",
            "输出纯文本——不含任何 markdown 标记",
        ]

    def build_attention_points(self) -> List[str]:
        """构建注意事项"""
        return [
            "注意文化背景差异",
            "保持专有名词的一致性",
            "避免直译导致的生硬表达",
            "处理好习语和俚语的翻译",
            # 关键:明确禁止 markdown 标记,否则 Claude 会自作主张给翻译加 #/**/-/数字./``` 标记,
            # 导致译文塞回 HTML <tag> 后渲染时一坨乱码。
            "**严禁**在译文中添加任何 markdown 标记。具体说:不要加 # / ## / ### 之类的标题号,"
            "不要加 ** 加粗或 * 斜体,不要加 - 或 1./2. 列表符号,不要加 ``` 代码围栏,不要加 `行内代码`。"
            "原文什么标点你就用什么标点;输出**只能是纯文本**,由外层组件负责套回 HTML 结构。",
            "如果原文只有一句话/一个短语,译文也只输出对应的一句话/一个短语,不要加额外的解释或前后缀。",
        ]
"""
任务特定的Prompt构建器
为工具栏中的每个动作提供精细化的prompt
"""

from typing import Optional, List, Dict
from .base import BasePromptBuilder, PromptTemplate


class ImprovePrompt(BasePromptBuilder):
    """改进文本的Prompt"""

    def build_role(self) -> str:
        return "你是一位专业的文本编辑专家，擅长优化和改进各类文本内容。"

    def build_task(self, **kwargs) -> str:
        return "改进以下文本，使其更加清晰、准确、有说服力。"

    def build_constraints(self) -> List[str]:
        return [
            "保持原文的核心意思不变",
            "修正语法和拼写错误",
            "优化句子结构和表达方式",
            "增强逻辑连贯性",
            "提升专业性和可读性",
            "保持原文的语言风格（正式/非正式）"
        ]

    def build_quality_requirements(self) -> List[str]:
        return [
            "改进后的文本要比原文更专业",
            "语言要自然流畅",
            "逻辑要更加清晰",
            "去除冗余和重复内容"
        ]


class ExpandPrompt(BasePromptBuilder):
    """扩展文本的Prompt"""

    def build_role(self) -> str:
        return "你是一位善于深化内容的写作专家，能够丰富和扩展现有文本。"

    def build_task(self, **kwargs) -> str:
        return "扩展以下文本，添加更多细节、例子和相关信息。"

    def build_constraints(self) -> List[str]:
        return [
            "保持原文的主题和观点",
            "添加具体的例子和案例",
            "提供更深入的解释和分析",
            "增加相关的背景信息",
            "扩展到原文长度的2-3倍",
            "确保新增内容与原文风格一致"
        ]

    def build_quality_requirements(self) -> List[str]:
        return [
            "扩展的内容要有价值",
            "新增信息要准确可靠",
            "保持段落结构清晰",
            "避免无意义的填充内容"
        ]


class SummarizePrompt(BasePromptBuilder):
    """总结文本的Prompt"""

    def build_role(self) -> str:
        return "你是一位精通信息提炼的分析专家，擅长抓住要点并简明表达。"

    def build_task(self, **kwargs) -> str:
        return "总结以下文本的核心内容，提取关键要点。"

    def build_constraints(self) -> List[str]:
        return [
            "提取3-5个关键要点",
            "保留最重要的信息",
            "去除细节和例子",
            "使用简洁明了的语言",
            "总结长度不超过原文的30%",
            "按重要性排序要点"
        ]

    def build_quality_requirements(self) -> List[str]:
        return [
            "总结要准确反映原文主旨",
            "要点要完整且独立",
            "语言要精炼",
            "逻辑结构要清晰"
        ]


class SimplifyPrompt(BasePromptBuilder):
    """简化文本的Prompt"""

    def build_role(self) -> str:
        return "你是一位擅长将复杂内容简单化的沟通专家。"

    def build_task(self, **kwargs) -> str:
        return "简化以下文本，使其更容易理解。"

    def build_constraints(self) -> List[str]:
        return [
            "使用简单常用的词汇",
            "缩短复杂的句子",
            "解释专业术语",
            "去除不必要的修饰",
            "保持核心信息完整",
            "适合普通读者理解"
        ]

    def build_quality_requirements(self) -> List[str]:
        return [
            "简化后要易于理解",
            "不能丢失关键信息",
            "保持逻辑清晰",
            "语言要自然"
        ]


class TranslatePrompt(BasePromptBuilder):
    """翻译文本的Prompt"""

    def __init__(self, target_language: str = "en"):
        super().__init__()
        self.target_language = target_language

    def build_role(self) -> str:
        lang_map = {
            "en": "英文",
            "zh": "中文",
            "ja": "日文",
            "ko": "韩文",
            "fr": "法文",
            "de": "德文",
            "es": "西班牙文"
        }
        target = lang_map.get(self.target_language, self.target_language)
        return f"你是一位精通多语言的专业翻译，尤其擅长{target}翻译。"

    def build_task(self, **kwargs) -> str:
        return f"将以下文本准确翻译成{self.target_language}。"

    def build_constraints(self) -> List[str]:
        return [
            "保持原文的语气和风格",
            "准确传达原意",
            "使用地道的目标语言表达",
            "保留专有名词",
            "适当处理文化差异",
            "保持格式和结构"
        ]

    def build_quality_requirements(self) -> List[str]:
        return [
            "翻译要准确无误",
            "语言要自然地道",
            "符合目标语言的表达习惯",
            "保持原文的语言风格"
        ]


class PolishPrompt(BasePromptBuilder):
    """润色文本的Prompt"""

    def build_role(self) -> str:
        return "你是一位资深的文字编辑，擅长文本润色和优化。"

    def build_task(self, **kwargs) -> str:
        return "润色以下文本，提升其表达质量和文采。"

    def build_constraints(self) -> List[str]:
        return [
            "优化词汇选择",
            "改善句子节奏",
            "增强表达的优雅性",
            "保持原意不变",
            "提升整体文采",
            "去除口语化表达"
        ]

    def build_quality_requirements(self) -> List[str]:
        return [
            "润色后的文本要更优美",
            "表达要更精确",
            "阅读体验要更好",
            "保持专业性"
        ]


class ContinuePrompt(BasePromptBuilder):
    """续写文本的Prompt"""

    def build_role(self) -> str:
        return "你是一位创意写作专家，擅长延续和发展现有内容。"

    def build_task(self, **kwargs) -> str:
        return "续写以下文本，自然地延续其内容和风格。"

    def build_constraints(self) -> List[str]:
        return [
            "保持与原文一致的风格",
            "逻辑上自然衔接",
            "延续原文的主题",
            "保持相同的语气",
            "续写长度适中（200-500字）",
            "避免重复原文内容"
        ]

    def build_quality_requirements(self) -> List[str]:
        return [
            "续写要流畅自然",
            "内容要有新意",
            "逻辑要连贯",
            "质量不低于原文"
        ]


class ExplainPrompt(BasePromptBuilder):
    """解释文本的Prompt"""

    def build_role(self) -> str:
        return "你是一位善于解释复杂概念的教育专家。"

    def build_task(self, **kwargs) -> str:
        return "详细解释以下文本的含义、背景和相关概念。"

    def build_constraints(self) -> List[str]:
        return [
            "解释核心概念和术语",
            "提供必要的背景信息",
            "使用通俗易懂的语言",
            "给出具体的例子",
            "解释隐含的意思",
            "说明实际应用场景"
        ]

    def build_quality_requirements(self) -> List[str]:
        return [
            "解释要准确全面",
            "要易于理解",
            "例子要恰当",
            "逻辑要清晰"
        ]


class FixGrammarPrompt(BasePromptBuilder):
    """修正语法的Prompt"""

    def build_role(self) -> str:
        return "你是一位专业的语言校对专家，精通语法和拼写规则。"

    def build_task(self, **kwargs) -> str:
        return "修正以下文本中的语法、拼写和标点错误。"

    def build_constraints(self) -> List[str]:
        return [
            "修正所有语法错误",
            "纠正拼写错误",
            "修正标点符号使用",
            "保持原文意思不变",
            "只修改错误部分",
            "标注主要修改内容"
        ]

    def build_quality_requirements(self) -> List[str]:
        return [
            "修正要准确无误",
            "不改变原意",
            "保持原文风格",
            "符合语言规范"
        ]


class MakeProfessionalPrompt(BasePromptBuilder):
    """专业化文本的Prompt"""

    def build_role(self) -> str:
        return "你是一位商务写作专家，擅长将文本转化为专业的商务风格。"

    def build_task(self, **kwargs) -> str:
        return "将以下文本改写为专业的商务/学术风格。"

    def build_constraints(self) -> List[str]:
        return [
            "使用正式的商务语言",
            "采用专业术语",
            "去除口语化表达",
            "使用被动语态（适当）",
            "保持客观中立的语气",
            "结构要严谨"
        ]

    def build_quality_requirements(self) -> List[str]:
        return [
            "文本要显得专业",
            "措辞要准确严谨",
            "逻辑要清晰",
            "符合行业规范"
        ]


class ExtractKeyPointsPrompt(BasePromptBuilder):
    """提取要点的Prompt"""

    def build_role(self) -> str:
        return "你是一位信息分析专家，擅长识别和提取关键信息。"

    def build_task(self, **kwargs) -> str:
        return "从以下文本中提取关键要点和核心观点。"

    def build_constraints(self) -> List[str]:
        return [
            "识别主要论点",
            "提取关键数据和事实",
            "标注重要概念",
            "按重要性排序",
            "每个要点独立完整",
            "使用列表格式呈现"
        ]

    def build_quality_requirements(self) -> List[str]:
        return [
            "要点要准确",
            "不遗漏重要信息",
            "表述要简洁",
            "便于快速理解"
        ]


class GenerateOutlinePrompt(BasePromptBuilder):
    """生成大纲的Prompt"""

    def build_role(self) -> str:
        return "你是一位结构化思维专家，擅长组织和规划内容结构。"

    def build_task(self, **kwargs) -> str:
        return "为以下内容生成详细的大纲结构。"

    def build_constraints(self) -> List[str]:
        return [
            "创建多级标题结构",
            "每个部分要有清晰的主题",
            "包含要点说明",
            "逻辑层次分明",
            "适合扩展成完整文章",
            "使用标准大纲格式"
        ]

    def build_quality_requirements(self) -> List[str]:
        return [
            "结构要合理",
            "层次要清晰",
            "覆盖要全面",
            "便于后续写作"
        ]
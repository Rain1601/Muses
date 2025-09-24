"""
基础Prompt模板类
定义prompt的基本结构和构建逻辑
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from abc import ABC, abstractmethod


@dataclass
class PromptTemplate:
    """Prompt模板数据类"""

    # 基础模板
    role: str = ""  # 角色定义
    task: str = ""  # 任务描述
    context: str = ""  # 上下文信息
    constraints: List[str] = field(default_factory=list)  # 约束条件
    examples: List[Dict[str, str]] = field(default_factory=list)  # 示例
    output_format: str = ""  # 输出格式要求

    # 风格控制
    tone: Optional[str] = None  # 语气
    style: Optional[str] = None  # 风格
    language: str = "zh-CN"  # 语言

    # 质量控制
    quality_requirements: List[str] = field(default_factory=list)  # 质量要求
    avoid_list: List[str] = field(default_factory=list)  # 避免的内容

    def build(self, **kwargs) -> str:
        """构建最终的prompt"""
        sections = []

        # 角色定义
        if self.role:
            sections.append(f"# 角色\n{self.role}")

        # 任务描述
        if self.task:
            task_text = self.task.format(**kwargs) if kwargs else self.task
            sections.append(f"# 任务\n{task_text}")

        # 上下文
        if self.context:
            context_text = self.context.format(**kwargs) if kwargs else self.context
            sections.append(f"# 背景\n{context_text}")

        # 约束条件
        if self.constraints:
            constraints_text = "\n".join([f"- {c}" for c in self.constraints])
            sections.append(f"# 要求\n{constraints_text}")

        # 质量要求
        if self.quality_requirements:
            quality_text = "\n".join([f"- {q}" for q in self.quality_requirements])
            sections.append(f"# 质量标准\n{quality_text}")

        # 避免内容
        if self.avoid_list:
            avoid_text = "\n".join([f"- {a}" for a in self.avoid_list])
            sections.append(f"# 避免\n{avoid_text}")

        # 示例
        if self.examples:
            example_texts = []
            for i, example in enumerate(self.examples, 1):
                example_text = f"示例{i}:"
                if "input" in example:
                    example_text += f"\n输入: {example['input']}"
                if "output" in example:
                    example_text += f"\n输出: {example['output']}"
                example_texts.append(example_text)
            sections.append(f"# 示例\n{chr(10).join(example_texts)}")

        # 输出格式
        if self.output_format:
            sections.append(f"# 输出格式\n{self.output_format}")

        return "\n\n".join(sections)


class BasePromptBuilder(ABC):
    """Prompt构建器基类"""

    def __init__(self):
        self.template = PromptTemplate()

    @abstractmethod
    def build_role(self) -> str:
        """构建角色定义"""
        pass

    @abstractmethod
    def build_task(self, **kwargs) -> str:
        """构建任务描述"""
        pass

    def build_constraints(self) -> List[str]:
        """构建约束条件"""
        return []

    def build_examples(self) -> List[Dict[str, str]]:
        """构建示例"""
        return []

    def build_quality_requirements(self) -> List[str]:
        """构建质量要求"""
        return [
            "确保内容准确无误",
            "逻辑清晰连贯",
            "表达自然流畅"
        ]

    def build(self, **kwargs) -> str:
        """构建完整的prompt"""
        self.template.role = self.build_role()
        self.template.task = self.build_task(**kwargs)
        self.template.constraints = self.build_constraints()
        self.template.examples = self.build_examples()
        self.template.quality_requirements = self.build_quality_requirements()

        return self.template.build(**kwargs)


class ChainOfThoughtMixin:
    """思维链提示混入类"""

    def add_chain_of_thought(self, template: PromptTemplate):
        """添加思维链提示"""
        template.constraints.extend([
            "请一步一步地思考",
            "先分析问题的关键点",
            "展示你的推理过程",
            "最后给出结论"
        ])

        template.quality_requirements.append("推理过程要清晰可验证")


class CreativeWritingMixin:
    """创意写作混入类"""

    def add_creative_elements(self, template: PromptTemplate):
        """添加创意写作要素"""
        template.constraints.extend([
            "使用生动的描述和比喻",
            "保持叙述的趣味性",
            "适当加入个人见解",
            "避免枯燥的平铺直叙"
        ])

        template.quality_requirements.extend([
            "内容要有吸引力",
            "保持读者的阅读兴趣"
        ])


class TechnicalWritingMixin:
    """技术写作混入类"""

    def add_technical_requirements(self, template: PromptTemplate):
        """添加技术写作要求"""
        template.constraints.extend([
            "使用准确的技术术语",
            "提供具体的实现细节",
            "包含代码示例（如适用）",
            "解释技术原理"
        ])

        template.quality_requirements.extend([
            "技术描述要准确",
            "代码示例要可运行",
            "逻辑要严谨"
        ])

        template.avoid_list.extend([
            "模糊的技术描述",
            "未经验证的代码",
            "过时的技术方案"
        ])
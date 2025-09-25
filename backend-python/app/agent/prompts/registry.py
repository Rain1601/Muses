"""
Prompt注册表
管理和扩展prompt模板
"""

from typing import Dict, Type, Optional, Callable
from .base import BasePromptBuilder


class PromptRegistry:
    """Prompt模板注册表"""

    def __init__(self):
        self._prompts: Dict[str, Type[BasePromptBuilder]] = {}
        self._custom_builders: Dict[str, Callable] = {}

    def register(self, task: str, prompt_class: Type[BasePromptBuilder]):
        """
        注册prompt模板

        Args:
            task: 任务名称
            prompt_class: Prompt构建器类
        """
        if not issubclass(prompt_class, BasePromptBuilder):
            raise ValueError(f"{prompt_class} must be a subclass of BasePromptBuilder")

        self._prompts[task] = prompt_class

    def register_custom(self, task: str, builder_func: Callable):
        """
        注册自定义构建函数

        Args:
            task: 任务名称
            builder_func: 自定义构建函数
        """
        self._custom_builders[task] = builder_func

    def get(self, task: str) -> Optional[Type[BasePromptBuilder]]:
        """
        获取prompt模板类

        Args:
            task: 任务名称

        Returns:
            Prompt构建器类
        """
        return self._prompts.get(task)

    def get_custom_builder(self, task: str) -> Optional[Callable]:
        """
        获取自定义构建函数

        Args:
            task: 任务名称

        Returns:
            自定义构建函数
        """
        return self._custom_builders.get(task)

    def list_tasks(self) -> list:
        """列出所有注册的任务"""
        return list(self._prompts.keys()) + list(self._custom_builders.keys())

    def clear(self):
        """清空注册表"""
        self._prompts.clear()
        self._custom_builders.clear()


# 全局注册表实例
prompt_registry = PromptRegistry()


# 注册默认的任务prompt
def register_default_prompts():
    """注册默认的任务prompt"""
    from .action_prompts import (
        ImprovePrompt,
        ExpandPrompt,
        SummarizePrompt,
        SimplifyPrompt,
        TranslatePrompt,
        PolishPrompt,
        ContinuePrompt,
        ExplainPrompt,
        FixGrammarPrompt,
        MakeProfessionalPrompt,
        ExtractKeyPointsPrompt,
        GenerateOutlinePrompt
    )

    # improve/continue/
    prompt_registry.register("improve", ImprovePrompt)
    prompt_registry.register("expand", ExpandPrompt)
    prompt_registry.register("summarize", SummarizePrompt)
    prompt_registry.register("simplify", SimplifyPrompt)
    prompt_registry.register("translate", TranslatePrompt)
    prompt_registry.register("polish", PolishPrompt)
    prompt_registry.register("continue", ContinuePrompt)
    prompt_registry.register("explain", ExplainPrompt)
    prompt_registry.register("fix_grammar", FixGrammarPrompt)
    prompt_registry.register("make_professional", MakeProfessionalPrompt)
    prompt_registry.register("extract_key_points", ExtractKeyPointsPrompt)
    prompt_registry.register("generate_outline", GenerateOutlinePrompt)


# 初始化时注册默认prompt
register_default_prompts()
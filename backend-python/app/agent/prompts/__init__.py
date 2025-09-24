"""
Prompt管理模块
提供系统级的prompt模板和构建逻辑
"""

from .base import PromptTemplate, BasePromptBuilder
from .task_prompts import (
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
from .builder import PromptBuilder, AgentContext
from .registry import PromptRegistry

__all__ = [
    "PromptTemplate",
    "BasePromptBuilder",
    "PromptBuilder",
    "AgentContext",
    "PromptRegistry",
    # Task-specific prompts
    "ImprovePrompt",
    "ExpandPrompt",
    "SummarizePrompt",
    "SimplifyPrompt",
    "TranslatePrompt",
    "PolishPrompt",
    "ContinuePrompt",
    "ExplainPrompt",
    "FixGrammarPrompt",
    "MakeProfessionalPrompt",
    "ExtractKeyPointsPrompt",
    "GenerateOutlinePrompt"
]
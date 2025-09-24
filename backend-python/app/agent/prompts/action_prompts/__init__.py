"""
Action-specific prompt builders
每个文本操作的独立prompt构建器
"""

from .improve import ImprovePrompt
from .expand import ExpandPrompt
from .summarize import SummarizePrompt
from .simplify import SimplifyPrompt
from .translate import TranslatePrompt
from .polish import PolishPrompt
from .continue_text import ContinuePrompt
from .explain import ExplainPrompt
from .fix_grammar import FixGrammarPrompt
from .make_professional import MakeProfessionalPrompt
from .extract_key_points import ExtractKeyPointsPrompt
from .generate_outline import GenerateOutlinePrompt

__all__ = [
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
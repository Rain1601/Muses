"""
Prompt构建器
负责根据任务和Agent配置构建完整的system prompt
"""

from typing import Optional, Dict, Any
from dataclasses import dataclass
from .base import PromptTemplate
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


@dataclass
class AgentContext:
    """Agent上下文信息"""
    name: str
    language: str = "zh-CN"
    tone: str = "professional"
    target_audience: Optional[str] = None
    custom_prompt: Optional[str] = None
    description: Optional[str] = None


class PromptBuilder:
    """统一的Prompt构建器"""

    # 任务到Prompt类的映射
    TASK_PROMPT_MAP = {
        "improve": ImprovePrompt,
        "expand": ExpandPrompt,
        "summarize": SummarizePrompt,
        "simplify": SimplifyPrompt,
        "translate": TranslatePrompt,
        "polish": PolishPrompt,
        "continue": ContinuePrompt,
        "explain": ExplainPrompt,
        "fix_grammar": FixGrammarPrompt,
        "make_professional": MakeProfessionalPrompt,
        "extract_key_points": ExtractKeyPointsPrompt,
        "generate_outline": GenerateOutlinePrompt
    }

    # 语气映射
    TONE_MAP = {
        "professional": "专业严谨",
        "casual": "轻松随意",
        "humorous": "幽默风趣",
        "serious": "严肃认真",
        "friendly": "友好亲切",
        "academic": "学术严谨",
        "creative": "创意活泼"
    }

    @classmethod
    def build(cls,
             task: str,
             agent_context: Optional[AgentContext] = None,
             **kwargs) -> str:
        """
        构建完整的system prompt

        Args:
            task: 任务类型
            agent_context: Agent上下文信息
            **kwargs: 传递给具体prompt构建器的参数

        Returns:
            构建好的system prompt
        """
        # 获取任务对应的Prompt构建器
        prompt_class = cls.TASK_PROMPT_MAP.get(task)
        if not prompt_class:
            raise ValueError(f"Unsupported task: {task}")

        # 特殊处理翻译任务
        if task == "translate" and "target_language" in kwargs:
            prompt_builder = prompt_class(target_language=kwargs["target_language"])
        else:
            prompt_builder = prompt_class()

        # 构建基础prompt
        base_prompt = prompt_builder.build(**kwargs)

        # 如果有Agent上下文，添加Agent特定的信息
        if agent_context:
            agent_prompt = cls._build_agent_context_prompt(agent_context)
            return f"{agent_prompt}\n\n{base_prompt}"

        return base_prompt

    @classmethod
    def _build_agent_context_prompt(cls, context: AgentContext) -> str:
        """
        构建Agent上下文prompt

        Args:
            context: Agent上下文信息

        Returns:
            Agent相关的prompt
        """
        sections = []

        # Agent身份
        sections.append(f"# Agent信息\n你的身份是：{context.name}")

        # 语言偏好
        if context.language:
            lang_text = "中文" if context.language == "zh-CN" else "英文" if context.language == "en" else context.language
            sections.append(f"工作语言：{lang_text}")

        # 语气风格
        if context.tone:
            tone_text = cls.TONE_MAP.get(context.tone, context.tone)
            sections.append(f"表达风格：{tone_text}")

        # 目标受众
        if context.target_audience:
            sections.append(f"目标受众：{context.target_audience}")

        # Agent描述
        if context.description:
            sections.append(f"特点说明：{context.description}")

        # 自定义prompt
        if context.custom_prompt:
            sections.append(f"\n# 特殊要求\n{context.custom_prompt}")

        return "\n".join(sections)

    @classmethod
    def build_for_action(cls,
                        action: str,
                        text: str,
                        agent_context: Optional[AgentContext] = None,
                        instruction: Optional[str] = None,
                        **kwargs) -> tuple[str, str]:
        """
        为文本操作构建完整的prompt

        Args:
            action: 动作类型（improve, expand等）
            text: 要处理的文本
            agent_context: Agent上下文
            instruction: 用户的额外指令
            **kwargs: 其他参数

        Returns:
            (system_prompt, user_prompt) 元组
        """
        # 构建system prompt
        system_prompt = cls.build(action, agent_context, **kwargs)

        # 构建user prompt
        user_sections = []

        # 添加待处理文本
        user_sections.append("# 待处理文本")
        user_sections.append(text)

        # 添加用户指令（如果有）
        if instruction:
            user_sections.append("\n# 用户指令")
            user_sections.append(instruction)

        # 添加输出要求
        user_sections.append("\n# 输出要求")
        user_sections.append("请直接输出处理后的文本，不要包含其他说明或解释。")

        user_prompt = "\n".join(user_sections)

        return system_prompt, user_prompt

    @classmethod
    def get_available_tasks(cls) -> list:
        """获取所有支持的任务类型"""
        return list(cls.TASK_PROMPT_MAP.keys())

    @classmethod
    def get_task_description(cls, task: str) -> str:
        """获取任务描述"""
        descriptions = {
            "improve": "改进文本质量",
            "expand": "扩展文本内容",
            "summarize": "总结要点",
            "simplify": "简化文本",
            "translate": "翻译文本",
            "polish": "润色文本",
            "continue": "续写文本",
            "explain": "解释文本",
            "fix_grammar": "修正语法",
            "make_professional": "专业化文本",
            "extract_key_points": "提取要点",
            "generate_outline": "生成大纲"
        }
        return descriptions.get(task, task)
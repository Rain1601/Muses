"""
统一的AI调用接口
支持自动格式化请求以适配不同的模型API
"""

from typing import Dict, List, Optional, Any
import openai
import anthropic

from ..models import User
from ..utils.security import decrypt
from ..utils.exceptions import ValidationError
from ..models_config import get_model_for_provider


class UnifiedAIClient:
    """统一的AI客户端，自动适配不同模型的API格式"""

    @staticmethod
    def format_messages_for_provider(
        messages: List[Dict[str, str]],
        provider: str
    ) -> tuple[List[Dict[str, str]], Optional[str]]:
        """
        根据不同的提供商格式化消息

        Args:
            messages: 标准消息格式 [{"role": "system/user/assistant", "content": "..."}]
            provider: 提供商名称

        Returns:
            (formatted_messages, system_prompt) 元组
        """
        system_prompt = None
        formatted_messages = []

        for msg in messages:
            if msg["role"] == "system":
                system_prompt = msg["content"]
                # OpenAI和GPT-4.1支持system消息在messages中
                if provider == "openai":
                    formatted_messages.append(msg)
                # Claude需要单独的system参数
                # Gemini也需要特殊处理
            else:
                formatted_messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })

        # 确保至少有一条用户消息
        if not any(msg["role"] == "user" for msg in formatted_messages):
            if formatted_messages and formatted_messages[-1]["role"] == "assistant":
                # 如果最后一条是assistant消息，添加一个用户消息
                formatted_messages.append({"role": "user", "content": "Continue"})
            elif not formatted_messages:
                # 如果没有任何消息，添加默认用户消息
                formatted_messages.append({"role": "user", "content": "Hello"})

        return formatted_messages, system_prompt

    @classmethod
    async def call(
        cls,
        user: User,
        messages: List[Dict[str, str]],
        provider: str = None,
        model: str = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        **kwargs
    ) -> str:
        """
        统一的AI调用接口

        Args:
            user: 用户对象
            messages: 统一的消息格式
            provider: 指定提供商 (openai/claude/gemini)
            model: 指定模型
            temperature: 温度参数 (0.0-1.0)
            max_tokens: 最大生成长度
            **kwargs: 其他特定于模型的参数

        Returns:
            AI生成的文本响应
        """
        # 自动选择提供商
        if not provider:
            provider = cls._determine_provider(user)

        # 获取默认模型
        if not model:
            model = get_model_for_provider(provider)

        # 格式化消息
        formatted_messages, system_prompt = cls.format_messages_for_provider(messages, provider)

        # 调用对应的API
        if provider == "openai":
            return cls._call_openai(
                user, model, formatted_messages, system_prompt,
                temperature, max_tokens, **kwargs
            )
        elif provider == "claude":
            return cls._call_claude(
                user, model, formatted_messages, system_prompt,
                temperature, max_tokens, **kwargs
            )
        elif provider == "gemini":
            return cls._call_gemini(
                user, model, formatted_messages, system_prompt,
                temperature, max_tokens, **kwargs
            )
        else:
            raise ValidationError(f"Unsupported provider: {provider}")

    @staticmethod
    def _call_openai(
        user: User,
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        **kwargs
    ) -> str:
        """调用OpenAI API"""
        if not user.openaiKey:
            raise ValidationError("OpenAI API key not configured")

        api_key = decrypt(user.openaiKey)
        client = openai.OpenAI(api_key=api_key)

        # GPT-5系列的特殊处理
        if model in ["gpt-5", "gpt-5-mini"]:
            # 提取用户消息
            user_message = ""
            for msg in messages:
                if msg["role"] == "user":
                    user_message = msg["content"]
                    break

            # 如果有system prompt，添加到用户消息前
            if system_prompt:
                user_message = f"{system_prompt}\n\n{user_message}"

            # 尝试使用新的responses API
            try:
                response = client.responses.create(
                    model=model,
                    input=user_message,
                    reasoning=kwargs.get("reasoning", {"effort": "medium"}),
                    text=kwargs.get("text", {"verbosity": "medium"})
                )
                return response.output_text or ""
            except (AttributeError, Exception):
                # 回退到标准API
                response = client.chat.completions.create(
                    model=model,
                    messages=messages
                )
                return response.choices[0].message.content or ""

        # GPT-4.1和其他模型使用标准API
        else:
            params = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            }

            # 添加额外参数
            for key in ["top_p", "frequency_penalty", "presence_penalty"]:
                if key in kwargs:
                    params[key] = kwargs[key]

            response = client.chat.completions.create(**params)
            return response.choices[0].message.content or ""

    @staticmethod
    def _call_claude(
        user: User,
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        **kwargs
    ) -> str:
        """调用Claude API"""
        if not user.claudeKey:
            raise ValidationError("Claude API key not configured")

        api_key = decrypt(user.claudeKey)
        client = anthropic.Anthropic(api_key=api_key)

        # 构建参数
        params = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature
        }

        # 添加system prompt（如果有）
        if system_prompt:
            params["system"] = system_prompt

        # 添加额外参数
        for key in ["top_p", "top_k"]:
            if key in kwargs:
                params[key] = kwargs[key]

        response = client.messages.create(**params)

        # 提取响应文本
        if response.content and len(response.content) > 0:
            return response.content[0].text
        return ""

    @staticmethod
    def _call_gemini(
        user: User,
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        **kwargs
    ) -> str:
        """调用Gemini API（待实现）"""
        if not user.geminiKey:
            raise ValidationError("Gemini API key not configured")

        # 待实现Gemini API调用
        raise ValidationError("Gemini support is not yet implemented")

    @staticmethod
    def _determine_provider(user: User) -> str:
        """根据用户配置自动选择提供商"""
        # 优先级：OpenAI > Claude > Gemini
        if user.openaiKey:
            return "openai"
        elif user.claudeKey:
            return "claude"
        elif user.geminiKey:
            return "gemini"
        else:
            raise ValidationError("No AI API keys configured")


# 便捷函数
async def unified_ai_call(
    user: User,
    prompt: str,
    system_prompt: str = None,
    provider: str = None,
    model: str = None,
    **kwargs
) -> str:
    """
    简化的AI调用接口

    Args:
        user: 用户对象
        prompt: 用户输入
        system_prompt: 系统提示（可选）
        provider: 指定提供商（可选）
        model: 指定模型（可选）
        **kwargs: 其他参数

    Returns:
        AI响应文本
    """
    messages = []

    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})

    messages.append({"role": "user", "content": prompt})

    return await UnifiedAIClient.call(
        user=user,
        messages=messages,
        provider=provider,
        model=model,
        **kwargs
    )
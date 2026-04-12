"""
统一的AI调用接口
所有聚合 API（AIHubMix / OpenRouter / 百炼）均通过 OpenAI 兼容 SDK 调用
"""

from typing import Dict, List, Optional, Any
import openai

from ..models import User
from ..utils.security import decrypt
from ..utils.exceptions import ValidationError
from ..models_config import get_default_model

# 聚合 API base URLs
PROVIDER_BASE_URLS = {
    "aihubmix": "https://aihubmix.com/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "bailian": "https://dashscope.aliyuncs.com/compatible-mode/v1",
}

# Provider → User model key field
PROVIDER_KEY_FIELDS = {
    "aihubmix": "aihubmixKey",
    "openrouter": "openrouterKey",
    "bailian": "bailianKey",
}


class UnifiedAIClient:
    """统一的AI客户端 — 所有 provider 通过 OpenAI 兼容接口调用"""

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
            messages: [{"role": "system/user/assistant", "content": "..."}]
            provider: aihubmix / openrouter / bailian
            model: 模型 ID（如 claude-sonnet-4-20250514, gpt-4o 等）
            temperature: 温度
            max_tokens: 最大 token 数
        """
        if not provider:
            provider = cls._determine_provider(user)

        if not model:
            model = get_default_model(provider)

        # 获取 API key 和 base_url
        api_key = cls._get_api_key(user, provider)
        base_url = PROVIDER_BASE_URLS.get(provider)
        if not base_url:
            raise ValidationError(f"Unsupported provider: {provider}")

        client = openai.OpenAI(api_key=api_key, base_url=base_url)

        # 构建请求参数
        params = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        # 传递额外参数
        for key in ["top_p", "frequency_penalty", "presence_penalty"]:
            if key in kwargs:
                params[key] = kwargs[key]

        response = client.chat.completions.create(**params)
        return response.choices[0].message.content or ""

    @staticmethod
    def _get_api_key(user: User, provider: str) -> str:
        """获取并解密用户的 API key"""
        field = PROVIDER_KEY_FIELDS.get(provider)
        if not field:
            raise ValidationError(f"Unknown provider: {provider}")

        encrypted_key = getattr(user, field, None)
        if not encrypted_key:
            raise ValidationError(
                f"未配置 {provider} API Key，请在设置中添加"
            )
        return decrypt(encrypted_key)

    @staticmethod
    def _determine_provider(user: User) -> str:
        """根据用户已配置的 key 自动选择 provider"""
        # 优先级：aihubmix > openrouter > bailian
        if user.aihubmixKey:
            return "aihubmix"
        elif user.openrouterKey:
            return "openrouter"
        elif user.bailianKey:
            return "bailian"
        else:
            raise ValidationError(
                "未配置任何 AI API Key，请在设置中添加 AIHubMix、OpenRouter 或百炼的 API Key"
            )


# 便捷函数
async def unified_ai_call(
    user: User,
    prompt: str,
    system_prompt: str = None,
    provider: str = None,
    model: str = None,
    **kwargs
) -> str:
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

"""
AI 模型配置 — 聚合 API（AIHubMix / OpenRouter / 百炼）
所有 provider 均通过 OpenAI 兼容接口调用，模型 ID 共享。
"""

from typing import Dict, List, Any

# 通用模型列表（聚合 API 支持的主流模型）
MODELS = {
    # Claude 系列
    "claude-sonnet-4-5-20250929": {
        "name": "Claude Sonnet 4.5",
        "provider_origin": "anthropic",
        "description": "最新最强 Claude，卓越的推理和创造力",
        "max_tokens": 200000,
        "default": True,
    },
    "claude-sonnet-4-20250514": {
        "name": "Claude Sonnet 4",
        "provider_origin": "anthropic",
        "description": "高性能 Claude 4 模型",
        "max_tokens": 200000,
    },
    "claude-opus-4-1-20250805": {
        "name": "Claude Opus 4.1",
        "provider_origin": "anthropic",
        "description": "最强大的 Claude 模型，适合复杂任务",
        "max_tokens": 200000,
    },
    # GPT 系列
    "gpt-4o": {
        "name": "GPT-4o",
        "provider_origin": "openai",
        "description": "OpenAI 旗舰多模态模型",
        "max_tokens": 128000,
    },
    "gpt-4o-mini": {
        "name": "GPT-4o Mini",
        "provider_origin": "openai",
        "description": "轻量高效的 GPT-4o",
        "max_tokens": 128000,
    },
    # Gemini 系列
    "gemini-2.5-flash": {
        "name": "Gemini 2.5 Flash",
        "provider_origin": "google",
        "description": "Google 最新快速模型",
        "max_tokens": 100000,
    },
    "gemini-2.5-pro": {
        "name": "Gemini 2.5 Pro",
        "provider_origin": "google",
        "description": "Google 最强推理模型",
        "max_tokens": 100000,
    },
    # 国产模型（百炼专属）
    "qwen-max": {
        "name": "通义千问 Max",
        "provider_origin": "alibaba",
        "description": "阿里最强大模型",
        "max_tokens": 32000,
    },
    "qwen-plus": {
        "name": "通义千问 Plus",
        "provider_origin": "alibaba",
        "description": "高性价比通义千问",
        "max_tokens": 32000,
    },
    "deepseek-chat": {
        "name": "DeepSeek V3",
        "provider_origin": "deepseek",
        "description": "DeepSeek 最新对话模型",
        "max_tokens": 64000,
    },
}

# 每个聚合 provider 的默认模型
DEFAULT_MODELS = {
    "aihubmix": "claude-sonnet-4-5-20250929",
    "openrouter": "claude-sonnet-4-5-20250929",
    "bailian": "qwen-max",
}


def get_default_model(provider: str) -> str:
    """获取 provider 的默认模型 ID"""
    return DEFAULT_MODELS.get(provider, "claude-sonnet-4-5-20250929")


def get_model_info(model_id: str) -> Dict[str, Any]:
    """获取模型信息"""
    return MODELS.get(model_id, {})


def get_available_models() -> List[Dict[str, Any]]:
    """获取所有可用模型"""
    return [{"id": mid, **info} for mid, info in MODELS.items()]


# Legacy compatibility
def get_model_for_provider(provider: str, preferred_model: str = None) -> str:
    if preferred_model and preferred_model in MODELS:
        return preferred_model
    return get_default_model(provider)

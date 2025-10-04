"""
AI模型配置
"""

from typing import Dict, List, Any

# OpenAI模型配置
OPENAI_MODELS = {
    "gpt-5-2025-08-07": {
        "name": "GPT-5",
        "description": "最新最强的 OpenAI 模型，卓越的推理和创造力",
        "max_tokens": 200000,
        "default": True,
        "capabilities": ["text", "code", "analysis", "creative", "vision"]
    },
    "gpt-5-mini-2025-08-07": {
        "name": "GPT-5 Mini",
        "description": "轻量级 GPT-5，快速高效",
        "max_tokens": 128000,
        "capabilities": ["text", "code", "analysis", "creative"]
    }
}

# Claude模型配置
CLAUDE_MODELS = {
    "claude-sonnet-4-5-20250929": {
        "name": "Claude Sonnet 4.5",
        "description": "最新最强的 Claude 模型，卓越的能力和性能",
        "max_tokens": 200000,
        "default": True,
        "capabilities": ["text", "code", "analysis", "creative", "vision"]
    },
    "claude-sonnet-4-20250514": {
        "name": "Claude Sonnet 4",
        "description": "强大的 Claude 4 模型，性能优异",
        "max_tokens": 200000,
        "capabilities": ["text", "code", "analysis", "creative"]
    },
    "claude-opus-4-1-20250805": {
        "name": "Claude Opus 4.1",
        "description": "最强大的 Claude 模型，适合复杂任务",
        "max_tokens": 200000,
        "capabilities": ["text", "code", "analysis", "creative", "vision"]
    }
}

# Gemini模型配置
GEMINI_MODELS = {
    "gemini-2.5-flash": {
        "name": "Gemini 2.5 Flash",
        "description": "最新的 Google Gemini 模型，快速高效",
        "max_tokens": 100000,
        "default": True,
        "capabilities": ["text", "code", "analysis", "vision"]
    }
}

# 默认模型选择
DEFAULT_MODELS = {
    "openai": "gpt-5-2025-08-07",
    "claude": "claude-sonnet-4-5-20250929",
    "gemini": "gemini-2.5-flash"
}

def get_model_for_provider(provider: str, preferred_model: str = None) -> str:
    """
    根据提供商获取模型ID

    Args:
        provider: 模型提供商 (openai, claude, gemini)
        preferred_model: 用户偏好的模型

    Returns:
        模型ID字符串
    """
    if provider == "openai":
        models = OPENAI_MODELS
        default = DEFAULT_MODELS["openai"]
    elif provider == "claude":
        models = CLAUDE_MODELS
        default = DEFAULT_MODELS["claude"]
    elif provider == "gemini":
        models = GEMINI_MODELS
        default = DEFAULT_MODELS["gemini"]
    else:
        raise ValueError(f"Unknown provider: {provider}")

    # 如果指定了偏好模型且存在，使用它
    if preferred_model and preferred_model in models:
        return preferred_model

    # 否则使用默认模型
    return default

def get_model_info(provider: str, model_id: str) -> Dict[str, Any]:
    """
    获取模型信息

    Args:
        provider: 模型提供商
        model_id: 模型ID

    Returns:
        模型信息字典
    """
    if provider == "openai":
        return OPENAI_MODELS.get(model_id, {})
    elif provider == "claude":
        return CLAUDE_MODELS.get(model_id, {})
    elif provider == "gemini":
        return GEMINI_MODELS.get(model_id, {})
    else:
        return {}

def get_available_models(provider: str) -> List[Dict[str, Any]]:
    """
    获取提供商的所有可用模型

    Args:
        provider: 模型提供商

    Returns:
        模型列表
    """
    if provider == "openai":
        models_dict = OPENAI_MODELS
    elif provider == "claude":
        models_dict = CLAUDE_MODELS
    elif provider == "gemini":
        models_dict = GEMINI_MODELS
    else:
        return []

    models_list = []
    for model_id, info in models_dict.items():
        models_list.append({
            "id": model_id,
            **info
        })

    return models_list
"""
AI模型配置
"""

from typing import Dict, List, Any

# OpenAI模型配置
OPENAI_MODELS = {
    "gpt-4": {
        "name": "GPT-4",
        "description": "最先进的模型，卓越的推理和创造力",
        "max_tokens": 8192,
        "default": True,
        "capabilities": ["text", "code", "analysis", "creative"]
    },
    "gpt-4-turbo-preview": {
        "name": "GPT-4 Turbo",
        "description": "更快速的GPT-4，支持更长上下文",
        "max_tokens": 128000,
        "capabilities": ["text", "code", "analysis", "creative"]
    },
    "gpt-3.5-turbo": {
        "name": "GPT-3.5 Turbo",
        "description": "快速高效的模型，适合大多数任务",
        "max_tokens": 16385,
        "capabilities": ["text", "code", "analysis"]
    }
}

# Claude模型配置
CLAUDE_MODELS = {
    "claude-3.5-sonnet-20241022": {
        "name": "Claude 3.5 Sonnet",
        "description": "最新最强的Claude模型，卓越的能力和性能",
        "max_tokens": 200000,
        "default": True,
        "capabilities": ["text", "code", "analysis", "creative"]
    },
    "claude-3-opus-20240229": {
        "name": "Claude 3 Opus",
        "description": "最强大的Claude模型，适合复杂任务",
        "max_tokens": 200000,
        "capabilities": ["text", "code", "analysis", "creative"]
    },
    "claude-3-sonnet-20240229": {
        "name": "Claude 3 Sonnet",
        "description": "平衡的Claude模型，性价比高",
        "max_tokens": 200000,
        "capabilities": ["text", "code", "analysis", "creative"]
    }
}

# Gemini模型配置
GEMINI_MODELS = {
    "gemini-pro": {
        "name": "Gemini Pro",
        "description": "Google's advanced language model",
        "max_tokens": 30720,
        "default": True,
        "capabilities": ["text", "code", "analysis"]
    },
    "gemini-pro-vision": {
        "name": "Gemini Pro Vision",
        "description": "Multimodal Gemini model",
        "max_tokens": 30720,
        "capabilities": ["text", "code", "vision"]
    }
}

# 默认模型选择
DEFAULT_MODELS = {
    "openai": "gpt-4",
    "claude": "claude-3.5-sonnet-20241022",
    "gemini": "gemini-pro"
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
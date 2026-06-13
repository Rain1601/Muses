"""
Agent Models Module

统一的AI模型接口，支持多种模型提供者：
- Claude (Anthropic)
- OpenAI (GPT)
- Gemini (Google)
"""

from .base import BaseModel, GenerationResponse
from .factory import ModelFactory
from .config import ModelConfig

# 导出主要类和函数
__all__ = [
    'BaseModel',
    'GenerationResponse',
    'ModelFactory',
    'ModelConfig'
]

# 便捷函数
def create_model(model_type: str, api_key: str, **kwargs) -> BaseModel:
    """快捷创建模型实例

    Args:
        model_type: 模型类型 (claude, openai, gemini)
        api_key: API密钥
        **kwargs: 额外配置参数

    Returns:
        BaseModel: 模型实例
    """
    return ModelFactory.create_from_type(model_type, api_key, **kwargs)

def get_available_models():
    """获取可用的模型列表

    Returns:
        List[Dict]: 模型信息列表
    """
    return ModelFactory.list_all_models_info()

def is_model_supported(model_type: str) -> bool:
    """检查模型是否支持

    Args:
        model_type: 模型类型

    Returns:
        bool: 是否支持
    """
    return ModelFactory.is_model_available(model_type)
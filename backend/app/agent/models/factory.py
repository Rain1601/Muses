from typing import Dict, Type, List
import logging
from .base import BaseModel
from .config import ModelConfig

logger = logging.getLogger(__name__)

class ModelFactory:
    """模型工厂类，负责创建和管理AI模型实例"""

    _models: Dict[str, Type[BaseModel]] = {}

    @classmethod
    def register_model(cls, model_type: str, model_class: Type[BaseModel]):
        """注册模型类

        Args:
            model_type: 模型类型标识
            model_class: 模型实现类
        """
        cls._models[model_type] = model_class
        logger.info(f"Registered model: {model_type} -> {model_class.__name__}")

    @classmethod
    def create(cls, config: Dict[str, str]) -> BaseModel:
        """创建模型实例

        Args:
            config: 模型配置字典

        Returns:
            BaseModel: 模型实例

        Raises:
            ValueError: 未知的模型类型或配置无效
        """
        model_type = config.get('type')
        if not model_type:
            raise ValueError("Model type is required in config")

        if model_type not in cls._models:
            raise ValueError(f"Unknown model type: {model_type}")

        if not ModelConfig.validate_config(config):
            raise ValueError(f"Invalid config for model type: {model_type}")

        model_class = cls._models[model_type]
        try:
            return model_class(config)
        except Exception as e:
            logger.error(f"Failed to create model {model_type}: {e}")
            raise

    @classmethod
    def create_from_type(cls, model_type: str, api_key: str, **kwargs) -> BaseModel:
        """根据类型创建模型实例

        Args:
            model_type: 模型类型
            api_key: API密钥
            **kwargs: 额外配置参数

        Returns:
            BaseModel: 模型实例
        """
        config = ModelConfig.create_config(model_type, api_key, kwargs)
        return cls.create(config)

    @classmethod
    def create_from_env(cls, model_type: str, **kwargs) -> BaseModel:
        """从环境变量创建模型实例

        Args:
            model_type: 模型类型
            **kwargs: 额外配置参数

        Returns:
            BaseModel: 模型实例
        """
        config = ModelConfig.from_env(model_type)
        if kwargs:
            config.update(kwargs)
        return cls.create(config)

    @classmethod
    def get_available_models(cls) -> List[str]:
        """获取可用的模型类型列表

        Returns:
            List[str]: 可用模型类型列表
        """
        return list(cls._models.keys())

    @classmethod
    def get_model_info(cls, model_type: str) -> Dict:
        """获取模型信息

        Args:
            model_type: 模型类型

        Returns:
            Dict: 模型信息
        """
        if model_type not in cls._models:
            return {}

        default_config = ModelConfig.get_default_config(model_type)
        capabilities = ModelConfig.get_model_capabilities(model_type)
        display_name = ModelConfig.get_model_display_name(model_type)

        return {
            'type': model_type,
            'display_name': display_name,
            'default_model': default_config.get('model', ''),
            'max_tokens': default_config.get('max_tokens', 0),
            'capabilities': capabilities
        }

    @classmethod
    def list_all_models_info(cls) -> List[Dict]:
        """获取所有可用模型的信息

        Returns:
            List[Dict]: 模型信息列表
        """
        return [cls.get_model_info(model_type) for model_type in cls.get_available_models()]

    @classmethod
    def is_model_available(cls, model_type: str) -> bool:
        """检查模型是否可用

        Args:
            model_type: 模型类型

        Returns:
            bool: 模型是否可用
        """
        return model_type in cls._models

# 自动注册模型（延迟导入避免循环依赖）
def _register_builtin_models():
    """注册内置模型"""
    try:
        from .claude import ClaudeModel
        ModelFactory.register_model('claude', ClaudeModel)
    except ImportError as e:
        logger.warning(f"Failed to register Claude model: {e}")

    try:
        from .openai import OpenAIModel
        ModelFactory.register_model('openai', OpenAIModel)
    except ImportError as e:
        logger.warning(f"Failed to register OpenAI model: {e}")

    try:
        from .gemini import GeminiModel
        ModelFactory.register_model('gemini', GeminiModel)
    except ImportError as e:
        logger.warning(f"Failed to register Gemini model: {e}")

# 在模块加载时注册内置模型
_register_builtin_models()
from typing import Dict, Any, Optional
import os

class ModelConfig:
    """模型配置管理"""

    DEFAULT_CONFIGS = {
        'claude': {
            'type': 'claude',
            'model': 'claude-3-5-sonnet-20241022',
            'max_tokens': 4096,
            'temperature': 0.7,
            'provider_name': 'anthropic'
        },
        'openai': {
            'type': 'openai',
            'model': 'gpt-4',
            'max_tokens': 4096,
            'temperature': 0.7,
            'provider_name': 'openai'
        },
        'gemini': {
            'type': 'gemini',
            'model': 'gemini-pro',
            'max_tokens': 4096,
            'temperature': 0.7,
            'provider_name': 'google'
        }
    }

    @classmethod
    def get_default_config(cls, model_type: str) -> Dict[str, Any]:
        """获取默认配置

        Args:
            model_type: 模型类型 (claude, openai, gemini)

        Returns:
            Dict: 默认配置
        """
        return cls.DEFAULT_CONFIGS.get(model_type, {}).copy()

    @classmethod
    def create_config(
        cls,
        model_type: str,
        api_key: str,
        custom_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """创建模型配置

        Args:
            model_type: 模型类型
            api_key: API密钥
            custom_config: 自定义配置

        Returns:
            Dict: 完整配置
        """
        config = cls.get_default_config(model_type)
        config['api_key'] = api_key

        if custom_config:
            config.update(custom_config)

        return config

    @classmethod
    def from_env(cls, model_type: str) -> Dict[str, Any]:
        """从环境变量创建配置

        Args:
            model_type: 模型类型

        Returns:
            Dict: 配置字典
        """
        config = cls.get_default_config(model_type)

        # 从环境变量获取API密钥
        env_keys = {
            'claude': 'ANTHROPIC_API_KEY',
            'openai': 'OPENAI_API_KEY',
            'gemini': 'GOOGLE_API_KEY'
        }

        api_key = os.getenv(env_keys.get(model_type, ''))
        if api_key:
            config['api_key'] = api_key

        return config

    @classmethod
    def get_available_models(cls) -> list:
        """获取可用的模型列表

        Returns:
            list: 可用模型列表
        """
        return list(cls.DEFAULT_CONFIGS.keys())

    @classmethod
    def validate_config(cls, config: Dict[str, Any]) -> bool:
        """验证配置是否有效

        Args:
            config: 配置字典

        Returns:
            bool: 配置是否有效
        """
        required_fields = ['type', 'model', 'api_key']
        return all(field in config for field in required_fields)

    @classmethod
    def get_model_display_name(cls, model_type: str) -> str:
        """获取模型显示名称

        Args:
            model_type: 模型类型

        Returns:
            str: 显示名称
        """
        display_names = {
            'claude': 'Claude (Sonnet 4)',
            'openai': 'OpenAI (GPT-4)',
            'gemini': 'Google Gemini'
        }
        return display_names.get(model_type, model_type.title())

    @classmethod
    def get_model_capabilities(cls, model_type: str) -> Dict[str, Any]:
        """获取模型能力信息

        Args:
            model_type: 模型类型

        Returns:
            Dict: 能力信息
        """
        capabilities = {
            'claude': {
                'max_context_length': 200000,
                'supports_streaming': True,
                'supports_function_calling': True,
                'supports_vision': True
            },
            'openai': {
                'max_context_length': 128000,
                'supports_streaming': True,
                'supports_function_calling': True,
                'supports_vision': True
            },
            'gemini': {
                'max_context_length': 32000,
                'supports_streaming': True,
                'supports_function_calling': True,
                'supports_vision': True
            }
        }
        return capabilities.get(model_type, {})
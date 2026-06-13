from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, Any, Optional
from dataclasses import dataclass

@dataclass
class GenerationResponse:
    """模型生成响应"""
    content: str
    token_count: Optional[int] = None
    model_used: Optional[str] = None
    finish_reason: Optional[str] = None

class BaseModel(ABC):
    """所有AI模型的基础抽象类"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.model_name = config.get('model', '')
        self.max_tokens = config.get('max_tokens', 4096)
        self.temperature = config.get('temperature', 0.7)

    @abstractmethod
    async def generate(self, prompt: str, **kwargs) -> GenerationResponse:
        """生成文本内容

        Args:
            prompt: 输入提示词
            **kwargs: 额外参数

        Returns:
            GenerationResponse: 生成结果
        """
        pass

    @abstractmethod
    async def stream_generate(self, prompt: str, **kwargs) -> AsyncGenerator[str, None]:
        """流式生成文本内容

        Args:
            prompt: 输入提示词
            **kwargs: 额外参数

        Yields:
            str: 生成的文本片段
        """
        pass

    @abstractmethod
    def get_token_count(self, text: str) -> int:
        """计算文本的token数量

        Args:
            text: 待计算的文本

        Returns:
            int: token数量
        """
        pass

    def get_model_info(self) -> Dict[str, Any]:
        """获取模型信息

        Returns:
            Dict: 模型信息
        """
        return {
            'name': self.model_name,
            'max_tokens': self.max_tokens,
            'temperature': self.temperature,
            'provider': self.__class__.__name__.replace('Model', '').lower()
        }

    async def validate_config(self) -> bool:
        """验证模型配置是否有效

        Returns:
            bool: 配置是否有效
        """
        return True
import logging
from typing import AsyncGenerator, Dict, Any
import anthropic
from .base import BaseModel, GenerationResponse

logger = logging.getLogger(__name__)

class ClaudeModel(BaseModel):
    """Claude (Anthropic) 模型实现"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.api_key = config['api_key']
        self.client = anthropic.AsyncAnthropic(api_key=self.api_key)

    async def generate(self, prompt: str, **kwargs) -> GenerationResponse:
        """生成文本内容"""
        try:
            # 合并配置参数
            generation_config = {
                'model': self.model_name,
                'max_tokens': kwargs.get('max_tokens', self.max_tokens),
                'temperature': kwargs.get('temperature', self.temperature),
                'messages': [{"role": "user", "content": prompt}]
            }

            # 添加系统消息（如果提供）
            if 'system' in kwargs:
                generation_config['system'] = kwargs['system']

            response = await self.client.messages.create(**generation_config)

            # 提取响应内容
            content = response.content[0].text if response.content else ""

            return GenerationResponse(
                content=content,
                token_count=response.usage.output_tokens if hasattr(response, 'usage') else None,
                model_used=response.model,
                finish_reason=response.stop_reason
            )

        except Exception as e:
            logger.error(f"Claude generation failed: {e}")
            raise RuntimeError(f"Claude API error: {str(e)}")

    async def stream_generate(self, prompt: str, **kwargs) -> AsyncGenerator[str, None]:
        """流式生成文本内容"""
        try:
            # 合并配置参数
            generation_config = {
                'model': self.model_name,
                'max_tokens': kwargs.get('max_tokens', self.max_tokens),
                'temperature': kwargs.get('temperature', self.temperature),
                'messages': [{"role": "user", "content": prompt}]
            }

            # 添加系统消息（如果提供）
            if 'system' in kwargs:
                generation_config['system'] = kwargs['system']

            async with self.client.messages.stream(**generation_config) as stream:
                async for text in stream.text_stream:
                    yield text

        except Exception as e:
            logger.error(f"Claude streaming failed: {e}")
            raise RuntimeError(f"Claude streaming error: {str(e)}")

    def get_token_count(self, text: str) -> int:
        """计算token数量（简单估算）"""
        # Claude的token计算比较复杂，这里使用简单估算
        # 1 token ≈ 4 个字符 (英文)，中文字符大约 1-2 个字符/token
        try:
            # 粗略估算：英文按4字符/token，中文按1.5字符/token
            english_chars = sum(1 for c in text if ord(c) < 128)
            chinese_chars = len(text) - english_chars

            estimated_tokens = (english_chars / 4) + (chinese_chars / 1.5)
            return int(estimated_tokens)
        except Exception:
            # 回退到简单估算
            return len(text) // 4

    async def validate_config(self) -> bool:
        """验证Claude配置是否有效"""
        try:
            # 发送一个简单的测试请求来验证API密钥
            response = await self.client.messages.create(
                model=self.model_name,
                max_tokens=10,
                messages=[{"role": "user", "content": "Hi"}]
            )
            return response is not None
        except anthropic.AuthenticationError:
            logger.error("Invalid Claude API key")
            return False
        except anthropic.APIError as e:
            logger.error(f"Claude API error during validation: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during Claude validation: {e}")
            return False

    def get_model_info(self) -> Dict[str, Any]:
        """获取Claude模型信息"""
        base_info = super().get_model_info()
        base_info.update({
            'provider': 'anthropic',
            'supports_streaming': True,
            'supports_system_message': True,
            'context_window': 200000,  # Claude 3.5 Sonnet 的上下文窗口
            'pricing_model': 'per_token'
        })
        return base_info
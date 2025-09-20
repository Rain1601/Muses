import logging
from typing import AsyncGenerator, Dict, Any
import openai
from .base import BaseModel, GenerationResponse

logger = logging.getLogger(__name__)

class OpenAIModel(BaseModel):
    """OpenAI (GPT) 模型实现"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.api_key = config['api_key']
        self.client = openai.AsyncOpenAI(api_key=self.api_key)

    async def generate(self, prompt: str, **kwargs) -> GenerationResponse:
        """生成文本内容"""
        try:
            # 构建消息列表
            messages = [{"role": "user", "content": prompt}]

            # 添加系统消息（如果提供）
            if 'system' in kwargs:
                messages.insert(0, {"role": "system", "content": kwargs['system']})

            # 合并配置参数
            generation_config = {
                'model': self.model_name,
                'messages': messages,
                'max_tokens': kwargs.get('max_tokens', self.max_tokens),
                'temperature': kwargs.get('temperature', self.temperature),
            }

            # 添加其他OpenAI特有参数
            if 'top_p' in kwargs:
                generation_config['top_p'] = kwargs['top_p']
            if 'frequency_penalty' in kwargs:
                generation_config['frequency_penalty'] = kwargs['frequency_penalty']
            if 'presence_penalty' in kwargs:
                generation_config['presence_penalty'] = kwargs['presence_penalty']

            response = await self.client.chat.completions.create(**generation_config)

            # 提取响应内容
            content = response.choices[0].message.content if response.choices else ""

            return GenerationResponse(
                content=content,
                token_count=response.usage.completion_tokens if response.usage else None,
                model_used=response.model,
                finish_reason=response.choices[0].finish_reason if response.choices else None
            )

        except openai.AuthenticationError as e:
            logger.error(f"OpenAI authentication failed: {e}")
            raise RuntimeError(f"OpenAI authentication error: {str(e)}")
        except openai.RateLimitError as e:
            logger.error(f"OpenAI rate limit exceeded: {e}")
            raise RuntimeError(f"OpenAI rate limit error: {str(e)}")
        except Exception as e:
            logger.error(f"OpenAI generation failed: {e}")
            raise RuntimeError(f"OpenAI API error: {str(e)}")

    async def stream_generate(self, prompt: str, **kwargs) -> AsyncGenerator[str, None]:
        """流式生成文本内容"""
        try:
            # 构建消息列表
            messages = [{"role": "user", "content": prompt}]

            # 添加系统消息（如果提供）
            if 'system' in kwargs:
                messages.insert(0, {"role": "system", "content": kwargs['system']})

            # 合并配置参数
            generation_config = {
                'model': self.model_name,
                'messages': messages,
                'max_tokens': kwargs.get('max_tokens', self.max_tokens),
                'temperature': kwargs.get('temperature', self.temperature),
                'stream': True
            }

            # 添加其他OpenAI特有参数
            if 'top_p' in kwargs:
                generation_config['top_p'] = kwargs['top_p']

            async for chunk in await self.client.chat.completions.create(**generation_config):
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            logger.error(f"OpenAI streaming failed: {e}")
            raise RuntimeError(f"OpenAI streaming error: {str(e)}")

    def get_token_count(self, text: str) -> int:
        """计算token数量（简单估算）"""
        try:
            # GPT模型的token计算：英文大约4字符/token，中文1-2字符/token
            english_chars = sum(1 for c in text if ord(c) < 128)
            chinese_chars = len(text) - english_chars

            estimated_tokens = (english_chars / 4) + (chinese_chars / 1.3)
            return int(estimated_tokens)
        except Exception:
            # 回退到简单估算
            return len(text) // 4

    async def validate_config(self) -> bool:
        """验证OpenAI配置是否有效"""
        try:
            # 发送一个简单的测试请求来验证API密钥
            response = await self.client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": "Hi"}],
                max_tokens=5
            )
            return response is not None
        except openai.AuthenticationError:
            logger.error("Invalid OpenAI API key")
            return False
        except openai.APIError as e:
            logger.error(f"OpenAI API error during validation: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during OpenAI validation: {e}")
            return False

    def get_model_info(self) -> Dict[str, Any]:
        """获取OpenAI模型信息"""
        base_info = super().get_model_info()

        # 根据模型名称设置上下文窗口
        context_windows = {
            'gpt-4': 128000,
            'gpt-4-turbo': 128000,
            'gpt-4o': 128000,
            'gpt-3.5-turbo': 16385,
        }

        context_window = context_windows.get(self.model_name, 8192)

        base_info.update({
            'provider': 'openai',
            'supports_streaming': True,
            'supports_system_message': True,
            'context_window': context_window,
            'pricing_model': 'per_token',
            'supports_function_calling': True
        })
        return base_info
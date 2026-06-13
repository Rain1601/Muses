import logging
from typing import AsyncGenerator, Dict, Any
import google.generativeai as genai
import asyncio
from .base import BaseModel, GenerationResponse

logger = logging.getLogger(__name__)

class GeminiModel(BaseModel):
    """Google Gemini 模型实现"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.api_key = config['api_key']

        # 配置Gemini API
        genai.configure(api_key=self.api_key)

        # 创建模型实例
        self.model = genai.GenerativeModel(self.model_name)

    async def generate(self, prompt: str, **kwargs) -> GenerationResponse:
        """生成文本内容"""
        try:
            # 配置生成参数
            generation_config = genai.GenerationConfig(
                max_output_tokens=kwargs.get('max_tokens', self.max_tokens),
                temperature=kwargs.get('temperature', self.temperature),
                top_p=kwargs.get('top_p', 0.95),
                top_k=kwargs.get('top_k', 40),
            )

            # 构建完整的提示词
            full_prompt = prompt
            if 'system' in kwargs:
                full_prompt = f"System: {kwargs['system']}\n\nUser: {prompt}"

            # 使用asyncio在新线程中运行同步函数
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.model.generate_content(
                    full_prompt,
                    generation_config=generation_config,
                    safety_settings={
                        'HATE': 'BLOCK_NONE',
                        'HARASSMENT': 'BLOCK_NONE',
                        'SEXUAL': 'BLOCK_NONE',
                        'DANGEROUS': 'BLOCK_NONE'
                    }
                )
            )

            # 提取响应内容
            content = response.text if response.text else ""

            return GenerationResponse(
                content=content,
                token_count=self._count_tokens(content),
                model_used=self.model_name,
                finish_reason=response.candidates[0].finish_reason.name if response.candidates else None
            )

        except Exception as e:
            logger.error(f"Gemini generation failed: {e}")
            raise RuntimeError(f"Gemini API error: {str(e)}")

    async def stream_generate(self, prompt: str, **kwargs) -> AsyncGenerator[str, None]:
        """流式生成文本内容"""
        try:
            # 配置生成参数
            generation_config = genai.GenerationConfig(
                max_output_tokens=kwargs.get('max_tokens', self.max_tokens),
                temperature=kwargs.get('temperature', self.temperature),
                top_p=kwargs.get('top_p', 0.95),
                top_k=kwargs.get('top_k', 40),
            )

            # 构建完整的提示词
            full_prompt = prompt
            if 'system' in kwargs:
                full_prompt = f"System: {kwargs['system']}\n\nUser: {prompt}"

            # 使用同步的流式生成（Gemini SDK还没有原生async支持）
            def _generate_stream():
                return self.model.generate_content(
                    full_prompt,
                    generation_config=generation_config,
                    stream=True,
                    safety_settings={
                        'HATE': 'BLOCK_NONE',
                        'HARASSMENT': 'BLOCK_NONE',
                        'SEXUAL': 'BLOCK_NONE',
                        'DANGEROUS': 'BLOCK_NONE'
                    }
                )

            # 在线程池中运行流式生成
            stream = await asyncio.get_event_loop().run_in_executor(None, _generate_stream)

            # 处理流式响应
            for chunk in stream:
                if chunk.text:
                    yield chunk.text

        except Exception as e:
            logger.error(f"Gemini streaming failed: {e}")
            raise RuntimeError(f"Gemini streaming error: {str(e)}")

    def get_token_count(self, text: str) -> int:
        """计算token数量"""
        return self._count_tokens(text)

    def _count_tokens(self, text: str) -> int:
        """内部token计算方法"""
        try:
            # 使用Gemini的token计算API
            response = self.model.count_tokens(text)
            return response.total_tokens
        except Exception:
            # 回退到简单估算：Gemini大约1字符 = 0.75 token
            return int(len(text) * 0.75)

    async def validate_config(self) -> bool:
        """验证Gemini配置是否有效"""
        try:
            # 发送一个简单的测试请求来验证API密钥
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.model.generate_content("Hi", generation_config=genai.GenerationConfig(max_output_tokens=5))
            )
            return response is not None and response.text is not None
        except Exception as e:
            logger.error(f"Gemini validation failed: {e}")
            return False

    def get_model_info(self) -> Dict[str, Any]:
        """获取Gemini模型信息"""
        base_info = super().get_model_info()

        # 根据模型名称设置上下文窗口
        context_windows = {
            'gemini-pro': 32768,
            'gemini-1.5-pro': 2000000,  # 2M tokens
            'gemini-1.5-flash': 1000000,  # 1M tokens
        }

        context_window = context_windows.get(self.model_name, 32768)

        base_info.update({
            'provider': 'google',
            'supports_streaming': True,
            'supports_system_message': False,  # Gemini通过prompt方式处理system消息
            'context_window': context_window,
            'pricing_model': 'per_token',
            'supports_function_calling': True,
            'supports_vision': True
        })
        return base_info
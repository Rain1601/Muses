import openai
import anthropic
import markdown
import json
import re
from typing import List, Dict, Any, Optional, Literal, Tuple
from sqlalchemy.orm import Session
from difflib import SequenceMatcher

from ..models import User, Agent, Article
from ..utils.security import decrypt
from ..utils.exceptions import OpenAIKeyError, ValidationError
from ..models_config import get_model_for_provider, get_model_info
from .unified_ai import UnifiedAIClient


TaskType = Literal["rewrite", "continue", "custom"]


class AIService:
    
    @staticmethod
    def _classify_task_type(user_input: str, context: Optional[str] = None) -> TaskType:
        """分类任务类型"""
        rewrite_keywords = ["修改", "改写", "优化", "润色", "改进", "调整", "重写", "编辑"]
        continue_keywords = ["继续", "续写", "补充", "扩展", "接着写", "添加", "延伸"]
        
        input_lower = user_input.lower()
        
        # 检查改写关键词
        for keyword in rewrite_keywords:
            if keyword in user_input:
                return "rewrite"
        
        # 检查续写关键词
        for keyword in continue_keywords:
            if keyword in user_input:
                return "continue"
        
        # 默认为自定义任务
        return "custom"
    
    @staticmethod
    def _extract_changes(original: str, modified: str) -> List[Dict[str, Any]]:
        """提取文本修改详情"""
        changes = []
        matcher = SequenceMatcher(None, original, modified)
        
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'replace':
                changes.append({
                    "type": "modify",
                    "original": original[i1:i2],
                    "modified": modified[j1:j2],
                    "position": {"start": i1, "end": i2}
                })
            elif tag == 'delete':
                changes.append({
                    "type": "delete",
                    "original": original[i1:i2],
                    "modified": "",
                    "position": {"start": i1, "end": i2}
                })
            elif tag == 'insert':
                changes.append({
                    "type": "add",
                    "original": "",
                    "modified": modified[j1:j2],
                    "position": {"start": i1, "end": i1}
                })
        
        return changes
    
    @staticmethod
    def _get_openai_client(user: User) -> openai.OpenAI:
        """获取OpenAI客户端"""
        if not user.openaiKey:
            raise OpenAIKeyError("OpenAI API Key not configured")

        try:
            api_key = decrypt(user.openaiKey)
            return openai.OpenAI(api_key=api_key)
        except Exception as e:
            raise OpenAIKeyError("Failed to decrypt OpenAI API Key")

    @staticmethod
    def _get_claude_client(user: User) -> anthropic.Anthropic:
        """获取Claude客户端"""
        if not user.claudeKey:
            raise ValidationError("Claude API Key not configured")

        try:
            api_key = decrypt(user.claudeKey)
            return anthropic.Anthropic(api_key=api_key)
        except Exception as e:
            raise ValidationError("Failed to decrypt Claude API Key")

    @staticmethod
    def _determine_provider(user: User, preferred_provider: str = None) -> str:
        """
        确定使用哪个AI提供商

        Args:
            user: 用户对象
            preferred_provider: 偏好的提供商 (openai, claude, gemini)

        Returns:
            可用的提供商名称
        """
        # 如果指定了偏好提供商且该提供商可用
        if preferred_provider:
            if preferred_provider == "openai" and user.openaiKey:
                return "openai"
            elif preferred_provider == "claude" and user.claudeKey:
                return "claude"
            elif preferred_provider == "gemini" and user.geminiKey:
                return "gemini"

        # 按优先级检查可用的提供商
        if user.openaiKey:
            return "openai"
        elif user.claudeKey:
            return "claude"
        elif user.geminiKey:
            return "gemini"
        else:
            raise ValidationError("No AI API keys configured")
    
    @classmethod
    async def _call_ai(
        cls,
        user: User,
        messages: List[Dict[str, str]],
        provider: str = None,
        model: str = None,
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> str:
        """
        统一的AI调用接口，支持多个提供商

        使用UnifiedAIClient自动处理不同提供商的消息格式和API差异

        Args:
            user: 用户对象
            messages: 消息列表
            provider: AI提供商 (openai, claude, gemini)
            model: 指定的模型ID
            temperature: 温度参数
            max_tokens: 最大token数

        Returns:
            AI响应文本
        """
        # 使用统一的AI客户端
        return await UnifiedAIClient.call(
            user=user,
            messages=messages,
            provider=provider,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens
        )

    @staticmethod
    def _build_system_prompt(agent: Agent) -> str:
        """构建系统提示词"""
        tone_map = {
            "professional": "专业严谨",
            "casual": "轻松随意", 
            "humorous": "幽默风趣",
            "serious": "严肃认真"
        }
        
        length_map = {
            "short": "简洁精炼，控制在500字以内",
            "medium": "适中详细，控制在500-1500字",
            "long": "详细充分，1500字以上"
        }
        
        prompt = f"""你是一个{agent.name}，你的任务是根据用户提供的素材生成高质量的博客文章。

你的写作特点：
- 语言：{agent.language if agent.language == 'zh-CN' else '英文' if agent.language == 'en-US' else '中英混合'}
- 语气：{tone_map.get(agent.tone, agent.tone)}
- 篇幅：{length_map.get(agent.lengthPreference, agent.lengthPreference)}"""

        if agent.targetAudience:
            prompt += f"\n- 目标读者：{agent.targetAudience}"
        
        if agent.description:
            prompt += f"\n- 特点描述：{agent.description}"
        
        if agent.customPrompt:
            prompt += f"\n\n特殊要求：{agent.customPrompt}"
        
        prompt += f"""

输出格式要求：
1. 文章必须是Markdown格式（我会自动转换为HTML）
2. 包含适当的标题层级（使用 #, ##, ### 等）
3. 如果适合，可以包含代码块、列表、引用等元素
4. 文章结构清晰，逻辑流畅
5. 使用标准Markdown语法，确保转换为HTML后格式正确

请直接输出文章内容，不要包含其他说明。"""
        
        return prompt
    
    @staticmethod
    def _build_chat_system_prompt(agent: Agent, materials: Optional[str] = None) -> str:
        """构建对话系统提示词"""
        tone_map = {
            "professional": "专业严谨",
            "casual": "轻松随意",
            "humorous": "幽默风趣", 
            "serious": "严肃认真"
        }
        
        prompt = f"""你是一个{agent.name}，正在和用户进行对话，帮助用户生成博客文章。

你的特点：
- 语言：{agent.language if agent.language == 'zh-CN' else '英文' if agent.language == 'en-US' else '中英混合'}
- 语气：{tone_map.get(agent.tone, agent.tone)}"""

        if agent.targetAudience:
            prompt += f"\n- 目标读者：{agent.targetAudience}"
        
        if agent.description:
            prompt += f"\n- 特点描述：{agent.description}"
        
        if materials:
            prompt += f"\n\n参考素材：\n{materials}"
            prompt += "\n\n你可以在对话中引用这些素材，回答用户关于素材的问题，或者基于素材提供建议。"
        
        prompt += """

请以友好、有帮助的方式与用户对话。你可以：
1. 回答用户关于写作的问题
2. 基于素材提供写作建议
3. 帮助用户梳理文章结构
4. 提供内容优化建议
5. 与用户讨论文章主题和方向

保持对话自然流畅，不要太过冗长。"""
        
        return prompt
    
    @staticmethod
    def _markdown_to_html(markdown_text: str) -> str:
        """将Markdown转换为HTML"""
        # 配置markdown扩展
        md = markdown.Markdown(extensions=[
            'extra',  # 包括表格、代码块等
            'codehilite',  # 代码高亮
            'fenced_code',  # 围栏代码块
            'tables',  # 表格支持
            'toc',  # 目录支持
            'nl2br',  # 换行转<br>
            'sane_lists',  # 更好的列表处理
        ])
        return md.convert(markdown_text)
    
    @staticmethod
    def _parse_article_response(response: str, provided_title: Optional[str] = None) -> Dict[str, str]:
        """解析文章生成响应"""
        lines = response.strip().split('\n')
        title = provided_title or "未命名文章"
        markdown_content = response
        
        # 如果响应以 # 开头，说明包含了标题
        if lines and lines[0].startswith('# '):
            title = lines[0].replace('# ', '').strip()
            markdown_content = '\n'.join(lines[1:]).strip()
        
        # 将Markdown转换为HTML
        html_content = AIService._markdown_to_html(markdown_content)
        
        # 生成摘要（取前200个字符）
        plain_text = markdown_content.replace('#', '').replace('*', '').replace('`', '').strip()
        summary = plain_text[:200] + '...' if len(plain_text) > 200 else plain_text
        
        return {
            "title": title,
            "content": html_content,  # 返回HTML内容
            "summary": summary,
            "markdown_content": markdown_content  # 保留原始Markdown内容以备需要
        }
    
    @classmethod
    async def generate_article(
        cls,
        user: User,
        agent: Agent,
        materials: str,
        title: Optional[str] = None,
        requirements: Optional[str] = None
    ) -> Dict[str, str]:
        """生成文章"""
        
        client = cls._get_openai_client(user)
        system_prompt = cls._build_system_prompt(agent)
        
        # 构建用户提示词
        user_prompt = "请根据以下素材生成一篇博客文章：\n\n"
        
        if title:
            user_prompt += f"文章标题：{title}\n\n"
        
        user_prompt += f"素材内容：\n{materials}\n\n"
        
        if requirements:
            user_prompt += f"额外要求：{requirements}\n\n"
        
        if not title:
            user_prompt += "请为文章生成一个合适的标题。\n"
        
        try:
            response = client.chat.completions.create(
                model=get_model_for_provider("openai"),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=4000
            )
            
            generated_content = response.choices[0].message.content or ""
            return cls._parse_article_response(generated_content, title)
            
        except Exception as e:
            raise ValidationError(f"AI generation failed: {str(e)}")
    
    @classmethod
    async def generate_chat_response(
        cls,
        user: User,
        agent: Agent,
        messages: List[Dict[str, str]],
        materials: Optional[str] = None
    ) -> str:
        """生成对话响应"""
        
        client = cls._get_openai_client(user)
        system_prompt = cls._build_chat_system_prompt(agent, materials)
        
        # 构建对话消息
        chat_messages = [{"role": "system", "content": system_prompt}]
        chat_messages.extend([
            {"role": msg["role"], "content": msg["content"]} 
            for msg in messages
        ])
        
        try:
            response = client.chat.completions.create(
                model=get_model_for_provider("openai"),
                messages=chat_messages,
                temperature=0.7,
                max_tokens=1000
            )
            
            return response.choices[0].message.content or "抱歉，我无法生成回复。"
            
        except Exception as e:
            raise ValidationError(f"Chat generation failed: {str(e)}")
    
    @classmethod
    async def improve_article(
        cls,
        user: User, 
        agent: Agent,
        current_content: str,
        instructions: str
    ) -> str:
        """改进文章"""
        
        client = cls._get_openai_client(user)
        system_prompt = cls._build_system_prompt(agent)
        
        user_prompt = f"""请根据以下指示改进这篇文章：

当前文章内容：
{current_content}

改进要求：
{instructions}

请直接输出改进后的完整文章内容（Markdown格式）。"""
        
        try:
            response = client.chat.completions.create(
                model=get_model_for_provider("openai"),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=4000
            )
            
            markdown_response = response.choices[0].message.content or current_content
            # 将Markdown转换为HTML
            return cls._markdown_to_html(markdown_response)
            
        except Exception as e:
            raise ValidationError(f"Article improvement failed: {str(e)}")
    
    @classmethod
    async def analyze_writing_style(
        cls,
        user: User,
        content: str,
        content_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """分析文本内容并生成写作风格描述"""
        
        client = cls._get_openai_client(user)
        
        # 构建系统提示词
        system_prompt = """你是一个专业的写作风格分析师。你的任务是：
1. 判断内容类型（对话记录或文章）
2. 分析写作风格特征
3. 生成一个适合作为AI Agent customPrompt的风格描述

请分析以下几个维度：
- 语言风格（正式/非正式、专业/通俗等）
- 句式特点（长短、复杂度）
- 用词习惯（专业术语、口语化程度）
- 表达方式（直接/委婉、理性/感性）
- 特殊习惯（标点使用、段落组织等）

返回JSON格式，包含：
{
    "detectedType": "conversation" 或 "article",
    "styleDescription": "一段完整的风格描述，可直接用作customPrompt",
    "characteristics": {
        "language": "语言特点",
        "tone": "语气风格",
        "sentenceStyle": "句式特点",
        "vocabulary": "用词特征",
        "specialTraits": "特殊习惯"
    }
}"""
        
        # 构建用户提示词
        user_prompt = f"请分析以下内容的写作风格：\n\n{content[:3000]}"  # 限制长度避免超出token限制
        
        if content_type:
            user_prompt = f"内容类型提示：{content_type}\n\n" + user_prompt
        
        try:
            response = client.chat.completions.create(
                model=get_model_for_provider("openai"),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,  # 降低温度以获得更稳定的分析结果
                max_tokens=1000,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content or "{}")
            
            # 确保返回格式正确
            if not all(key in result for key in ["detectedType", "styleDescription", "characteristics"]):
                raise ValidationError("Invalid response format from AI")
            
            return result
            
        except json.JSONDecodeError:
            raise ValidationError("Failed to parse AI response as JSON")
        except Exception as e:
            raise ValidationError(f"Writing style analysis failed: {str(e)}")
    
    @classmethod
    async def generate_structured_response(
        cls,
        user: User,
        agent: Agent,
        user_input: str,
        context: Optional[str] = None,
        task_type: Optional[TaskType] = None,
        original_content: Optional[str] = None
    ) -> Dict[str, Any]:
        """生成结构化的JSON响应"""
        
        client = cls._get_openai_client(user)
        
        # 自动分类任务类型（如果未提供）
        if not task_type:
            task_type = cls._classify_task_type(user_input, context)
        
        # 根据任务类型构建系统提示词
        base_system_prompt = cls._build_system_prompt(agent)
        
        # 添加JSON格式化要求
        json_format_prompt = f"""
{base_system_prompt}

重要：你必须返回一个严格的JSON格式响应，格式如下：
{{
    "type": "{task_type}",
    "result": "处理后的文本内容",
    "metadata": {{
        "confidence": 0.95,  // 任务类型判断置信度（0-1）
        "suggestions": []    // 可选的额外建议
    }}
}}
"""
        
        # 根据任务类型定制提示词
        if task_type == "rewrite":
            json_format_prompt += """
对于改写任务，metadata中还需要包含：
- "original": "原始文本"
- "changes": [修改详情数组]
"""
            user_prompt = f"""任务类型：改写/优化文本
用户指令：{user_input}

需要改写的文本：
{original_content or context}

请按照JSON格式返回改写结果。"""
        
        elif task_type == "continue":
            user_prompt = f"""任务类型：续写文本
用户指令：{user_input}

已有文本：
{context}

请按照JSON格式返回续写内容。"""
        
        else:  # custom
            user_prompt = f"""任务类型：自定义处理
用户指令：{user_input}

上下文信息：
{context}

请按照JSON格式返回处理结果。"""
        
        try:
            response = client.chat.completions.create(
                model=get_model_for_provider("openai"),
                messages=[
                    {"role": "system", "content": json_format_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=4000,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content or "{}")
            
            # 如果是改写任务，计算文本差异
            if task_type == "rewrite" and original_content:
                if "metadata" not in result:
                    result["metadata"] = {}
                
                result["metadata"]["original"] = original_content
                result["metadata"]["changes"] = cls._extract_changes(
                    original_content, 
                    result.get("result", "")
                )
            
            return result
            
        except json.JSONDecodeError:
            raise ValidationError("Failed to parse AI response as JSON")
        except Exception as e:
            raise ValidationError(f"Structured response generation failed: {str(e)}")
    
    @classmethod
    async def process_text_with_structure(
        cls,
        user: User,
        agent: Agent,
        input_text: str,
        context: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """处理文本并返回结构化响应（统一API）"""
        
        options = options or {}
        task_type = options.get("task_type")
        
        # 如果是改写任务，需要原文
        original_content = None
        if task_type == "rewrite" or cls._classify_task_type(input_text) == "rewrite":
            original_content = context
        
        return await cls.generate_structured_response(
            user=user,
            agent=agent,
            user_input=input_text,
            context=context,
            task_type=task_type,
            original_content=original_content
        )

    @classmethod
    async def perform_text_action(
        cls,
        user: User,
        agent: Agent,
        text: str,
        action_type: str,
        context: Optional[str] = None,
        language: Optional[str] = None,
        provider: str = None,
        model: str = None
    ) -> Dict[str, Any]:
        """执行文本操作（改进、解释、扩展等）"""

        system_prompt = cls._build_system_prompt(agent)

        # 根据操作类型构建不同的提示词
        action_prompts = {
            "improve": "请改进以下文本，使其更加清晰、准确和有说服力，保持原意不变：",
            "explain": "请详细解释以下文本的含义、背景和重要概念：",
            "expand": "请扩展以下文本，添加更多细节、例子和相关信息：",
            "summarize": "请总结以下文本的关键要点和主要内容：",
            "translate": f"请将以下文本翻译成{language or '英文'}：",
            "rewrite": "请用不同的表达方式重写以下文本，保持核心意思不变："
        }

        action_prompt = action_prompts.get(action_type, "请处理以下文本：")

        # 构建用户提示词
        user_prompt = f"{action_prompt}\n\n文本内容：\n{text}"

        if context:
            user_prompt += f"\n\n上下文信息：\n{context}"

        if action_type in ["improve", "rewrite"]:
            user_prompt += "\n\n请提供简要的修改说明。"

        try:
            # 使用统一的AI调用方法
            processed_text = await cls._call_ai(
                user=user,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                provider=provider,
                model=model,
                temperature=0.7,
                max_tokens=2000
            )

            # 对于改进和重写操作，尝试分离结果和说明
            explanation = None
            if action_type in ["improve", "rewrite"]:
                # 尝试多种分隔符
                separators = ["修改说明：", "修改说明:", "说明：", "说明:", "\n\n修改说明", "\n修改说明"]
                for sep in separators:
                    if sep in processed_text:
                        parts = processed_text.split(sep, 1)  # 只分割第一次出现
                        if len(parts) == 2:
                            processed_text = parts[0].strip()
                            explanation = parts[1].strip()
                            break

            return {
                "actionType": action_type,
                "originalText": text,
                "processedText": processed_text,
                "explanation": explanation
            }

        except Exception as e:
            raise ValidationError(f"Text action failed: {str(e)}")
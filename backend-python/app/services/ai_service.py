import openai
import markdown
import json
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from ..models import User, Agent, Article
from ..utils.security import decrypt
from ..utils.exceptions import OpenAIKeyError, ValidationError


class AIService:
    
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
                model="gpt-4-turbo-preview",
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
                model="gpt-4-turbo-preview",
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
                model="gpt-4-turbo-preview",
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
                model="gpt-4-turbo-preview",
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
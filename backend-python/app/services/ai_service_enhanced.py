"""
增强版AI服务
使用新的prompt系统
"""

from typing import Dict, Optional, Any
from ..models import User, Agent
from ..agent.prompts import PromptBuilder, AgentContext
from .ai_service import AIService


class EnhancedAIService(AIService):
    """增强的AI服务，集成了prompt系统"""

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
        model: str = None,
        instruction: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        执行文本操作（使用新的prompt系统）

        Args:
            user: 用户对象
            agent: Agent对象
            text: 要处理的文本
            action_type: 操作类型（improve, explain, expand等）
            context: 上下文信息
            language: 目标语言（用于翻译）
            provider: AI提供商
            model: 模型名称
            instruction: 用户额外指令

        Returns:
            处理结果字典
        """
        # 构建Agent上下文
        agent_context = AgentContext(
            name=agent.name,
            language=agent.language,
            tone=agent.tone,
            target_audience=agent.targetAudience,
            custom_prompt=agent.customPrompt,
            description=agent.description
        )

        # 映射action_type到prompt系统的任务名
        action_map = {
            "improve": "improve",
            "explain": "explain",
            "expand": "expand",
            "summarize": "summarize",
            "translate": "translate",
            "simplify": "simplify",
            "polish": "polish",
            "continue": "continue",
            "fix_grammar": "fix_grammar",
            "make_professional": "make_professional",
            "extract_key_points": "extract_key_points",
            "generate_outline": "generate_outline",
            "rewrite": "polish"  # 重写映射到润色
        }

        task = action_map.get(action_type, "improve")

        # 构建kwargs
        kwargs = {}
        if task == "translate" and language:
            kwargs["target_language"] = language

        # 使用PromptBuilder构建prompt
        system_prompt, user_prompt = PromptBuilder.build_for_action(
            action=task,
            text=text,
            agent_context=agent_context,
            instruction=instruction or context,
            **kwargs
        )

        try:
            # 调用AI
            processed_text = await cls._call_ai(
                user=user,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                provider=provider,
                model=model,
                temperature=0.7,
                max_tokens=3000
            )

            # 构建响应
            result = {
                "processedText": processed_text,
                "actionType": action_type,
                "metadata": {
                    "model": model or "default",
                    "provider": provider or "auto",
                    "task": task,
                    "hasContext": bool(context or instruction)
                }
            }

            # 对于某些操作，尝试提取额外信息
            if action_type in ["improve", "explain"]:
                # 尝试分离主要内容和说明
                lines = processed_text.strip().split('\n')
                if len(lines) > 1 and any(keyword in lines[-1].lower() for keyword in ['修改', '改进', '解释', 'change', 'improve']):
                    result["processedText"] = '\n'.join(lines[:-1])
                    result["explanation"] = lines[-1]

            return result

        except Exception as e:
            raise ValueError(f"Text action failed: {str(e)}")

    @classmethod
    def get_available_actions(cls) -> list:
        """获取所有可用的文本操作"""
        return [
            {
                "action": "improve",
                "label": "改进文本",
                "description": "提升文本清晰度和说服力",
                "icon": "✨"
            },
            {
                "action": "explain",
                "label": "解释文本",
                "description": "详细解释概念和术语",
                "icon": "💡"
            },
            {
                "action": "expand",
                "label": "扩展文本",
                "description": "添加更多细节和例子",
                "icon": "➕"
            },
            {
                "action": "summarize",
                "label": "总结文本",
                "description": "提取关键要点",
                "icon": "📋"
            },
            {
                "action": "translate",
                "label": "翻译文本",
                "description": "翻译为其他语言",
                "icon": "🌐"
            },
            {
                "action": "simplify",
                "label": "简化文本",
                "description": "使文本更易理解",
                "icon": "📝"
            },
            {
                "action": "polish",
                "label": "润色文本",
                "description": "提升文采和表达",
                "icon": "✏️"
            },
            {
                "action": "continue",
                "label": "续写文本",
                "description": "延续内容发展",
                "icon": "📄"
            },
            {
                "action": "fix_grammar",
                "label": "修正语法",
                "description": "纠正语法和拼写错误",
                "icon": "🔧"
            },
            {
                "action": "make_professional",
                "label": "专业化",
                "description": "转换为专业风格",
                "icon": "👔"
            },
            {
                "action": "extract_key_points",
                "label": "提取要点",
                "description": "识别关键信息",
                "icon": "🎯"
            },
            {
                "action": "generate_outline",
                "label": "生成大纲",
                "description": "创建结构化大纲",
                "icon": "📑"
            }
        ]
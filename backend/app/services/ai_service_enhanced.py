"""
增强版AI服务
使用新的prompt系统
"""

from typing import Dict, Optional, Any
import time
from ..models import User, Agent
from ..agent.prompts import PromptBuilder, AgentContext
from ..agent.prompts.action_config import get_action_by_alias, is_action_enabled, get_default_instruction
from .ai_service import AIService
from ..utils.agent_logger import agent_logger


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
        start_time = time.time()

        # 记录Agent配置
        agent_logger.log_agent_execution(
            agent_id=agent.id,
            action=action_type,
            stage="agent_config",
            data={
                "agent_config": {
                    "name": agent.name,
                    "role": agent.description,
                    "tone": agent.tone,
                    "target_audience": agent.targetAudience,
                    "language": agent.language
                }
            }
        )

        # 构建Agent上下文
        agent_context = AgentContext(
            name=agent.name,
            language=agent.language,
            tone=agent.tone,
            target_audience=agent.targetAudience,
            custom_prompt=agent.customPrompt,
            description=agent.description
        )

        # 通过别名系统获取实际的action ID
        actual_action = get_action_by_alias(action_type)

        # 检查action是否启用（这里可以根据用户级别进一步控制）
        # 暂时使用advanced级别，允许使用高级功能
        if not is_action_enabled(actual_action, user_level="advanced"):
            raise ValueError(f"Action '{action_type}' is not available for current user")

        task = actual_action

        # 处理指令：如果用户没有输入，使用默认指令
        final_instruction = instruction or context
        if not final_instruction:
            # 获取action的默认指令
            default_inst = get_default_instruction(actual_action)
            final_instruction = default_inst
        else:
            # 如果用户输入了指令，将默认指令作为前缀
            default_inst = get_default_instruction(actual_action)
            if default_inst:
                # 组合默认指令和用户指令，例如："改进文本，更简洁"
                final_instruction = f"{default_inst}，{final_instruction}"

        # 构建kwargs
        kwargs = {}
        if task == "translate" and language:
            kwargs["target_language"] = language

        # 使用PromptBuilder构建prompt
        prompt_start = time.time()
        system_prompt, user_prompt = PromptBuilder.build_for_action(
            action=task,
            text=text,
            agent_context=agent_context,
            instruction=final_instruction,
            **kwargs
        )

        # 记录prompt构建
        agent_logger.log_agent_execution(
            agent_id=agent.id,
            action=actual_action,
            stage="prompt_construction",
            data={
                "agent_config": {
                    "name": agent.name,
                    "role": agent.description,
                    "tone": agent.tone,
                    "target_audience": agent.targetAudience
                },
                "system_prompt": system_prompt,
                "user_prompt": user_prompt,
                "task_guidance": f"执行{actual_action}操作",
                "final_instruction": final_instruction,
                "user_instruction": instruction or context,
                "default_instruction": get_default_instruction(actual_action),
                "has_user_input": bool(instruction or context),
                "text_length": len(text)
            },
            execution_time=time.time() - prompt_start
        )

        try:
            # 记录API调用开始
            api_start = time.time()

            # 翻译任务使用0.1温度以提高准确性
            temp = 0.1 if action_type == "translate" else 0.7

            # DEBUG: 检查provider参数
            print(f"🔍 EnhancedAIService.perform_text_action: provider={provider}, model={model}, temp={temp}")

            agent_logger.log_agent_execution(
                agent_id=agent.id,
                action=actual_action,
                stage="api_call",
                data={
                    "model": model or "default",
                    "provider": provider or "auto",
                    "temperature": temp,
                    "max_tokens": 3000
                }
            )

            # 调用AI
            processed_text = await cls._call_ai(
                user=user,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                provider=provider,
                model=model,
                temperature=temp,
                max_tokens=3000
            )

            # 记录API响应
            agent_logger.log_agent_execution(
                agent_id=agent.id,
                action=actual_action,
                stage="api_response",
                data={
                    "response_length": len(processed_text),
                    "success": True
                },
                execution_time=time.time() - api_start
            )

            # 构建响应
            result = {
                "processedText": processed_text,
                "originalText": text,  # 添加原始文本
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

            # 记录最终结果
            agent_logger.log_agent_execution(
                agent_id=agent.id,
                action=actual_action,
                stage="result",
                data={
                    "success": True,
                    "output_length": len(processed_text),
                    "has_explanation": "explanation" in result
                },
                execution_time=time.time() - start_time
            )

            return result

        except Exception as e:
            # 记录错误
            agent_logger.log_agent_execution(
                agent_id=agent.id,
                action=actual_action,
                stage="error",
                data={
                    "error": str(e),
                    "success": False
                },
                execution_time=time.time() - start_time
            )
            raise ValueError(f"Text action failed: {str(e)}")

    @classmethod
    def get_available_actions(cls, user_level: str = "basic") -> list:
        """
        获取用户可用的文本操作

        Args:
            user_level: 用户级别 (basic, advanced, experimental)

        Returns:
            可用操作列表
        """
        from ..agent.prompts.action_config import get_visible_actions

        # 根据用户级别决定显示哪些功能
        include_advanced = user_level in ["advanced", "experimental"]
        include_experimental = user_level == "experimental"

        return get_visible_actions(
            include_advanced=include_advanced,
            include_experimental=include_experimental
        )
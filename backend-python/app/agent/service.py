import logging
from typing import Dict, Any, Optional, List, AsyncGenerator
from sqlalchemy.orm import Session
from .models import ModelFactory, GenerationResponse
from app.models.agent import Agent as AgentModel
from app.dependencies import get_db
from ..utils.security import decrypt

logger = logging.getLogger(__name__)

class AgentService:
    """Agent业务服务类，协调模型和其他功能模块"""

    def __init__(self):
        self.model_factory = ModelFactory()

    async def generate_content(
        self,
        agent_id: str,
        prompt: str,
        user_id: str,
        db: Session,
        **kwargs
    ) -> GenerationResponse:
        """使用指定Agent生成内容

        Args:
            agent_id: Agent ID
            prompt: 输入提示词
            user_id: 用户ID
            db: 数据库会话
            **kwargs: 额外参数

        Returns:
            GenerationResponse: 生成结果
        """
        try:
            # 获取Agent配置
            agent = self._get_agent(agent_id, user_id, db)
            if not agent:
                raise ValueError(f"Agent {agent_id} not found")

            # 创建模型实例
            model = await self._create_model_from_agent(agent)

            # 构建系统消息（如果Agent有特定配置）
            system_message = self._build_system_message(agent)
            if system_message:
                kwargs['system'] = system_message

            # 生成内容
            result = await model.generate(prompt, **kwargs)

            logger.info(f"Generated content for agent {agent_id}: {len(result.content)} chars")
            return result

        except Exception as e:
            logger.error(f"Content generation failed for agent {agent_id}: {e}")
            raise

    async def stream_generate_content(
        self,
        agent_id: str,
        prompt: str,
        user_id: str,
        db: Session,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """流式生成内容

        Args:
            agent_id: Agent ID
            prompt: 输入提示词
            user_id: 用户ID
            db: 数据库会话
            **kwargs: 额外参数

        Yields:
            str: 生成的内容片段
        """
        try:
            # 获取Agent配置
            agent = self._get_agent(agent_id, user_id, db)
            if not agent:
                raise ValueError(f"Agent {agent_id} not found")

            # 创建模型实例
            model = await self._create_model_from_agent(agent)

            # 构建系统消息
            system_message = self._build_system_message(agent)
            if system_message:
                kwargs['system'] = system_message

            # 流式生成内容
            async for chunk in model.stream_generate(prompt, **kwargs):
                yield chunk

        except Exception as e:
            logger.error(f"Stream generation failed for agent {agent_id}: {e}")
            raise

    async def validate_agent_model(
        self,
        agent_id: str,
        user_id: str,
        db: Session
    ) -> bool:
        """验证Agent的模型配置是否有效

        Args:
            agent_id: Agent ID
            user_id: 用户ID
            db: 数据库会话

        Returns:
            bool: 配置是否有效
        """
        try:
            agent = self._get_agent(agent_id, user_id, db)
            if not agent:
                return False

            model = await self._create_model_from_agent(agent)
            return await model.validate_config()

        except Exception as e:
            logger.error(f"Agent model validation failed: {e}")
            return False

    def get_available_models(self) -> List[Dict[str, Any]]:
        """获取可用的模型列表

        Returns:
            List[Dict]: 模型信息列表
        """
        return self.model_factory.list_all_models_info()

    def get_model_info(self, model_type: str) -> Dict[str, Any]:
        """获取指定模型的详细信息

        Args:
            model_type: 模型类型

        Returns:
            Dict: 模型信息
        """
        return self.model_factory.get_model_info(model_type)

    def _get_agent(self, agent_id: str, user_id: str, db: Session) -> Optional[AgentModel]:
        """获取Agent实例

        Args:
            agent_id: Agent ID
            user_id: 用户ID
            db: 数据库会话

        Returns:
            Optional[AgentModel]: Agent实例
        """
        try:
            agent = db.query(AgentModel).filter(
                AgentModel.id == agent_id,
                AgentModel.userId == user_id
            ).first()
            return agent
        except Exception as e:
            logger.error(f"Failed to get agent {agent_id}: {e}")
            return None

    async def _create_model_from_agent(self, agent: AgentModel):
        """根据Agent配置创建模型实例

        Args:
            agent: Agent数据模型

        Returns:
            BaseModel: 模型实例
        """
        # 获取模型配置
        model_config = agent.modelConfig or {}
        model_type = model_config.get('type', 'claude')

        # 解密API密钥（假设存储在User表中的encryptedOpenaiApiKey字段）
        # 这里需要根据实际的数据库结构调整
        user = agent.user
        api_key = None

        if model_type == 'claude':
            api_key = decrypt(user.claudeKey) if user.claudeKey else None
        elif model_type == 'openai':
            api_key = decrypt(user.openaiKey) if user.openaiKey else None
        elif model_type == 'gemini':
            api_key = decrypt(user.geminiKey) if user.geminiKey else None

        if not api_key:
            raise ValueError(f"No API key found for model type: {model_type}")

        # 创建模型配置
        full_config = {
            'type': model_type,
            'api_key': api_key,
            **model_config
        }

        # 创建模型实例
        return self.model_factory.create(full_config)

    def _build_system_message(self, agent: AgentModel) -> Optional[str]:
        """构建系统消息

        Args:
            agent: Agent实例

        Returns:
            Optional[str]: 系统消息
        """
        system_parts = []

        # 添加Agent描述
        if agent.description:
            system_parts.append(f"你是{agent.name}。{agent.description}")

        # 添加写作风格
        if hasattr(agent, 'tone') and agent.tone:
            system_parts.append(f"写作风格：{agent.tone}")

        # 添加目标受众
        if hasattr(agent, 'targetAudience') and agent.targetAudience:
            system_parts.append(f"目标受众：{agent.targetAudience}")

        # 添加自定义提示词
        if hasattr(agent, 'customInstructions') and agent.customInstructions:
            system_parts.append(agent.customInstructions)

        return "\n\n".join(system_parts) if system_parts else None

# 创建全局服务实例
agent_service = AgentService()
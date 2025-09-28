"""
调试配置 - 控制Agent执行的日志级别
"""
import os
from typing import Optional


class DebugConfig:
    """调试配置类"""

    # 从环境变量读取调试模式
    AGENT_DEBUG_MODE: bool = os.getenv('AGENT_DEBUG_MODE', 'true').lower() == 'true'

    # 日志级别
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'DEBUG' if AGENT_DEBUG_MODE else 'INFO')

    # 是否记录完整的prompt（可能很长）
    LOG_FULL_PROMPTS: bool = os.getenv('LOG_FULL_PROMPTS', 'true').lower() == 'true'

    # 是否记录API响应
    LOG_API_RESPONSES: bool = os.getenv('LOG_API_RESPONSES', 'true').lower() == 'true'

    # 日志文件保留天数
    LOG_RETENTION_DAYS: int = int(os.getenv('LOG_RETENTION_DAYS', '30'))

    # 是否将日志输出到控制台
    LOG_TO_CONSOLE: bool = os.getenv('LOG_TO_CONSOLE', 'true').lower() == 'true'

    # 特定Agent的调试开关
    DEBUG_AGENT_IDS: Optional[list] = None  # None表示调试所有Agent

    @classmethod
    def is_agent_debug_enabled(cls, agent_id: int) -> bool:
        """检查特定Agent是否启用调试"""
        if not cls.AGENT_DEBUG_MODE:
            return False

        if cls.DEBUG_AGENT_IDS is None:
            return True

        return agent_id in cls.DEBUG_AGENT_IDS

    @classmethod
    def enable_debug_for_agent(cls, agent_id: int):
        """为特定Agent启用调试"""
        if cls.DEBUG_AGENT_IDS is None:
            cls.DEBUG_AGENT_IDS = []
        if agent_id not in cls.DEBUG_AGENT_IDS:
            cls.DEBUG_AGENT_IDS.append(agent_id)

    @classmethod
    def disable_debug_for_agent(cls, agent_id: int):
        """为特定Agent禁用调试"""
        if cls.DEBUG_AGENT_IDS and agent_id in cls.DEBUG_AGENT_IDS:
            cls.DEBUG_AGENT_IDS.remove(agent_id)

    @classmethod
    def toggle_debug_mode(cls):
        """切换调试模式"""
        cls.AGENT_DEBUG_MODE = not cls.AGENT_DEBUG_MODE
        cls.LOG_LEVEL = 'DEBUG' if cls.AGENT_DEBUG_MODE else 'INFO'
        return cls.AGENT_DEBUG_MODE


# 导出配置实例
debug_config = DebugConfig()
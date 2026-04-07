"""
Agent执行日志器 - 专注于prompt构建和知识召回的监控
"""
import json
import time
import functools
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional
import logging
try:
    from ..debug_config import debug_config
except ImportError:
    # 如果debug_config不存在，使用默认配置
    class DefaultDebugConfig:
        AGENT_DEBUG_MODE = True
        LOG_LEVEL = 'DEBUG'
        LOG_FULL_PROMPTS = True
        LOG_API_RESPONSES = True
        LOG_TO_CONSOLE = True
        DEBUG_AGENT_IDS = None

        @classmethod
        def is_agent_debug_enabled(cls, agent_id):
            return cls.AGENT_DEBUG_MODE

    debug_config = DefaultDebugConfig()


class AgentExecutionLogger:
    """Agent执行日志器"""

    def __init__(self, log_dir: str = "logs/agent", debug: bool = None):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)

        # 使用配置中的debug设置
        self.debug = debug if debug is not None else debug_config.AGENT_DEBUG_MODE

        # 创建专门的logger
        self.logger = logging.getLogger('agent.execution')
        self.logger.setLevel(getattr(logging, debug_config.LOG_LEVEL.upper()))

        # 文件处理器 - 记录所有agent执行
        log_file = self.log_dir / f"agent_{datetime.now().strftime('%Y%m%d')}.log"
        fh = logging.FileHandler(log_file, encoding='utf-8')
        fh.setLevel(logging.DEBUG)

        # 控制台处理器 - 根据配置决定是否输出
        if debug_config.LOG_TO_CONSOLE:
            ch = logging.StreamHandler()
            ch.setLevel(logging.INFO)
            self.logger.addHandler(ch)

        # 格式化器
        formatter = logging.Formatter(
            '%(asctime)s | %(levelname)s | %(message)s',
            datefmt='%H:%M:%S'
        )
        fh.setFormatter(formatter)
        fh.setFormatter(formatter)
        if debug_config.LOG_TO_CONSOLE:
            ch.setFormatter(formatter)

        self.logger.addHandler(fh)

    def log_agent_execution(self,
                           agent_id: int,
                           action: str,
                           stage: str,
                           data: Dict[str, Any],
                           execution_time: Optional[float] = None):
        """记录Agent执行的各个阶段"""

        # 检查是否对该Agent启用调试
        if not debug_config.is_agent_debug_enabled(agent_id):
            return

        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "agent_id": agent_id,
            "action": action,
            "stage": stage,
            "data": data
        }

        if execution_time:
            log_entry["execution_time_ms"] = round(execution_time * 1000, 2)

        # 根据阶段选择日志级别和格式
        if stage == "prompt_construction":
            self._log_prompt_construction(log_entry)
        elif stage == "knowledge_recall":
            self._log_knowledge_recall(log_entry)
        elif stage == "api_call":
            self._log_api_call(log_entry)
        elif stage == "result":
            self._log_result(log_entry)
        else:
            self.logger.debug(json.dumps(log_entry, ensure_ascii=False, indent=2))

    def _log_prompt_construction(self, entry: Dict):
        """记录Prompt构建过程"""
        data = entry['data']

        msg = f"\n{'='*60}\n"
        msg += f"📝 PROMPT构建 | Agent: {entry['agent_id']} | Action: {entry['action']}\n"
        msg += f"{'='*60}\n"

        # Agent配置
        if 'agent_config' in data:
            config = data['agent_config']
            msg += f"🤖 Agent配置:\n"
            msg += f"   - 名称: {config.get('name', 'N/A')}\n"
            msg += f"   - 角色: {config.get('role', 'N/A')}\n"
            msg += f"   - 语气: {config.get('tone', 'N/A')}\n"
            msg += f"   - 目标读者: {config.get('target_audience', 'N/A')}\n"

        # System Prompt
        if 'system_prompt' in data and debug_config.LOG_FULL_PROMPTS:
            msg += f"\n📋 System Prompt:\n"
            msg += f"{'-'*40}\n"
            prompt_text = data['system_prompt']
            if not debug_config.LOG_FULL_PROMPTS and len(prompt_text) > 500:
                msg += f"{prompt_text[:500]}...\n"
            else:
                msg += f"{prompt_text}\n"

        # User Prompt
        if 'user_prompt' in data and debug_config.LOG_FULL_PROMPTS:
            msg += f"\n💬 User Prompt:\n"
            msg += f"{'-'*40}\n"
            prompt_text = data['user_prompt']
            if not debug_config.LOG_FULL_PROMPTS and len(prompt_text) > 500:
                msg += f"{prompt_text[:500]}...\n"
            else:
                msg += f"{prompt_text}\n"

        # 任务指导
        if 'task_guidance' in data:
            msg += f"\n📌 任务指导:\n"
            msg += f"{data['task_guidance']}\n"

        self.logger.debug(msg)

    def _log_knowledge_recall(self, entry: Dict):
        """记录知识召回过程"""
        data = entry['data']

        msg = f"\n🔍 知识召回 | Agent: {entry['agent_id']}\n"

        if 'query' in data:
            msg += f"   查询: {data['query']}\n"

        if 'recalled_items' in data:
            msg += f"   召回数量: {len(data['recalled_items'])}\n"
            for idx, item in enumerate(data['recalled_items'][:3], 1):
                msg += f"   {idx}. {item.get('title', item.get('content', 'N/A')[:50])}...\n"

        if 'relevance_scores' in data:
            msg += f"   相关性分数: {data['relevance_scores']}\n"

        self.logger.info(msg)

    def _log_api_call(self, entry: Dict):
        """记录API调用"""
        data = entry['data']

        msg = f"🌐 API调用 | Model: {data.get('model', 'unknown')}"

        if 'tokens' in data:
            msg += f" | Tokens: {data['tokens']}"

        if entry.get('execution_time_ms'):
            msg += f" | 耗时: {entry['execution_time_ms']}ms"

        self.logger.info(msg)

    def _log_result(self, entry: Dict):
        """记录执行结果"""
        data = entry['data']

        msg = f"✅ 执行完成 | Action: {entry['action']}"

        if 'success' in data:
            msg += f" | 成功: {data['success']}"

        if 'output_length' in data:
            msg += f" | 输出长度: {data['output_length']}"

        if entry.get('execution_time_ms'):
            msg += f" | 总耗时: {entry['execution_time_ms']}ms"

        self.logger.info(msg)


# 全局实例
agent_logger = AgentExecutionLogger()


def log_agent_stage(stage: str, include_result: bool = False):
    """
    装饰器: 记录Agent执行阶段

    @log_agent_stage("prompt_construction")
    async def build_prompt(...):
        pass
    """
    def decorator(func):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()

            # 提取agent_id和action
            agent_id = kwargs.get('agent_id', 0)
            action = kwargs.get('action', 'unknown')

            try:
                result = await func(*args, **kwargs)

                # 记录执行
                log_data = {
                    "function": func.__name__,
                    "args_count": len(args),
                    "kwargs_keys": list(kwargs.keys())
                }

                if include_result and result:
                    if isinstance(result, str):
                        log_data["result_preview"] = result[:200]
                    elif isinstance(result, dict):
                        log_data["result_keys"] = list(result.keys())

                agent_logger.log_agent_execution(
                    agent_id=agent_id,
                    action=action,
                    stage=stage,
                    data=log_data,
                    execution_time=time.time() - start_time
                )

                return result

            except Exception as e:
                agent_logger.log_agent_execution(
                    agent_id=agent_id,
                    action=action,
                    stage=f"{stage}_error",
                    data={"error": str(e)},
                    execution_time=time.time() - start_time
                )
                raise

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            agent_id = kwargs.get('agent_id', 0)
            action = kwargs.get('action', 'unknown')

            try:
                result = func(*args, **kwargs)

                log_data = {
                    "function": func.__name__,
                    "args_count": len(args),
                    "kwargs_keys": list(kwargs.keys())
                }

                if include_result and result:
                    if isinstance(result, str):
                        log_data["result_preview"] = result[:200]
                    elif isinstance(result, dict):
                        log_data["result_keys"] = list(result.keys())

                agent_logger.log_agent_execution(
                    agent_id=agent_id,
                    action=action,
                    stage=stage,
                    data=log_data,
                    execution_time=time.time() - start_time
                )

                return result

            except Exception as e:
                agent_logger.log_agent_execution(
                    agent_id=agent_id,
                    action=action,
                    stage=f"{stage}_error",
                    data={"error": str(e)},
                    execution_time=time.time() - start_time
                )
                raise

        return async_wrapper if hasattr(func, '__aiter__') or hasattr(func, '__await__') else sync_wrapper

    return decorator
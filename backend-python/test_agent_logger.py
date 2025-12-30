#!/usr/bin/env python3
"""
测试Agent执行日志系统
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 设置环境变量以启用调试
os.environ['AGENT_DEBUG_MODE'] = 'true'
os.environ['LOG_FULL_PROMPTS'] = 'true'
os.environ['LOG_TO_CONSOLE'] = 'true'

from app.utils.agent_logger import agent_logger
from app.debug_config import debug_config


def test_direct_logging():
    """测试直接日志记录"""
    print("\n=== 测试直接日志记录 ===")

    # 模拟Agent配置
    agent_config = {
        "name": "测试助手",
        "role": "专业的内容优化助手",
        "tone": "professional",
        "target_audience": "技术人员"
    }

    # 1. 记录Agent配置
    agent_logger.log_agent_execution(
        agent_id=1,
        action="improve",
        stage="agent_config",
        data={"agent_config": agent_config}
    )

    # 2. 记录Prompt构建
    agent_logger.log_agent_execution(
        agent_id=1,
        action="improve",
        stage="prompt_construction",
        data={
            "agent_config": agent_config,
            "system_prompt": "你是一个专业的内容优化助手。你的任务是改进用户提供的文本，使其更加清晰、专业和易于理解。",
            "user_prompt": "请改进以下文本：\n\n这个系统很好用，但是有一些小问题需要解决。",
            "task_guidance": "改进文本质量，保持原意",
            "text_length": 100
        },
        execution_time=0.05
    )

    # 3. 记录知识召回
    agent_logger.log_agent_execution(
        agent_id=1,
        action="improve",
        stage="knowledge_recall",
        data={
            "query": "文本改进技巧",
            "recalled_items": [
                {"title": "专业写作指南", "relevance": 0.92},
                {"title": "技术文档规范", "relevance": 0.85},
                {"title": "内容优化策略", "relevance": 0.78}
            ],
            "relevance_scores": [0.92, 0.85, 0.78]
        }
    )

    # 4. 记录API调用
    agent_logger.log_agent_execution(
        agent_id=1,
        action="improve",
        stage="api_call",
        data={
            "model": "gpt-4",
            "provider": "openai",
            "tokens": 1500,
            "temperature": 0.7
        }
    )

    # 5. 记录结果
    agent_logger.log_agent_execution(
        agent_id=1,
        action="improve",
        stage="result",
        data={
            "success": True,
            "output_length": 250,
            "improvements": ["增加了具体细节", "改进了语言流畅性", "优化了结构"]
        },
        execution_time=2.5
    )


def test_debug_control():
    """测试调试控制"""
    print("\n=== 测试调试控制 ===")

    # 测试全局调试开关
    print(f"当前调试模式: {debug_config.AGENT_DEBUG_MODE}")

    # 测试特定Agent的调试
    print(f"Agent 1 调试状态: {debug_config.is_agent_debug_enabled(1)}")
    print(f"Agent 2 调试状态: {debug_config.is_agent_debug_enabled(2)}")

    # 禁用Agent 1的调试
    debug_config.DEBUG_AGENT_IDS = [2]  # 只调试Agent 2
    print("\n设置只调试Agent 2...")
    print(f"Agent 1 调试状态: {debug_config.is_agent_debug_enabled(1)}")
    print(f"Agent 2 调试状态: {debug_config.is_agent_debug_enabled(2)}")

    # 重新启用所有调试
    debug_config.DEBUG_AGENT_IDS = None
    print("\n启用所有Agent调试...")
    print(f"Agent 1 调试状态: {debug_config.is_agent_debug_enabled(1)}")
    print(f"Agent 2 调试状态: {debug_config.is_agent_debug_enabled(2)}")


async def test_with_actual_service():
    """测试与实际服务集成（需要数据库和配置）"""
    print("\n=== 测试与实际服务集成 ===")

    try:
        from app.database import SessionLocal
        from app.models import User, Agent
        from app.services.ai_service_enhanced import EnhancedAIService

        # 创建数据库会话
        db = SessionLocal()

        # 获取测试用户和Agent
        user = db.query(User).first()
        agent = db.query(Agent).filter(Agent.userId == user.id).first()

        if not user or not agent:
            print("❌ 未找到测试用户或Agent")
            return

        print(f"使用用户: {user.name} (ID: {user.id})")
        print(f"使用Agent: {agent.name} (ID: {agent.id})")

        # 测试文本
        test_text = "这是一段测试文本，需要改进。"

        # 执行文本操作（会触发日志记录）
        print("\n执行文本改进操作...")
        result = await EnhancedAIService.perform_text_action(
            user=user,
            agent=agent,
            text=test_text,
            action_type="improve",
            context="请让文本更专业",
            provider="openai",
            model="gpt-3.5-turbo"
        )

        print(f"\n✅ 操作成功!")
        print(f"处理结果长度: {len(result.get('processedText', ''))}")

        db.close()

    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()


def check_log_files():
    """检查日志文件"""
    print("\n=== 检查日志文件 ===")

    from pathlib import Path
    log_dir = Path("logs/agent")

    if log_dir.exists():
        log_files = list(log_dir.glob("*.log"))
        if log_files:
            print(f"找到 {len(log_files)} 个日志文件:")
            for file in log_files:
                size = file.stat().st_size
                print(f"  - {file.name} ({size:,} bytes)")

            # 显示最新日志文件的最后几行
            latest_file = max(log_files, key=lambda f: f.stat().st_mtime)
            print(f"\n最新日志文件内容 ({latest_file.name}):")
            print("-" * 60)
            with open(latest_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                for line in lines[-20:]:  # 显示最后20行
                    print(line.rstrip())
        else:
            print("未找到日志文件")
    else:
        print("日志目录不存在")


if __name__ == "__main__":
    print("=" * 60)
    print("Agent执行日志系统测试")
    print("=" * 60)

    # 1. 测试直接日志记录
    test_direct_logging()

    # 2. 测试调试控制
    test_debug_control()

    # 3. 检查日志文件
    check_log_files()

    # 4. 测试与实际服务集成（需要异步运行）
    # asyncio.run(test_with_actual_service())

    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)
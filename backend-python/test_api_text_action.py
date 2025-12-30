#!/usr/bin/env python3
"""
测试text-action API的默认指令功能
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 启用agent调试日志
os.environ['AGENT_DEBUG_MODE'] = 'true'
os.environ['LOG_FULL_PROMPTS'] = 'true'

from app.database import SessionLocal
from app.models import User, Agent
from app.services.ai_service_enhanced import EnhancedAIService


async def test_text_action_with_default_instruction():
    """测试默认指令功能"""
    print("\n=== 测试默认指令功能 ===\n")

    # 创建数据库会话
    db = SessionLocal()

    try:
        # 获取测试用户
        user = db.query(User).first()
        if not user:
            print("❌ 未找到测试用户，请先登录系统创建用户")
            return

        print(f"使用用户: {user.username} (ID: {user.id})")

        # 获取用户的第一个Agent
        agent = db.query(Agent).filter(Agent.userId == user.id).first()
        if not agent:
            print("❌ 未找到Agent，请先创建一个Agent")
            return

        print(f"使用Agent: {agent.name} (ID: {agent.id})")

        # 测试文本
        test_text = "所有的交易系统不外乎去回答这个问题：如何实现扩大盈利，如何缩小避免损失。"

        # 测试场景1: 不提供context（应使用默认指令）
        print("\n场景1: 不提供用户指令（使用默认）")
        print("-" * 40)

        result1 = await EnhancedAIService.perform_text_action(
            user=user,
            agent=agent,
            text=test_text,
            action_type="improve",
            context=None,  # 不提供context
            provider="openai",
            model="gpt-3.5-turbo"
        )

        print(f"✅ 执行成功!")
        print(f"原文: {test_text[:50]}...")
        print(f"结果预览: {result1['processedText'][:100]}...")

        # 测试场景2: 提供context（应组合默认指令和用户指令）
        print("\n场景2: 提供用户指令（组合默认和用户）")
        print("-" * 40)

        result2 = await EnhancedAIService.perform_text_action(
            user=user,
            agent=agent,
            text=test_text,
            action_type="improve",
            context="更简洁",  # 提供用户指令
            provider="openai",
            model="gpt-3.5-turbo"
        )

        print(f"✅ 执行成功!")
        print(f"用户指令: 更简洁")
        print(f"结果预览: {result2['processedText'][:100]}...")

        # 测试场景3: 测试不同的action
        print("\n场景3: 测试expand动作")
        print("-" * 40)

        result3 = await EnhancedAIService.perform_text_action(
            user=user,
            agent=agent,
            text=test_text,
            action_type="expand",
            context=None,  # 不提供context，使用默认
            provider="openai",
            model="gpt-3.5-turbo"
        )

        print(f"✅ 执行成功!")
        print(f"动作: expand (默认指令: 扩展内容，增加细节)")
        print(f"结果长度对比: 原文 {len(test_text)} 字符 -> 结果 {len(result3['processedText'])} 字符")

    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()

    finally:
        db.close()


def check_log_output():
    """检查日志输出"""
    print("\n=== 检查日志输出 ===")

    from pathlib import Path
    log_dir = Path("logs/agent")

    if log_dir.exists():
        log_files = list(log_dir.glob("*.log"))
        if log_files:
            latest_file = max(log_files, key=lambda f: f.stat().st_mtime)
            print(f"\n查看最新日志: {latest_file.name}")
            print("-" * 60)

            # 读取最后50行，查找默认指令相关内容
            with open(latest_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                for line in lines[-50:]:
                    if any(keyword in line for keyword in ["默认指令", "default_instruction", "final_instruction", "改进文本"]):
                        print(line.rstrip())


if __name__ == "__main__":
    print("=" * 60)
    print("Text Action API 默认指令测试")
    print("=" * 60)

    # 运行异步测试
    asyncio.run(test_text_action_with_default_instruction())

    # 检查日志
    check_log_output()

    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)
#!/usr/bin/env python3
"""
直接测试AIService的perform_text_action方法
"""

import asyncio
import json
import sys
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal
from app.models import User, Agent
from app.services.ai_service import AIService

async def test_text_action_service():
    """直接测试AIService.perform_text_action"""

    db = SessionLocal()

    try:
        # 获取用户和Agent
        user = db.query(User).filter(User.id == "99946c0e-b6bd-457d-bfbd-d9d360ebf030").first()
        agent = db.query(Agent).filter(
            Agent.userId == user.id,
            Agent.id == "bd8ab76c-d886-46ab-8545-e325cc938b6c"
        ).first()

        if not user or not agent:
            print("❌ 用户或Agent不存在")
            return

        print("=" * 60)
        print("🎯 测试 AIService.perform_text_action")
        print("=" * 60)

        test_text = "This is a test text for improvement"

        print(f"\n📝 测试文本: {test_text}")
        print(f"🤖 Agent: {agent.name}")
        print(f"🔧 操作: improve")
        print(f"🏢 Provider: openai")
        print(f"🧠 Model: gpt-3.5-turbo")

        print("\n🚀 调用 AIService.perform_text_action...")

        try:
            result = await AIService.perform_text_action(
                user=user,
                agent=agent,
                text=test_text,
                action_type="improve",
                provider="openai",
                model="gpt-3.5-turbo"
            )

            print("\n✅ 成功!")
            print(f"操作类型: {result.get('actionType')}")
            print(f"原文: {result.get('originalText', '')[:50]}...")

            processed = result.get('processedText', '')
            if processed:
                print(f"处理后: {processed[:150]}...")
            else:
                print("处理后: (无内容)")

            if result.get('explanation'):
                print(f"说明: {result.get('explanation', '')[:100]}...")

            print("\n📊 完整响应结构:")
            print(json.dumps({k: type(v).__name__ for k, v in result.items()}, indent=2))

        except Exception as e:
            print(f"\n❌ 调用失败: {e}")
            import traceback
            traceback.print_exc()

    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("\n🚀 Muses AIService 直接测试\n")
    asyncio.run(test_text_action_service())
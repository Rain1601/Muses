#!/usr/bin/env python3
"""
直接测试text-action API
"""

import asyncio
import json
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, Agent
from app.dependencies import get_current_user_db
from unittest.mock import Mock

# 创建测试客户端
client = TestClient(app)

def test_text_action_api():
    """直接测试text-action API"""

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
        print("🎯 测试text-action API端点")
        print("=" * 60)

        # 模拟认证（覆盖依赖）
        def override_get_current_user():
            return user

        app.dependency_overrides[get_current_user_db] = override_get_current_user

        # 准备请求数据
        request_data = {
            "agentId": agent.id,
            "text": "This is a test text for improvement",
            "actionType": "improve",
            "provider": "openai",
            "model": "gpt-3.5-turbo"
        }

        print(f"\n📝 请求数据:")
        print(json.dumps(request_data, indent=2, ensure_ascii=False))

        print("\n🚀 发送请求到 /api/agents/text-action...")

        # 发送请求
        response = client.post(
            "/api/agents/text-action",
            json=request_data,
            headers={"Authorization": "Bearer test_token"}
        )

        print(f"\n📊 响应状态码: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print("\n✅ 成功!")
            print(f"操作类型: {result.get('actionType')}")
            print(f"原文: {result.get('originalText', '')[:50]}...")
            print(f"处理后: {result.get('processedText', '')[:100]}...")
            if result.get('explanation'):
                print(f"说明: {result.get('explanation', '')[:50]}...")
        else:
            print(f"\n❌ 失败!")
            print(f"错误内容: {response.text}")

            # 尝试解析错误
            try:
                error_detail = response.json()
                print(f"错误详情: {json.dumps(error_detail, indent=2, ensure_ascii=False)}")
            except:
                pass

        # 清除依赖覆盖
        app.dependency_overrides.clear()

    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("\n🚀 Muses Text Action API 直接测试\n")
    test_text_action_api()
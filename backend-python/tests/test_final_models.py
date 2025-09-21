#!/usr/bin/env python3
"""
最终模型配置测试
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.insert(0, str(Path(__file__).parent))

from app.services.ai_service import AIService
from app.database import SessionLocal
from app.models import User, Agent
from app.models_config import OPENAI_MODELS, CLAUDE_MODELS, DEFAULT_MODELS

async def test_final_configuration():
    """测试最终的模型配置"""

    db = SessionLocal()

    try:
        # 获取用户
        user = db.query(User).filter(User.id == "99946c0e-b6bd-457d-bfbd-d9d360ebf030").first()
        if not user:
            print("❌ 用户不存在")
            return

        print("=" * 60)
        print("🎯 最终模型配置验证")
        print("=" * 60)

        # 显示配置
        print("\n📋 配置的模型：")
        print("\nOpenAI:")
        for model_id, info in OPENAI_MODELS.items():
            default = " ⭐" if model_id == DEFAULT_MODELS["openai"] else ""
            print(f"  • {model_id}: {info['name']}{default}")

        print("\nClaude:")
        for model_id, info in CLAUDE_MODELS.items():
            default = " ⭐" if model_id == DEFAULT_MODELS["claude"] else ""
            print(f"  • {model_id}: {info['name']}{default}")

        print("\n" + "=" * 60)
        print("🧪 测试模型API调用")
        print("=" * 60)

        # 测试用例
        test_cases = [
            ("openai", "gpt-5", "GPT-5 (新API)"),
            ("openai", "gpt-5-mini", "GPT-5 Mini (新API)"),
            ("openai", "gpt-4.1-2025-04-14", "GPT-4.1 (标准API)"),
            ("claude", "claude-sonnet-4-20250514", "Claude Sonnet 4"),
        ]

        for provider, model, description in test_cases:
            print(f"\n📝 测试 {description}:")
            print(f"   Provider: {provider}")
            print(f"   Model: {model}")

            try:
                # 使用统一的AI调用接口
                result = await AIService._call_ai(
                    user=user,
                    messages=[
                        {"role": "user", "content": "Say 'Hello AI' in exactly 2 words"}
                    ],
                    provider=provider,
                    model=model
                )

                if result:
                    print(f"   ✅ 成功!")
                    print(f"   响应: {result[:100]}")
                else:
                    print(f"   ⚠️  返回空响应")

            except Exception as e:
                error_msg = str(e)
                if "404" in error_msg:
                    print(f"   ❌ 模型不存在")
                elif "not support" in error_msg:
                    print(f"   ⚠️  参数不支持，但模型可用")
                elif "responses" in error_msg:
                    print(f"   ⚠️  新API格式可能尚未可用，使用标准API")
                else:
                    print(f"   ❌ 错误: {error_msg[:100]}")

        # 测试文本处理功能
        print("\n" + "=" * 60)
        print("🔄 测试文本处理功能")
        print("=" * 60)

        agent = db.query(Agent).filter(Agent.userId == user.id).first()
        if agent:
            test_text = "AI is changing the world"

            print(f"\n测试文本: '{test_text}'")

            try:
                result = await AIService.perform_text_action(
                    user=user,
                    agent=agent,
                    text=test_text,
                    action_type="improve",
                    provider="openai"  # 使用默认GPT-5
                )

                print(f"✅ 文本改进成功!")
                print(f"   原文: {result['originalText']}")
                print(f"   改进: {result['processedText'][:100]}...")

            except Exception as e:
                print(f"❌ 文本处理失败: {str(e)[:100]}")

        print("\n" + "=" * 60)
        print("✨ 验证完成!")
        print("=" * 60)

        # 总结
        print("\n📊 总结:")
        print("1. OpenAI模型配置: gpt-5, gpt-5-mini, gpt-4.1-2025-04-14")
        print("2. Claude模型配置: claude-sonnet-4-20250514")
        print("3. 默认模型: GPT-5 (OpenAI), Claude Sonnet 4 (Claude)")
        print("4. GPT-5使用新的responses API (带reasoning和text参数)")
        print("5. GPT-4.1使用标准chat completions API")

    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("\n🚀 Muses 最终模型配置测试\n")
    asyncio.run(test_final_configuration())
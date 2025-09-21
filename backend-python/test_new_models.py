#!/usr/bin/env python3
"""
测试新模型配置的脚本
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal
from app.models import User, Agent
from app.services.ai_service import AIService
from app.models_config import get_available_models, DEFAULT_MODELS

async def test_models():
    """测试新的模型配置"""

    db = SessionLocal()

    try:
        # 获取用户
        user = db.query(User).filter(User.id == "99946c0e-b6bd-457d-bfbd-d9d360ebf030").first()
        if not user:
            print("❌ 用户不存在")
            return

        # 获取或创建测试Agent
        agent = db.query(Agent).filter(Agent.userId == user.id).first()
        if not agent:
            print("❌ 没有找到Agent")
            return

        print("=" * 60)
        print("🧪 测试新模型配置")
        print("=" * 60)

        # 显示可用的模型
        print("\n📋 配置的模型列表：\n")

        print("OpenAI 模型:")
        for model in get_available_models("openai"):
            default = " (默认)" if model["id"] == DEFAULT_MODELS["openai"] else ""
            print(f"  - {model['id']}: {model['name']}{default}")

        print("\nClaude 模型:")
        for model in get_available_models("claude"):
            default = " (默认)" if model["id"] == DEFAULT_MODELS["claude"] else ""
            print(f"  - {model['id']}: {model['name']}{default}")

        # 测试文本
        test_text = "AI technology is advancing rapidly."

        # 测试不同的提供商和模型
        test_cases = [
            ("openai", None, "使用OpenAI默认模型 (GPT-5)"),
            ("claude", None, "使用Claude默认模型 (Sonnet 4)"),
            ("openai", "gpt-3.5-turbo", "使用GPT-3.5 Turbo (快速经济)")
        ]

        print(f"\n📝 测试文本: '{test_text}'\n")
        print("=" * 60)

        for provider, model, description in test_cases:
            print(f"\n🔄 {description}")
            print(f"   Provider: {provider}")
            print(f"   Model: {model or 'default'}")

            try:
                # 调用文本改进功能
                result = await AIService.perform_text_action(
                    user=user,
                    agent=agent,
                    text=test_text,
                    action_type="improve",
                    provider=provider
                )

                print(f"   ✅ 成功!")
                print(f"   原文: {result['originalText']}")
                print(f"   改进: {result['processedText'][:100]}...")

            except Exception as e:
                error_msg = str(e)
                if "404" in error_msg:
                    print(f"   ⚠️  模型不可用 (可能需要升级API计划)")
                elif "No AI API keys configured" in error_msg:
                    print(f"   ❌ 未配置{provider.upper()} API密钥")
                elif "not yet implemented" in error_msg:
                    print(f"   ⏳ {provider}支持尚未实现")
                else:
                    print(f"   ❌ 错误: {error_msg[:100]}")

        print("\n" + "=" * 60)
        print("✨ 模型测试完成!")
        print("=" * 60)

        # 测试确定提供商逻辑
        print("\n🔍 测试提供商选择逻辑:")
        provider = AIService._determine_provider(user)
        print(f"   默认提供商: {provider}")

        if user.openaiKey and user.claudeKey:
            print("   ✅ 检测到多个API密钥，可以切换提供商")

    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("\n🚀 Muses 新模型配置测试\n")
    asyncio.run(test_models())
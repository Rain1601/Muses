#!/usr/bin/env python3
"""
测试API密钥的脚本 - 验证OpenAI和Claude API是否能正常工作
"""

import sys
import os
import asyncio
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal
from app.models import User
from app.utils.security import decrypt
import openai
import anthropic

def test_api_keys():
    """测试用户的API密钥"""

    # 连接数据库
    db = SessionLocal()

    try:
        # 获取用户（使用你的用户ID）
        user = db.query(User).filter(User.id == "99946c0e-b6bd-457d-bfbd-d9d360ebf030").first()

        if not user:
            print("❌ 用户不存在")
            return

        print("=" * 60)
        print("🔍 开始测试API密钥")
        print("=" * 60)

        # 测试OpenAI API
        if user.openaiKey:
            print("\n📘 测试 OpenAI API...")
            try:
                decrypted_key = decrypt(user.openaiKey)
                print(f"   密钥: {decrypted_key[:20]}...{decrypted_key[-10:]}")

                # 创建OpenAI客户端
                client = openai.OpenAI(api_key=decrypted_key)

                # 简单的测试调用
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant."},
                        {"role": "user", "content": "Say 'Hello, API test successful!' in exactly 5 words."}
                    ],
                    max_tokens=20,
                    temperature=0
                )

                result = response.choices[0].message.content
                print(f"   ✅ OpenAI API 测试成功!")
                print(f"   响应: {result}")

                # 列出可用模型
                print("\n   可用的模型:")
                models = client.models.list()
                gpt_models = [m.id for m in models.data if 'gpt' in m.id.lower()]
                for model in sorted(gpt_models)[:5]:  # 只显示前5个
                    print(f"      - {model}")

            except openai.AuthenticationError as e:
                print(f"   ❌ OpenAI 认证失败: {e}")
            except openai.RateLimitError as e:
                print(f"   ⚠️  OpenAI 速率限制: {e}")
            except Exception as e:
                print(f"   ❌ OpenAI API 错误: {e}")
        else:
            print("\n📘 OpenAI API Key 未配置")

        # 测试Claude API
        if user.claudeKey:
            print("\n🧠 测试 Claude API...")
            try:
                decrypted_key = decrypt(user.claudeKey)
                print(f"   密钥: {decrypted_key[:20]}...{decrypted_key[-10:]}")

                # 创建Anthropic客户端
                client = anthropic.Anthropic(api_key=decrypted_key)

                # 简单的测试调用
                response = client.messages.create(
                    model="claude-3-haiku-20240307",
                    max_tokens=50,
                    messages=[
                        {"role": "user", "content": "Say 'Hello, Claude API test successful!' in exactly 6 words."}
                    ]
                )

                result = response.content[0].text if response.content else "No response"
                print(f"   ✅ Claude API 测试成功!")
                print(f"   响应: {result}")

                # 测试其他模型
                print("\n   测试其他Claude模型:")
                models_to_test = [
                    ("claude-3-sonnet-20240229", "Sonnet"),
                    ("claude-3-opus-20240229", "Opus")
                ]

                for model_id, model_name in models_to_test:
                    try:
                        test_response = client.messages.create(
                            model=model_id,
                            max_tokens=10,
                            messages=[{"role": "user", "content": "Hi"}]
                        )
                        print(f"      ✅ {model_name} ({model_id}) - 可用")
                    except Exception as e:
                        print(f"      ❌ {model_name} ({model_id}) - 不可用: {str(e)[:50]}")

            except anthropic.AuthenticationError as e:
                print(f"   ❌ Claude 认证失败: {e}")
            except anthropic.RateLimitError as e:
                print(f"   ⚠️  Claude 速率限制: {e}")
            except Exception as e:
                print(f"   ❌ Claude API 错误: {e}")
        else:
            print("\n🧠 Claude API Key 未配置")

        # 测试Gemini API（如果配置了）
        if user.geminiKey:
            print("\n✨ 测试 Gemini API...")
            try:
                import google.generativeai as genai

                decrypted_key = decrypt(user.geminiKey)
                print(f"   密钥: {decrypted_key[:20]}...{decrypted_key[-10:]}")

                # 配置Gemini
                genai.configure(api_key=decrypted_key)

                # 测试调用
                model = genai.GenerativeModel('gemini-pro')
                response = model.generate_content(
                    "Say 'Hello, Gemini API test successful!' in exactly 6 words.",
                    generation_config=genai.types.GenerationConfig(
                        max_output_tokens=50,
                        temperature=0
                    )
                )

                result = response.text
                print(f"   ✅ Gemini API 测试成功!")
                print(f"   响应: {result}")

            except Exception as e:
                print(f"   ❌ Gemini API 错误: {e}")
        else:
            print("\n✨ Gemini API Key 未配置")

        print("\n" + "=" * 60)
        print("🎉 API密钥测试完成!")
        print("=" * 60)

    except Exception as e:
        print(f"❌ 测试过程中出错: {e}")
    finally:
        db.close()

def test_text_action():
    """测试文本操作API"""
    print("\n" + "=" * 60)
    print("📝 测试文本操作功能")
    print("=" * 60)

    from app.services.ai_service import AIService
    from app.database import SessionLocal
    from app.models import User, Agent

    db = SessionLocal()

    try:
        # 获取用户和Agent
        user = db.query(User).filter(User.id == "99946c0e-b6bd-457d-bfbd-d9d360ebf030").first()
        if not user:
            print("❌ 用户不存在")
            return

        # 获取第一个Agent
        agent = db.query(Agent).filter(Agent.userId == user.id).first()
        if not agent:
            print("❌ 没有找到Agent")
            return

        print(f"\n使用Agent: {agent.name}")

        # 测试文本
        test_text = "This is a test text for API validation."

        # 测试不同的操作
        actions = ["improve", "explain", "summarize", "translate"]

        async def run_tests():
            for action in actions:
                print(f"\n🔄 测试 {action} 操作...")
                try:
                    result = await AIService.perform_text_action(
                        user=user,
                        agent=agent,
                        text=test_text,
                        action_type=action,
                        language="中文" if action == "translate" else None
                    )

                    print(f"   ✅ {action} 成功!")
                    print(f"   原文: {result['originalText'][:50]}...")
                    print(f"   结果: {result['processedText'][:100]}...")

                except Exception as e:
                    print(f"   ❌ {action} 失败: {e}")

        # 运行异步测试
        asyncio.run(run_tests())

    except Exception as e:
        print(f"❌ 测试失败: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    print("\n🚀 Muses API密钥测试工具\n")

    # 运行测试
    test_api_keys()

    # 询问是否测试文本操作
    print("\n是否测试文本操作功能? (需要消耗API额度)")
    response = input("输入 'y' 继续，其他键跳过: ")

    if response.lower() == 'y':
        test_text_action()
    else:
        print("跳过文本操作测试")

    print("\n✨ 所有测试完成!")
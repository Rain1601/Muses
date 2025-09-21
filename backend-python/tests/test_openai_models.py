#!/usr/bin/env python3
"""
测试OpenAI特定模型的脚本
"""

import asyncio
import sys
from pathlib import Path
import openai

# 添加项目根目录到Python路径
sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal
from app.models import User
from app.utils.security import decrypt
from app.models_config import OPENAI_MODELS

async def test_openai_models():
    """测试OpenAI模型"""

    db = SessionLocal()

    try:
        # 获取用户
        user = db.query(User).filter(User.id == "99946c0e-b6bd-457d-bfbd-d9d360ebf030").first()
        if not user or not user.openaiKey:
            print("❌ 用户不存在或未配置OpenAI密钥")
            return

        # 解密API密钥
        api_key = decrypt(user.openaiKey)
        client = openai.OpenAI(api_key=api_key)

        print("=" * 60)
        print("🧪 测试OpenAI模型配置")
        print("=" * 60)

        # 显示配置的模型
        print("\n📋 配置的OpenAI模型：")
        for model_id, info in OPENAI_MODELS.items():
            print(f"  • {model_id}")
            print(f"    名称: {info['name']}")
            print(f"    描述: {info['description']}")
            print()

        # 测试每个模型
        test_models = [
            "gpt-5-2025-08-07",
            "gpt-5-mini-2025-08-07",
            "gpt-4.1-2025-04-14"
        ]

        print("=" * 60)
        print("🔄 开始测试模型接口...")
        print("=" * 60)

        for model_id in test_models:
            print(f"\n📝 测试模型: {model_id}")
            print(f"   配置: {OPENAI_MODELS.get(model_id, {}).get('name', 'Unknown')}")

            try:
                # 尝试简单的API调用
                response = client.chat.completions.create(
                    model=model_id,
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant."},
                        {"role": "user", "content": "Say 'Model test successful' in 3 words."}
                    ],
                    max_tokens=20,
                    temperature=0
                )

                result = response.choices[0].message.content
                print(f"   ✅ 成功!")
                print(f"   响应: {result}")

                # 获取使用的token信息
                if hasattr(response, 'usage'):
                    print(f"   Tokens: {response.usage.total_tokens}")

            except openai.NotFoundError as e:
                print(f"   ❌ 模型不存在: {str(e)[:100]}")
            except openai.BadRequestError as e:
                error_msg = str(e)
                if "max_tokens" in error_msg:
                    print(f"   ⚠️  参数问题，尝试不带max_tokens...")
                    # 重试不带max_tokens
                    try:
                        response = client.chat.completions.create(
                            model=model_id,
                            messages=[
                                {"role": "system", "content": "You are a helpful assistant."},
                                {"role": "user", "content": "Say 'Model test successful' in 3 words."}
                            ],
                            temperature=0
                        )
                        result = response.choices[0].message.content
                        print(f"   ✅ 成功 (无max_tokens)!")
                        print(f"   响应: {result}")
                    except Exception as e2:
                        print(f"   ❌ 仍然失败: {str(e2)[:100]}")
                else:
                    print(f"   ❌ 请求错误: {error_msg[:100]}")
            except openai.RateLimitError as e:
                print(f"   ⚠️  速率限制: {str(e)[:100]}")
            except openai.AuthenticationError as e:
                print(f"   ❌ 认证失败: {str(e)[:100]}")
            except Exception as e:
                print(f"   ❌ 未知错误: {type(e).__name__}: {str(e)[:100]}")

        print("\n" + "=" * 60)

        # 列出账户实际可用的模型
        print("\n🔍 查询账户实际可用的模型...")
        try:
            models = client.models.list()
            gpt_models = [m.id for m in models.data if 'gpt' in m.id.lower()]

            print(f"📋 账户可用的GPT模型 (共{len(gpt_models)}个):")
            for model in sorted(gpt_models)[:10]:  # 只显示前10个
                print(f"   • {model}")

            # 检查我们配置的模型是否在可用列表中
            print("\n🔍 验证配置的模型是否可用:")
            for model_id in test_models:
                if model_id in gpt_models:
                    print(f"   ✅ {model_id} - 可用")
                else:
                    print(f"   ❌ {model_id} - 不在可用列表中")

        except Exception as e:
            print(f"❌ 无法获取模型列表: {e}")

        print("\n" + "=" * 60)
        print("✨ OpenAI模型测试完成!")
        print("=" * 60)

    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("\n🚀 OpenAI模型验证工具\n")
    asyncio.run(test_openai_models())
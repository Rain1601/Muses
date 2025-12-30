#!/usr/bin/env python3
"""
测试默认指令功能
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.agent.prompts.action_config import get_default_instruction, ACTION_CONFIG


def test_default_instructions():
    """测试所有action的默认指令配置"""
    print("\n=== 默认指令配置测试 ===\n")

    for action_id, config in ACTION_CONFIG.items():
        default_inst = get_default_instruction(action_id)
        visibility = config.get("visibility")
        label = config.get("label")

        if default_inst:
            print(f"✅ {action_id:20} | {label:10} | 默认指令: {default_inst}")
        else:
            print(f"❌ {action_id:20} | {label:10} | 无默认指令")

    print("\n" + "="*60)


def simulate_instruction_merge():
    """模拟指令合并逻辑"""
    print("\n=== 模拟指令合并 ===\n")

    test_cases = [
        # (action, user_input, expected)
        ("improve", None, "改进文本"),
        ("improve", "", "改进文本"),
        ("improve", "更简洁", "改进文本，更简洁"),
        ("expand", None, "扩展内容，增加细节"),
        ("expand", "添加示例", "扩展内容，增加细节，添加示例"),
        ("polish", None, "润色文字，提升表达"),
        ("polish", "更正式", "润色文字，提升表达，更正式"),
        ("translate", None, "准确翻译"),
        ("translate", "保持原文风格", "准确翻译，保持原文风格"),
    ]

    for action_id, user_input, expected in test_cases:
        # 模拟AI服务中的逻辑
        default_inst = get_default_instruction(action_id)

        if not user_input:
            final_instruction = default_inst
        else:
            if default_inst:
                final_instruction = f"{default_inst}，{user_input}"
            else:
                final_instruction = user_input

        status = "✅" if final_instruction == expected else "❌"
        print(f"{status} Action: {action_id:10}")
        print(f"   用户输入: {user_input if user_input else '[空]'}")
        print(f"   最终指令: {final_instruction}")
        print(f"   期望结果: {expected}")
        if final_instruction != expected:
            print(f"   ⚠️ 不匹配!")
        print()


def test_prompt_integration():
    """测试与Prompt系统的集成"""
    print("\n=== Prompt系统集成测试 ===\n")

    from app.agent.prompts import PromptBuilder, AgentContext

    # 创建测试Agent上下文
    agent_context = AgentContext(
        name="测试助手",
        language="中文",
        tone="professional",
        target_audience="技术人员",
        custom_prompt="",
        description="专业的内容改进助手"
    )

    # 测试不同的指令组合
    test_text = "这是一段测试文本。"

    test_scenarios = [
        ("improve", None, "使用默认指令"),
        ("improve", "改进文本", "使用默认指令（显式）"),
        ("improve", "改进文本，更简洁", "用户扩展默认指令"),
        ("expand", None, "使用默认指令"),
        ("expand", "扩展内容，增加细节，添加示例", "用户扩展默认指令"),
    ]

    for action, instruction, scenario_desc in test_scenarios:
        print(f"\n场景: {scenario_desc}")
        print(f"Action: {action}, 指令: {instruction if instruction else '[空]'}")

        # 处理指令（模拟AI服务逻辑）
        final_instruction = instruction
        if not final_instruction:
            final_instruction = get_default_instruction(action)
        elif get_default_instruction(action) and not final_instruction.startswith(get_default_instruction(action)):
            # 如果用户输入不包含默认指令，添加它
            final_instruction = f"{get_default_instruction(action)}，{final_instruction}"

        try:
            # 构建prompt
            system_prompt, user_prompt = PromptBuilder.build_for_action(
                action=action,
                text=test_text,
                agent_context=agent_context,
                instruction=final_instruction
            )

            print(f"✅ Prompt构建成功")
            print(f"   最终指令: {final_instruction}")
            # 只显示user_prompt的前100个字符
            print(f"   User Prompt预览: {user_prompt[:100]}...")

        except Exception as e:
            print(f"❌ 错误: {e}")


if __name__ == "__main__":
    print("=" * 60)
    print("默认指令系统测试")
    print("=" * 60)

    # 1. 测试默认指令配置
    test_default_instructions()

    # 2. 模拟指令合并
    simulate_instruction_merge()

    # 3. 测试与Prompt系统集成
    test_prompt_integration()

    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)
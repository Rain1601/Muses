#!/usr/bin/env python3
"""
测试指令合并逻辑（不调用API）
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.agent.prompts.action_config import get_default_instruction


def test_instruction_merge_logic():
    """测试指令合并逻辑"""
    print("\n=== 测试指令合并逻辑 ===\n")

    # 模拟ai_service_enhanced.py中的逻辑
    def merge_instructions(action_type: str, user_instruction: str = None) -> str:
        """模拟服务中的指令合并逻辑"""

        # 获取实际的action
        from app.agent.prompts.action_config import get_action_by_alias
        actual_action = get_action_by_alias(action_type)

        # 处理指令：如果用户没有输入，使用默认指令
        final_instruction = user_instruction
        if not final_instruction:
            # 获取action的默认指令
            default_inst = get_default_instruction(actual_action)
            final_instruction = default_inst
        else:
            # 如果用户输入了指令，将默认指令作为前缀
            default_inst = get_default_instruction(actual_action)
            if default_inst:
                # 组合默认指令和用户指令，例如："改进文本，更简洁"
                final_instruction = f"{default_inst}，{final_instruction}"

        return final_instruction

    # 测试场景
    test_cases = [
        # (action, user_input, expected_output, description)
        ("improve", None, "改进文本", "无用户输入，使用默认"),
        ("improve", "", "改进文本", "空字符串，使用默认"),
        ("improve", "更简洁", "改进文本，更简洁", "有用户输入，组合"),
        ("expand", None, "扩展内容，增加细节", "expand默认"),
        ("expand", "添加示例", "扩展内容，增加细节，添加示例", "expand组合"),
        ("polish", None, "润色文字，提升表达", "polish默认"),
        ("polish", "更正式", "润色文字，提升表达，更正式", "polish组合"),
        ("rewrite", None, "润色文字，提升表达", "rewrite别名映射到polish"),
        ("rewrite", "更简洁", "润色文字，提升表达，更简洁", "rewrite别名组合"),
        ("translate", None, "准确翻译", "translate默认"),
        ("translate", "保持原文风格", "准确翻译，保持原文风格", "translate组合"),
        ("summarize", None, "总结要点", "summarize默认"),
        ("simplify", None, "简化表达，更易理解", "simplify默认"),
        ("continue", None, "自然续写", "continue默认"),
        ("fix_grammar", None, "修正语法错误", "fix_grammar默认"),
        ("make_professional", None, "转换为专业表达", "make_professional默认"),
        ("extract_key_points", None, "提取关键要点", "extract_key_points默认"),
        ("generate_outline", None, "生成结构化大纲", "generate_outline默认"),
    ]

    success_count = 0
    fail_count = 0

    for action, user_input, expected, description in test_cases:
        result = merge_instructions(action, user_input)
        is_correct = result == expected

        if is_correct:
            success_count += 1
            status = "✅"
        else:
            fail_count += 1
            status = "❌"

        print(f"{status} {description}")
        print(f"   Action: {action}")
        print(f"   用户输入: '{user_input if user_input else '[None]'}'")
        print(f"   期望结果: '{expected}'")
        print(f"   实际结果: '{result}'")
        if not is_correct:
            print(f"   ⚠️ 不匹配!")
        print()

    print(f"\n测试结果: {success_count} 成功, {fail_count} 失败")
    return fail_count == 0


def test_all_actions_have_defaults():
    """测试所有action都有默认指令"""
    print("\n=== 测试所有Action的默认指令 ===\n")

    from app.agent.prompts.action_config import ACTION_CONFIG

    all_have_defaults = True

    for action_id, config in ACTION_CONFIG.items():
        default_inst = get_default_instruction(action_id)
        if default_inst:
            print(f"✅ {action_id:20} | {default_inst}")
        else:
            print(f"❌ {action_id:20} | 无默认指令")
            all_have_defaults = False

    return all_have_defaults


if __name__ == "__main__":
    print("=" * 60)
    print("指令合并系统测试")
    print("=" * 60)

    # 1. 测试所有action都有默认指令
    test1_result = test_all_actions_have_defaults()

    # 2. 测试指令合并逻辑
    test2_result = test_instruction_merge_logic()

    print("\n" + "=" * 60)
    if test1_result and test2_result:
        print("✅ 所有测试通过！默认指令系统正常工作")
    else:
        print("❌ 部分测试失败，请检查配置")
    print("=" * 60)
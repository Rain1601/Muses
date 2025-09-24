#!/usr/bin/env python3
"""
测试Prompt系统
验证新的prompt模块是否正常工作
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.agent.prompts import PromptBuilder, AgentContext, PromptTemplate
from app.agent.prompts.action_prompts import ImprovePrompt, ExpandPrompt, SummarizePrompt


def test_prompt_template():
    """测试基础模板"""
    print("=" * 60)
    print("测试基础Prompt模板")
    print("=" * 60)

    template = PromptTemplate(
        role="你是一位专业的文本编辑",
        task="改进以下文本",
        constraints=["保持原意", "修正错误", "提升质量"],
        quality_requirements=["准确", "流畅", "专业"]
    )

    prompt = template.build()
    print(prompt)
    print()


def test_task_prompts():
    """测试任务特定的Prompt"""
    print("=" * 60)
    print("测试任务特定的Prompt")
    print("=" * 60)

    # 测试改进文本
    improve = ImprovePrompt()
    print("【改进文本Prompt】")
    print(improve.build())
    print()

    # 测试扩展文本
    expand = ExpandPrompt()
    print("【扩展文本Prompt】")
    print(expand.build())
    print()

    # 测试总结文本
    summarize = SummarizePrompt()
    print("【总结文本Prompt】")
    print(summarize.build())
    print()


def test_prompt_builder():
    """测试Prompt构建器"""
    print("=" * 60)
    print("测试Prompt构建器")
    print("=" * 60)

    # 创建Agent上下文
    agent_context = AgentContext(
        name="技术博客助手",
        language="zh-CN",
        tone="professional",
        target_audience="技术开发者",
        custom_prompt="注重代码示例和技术细节"
    )

    # 测试不同任务
    tasks = ["improve", "expand", "summarize", "explain"]
    test_text = "人工智能正在改变世界。机器学习让计算机能够从数据中学习。"

    for task in tasks:
        print(f"\n【任务: {task}】")
        system_prompt, user_prompt = PromptBuilder.build_for_action(
            action=task,
            text=test_text,
            agent_context=agent_context,
            instruction="请保持技术深度"
        )

        print("System Prompt:")
        print("-" * 40)
        print(system_prompt[:500] + "..." if len(system_prompt) > 500 else system_prompt)
        print("\nUser Prompt:")
        print("-" * 40)
        print(user_prompt[:300] + "..." if len(user_prompt) > 300 else user_prompt)
        print()


def test_available_actions():
    """测试可用动作列表"""
    print("=" * 60)
    print("所有可用的文本操作")
    print("=" * 60)

    actions = PromptBuilder.get_available_tasks()
    for action in actions:
        description = PromptBuilder.get_task_description(action)
        print(f"  • {action}: {description}")

    print(f"\n共 {len(actions)} 个可用操作")


def main():
    print("\n🚀 Prompt系统测试\n")

    test_prompt_template()
    test_task_prompts()
    test_prompt_builder()
    test_available_actions()

    print("\n✅ 测试完成！Prompt系统运行正常。\n")


if __name__ == "__main__":
    main()
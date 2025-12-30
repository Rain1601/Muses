#!/usr/bin/env python3
"""
测试Action配置系统（不需要认证）
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.agent.prompts.action_config import (
    get_visible_actions,
    get_action_by_alias,
    is_action_enabled,
    ACTION_CONFIG,
    ActionVisibility
)


def test_visibility_levels():
    """测试不同可见性级别"""
    print("\n=== 测试可见性级别 ===")

    # 测试核心功能（仅CORE）
    print("\n1. 核心功能 (CORE only):")
    actions = get_visible_actions(include_advanced=False, include_experimental=False)
    print(f"   数量: {len(actions)}")
    for action in actions:
        print(f"   - {action['id']}: {action['label']} ({action['visibility']})")

    # 测试包含高级功能
    print("\n2. 核心+高级功能 (CORE + ADVANCED):")
    actions = get_visible_actions(include_advanced=True, include_experimental=False)
    print(f"   数量: {len(actions)}")
    for action in actions:
        print(f"   - {action['id']}: {action['label']} ({action['visibility']})")

    # 测试所有功能
    print("\n3. 所有功能 (ALL):")
    actions = get_visible_actions(include_advanced=True, include_experimental=True)
    print(f"   数量: {len(actions)}")
    for action in actions:
        print(f"   - {action['id']}: {action['label']} ({action['visibility']})")


def test_alias_mapping():
    """测试别名映射"""
    print("\n=== 测试别名映射 ===")

    test_cases = [
        ("rewrite", "polish"),      # 应该映射到polish
        ("polish", "polish"),       # 应该保持原样
        ("improve", "improve"),     # 应该保持原样
        ("invalid", "invalid")      # 无效的应该返回原值
    ]

    for input_action, expected in test_cases:
        actual = get_action_by_alias(input_action)
        status = "✅" if actual == expected else "❌"
        print(f"   {status} '{input_action}' -> '{actual}' (期望: '{expected}')")


def test_action_enablement():
    """测试Action启用状态"""
    print("\n=== 测试Action启用状态 ===")

    actions_to_test = ["improve", "polish", "fix_grammar", "generate_outline"]
    user_levels = ["basic", "advanced", "experimental"]

    for action in actions_to_test:
        config = ACTION_CONFIG.get(action, {})
        visibility = config.get("visibility", ActionVisibility.HIDDEN)
        print(f"\n{action} ({visibility.value}):")

        for level in user_levels:
            enabled = is_action_enabled(action, level)
            status = "✅" if enabled else "❌"
            print(f"   {status} {level}: {enabled}")


def test_action_metadata():
    """测试Action元数据"""
    print("\n=== 测试Action元数据 ===")

    # 按可见性分组
    by_visibility = {}
    for action_id, config in ACTION_CONFIG.items():
        vis = config.get("visibility", ActionVisibility.HIDDEN).value
        if vis not in by_visibility:
            by_visibility[vis] = []
        by_visibility[vis].append({
            "id": action_id,
            "label": config.get("label", "未命名"),
            "icon": config.get("icon", "❓"),
            "shortcut": config.get("shortcut", "无")
        })

    for vis_level in ["core", "advanced", "experimental", "hidden"]:
        if vis_level in by_visibility:
            actions = by_visibility[vis_level]
            print(f"\n{vis_level.upper()} ({len(actions)}个):")
            for action in actions:
                print(f"   {action['icon']} {action['id']}: {action['label']} (快捷: {action['shortcut']})")


def test_keyword_search():
    """测试关键词搜索"""
    print("\n=== 测试关键词搜索 ===")

    test_keywords = ["gj", "improve", "翻译", "translate", "rw"]

    for keyword in test_keywords:
        matches = []
        for action_id, config in ACTION_CONFIG.items():
            keywords = config.get("keywords", [])
            if keyword.lower() in [k.lower() for k in keywords]:
                matches.append(action_id)

        if matches:
            print(f"   '{keyword}' -> {', '.join(matches)}")
        else:
            print(f"   '{keyword}' -> 无匹配")


if __name__ == "__main__":
    print("=" * 60)
    print("Action配置系统测试")
    print("=" * 60)

    test_visibility_levels()
    test_alias_mapping()
    test_action_enablement()
    test_action_metadata()
    test_keyword_search()

    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)
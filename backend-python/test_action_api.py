#!/usr/bin/env python3
"""
测试Action API
"""

import requests
import json

# 测试配置
BASE_URL = "http://localhost:8080"

# 这里需要一个有效的token，从浏览器开发者工具获取
TOKEN = "YOUR_TOKEN_HERE"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}


def test_get_core_actions():
    """测试获取核心功能"""
    print("\n=== 测试获取核心功能 ===")

    response = requests.get(
        f"{BASE_URL}/api/agents/actions/available",
        headers=headers,
        params={
            "include_advanced": False,
            "include_experimental": False
        }
    )

    if response.status_code == 200:
        data = response.json()
        print(f"核心功能数量: {data['total']}")
        for action in data['actions']:
            print(f"  - {action['id']}: {action['label']} ({action['visibility']})")
    else:
        print(f"请求失败: {response.status_code}")
        print(response.text)


def test_get_all_actions():
    """测试获取所有功能"""
    print("\n=== 测试获取所有功能 ===")

    response = requests.get(
        f"{BASE_URL}/api/agents/actions/available",
        headers=headers,
        params={
            "include_advanced": True,
            "include_experimental": True
        }
    )

    if response.status_code == 200:
        data = response.json()
        print(f"所有功能数量: {data['total']}")

        # 按可见性分组显示
        by_visibility = {}
        for action in data['actions']:
            vis = action['visibility']
            if vis not in by_visibility:
                by_visibility[vis] = []
            by_visibility[vis].append(action)

        for vis, actions in by_visibility.items():
            print(f"\n{vis.upper()} ({len(actions)}个):")
            for action in actions:
                print(f"  - {action['id']}: {action['label']} - {action['description']}")
    else:
        print(f"请求失败: {response.status_code}")
        print(response.text)


def test_complete_list():
    """测试完整列表（管理界面用）"""
    print("\n=== 测试完整列表API ===")

    response = requests.get(
        f"{BASE_URL}/api/agents/actions/all",
        headers=headers
    )

    if response.status_code == 200:
        data = response.json()
        print(f"定义的所有操作: {data['total']}个")
        for action in data['actions']:
            print(f"  [{action['visibility']}] {action['icon']} {action['label']} - {action.get('shortcut', 'N/A')}")
    else:
        print(f"请求失败: {response.status_code}")
        print(response.text)


if __name__ == "__main__":
    print("Action配置API测试")
    print("=" * 60)

    # 注意：需要先设置有效的TOKEN
    print("\n⚠️  请先设置有效的TOKEN！")
    print("从浏览器开发者工具获取token，替换代码中的YOUR_TOKEN_HERE")

    # 如果已设置token，取消下面的注释
    # test_get_core_actions()
    # test_get_all_actions()
    # test_complete_list()
"""
Agent Actions API
提供可用action列表的接口
"""

from fastapi import APIRouter, Depends, Query
from typing import List, Dict, Any

from ..dependencies import get_current_user_db
from ..agent.prompts.action_config import get_visible_actions, ACTION_CONFIG, ActionVisibility
from ..schemas.agent import ActionInfo, ActionsListResponse


router = APIRouter()


@router.get("/actions/available", response_model=ActionsListResponse)
async def get_available_actions(
    include_advanced: bool = Query(False, description="是否包含高级功能"),
    include_experimental: bool = Query(False, description="是否包含实验功能"),
    current_user = Depends(get_current_user_db)
):
    """
    获取当前用户可用的文本操作列表

    Args:
        include_advanced: 是否包含高级功能
        include_experimental: 是否包含实验功能

    Returns:
        可用action的列表
    """
    # 根据用户权限或设置决定显示哪些功能
    # 这里可以根据用户的订阅级别、设置等来调整

    visible_actions = get_visible_actions(
        include_advanced=include_advanced,
        include_experimental=include_experimental
    )

    # 转换为响应格式
    action_list = []
    for action in visible_actions:
        action_info = ActionInfo(
            id=action["id"],
            label=action["label"],
            icon=action["icon"],
            description=action["description"],
            shortcut=action.get("shortcut"),
            keywords=action.get("keywords", []),
            visibility=action["visibility"].value
        )
        action_list.append(action_info)

    return ActionsListResponse(
        actions=action_list,
        total=len(action_list)
    )


@router.get("/actions/all", response_model=ActionsListResponse)
async def get_all_actions(
    current_user = Depends(get_current_user_db)
):
    """
    获取所有已定义的文本操作（用于管理界面）

    Returns:
        所有action的完整列表
    """
    action_list = []

    for action_id, config in ACTION_CONFIG.items():
        action_info = ActionInfo(
            id=action_id,
            label=config["label"],
            icon=config["icon"],
            description=config["description"],
            shortcut=config.get("shortcut"),
            keywords=config.get("keywords", []),
            visibility=config["visibility"].value
        )
        action_list.append(action_info)

    # 按可见性排序：core > advanced > experimental > hidden
    visibility_order = {
        ActionVisibility.CORE.value: 0,
        ActionVisibility.ADVANCED.value: 1,
        ActionVisibility.EXPERIMENTAL.value: 2,
        ActionVisibility.HIDDEN.value: 3
    }

    action_list.sort(key=lambda x: visibility_order.get(x.visibility, 999))

    return ActionsListResponse(
        actions=action_list,
        total=len(action_list)
    )
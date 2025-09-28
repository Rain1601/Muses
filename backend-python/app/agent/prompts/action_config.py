"""
Action配置管理
控制哪些action在前端显示
"""

from typing import Dict, List, Any
from enum import Enum


class ActionVisibility(Enum):
    """Action可见性级别"""
    CORE = "core"           # 核心功能，始终显示
    ADVANCED = "advanced"    # 高级功能，可选显示
    EXPERIMENTAL = "experimental"  # 实验功能，默认隐藏
    HIDDEN = "hidden"       # 隐藏功能，内部使用


# Action配置定义
ACTION_CONFIG: Dict[str, Dict[str, Any]] = {
    # 核心功能 - 前端工具栏显示
    "improve": {
        "visibility": ActionVisibility.CORE,
        "label": "改进文本",
        "icon": "✨",
        "description": "提升文本清晰度和说服力",
        "shortcut": "/improve",
        "keywords": ["improve", "gj", "改进", "优化"],
        "default_instruction": "改进文本"  # 默认指令
    },
    "explain": {
        "visibility": ActionVisibility.CORE,
        "label": "解释文本",
        "icon": "💡",
        "description": "详细解释概念和术语",
        "shortcut": "/explain",
        "keywords": ["explain", "js", "解释", "说明"],
        "default_instruction": "详细解释"  # 默认指令
    },
    "expand": {
        "visibility": ActionVisibility.CORE,
        "label": "扩展文本",
        "icon": "➕",
        "description": "添加更多细节和例子",
        "shortcut": "/expand",
        "keywords": ["expand", "kz", "扩展", "详细"],
        "default_instruction": "扩展内容，增加细节"  # 默认指令
    },
    "summarize": {
        "visibility": ActionVisibility.CORE,
        "label": "总结文本",
        "icon": "📋",
        "description": "提取关键要点",
        "shortcut": "/summarize",
        "keywords": ["summarize", "zj", "总结", "概括"],
        "default_instruction": "总结要点"  # 默认指令
    },
    "translate": {
        "visibility": ActionVisibility.CORE,
        "label": "翻译文本",
        "icon": "🌐",
        "description": "翻译为其他语言",
        "shortcut": "/translate",
        "keywords": ["translate", "fy", "翻译", "语言"],
        "default_instruction": "准确翻译"  # 默认指令
    },

    # 高级功能 - 可通过设置开启
    "polish": {
        "visibility": ActionVisibility.ADVANCED,
        "label": "润色文本",
        "icon": "✏️",
        "description": "提升文采和表达",
        "shortcut": "/polish",
        "keywords": ["polish", "rh", "润色", "美化"],
        "alias": ["rewrite"],  # 别名，前端的rewrite映射到这里
        "default_instruction": "润色文字，提升表达"  # 默认指令
    },
    "simplify": {
        "visibility": ActionVisibility.ADVANCED,
        "label": "简化文本",
        "icon": "📝",
        "description": "使文本更易理解",
        "shortcut": "/simplify",
        "keywords": ["simplify", "jh", "简化", "精简"],
        "default_instruction": "简化表达，更易理解"  # 默认指令
    },
    "continue": {
        "visibility": ActionVisibility.ADVANCED,
        "label": "续写文本",
        "icon": "📄",
        "description": "延续内容发展",
        "shortcut": "/continue",
        "keywords": ["continue", "xz", "续写", "继续"],
        "default_instruction": "自然续写"  # 默认指令
    },

    # 实验功能 - 需要特殊权限
    "fix_grammar": {
        "visibility": ActionVisibility.EXPERIMENTAL,
        "label": "修正语法",
        "icon": "🔧",
        "description": "纠正语法和拼写错误",
        "shortcut": "/fix",
        "keywords": ["fix", "xz", "修正", "纠正"],
        "default_instruction": "修正语法错误"  # 默认指令
    },
    "make_professional": {
        "visibility": ActionVisibility.EXPERIMENTAL,
        "label": "专业化",
        "icon": "👔",
        "description": "转换为专业风格",
        "shortcut": "/professional",
        "keywords": ["professional", "zy", "专业", "正式"],
        "default_instruction": "转换为专业表达"  # 默认指令
    },
    "extract_key_points": {
        "visibility": ActionVisibility.EXPERIMENTAL,
        "label": "提取要点",
        "icon": "🎯",
        "description": "识别关键信息",
        "shortcut": "/points",
        "keywords": ["points", "yd", "要点", "关键"],
        "default_instruction": "提取关键要点"  # 默认指令
    },
    "generate_outline": {
        "visibility": ActionVisibility.EXPERIMENTAL,
        "label": "生成大纲",
        "icon": "📑",
        "description": "创建结构化大纲",
        "shortcut": "/outline",
        "keywords": ["outline", "dg", "大纲", "结构"],
        "default_instruction": "生成结构化大纲"  # 默认指令
    }
}


def get_visible_actions(
    include_advanced: bool = False,
    include_experimental: bool = False
) -> List[Dict[str, Any]]:
    """
    获取可见的action列表

    Args:
        include_advanced: 是否包含高级功能
        include_experimental: 是否包含实验功能

    Returns:
        可见action的配置列表
    """
    visible_actions = []

    for action_id, config in ACTION_CONFIG.items():
        visibility = config["visibility"]

        # 根据可见性级别决定是否包含
        if visibility == ActionVisibility.CORE:
            visible_actions.append({
                "id": action_id,
                **config
            })
        elif visibility == ActionVisibility.ADVANCED and include_advanced:
            visible_actions.append({
                "id": action_id,
                **config
            })
        elif visibility == ActionVisibility.EXPERIMENTAL and include_experimental:
            visible_actions.append({
                "id": action_id,
                **config
            })
        # HIDDEN级别的action永不返回

    return visible_actions


def get_action_by_alias(alias: str) -> str:
    """
    通过别名获取action ID

    Args:
        alias: action别名（如rewrite）

    Returns:
        实际的action ID
    """
    for action_id, config in ACTION_CONFIG.items():
        if "alias" in config and alias in config["alias"]:
            return action_id
    return alias  # 如果没有找到别名，返回原值


def is_action_enabled(
    action_id: str,
    user_level: str = "basic"
) -> bool:
    """
    检查action是否对用户可用

    Args:
        action_id: action ID
        user_level: 用户级别 (basic, advanced, experimental)

    Returns:
        是否可用
    """
    if action_id not in ACTION_CONFIG:
        return False

    visibility = ACTION_CONFIG[action_id]["visibility"]

    if visibility == ActionVisibility.HIDDEN:
        return False
    elif visibility == ActionVisibility.CORE:
        return True
    elif visibility == ActionVisibility.ADVANCED:
        return user_level in ["advanced", "experimental"]
    elif visibility == ActionVisibility.EXPERIMENTAL:
        return user_level == "experimental"

    return False


def get_default_instruction(action_id: str) -> str:
    """
    获取action的默认指令

    Args:
        action_id: action ID

    Returns:
        默认指令文本，如果没有配置则返回空字符串
    """
    if action_id not in ACTION_CONFIG:
        return ""

    return ACTION_CONFIG[action_id].get("default_instruction", "")
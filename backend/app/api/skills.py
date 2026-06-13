from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from ..database import get_db
from ..models import Skill
from ..dependencies import get_current_user_db
from ..utils.exceptions import HTTPNotFoundError, HTTPValidationError

router = APIRouter()


# 预设写作 skill — 系统首次访问时为用户植入
PRESET_SKILLS = [
    {
        "name": "Skill Creator",
        "description": "通过对话帮你设计一个新的写作 skill — 描述你的需求，生成可直接保存的 prompt 模板。",
        "icon": "✨",
        "category": "meta",
        "prompt": """你是一名 Skill 设计师。请通过提问帮用户设计一个新的写作 skill：

1. 用一两句话澄清这个 skill 的目标场景（例如：写产品发布博文的开头段）
2. 询问 2-3 个关键变量（语气、长度、关键词）
3. 产出一个可复用的 prompt 模板，包含 {占位符}

请用简体中文与我对话。最终输出格式：

```
名称：...
描述：一句话
图标：emoji
分类：opening / structure / polish / style / general
Prompt：
<完整 prompt，含占位符>
```
""",
    },
    {
        "name": "故事化开头",
        "description": "用一个具体的小场景/小故事切入主题，避免开篇套话。",
        "icon": "🎬",
        "category": "opening",
        "prompt": """请为我下面的主题写一个故事化开头（约 100-150 字）：

主题：{主题}

要求：
- 用一个具体的场景、对话或动作切入，不要任何套话或泛泛而谈
- 场景必须服务于主题，且能自然过渡到正文
- 避免 \"在这个数字化时代\" / \"众所周知\" / \"随着xx的发展\" 等陈词
- 用第三人称白描笔法，节制使用形容词""",
    },
    {
        "name": "金字塔结论先行",
        "description": "把核心结论放最前，再依次给支撑论据，符合咨询风格写作。",
        "icon": "📐",
        "category": "structure",
        "prompt": """请将下面这段文字改写为"结论先行 + 三点支撑"的金字塔结构：

原文：{原文}

输出格式：
1. 一句核心结论（不超过 30 字）
2. 三个论据段落，每段以一个小标题开头
3. 整体保持原文事实，不新增未提及的数据""",
    },
    {
        "name": "口语化润色",
        "description": "把书面化或翻译腔的文字改成自然、像在对人说话的中文。",
        "icon": "💬",
        "category": "polish",
        "prompt": """请把下面这段文字改写得更口语、更像中文母语者随手写出来的：

原文：{原文}

要求：
- 拆短长句，去掉翻译腔（\"是...的\" / \"被...所...\" / 形容词堆叠）
- 适当用\"你/我\"、反问句、短句节奏
- 保留所有事实和数据，不增不减
- 不要变成网络梗，保持得体""",
    },
    {
        "name": "技术博客 TL;DR",
        "description": "为长技术文章生成 3-5 行的 TL;DR 摘要，照顾扫读读者。",
        "icon": "⚡",
        "category": "structure",
        "prompt": """阅读下面的技术文章，生成一段 3-5 行的 TL;DR：

文章：{文章}

要求：
- 第 1 行：这篇文章在讲什么问题
- 第 2-3 行：核心结论 / 方法
- 第 4-5 行（可选）：适合谁读、读完能做什么
- 全程用陈述句，不要营销话术""",
    },
    {
        "name": "类比解释",
        "description": "为一个抽象概念找一个贴切的日常类比，帮助读者快速理解。",
        "icon": "🔗",
        "category": "style",
        "prompt": """请为下面这个概念找一个**贴切的日常类比**，帮助没有背景的读者理解：

概念：{概念}

输出：
1. 类比对象（一句话）
2. 三个对应关系：概念中的 A ↔ 类比中的 B
3. 类比的边界（哪些方面会失真，必须说明）

要求：
- 类比要日常、具体、有画面感
- 不要用\"就像xx一样\"这种空洞类比
- 主动指出类比失真处，避免误导""",
    },
    {
        "name": "正反观点对照",
        "description": "把一个观点扩展为正反两方对照，避免一边倒。",
        "icon": "⚖️",
        "category": "structure",
        "prompt": """请把下面这个观点扩展为正反两方的对照分析：

观点：{观点}

输出格式：
- 支持方：3 条最强论据（每条一句话 + 一个具体例子）
- 反对方：3 条最强论据（同上）
- 我的判断：一段，明确取哪一边或在什么条件下取哪一边

要求：反对方的论据必须真的有说服力，不能稻草人。""",
    },
    {
        "name": "写作风格分析",
        "description": "分析一段示例文本的写作风格特征，输出可复用的风格指纹。",
        "icon": "🔍",
        "category": "meta",
        "prompt": """请分析下面这段示例文本的写作风格特征：

示例：{示例文本}

输出：
1. 句式：长短句比例、典型句型
2. 词汇：偏文/偏白、专有词密度、修辞习惯
3. 节奏：段落长度、段间过渡方式
4. 视角与态度：人称、距离感、温度

最后给出 5-8 条可直接套用的"模仿要点"，方便复制风格。""",
    },
]


class SkillCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    icon: Optional[str] = "📝"
    category: Optional[str] = "general"
    prompt: str


class SkillUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    prompt: Optional[str] = None


def _seed_presets_if_needed(db: Session, user_id: str):
    """Seed preset skills for a user if they don't have any preset yet."""
    has_preset = db.query(Skill).filter(Skill.userId == user_id, Skill.isPreset == True).first()
    if has_preset:
        return
    for spec in PRESET_SKILLS:
        skill = Skill(
            userId=user_id,
            name=spec["name"],
            description=spec.get("description", ""),
            icon=spec.get("icon", "📝"),
            category=spec.get("category", "general"),
            prompt=spec["prompt"],
            isPreset=True,
        )
        db.add(skill)
    db.commit()


@router.get("")
async def list_skills(
    current_user=Depends(get_current_user_db),
    db: Session = Depends(get_db),
):
    """获取当前用户的所有 skill（首次访问自动植入预设）。"""
    _seed_presets_if_needed(db, current_user.id)
    skills = db.query(Skill).filter(Skill.userId == current_user.id).order_by(
        Skill.isPreset.desc(), Skill.createdAt.asc()
    ).all()
    return {
        "skills": [{
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "icon": s.icon,
            "category": s.category,
            "prompt": s.prompt,
            "isPreset": s.isPreset,
            "createdAt": s.createdAt.isoformat() if s.createdAt else None,
            "updatedAt": s.updatedAt.isoformat() if s.updatedAt else None,
        } for s in skills]
    }


@router.post("")
async def create_skill(
    payload: SkillCreate,
    current_user=Depends(get_current_user_db),
    db: Session = Depends(get_db),
):
    skill = Skill(
        userId=current_user.id,
        name=payload.name,
        description=payload.description or "",
        icon=payload.icon or "📝",
        category=payload.category or "general",
        prompt=payload.prompt,
        isPreset=False,
    )
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return {
        "id": skill.id,
        "name": skill.name,
        "description": skill.description,
        "icon": skill.icon,
        "category": skill.category,
        "prompt": skill.prompt,
        "isPreset": skill.isPreset,
    }


@router.put("/{skill_id}")
async def update_skill(
    skill_id: str,
    payload: SkillUpdate,
    current_user=Depends(get_current_user_db),
    db: Session = Depends(get_db),
):
    skill = db.query(Skill).filter(Skill.id == skill_id, Skill.userId == current_user.id).first()
    if not skill:
        raise HTTPNotFoundError("Skill not found")
    if skill.isPreset:
        raise HTTPValidationError("Preset skill 不能直接编辑，请复制一份后再修改")

    for field in ("name", "description", "icon", "category", "prompt"):
        v = getattr(payload, field)
        if v is not None:
            setattr(skill, field, v)
    db.commit()
    db.refresh(skill)
    return {"id": skill.id, "updated": True}


@router.delete("/{skill_id}")
async def delete_skill(
    skill_id: str,
    current_user=Depends(get_current_user_db),
    db: Session = Depends(get_db),
):
    skill = db.query(Skill).filter(Skill.id == skill_id, Skill.userId == current_user.id).first()
    if not skill:
        raise HTTPNotFoundError("Skill not found")
    if skill.isPreset:
        raise HTTPValidationError("Preset skill 不能删除，可以创建自定义 skill 覆盖它")
    db.delete(skill)
    db.commit()
    return {"success": True}


@router.post("/{skill_id}/clone")
async def clone_skill(
    skill_id: str,
    current_user=Depends(get_current_user_db),
    db: Session = Depends(get_db),
):
    """复制 preset skill 为可编辑的自定义 skill。"""
    src = db.query(Skill).filter(Skill.id == skill_id, Skill.userId == current_user.id).first()
    if not src:
        raise HTTPNotFoundError("Skill not found")
    clone = Skill(
        userId=current_user.id,
        name=f"{src.name} (副本)",
        description=src.description,
        icon=src.icon,
        category=src.category,
        prompt=src.prompt,
        isPreset=False,
    )
    db.add(clone)
    db.commit()
    db.refresh(clone)
    return {"id": clone.id, "name": clone.name}

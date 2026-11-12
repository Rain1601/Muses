"""Claude-Docs-style drafting: outline first, then fill one section at a time.

Phase 1 of docs/dev/claude-docs-refactor-plan.md.

  POST /api/docs/outline  topic → {title, sections:[{heading, intent}]}
                          The frontend plants one PendingBlock per section.
  POST /api/docs/fill     one section's heading + intent (+ the doc so far)
                          → {markdown} that replaces that PendingBlock.

Both are stateless: the doc lives in the editor / Article row, nothing is stored
here. Auth is optional — with no user the call goes to DeepSeek on the server
env key (guest mode in local dev); a logged-in user's own provider keys win.
"""
from __future__ import annotations

import json
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..services.auth_service import AuthService
from ..services.unified_ai import UnifiedAIClient

router = APIRouter()

MAX_SECTIONS = 8
DOC_CONTEXT_CHARS = 6000


class OutlineSection(BaseModel):
    heading: str
    intent: str


class OutlineRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=2000)
    title: Optional[str] = None
    existingText: Optional[str] = None
    skillPrompt: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None


class OutlineResponse(BaseModel):
    title: str
    sections: List[OutlineSection]


class FillRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=2000)
    title: Optional[str] = None
    heading: str
    intent: str
    outline: List[OutlineSection] = []
    docText: Optional[str] = None
    skillPrompt: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None


class FillResponse(BaseModel):
    markdown: str


OUTLINE_SYSTEM = """你是一位资深编辑，负责为一篇文章先搭骨架。
只输出一个 JSON 对象，不要任何其他文字：
{"title": "文章标题", "sections": [{"heading": "小节标题", "intent": "这一节要写什么，一句话，具体到要点"}]}
要求：
- 主题里指定了数量（如"补充两节""写 3 个部分"），sections 数组的长度必须正好等于这个数，不要拆成更细的小节；没指定就 3 到 6 个小节
- 按阅读顺序排列；不要"引言""总结"这类空节，除非主题需要
- heading 不超过 16 个字；intent 不超过 40 个字，写清这一节的论点或要回答的问题
- 使用与主题相同的语言"""

FILL_SYSTEM = """你是一位作者，正在逐节写一篇文章。这次只写指定的一节。
输出 Markdown：第一行是 "## 小节标题"，然后是正文。
要求：
- 只写这一节，不要重复其他小节的内容，不要写全文标题、引言或总结
- 第一句就给出这一节的要点；段落不超过 3 句；具体、有信息量，少用形容词
- 内容的形状决定格式：并列项用列表，多维对比用表格，其余用段落
- 不要用代码块包裹整个输出
- 使用与主题相同的语言"""


def _resolve_user(authorization: Optional[str], db: Session) -> Optional[User]:
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        return None
    try:
        return AuthService.verify_user_token(token, db)
    except Exception:
        return None


def _pick_provider(user: Optional[User], requested: Optional[str]) -> Optional[str]:
    if requested:
        return requested
    # UnifiedAIClient picks from the user's keys; a guest only has the env DeepSeek key.
    return None if user is not None else "deepseek"


def _skill_block(skill_prompt: Optional[str]) -> str:
    if not skill_prompt or not skill_prompt.strip():
        return ""
    return f"\n\n写作技能（遵循它的要求）：\n{skill_prompt.strip()}"


def _extract_json(raw: str) -> dict:
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fence:
        text = fence.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object in model output")
    return json.loads(text[start : end + 1])


def _strip_outer_fence(md: str) -> str:
    text = md.strip()
    m = re.fullmatch(r"```(?:markdown|md)?\s*\n(.*)\n```", text, re.S)
    return m.group(1).strip() if m else text


def _ensure_heading(md: str, heading: str) -> str:
    first = md.lstrip().split("\n", 1)[0]
    if first.startswith("#"):
        # Normalise whatever level the model picked to a section heading.
        return re.sub(r"^\s*#{1,6}\s*", "## ", md.lstrip(), count=1)
    return f"## {heading}\n\n{md.strip()}"


async def _call(user, provider, model, system, prompt, *, max_tokens, json_mode=False) -> str:
    extra = {}
    if json_mode and (provider == "deepseek"):
        extra["response_format"] = {"type": "json_object"}
    try:
        return await UnifiedAIClient.call(
            user=user,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            provider=provider,
            model=model,
            temperature=0.6,
            max_tokens=max_tokens,
            **extra,
        )
    except HTTPException:
        raise
    except Exception as e:  # provider/key errors surface to the editor as a message
        raise HTTPException(status_code=502, detail=str(e) or e.__class__.__name__)


@router.post("/outline", response_model=OutlineResponse)
async def make_outline(
    req: OutlineRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user = _resolve_user(authorization, db)
    provider = _pick_provider(user, req.provider)

    parts = [f"主题：{req.topic.strip()}"]
    if req.title:
        parts.append(f"已有标题：{req.title.strip()}")
    if req.existingText and req.existingText.strip():
        parts.append(f"文档里已有的内容（大纲应接在它之后，不要重复）：\n{req.existingText.strip()[:DOC_CONTEXT_CHARS]}")
    prompt = "\n\n".join(parts) + _skill_block(req.skillPrompt)

    raw = await _call(user, provider, req.model, OUTLINE_SYSTEM, prompt, max_tokens=800, json_mode=True)
    try:
        data = _extract_json(raw)
        sections = [
            OutlineSection(heading=str(s["heading"]).strip(), intent=str(s.get("intent", "")).strip())
            for s in data.get("sections", [])
            if str(s.get("heading", "")).strip()
        ][:MAX_SECTIONS]
    except (ValueError, KeyError, TypeError) as e:
        raise HTTPException(status_code=502, detail=f"大纲格式无法解析: {e}")
    if not sections:
        raise HTTPException(status_code=502, detail="模型没有返回任何小节")
    title = str(data.get("title") or req.title or req.topic).strip()
    return OutlineResponse(title=title, sections=sections)


@router.post("/fill", response_model=FillResponse)
async def fill_section(
    req: FillRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user = _resolve_user(authorization, db)
    provider = _pick_provider(user, req.provider)

    outline = "\n".join(
        f"{i + 1}. {s.heading} — {s.intent}" + ("  ← 本节" if s.heading == req.heading else "")
        for i, s in enumerate(req.outline)
    )
    parts = [f"主题：{req.topic.strip()}"]
    if req.title:
        parts.append(f"文章标题：{req.title.strip()}")
    if outline:
        parts.append(f"全文大纲：\n{outline}")
    if req.docText and req.docText.strip():
        parts.append(f"文档目前的内容（供衔接，不要重复）：\n{req.docText.strip()[-DOC_CONTEXT_CHARS:]}")
    parts.append(f"现在只写这一节：\n小节标题：{req.heading}\n要写的内容：{req.intent}")
    prompt = "\n\n".join(parts) + _skill_block(req.skillPrompt)

    raw = await _call(user, provider, req.model, FILL_SYSTEM, prompt, max_tokens=1500)
    md = _strip_outer_fence(raw)
    if not md.strip():
        raise HTTPException(status_code=502, detail="模型返回了空内容")
    return FillResponse(markdown=_ensure_heading(md, req.heading))

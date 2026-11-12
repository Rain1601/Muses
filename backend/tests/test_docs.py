from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api import docs
from app.services.unified_ai import UnifiedAIClient


@pytest.mark.asyncio
async def test_outline_parses_fenced_json_and_guest_uses_deepseek(monkeypatch):
    call = AsyncMock(return_value='```json\n{"title":"远程办公","sections":[{"heading":"效率","intent":"数据怎么说"},{"heading":"  ","intent":"丢弃"}]}\n```')
    monkeypatch.setattr(UnifiedAIClient, "call", call)
    res = await docs.make_outline(docs.OutlineRequest(topic="远程办公利弊"), authorization=None, db=None)
    assert res.title == "远程办公"
    assert [s.heading for s in res.sections] == ["效率"]
    kwargs = call.await_args.kwargs
    assert kwargs["provider"] == "deepseek" and kwargs["user"] is None
    assert kwargs["response_format"] == {"type": "json_object"}


@pytest.mark.asyncio
async def test_outline_bad_output_is_502(monkeypatch):
    monkeypatch.setattr(UnifiedAIClient, "call", AsyncMock(return_value="抱歉，我不能"))
    with pytest.raises(HTTPException) as e:
        await docs.make_outline(docs.OutlineRequest(topic="x"), authorization=None, db=None)
    assert e.value.status_code == 502


@pytest.mark.asyncio
async def test_fill_normalises_heading_and_marks_current_section(monkeypatch):
    call = AsyncMock(return_value="```markdown\n# 效率\n\n远程让专注时间多了 20%。\n```")
    monkeypatch.setattr(UnifiedAIClient, "call", call)
    outline = [docs.OutlineSection(heading="效率", intent="数据"), docs.OutlineSection(heading="成本", intent="钱")]
    res = await docs.fill_section(
        docs.FillRequest(topic="远程办公", heading="效率", intent="数据", outline=outline, skillPrompt="短句"),
        authorization=None, db=None,
    )
    assert res.markdown.startswith("## 效率\n")
    prompt = call.await_args.kwargs["messages"][1]["content"]
    assert "1. 效率 — 数据  ← 本节" in prompt and "2. 成本 — 钱\n" in prompt
    assert "写作技能" in prompt


@pytest.mark.asyncio
async def test_fill_adds_missing_heading_and_maps_provider_errors(monkeypatch):
    monkeypatch.setattr(UnifiedAIClient, "call", AsyncMock(return_value="正文一段。"))
    res = await docs.fill_section(docs.FillRequest(topic="t", heading="成本", intent="i"), authorization=None, db=None)
    assert res.markdown == "## 成本\n\n正文一段。"

    monkeypatch.setattr(UnifiedAIClient, "call", AsyncMock(side_effect=ValueError("未配置 DeepSeek API Key")))
    with pytest.raises(HTTPException) as e:
        await docs.fill_section(docs.FillRequest(topic="t", heading="h", intent="i"), authorization=None, db=None)
    assert e.value.status_code == 502 and "DeepSeek" in e.value.detail

"""
Context Injection 上下文构建器

输入: 文章全文 + 选区位置 + 编辑历史 + 配置
输出: 一段 markdown 风格的 "# 文档上下文" 文本, 直接拼进 user prompt

配置来源: 前端 localStorage("muses.contextConfig") 跟着 text-action 请求一起发上来,
schema 与 frontend/components/ContextConfigPanel.tsx 的 ContextConfig 对齐。

设计要点:
- 段落识别走 "blank line 分段" + fallback "single newline";
  TipTap editor.getText() 默认用 "\n\n", FileImport 进来的可能是 "\n" 单行段。
- 选区索引是字符偏移 (utf-16 code units 与前端 String.length 对齐); 跨段选区时
  before/after 锚定到 "起始所在段" 与 "结束所在段"。
- 三档模式:
    full     : 全文 <= threshold       -> 注入整篇
    compact  : threshold < 全文 <= upper -> 开篇 + 前后段
    surround : 全文 > upper            -> 仅前后段
- 没启用 fullDocument 但 selection 之外没东西可塞时, 也回退到 surround。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


# ─────────────────────────── Config ───────────────────────────

@dataclass
class SurroundingConfig:
    before_paragraphs: int = 2
    after_paragraphs: int = 2
    max_chars_per_side: int = 300


@dataclass
class FullDocumentConfig:
    enabled: bool = True
    threshold: int = 2000


@dataclass
class SkeletonConfig:
    enabled: bool = True
    upper_bound: int = 5000


@dataclass
class EditHistoryConfig:
    enabled: bool = True
    turns: int = 5
    max_chars: int = 200


@dataclass
class ContextConfig:
    surrounding: SurroundingConfig = field(default_factory=SurroundingConfig)
    full_document: FullDocumentConfig = field(default_factory=FullDocumentConfig)
    skeleton: SkeletonConfig = field(default_factory=SkeletonConfig)
    edit_history: EditHistoryConfig = field(default_factory=EditHistoryConfig)

    @classmethod
    def from_dict(cls, data: Optional[dict]) -> "ContextConfig":
        """从前端 JSON 还原 (前端字段为 camelCase)"""
        if not data:
            return cls()
        s = data.get("surrounding", {}) or {}
        f = data.get("fullDocument", {}) or {}
        sk = data.get("skeleton", {}) or {}
        e = data.get("editHistory", {}) or {}
        return cls(
            surrounding=SurroundingConfig(
                before_paragraphs=int(s.get("beforeParagraphs", 2)),
                after_paragraphs=int(s.get("afterParagraphs", 2)),
                max_chars_per_side=int(s.get("maxCharsPerSide", 300)),
            ),
            full_document=FullDocumentConfig(
                enabled=bool(f.get("enabled", True)),
                threshold=int(f.get("threshold", 2000)),
            ),
            skeleton=SkeletonConfig(
                enabled=bool(sk.get("enabled", True)),
                upper_bound=int(sk.get("upperBound", 5000)),
            ),
            edit_history=EditHistoryConfig(
                enabled=bool(e.get("enabled", True)),
                turns=int(e.get("turns", 5)),
                max_chars=int(e.get("maxChars", 200)),
            ),
        )


@dataclass
class EditRecord:
    """单条 AI 编辑历史"""
    action: str        # "improve" | "translate" | ...
    summary: str       # 摘要 (e.g. "开篇被动句改主动")
    accepted: Optional[bool] = None   # True=接受, False=拒绝, None=未知

    @classmethod
    def from_dict(cls, data: dict) -> "EditRecord":
        return cls(
            action=str(data.get("action", "")),
            summary=str(data.get("summary", "")),
            accepted=data.get("accepted"),
        )


@dataclass
class BuildInput:
    article_title: Optional[str]
    article_content: str          # 全文 plain text
    selection_start: int          # 字符偏移 (含)
    selection_end: int            # 字符偏移 (不含)
    edit_history: list[EditRecord] = field(default_factory=list)
    config: ContextConfig = field(default_factory=ContextConfig)


@dataclass
class BuildResult:
    """构建产物"""
    context_block: str            # 完整的 "# 文档上下文" 段落, 直接拼到 user prompt
    mode: str                     # "full" | "compact" | "surround" | "none"
    chars_injected: int           # 注入字数 (用于调试 / 监控)


# ─────────────────────────── Paragraph utils ───────────────────────────

def _split_paragraphs(text: str) -> list[tuple[int, int, str]]:
    """
    分段。返回 [(start_offset, end_offset, paragraph_text), ...].
    end_offset 不含; 段落之间的空白不算在段内。

    分隔策略: 先按 "\n\n+" 切, 段数 <= 1 时回退按 "\n" 切。
    """
    import re

    if not text:
        return []

    # primary: blank-line split
    parts = re.split(r"\n{2,}", text)
    if len(parts) == 1:
        parts = text.split("\n")

    out: list[tuple[int, int, str]] = []
    cursor = 0
    for p in parts:
        # 跳过原文中对应位置的前导空白 / 换行
        while cursor < len(text) and text[cursor] in ("\n", "\r"):
            cursor += 1
        if not p.strip():
            cursor += len(p)
            continue
        start = cursor
        end = cursor + len(p)
        out.append((start, end, p))
        cursor = end
    return out


def _locate_paragraphs(
    paragraphs: list[tuple[int, int, str]],
    sel_start: int,
    sel_end: int,
) -> tuple[int, int]:
    """
    返回 selection 起止所在段的下标 (start_idx, end_idx, 含).
    若 selection 落在段间空白, 就靠最近的段。
    """
    if not paragraphs:
        return (-1, -1)

    start_idx = 0
    for i, (s, e, _) in enumerate(paragraphs):
        if s <= sel_start < e:
            start_idx = i
            break
        if sel_start < s:
            start_idx = max(0, i - 1) if i > 0 else 0
            break
        start_idx = i

    end_idx = start_idx
    for i in range(start_idx, len(paragraphs)):
        s, e, _ = paragraphs[i]
        if s < sel_end <= e:
            end_idx = i
            break
        if sel_end <= s:
            end_idx = max(start_idx, i - 1)
            break
        end_idx = i

    return (start_idx, end_idx)


def _take_paragraphs_with_budget(
    paras: list[str],
    max_chars: int,
    direction: str = "tail",
) -> str:
    """
    取 paras 拼到 max_chars 之内。
    direction="tail" -> 保留靠近选区的段 (即列表末尾, 适合 before 段);
    direction="head" -> 保留靠近选区的段 (即列表开头, 适合 after 段)。
    """
    if not paras or max_chars <= 0:
        return ""
    if direction == "tail":
        # 从末尾往前取
        acc: list[str] = []
        budget = max_chars
        for p in reversed(paras):
            if budget <= 0:
                break
            if len(p) <= budget:
                acc.append(p)
                budget -= len(p)
            else:
                # 段太长, 截尾保留末尾
                acc.append("…" + p[-budget:])
                budget = 0
        return "\n\n".join(reversed(acc))
    else:
        acc = []
        budget = max_chars
        for p in paras:
            if budget <= 0:
                break
            if len(p) <= budget:
                acc.append(p)
                budget -= len(p)
            else:
                acc.append(p[:budget] + "…")
                budget = 0
        return "\n\n".join(acc)


# ─────────────────────────── Main builder ───────────────────────────

def build_context(inp: BuildInput) -> BuildResult:
    """
    构建上下文 block。

    返回的 context_block 形如:

        # 文档上下文
        标题: ...

        ## 模式: full
        <全文>

        ## 选区前 (N 段)
        ...

        ## 选区后 (N 段)
        ...

        # 本文最近 AI 编辑
        1. [improve] ... ✅
        ...

    如果什么都没有可注入 (没全文也没历史), context_block 为空字符串,
    调用方据此决定是否拼到 prompt。
    """
    text = inp.article_content or ""
    total = len(text)
    cfg = inp.config

    paragraphs = _split_paragraphs(text)
    sections: list[str] = []
    chars_injected = 0

    # ── header ──
    header_lines: list[str] = []
    if inp.article_title:
        header_lines.append(f"标题: {inp.article_title}")
    header_lines.append(f"全文长度: {total} 字, 共 {len(paragraphs)} 段")

    # ── mode 选择 ──
    if cfg.full_document.enabled and total <= cfg.full_document.threshold and total > 0:
        mode = "full"
    elif cfg.skeleton.enabled and total <= cfg.skeleton.upper_bound and total > 0:
        mode = "compact"
    elif total > 0:
        mode = "surround"
    else:
        mode = "none"

    # 选区落在哪两段
    sel_start = max(0, min(total, inp.selection_start))
    sel_end = max(sel_start, min(total, inp.selection_end))
    start_idx, end_idx = _locate_paragraphs(paragraphs, sel_start, sel_end)

    # ── 主体 ──
    if mode == "full":
        sections.append(f"## 全文 (mode=full)\n{text}")
        chars_injected += total

    elif mode == "compact":
        # 开篇 (前 ~200 字)
        opening = text[:min(200, total)].rstrip()
        if opening:
            sections.append(f"## 开篇\n{opening}")
            chars_injected += len(opening)
        # 选区前后段 (复用 surround 逻辑)
        before, after = _surround_blocks(paragraphs, start_idx, end_idx, cfg.surrounding)
        if before:
            sections.append(f"## 选区前 ({cfg.surrounding.before_paragraphs} 段)\n{before}")
            chars_injected += len(before)
        if after:
            sections.append(f"## 选区后 ({cfg.surrounding.after_paragraphs} 段)\n{after}")
            chars_injected += len(after)

    elif mode == "surround":
        before, after = _surround_blocks(paragraphs, start_idx, end_idx, cfg.surrounding)
        if before:
            sections.append(f"## 选区前 ({cfg.surrounding.before_paragraphs} 段)\n{before}")
            chars_injected += len(before)
        if after:
            sections.append(f"## 选区后 ({cfg.surrounding.after_paragraphs} 段)\n{after}")
            chars_injected += len(after)

    # ── 编辑历史 ──
    hist_block = ""
    if cfg.edit_history.enabled and inp.edit_history:
        recent = inp.edit_history[-cfg.edit_history.turns :]
        lines = []
        for i, r in enumerate(recent, 1):
            mark = "✅" if r.accepted else ("❌" if r.accepted is False else "·")
            summary = r.summary[: cfg.edit_history.max_chars]
            lines.append(f"{i}. [{r.action}] {summary} {mark}")
        hist_block = "\n".join(lines)
        # 整体截断
        if len(hist_block) > cfg.edit_history.max_chars * cfg.edit_history.turns:
            hist_block = hist_block[: cfg.edit_history.max_chars * cfg.edit_history.turns] + "…"
        chars_injected += len(hist_block)

    # ── 组装 ──
    if not sections and not hist_block:
        return BuildResult(context_block="", mode="none", chars_injected=0)

    out_parts: list[str] = ["# 文档上下文"]
    out_parts.extend(header_lines)
    out_parts.append("")  # blank line
    if sections:
        out_parts.extend(sections)
    if hist_block:
        out_parts.append("")
        out_parts.append("# 本文最近 AI 编辑")
        out_parts.append(hist_block)

    return BuildResult(
        context_block="\n".join(out_parts),
        mode=mode,
        chars_injected=chars_injected,
    )


def _surround_blocks(
    paragraphs: list[tuple[int, int, str]],
    start_idx: int,
    end_idx: int,
    cfg: SurroundingConfig,
) -> tuple[str, str]:
    """返回 (before_block, after_block) 两段 markdown 文本"""
    if start_idx < 0 or not paragraphs:
        return ("", "")

    before_paras = [
        paragraphs[i][2]
        for i in range(max(0, start_idx - cfg.before_paragraphs), start_idx)
    ]
    after_paras = [
        paragraphs[i][2]
        for i in range(end_idx + 1, min(len(paragraphs), end_idx + 1 + cfg.after_paragraphs))
    ]

    before = _take_paragraphs_with_budget(before_paras, cfg.max_chars_per_side, "tail")
    after = _take_paragraphs_with_budget(after_paras, cfg.max_chars_per_side, "head")
    return (before, after)

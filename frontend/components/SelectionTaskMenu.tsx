"use client";

/**
 * SelectionTaskMenu — Notion-style inline command palette anchored to a
 * text selection. The user types an instruction (or picks a default / recent
 * one) and presses Enter to dispatch a non-blocking task.
 *
 * Recent commands are persisted in localStorage so the menu adapts to the
 * user's habits over time.
 */

import { useEffect, useRef, useState } from "react";
import s from "./SelectionTaskMenu.module.css";

const LS_RECENT_KEY = "muses-pw-recent-instructions";
const MAX_RECENT = 6;

const DEFAULT_INSTRUCTIONS: { label: string; prompt: string }[] = [
  { label: "翻译为英文",   prompt: "翻译为英文" },
  { label: "翻译为中文",   prompt: "翻译为中文" },
  { label: "改写",         prompt: "改写这段，让它更通顺自然" },
  { label: "简化",         prompt: "简化这段，去掉冗余" },
  { label: "扩写",         prompt: "扩写这段，加深细节" },
  { label: "修语法",       prompt: "修正语法和错别字，保留原意" },
  { label: "口语化",       prompt: "改写为更口语化的表达" },
  { label: "严肃化",       prompt: "改写为更严肃的书面表达" },
  { label: "抓重点",       prompt: "用一句话概括这段的核心论点" },
];

export interface SelectionTaskInput {
  /** The user's instruction text. */
  instruction: string;
  /** The text that was selected. */
  selectedText: string;
}

interface Props {
  /** Anchor position in viewport coords. */
  anchor: { top: number; left: number };
  /** The currently-selected text (shown in the preview footer). */
  selectedText: string;
  onSubmit: (input: SelectionTaskInput) => void;
  onClose: () => void;
}

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((s): s is string => typeof s === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function saveRecent(items: string[]) {
  try {
    localStorage.setItem(LS_RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
  } catch {}
}

export default function SelectionTaskMenu({
  anchor, selectedText, onSubmit, onClose,
}: Props) {
  const [text, setText] = useState("");
  const [recent, setRecent] = useState<string[]>(() => loadRecent());
  const rootRef = useRef<HTMLDivElement>(null);

  // Outside click / Escape close.
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const fire = (instruction: string) => {
    const trimmed = instruction.trim();
    if (!trimmed) return;
    // Dedupe + bump to front in recent list.
    const next = [trimmed, ...recent.filter(r => r !== trimmed)].slice(0, MAX_RECENT);
    setRecent(next);
    saveRecent(next);
    onSubmit({ instruction: trimmed, selectedText });
  };

  return (
    <div ref={rootRef} className={s.popover} style={{ top: anchor.top, left: anchor.left }}>
      <div className={s.inputRow}>
        <svg className={s.icon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        <input
          autoFocus
          className={s.input}
          placeholder="Ask AI to transform the selection…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); fire(text); }
          }}
        />
      </div>

      {!text && (
        <>
          <div className={s.section}>
            <div className={s.sectionTitle}>默认</div>
            <div className={s.chips}>
              {DEFAULT_INSTRUCTIONS.map((d) => (
                <button key={d.label} className={s.chip} onClick={() => fire(d.prompt)}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          {recent.length > 0 && (
            <div className={s.section}>
              <div className={s.sectionTitle}>最近</div>
              <div className={s.recentList}>
                {recent.map((r, i) => (
                  <button key={i} className={s.recentItem} onClick={() => fire(r)}>
                    <svg className={s.recentItemIcon} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className={s.preview}>
        <span className={s.previewLabel}>选中</span>
        <span className={s.previewText}>{selectedText.slice(0, 80)}{selectedText.length > 80 ? "…" : ""}</span>
      </div>

      <div className={s.footer}>
        <span><kbd>↵</kbd> 派任务</span>
        <span><kbd>esc</kbd> 关</span>
      </div>
    </div>
  );
}

"use client";

/**
 * /dashboard-pw — prompt-writing prototype.
 *
 * Two task creators, both non-blocking, both feed the same task system:
 *   1. 【】 in prose          — fires when cursor leaves the bracket
 *   2. ⌘K on a selection      — opens SelectionTaskMenu; instruction + selection → task
 *
 * Both render their results through the shared CandidatePopover. Accept either
 * replaces the bracket / selection, or (for selection tasks) appends below.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  SlotDecorations,
  AiSource,
  extractSlotsFromDoc,
  isCodeContext,
  registerSlotRange,
  unregisterSlotRange,
  getSlotRange,
} from "@/lib/tiptap-extensions/PromptSlot";
import { useSlotEngine } from "@/lib/hooks/useSlotEngine";
import CandidatePopover, { type AcceptMode } from "@/components/CandidatePopover";
import SelectionTaskMenu from "@/components/SelectionTaskMenu";
import s from "./page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const PROVIDER_LS_KEY = "muses-pw-provider";
const TOKEN_LS_KEY = "muses_token";

interface ProviderModel { id: string; label: string }
interface ProviderInfo {
  key: string; label: string; available: boolean;
  requires_auth: boolean; kind: "local" | "aggregated";
  models: ProviderModel[];
}

interface OpenSlot {
  /** Slot map key. Brackets use the trimmed prompt; selection tasks use `sel:<uuid>`. */
  key: string;
  /** Anchor coords in viewport. */
  anchor: { top: number; left: number };
  /** What we show in the popover header. */
  headerText: string;
  /** Replace vs append matters for selection tasks. Brackets only Accept. */
  isSelectionTask: boolean;
}

let _selUid = 0;
const newSelKey = () => `sel:${Date.now()}-${++_selUid}`;

// ── Provider picker (inline, page-specific) ────────────

interface ProviderPickerProps {
  providers: ProviderInfo[];
  selected: { provider: string; model: string };
  onSelect: (provider: string, model: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}
function ProviderPicker({ providers, selected, onSelect, open, setOpen }: ProviderPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);
  const cur = providers.find(p => p.key === selected.provider);
  const curAvail = cur ? cur.available : true;
  const curLabel = cur?.label ?? selected.provider;
  return (
    <div className={s.providerPicker} ref={rootRef}>
      <button className={s.providerBtn} onClick={() => setOpen(!open)}>
        <span className={`${s.providerBtnDot} ${!curAvail ? s.providerBtnDotMuted : ""}`} />
        <span>{curLabel}</span>
        <span style={{ color: "#78716C" }}>·</span>
        <span style={{ color: "#A8A29E" }}>{selected.model}</span>
        <span className={s.providerBtnCaret}>▾</span>
      </button>
      {open && (
        <div className={s.providerMenu}>
          {providers.map(p => (
            <div key={p.key} className={s.providerGroup}>
              <div className={s.providerGroupTitle}>
                <span>{p.label}</span>
                <span className={p.available ? s.providerGroupBadgeOk : s.providerGroupBadge}>
                  {p.available ? "ready" : p.requires_auth ? "no API key" : "unavailable"}
                </span>
              </div>
              {p.models.map(m => {
                const isActive = selected.provider === p.key && selected.model === m.id;
                const isDisabled = !p.available;
                const cls = [
                  s.providerOption,
                  isActive ? s.providerOptionActive : "",
                  isDisabled ? s.providerOptionDisabled : "",
                ].filter(Boolean).join(" ");
                return (
                  <div
                    key={m.id} className={cls}
                    onClick={() => { if (!isDisabled) onSelect(p.key, m.id); }}
                  >
                    <span>{m.label}</span>
                    {m.label !== m.id && <span className={s.providerOptionModel}>{m.id}</span>}
                  </div>
                );
              })}
            </div>
          ))}
          <div className={s.providerHint}>
            Aggregated providers require a key configured at <a href="/dashboard">/dashboard</a> settings.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────

export default function PromptWritingPage() {
  const [showProv, setShowProv] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<{ provider: string; model: string }>(() => {
    if (typeof window === "undefined") return { provider: "local:claude", model: "sonnet" };
    try {
      const raw = localStorage.getItem(PROVIDER_LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { provider: "local:claude", model: "sonnet" };
  });
  useEffect(() => {
    try { localStorage.setItem(PROVIDER_LS_KEY, JSON.stringify(selected)); } catch (_) {}
  }, [selected]);

  // Refresh provider list on mount.
  const refreshProviders = useCallback(async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_LS_KEY) : null;
      const res = await fetch(`${API_BASE}/api/slot-fill/providers`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) return;
      const data = await res.json();
      setProviders(data.providers || []);
    } catch (_) {}
  }, []);
  useEffect(() => { void refreshProviders(); }, [refreshProviders]);

  // Selection task menu state.
  const [selMenu, setSelMenu] = useState<{
    anchor: { top: number; left: number };
    selectedText: string;
    range: { from: number; to: number };
  } | null>(null);

  // Active candidate popover.
  const [openSlot, setOpenSlot] = useState<OpenSlot | null>(null);

  // ── Editor + engine ─────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start writing. Use 【...】 to mark a TODO spot, or select text and ⌘K to transform it.",
      }),
      AiSource,
      SlotDecorations({ getState: () => engineRef.current?.getStateRef() ?? new Map() }),
    ],
    content: defaultContent(),
    immediatelyRender: false,
    autofocus: "end",
  });

  const engine = useSlotEngine(editor, {
    provider: selected.provider,
    model: selected.model,
    autoFireBrackets: true,
  });
  const engineRef = useRef(engine);
  useEffect(() => { engineRef.current = engine; }, [engine]);

  // Force decoration re-render on slot map change.
  useEffect(() => {
    if (!editor) return;
    const view = editor.view;
    view.dispatch(view.state.tr.setMeta("force-redraw", true));
  }, [engine.slots, editor]);

  // ── Dot click → open candidate popover ───────────────
  // For selection tasks, the slot has an `instruction` field — header shows
  // that instead of the ugly sel:... key. hasAppendMode controls Replace/Append.
  useEffect(() => {
    if (!editor) return;
    const root = editor.view.dom;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const dot = t.closest("[data-slot-key]") as HTMLElement | null;
      if (!dot) return;
      const key = dot.getAttribute("data-slot-key") || "";
      const slot = engineRef.current?.slots.get(key);
      const isSelectionTask = !!getSlotRange(editor.view, key);
      const rect = dot.getBoundingClientRect();
      setOpenSlot({
        key,
        anchor: {
          top: rect.bottom + 6,
          left: Math.min(window.innerWidth - 440, rect.left - 12),
        },
        headerText: isSelectionTask ? (slot?.instruction ?? key) : key,
        isSelectionTask,
      });
      e.stopPropagation();
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [editor]);

  // ── ⌘K — open SelectionTaskMenu near selection ───────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!editor) return;
      if (!(e.metaKey || e.ctrlKey) || e.key !== "k") return;
      const { from, to } = editor.state.selection;
      if (from === to) return;  // no selection → ignore
      e.preventDefault();
      const text = editor.state.doc.textBetween(from, to, " ");
      if (!text.trim()) return;
      // Anchor near the end of the selection.
      const view = editor.view;
      const coords = view.coordsAtPos(to);
      setSelMenu({
        anchor: {
          top: Math.min(window.innerHeight - 360, coords.bottom + 8),
          left: Math.min(window.innerWidth - 380, coords.left),
        },
        selectedText: text,
        range: { from, to },
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor]);

  // ── Submit a selection task ──────────────────────────
  // The popover does NOT open here. Decoration appears inline (underline + dot).
  // The user clicks the dot once it turns green to see candidates.
  const submitSelectionTask = useCallback(async (input: { instruction: string; selectedText: string }) => {
    if (!editor || !selMenu) return;
    const key = newSelKey();
    const { range } = selMenu;
    const fullText = editor.getText();
    const occIdx = fullText.indexOf(input.selectedText);
    const ctxFrom = occIdx >= 0 ? occIdx : 0;
    const ctxTo = occIdx >= 0 ? occIdx + input.selectedText.length : 0;
    const CONTEXT = 400;
    const before = fullText.slice(Math.max(0, ctxFrom - CONTEXT), ctxFrom);
    const after = fullText.slice(ctxTo, Math.min(fullText.length, ctxTo + CONTEXT));

    // Register the range with the plugin so the decoration tracks it through
    // any subsequent edits.
    registerSlotRange(editor.view, key, range.from, range.to);

    // Stash instruction + original text so regenerate can re-fire later.
    // Keep `range` on the slot state as the original range (debug only — the
    // live range is owned by the plugin).
    engine.updateSlot(key, {
      status: "pending",
      range,
      originalText: input.selectedText,
      instruction: input.instruction,
    });

    setSelMenu(null);

    // Fire backend. While pending, the inline decoration is the only feedback.
    const prompt = `${input.instruction}\n\n原文：\n${input.selectedText}`;
    await engine.fireSlot(key, {
      prompt,
      contextBefore: before,
      contextAfter: after,
    });
  }, [editor, selMenu, engine]);

  // ── Accept / regenerate / discard handlers ───────────
  const acceptForSlot = useCallback((key: string, text: string, mode: AcceptMode) => {
    if (!editor) return;
    // If the plugin is tracking a range for this key, it's a selection task.
    const tracked = getSlotRange(editor.view, key);
    if (tracked) {
      const { from, to } = tracked;
      if (mode === "replace") {
        editor.chain().focus()
          .insertContentAt({ from, to }, [{ type: "text", text, marks: [{ type: "aiSource" }] }])
          .run();
      } else {
        editor.chain().focus()
          .insertContentAt(to, [
            { type: "text", text: " ", marks: [] },
            { type: "text", text, marks: [{ type: "aiSource" }] },
          ])
          .run();
      }
      unregisterSlotRange(editor.view, key);
    } else {
      // Bracket slot — find by content and replace 【key】.
      let from = -1, to = -1;
      editor.state.doc.descendants((node, pos, parent) => {
        if (!node.isText || !node.text) return;
        if (isCodeContext(node, parent)) return;
        const idx = node.text.indexOf(`【${key}】`);
        if (idx !== -1 && from === -1) {
          from = pos + idx;
          to = from + key.length + 2;
          return false;
        }
      });
      if (from === -1) return;
      editor.chain().focus()
        .insertContentAt({ from, to }, [{ type: "text", text, marks: [{ type: "aiSource" }] }])
        .run();
    }
    engine.clearSlot(key);
    setOpenSlot(null);
  }, [editor, engine]);

  const regenerateForSlot = useCallback(async (key: string) => {
    const st = engine.slots.get(key);
    if (!editor || !st) return;
    if (st.instruction && st.originalText) {
      // Selection task — re-fire with the same instruction + original text.
      const fullText = editor.getText();
      const occIdx = fullText.indexOf(st.originalText);
      const CONTEXT = 400;
      const ctxFrom = occIdx >= 0 ? occIdx : 0;
      const ctxTo = occIdx >= 0 ? occIdx + st.originalText.length : 0;
      const before = fullText.slice(Math.max(0, ctxFrom - CONTEXT), ctxFrom);
      const after = fullText.slice(ctxTo, Math.min(fullText.length, ctxTo + CONTEXT));
      const prompt = `${st.instruction}\n\n原文：\n${st.originalText}`;
      await engine.fireSlot(key, { prompt, contextBefore: before, contextAfter: after });
    } else {
      // Bracket — re-fire with bracket text as prompt.
      let from = -1, to = -1;
      editor.state.doc.descendants((node, pos, parent) => {
        if (!node.isText || !node.text) return;
        if (isCodeContext(node, parent)) return;
        const idx = node.text.indexOf(`【${key}】`);
        if (idx !== -1 && from === -1) { from = pos + idx; to = from + key.length + 2; return false; }
      });
      if (from === -1) return;
      const fullText = editor.getText();
      const CONTEXT = 600;
      const occIdx = fullText.indexOf(`【${key}】`);
      const ctxFrom = occIdx >= 0 ? occIdx : 0;
      const ctxTo = occIdx >= 0 ? occIdx + key.length + 2 : 0;
      const before = fullText.slice(Math.max(0, ctxFrom - CONTEXT), ctxFrom);
      const after = fullText.slice(ctxTo, Math.min(fullText.length, ctxTo + CONTEXT));
      await engine.fireSlot(key, { prompt: key, contextBefore: before, contextAfter: after });
    }
  }, [editor, engine]);

  const discardSlot = useCallback((key: string) => {
    if (editor && getSlotRange(editor.view, key)) {
      unregisterSlotRange(editor.view, key);
    }
    engine.clearSlot(key);
    setOpenSlot(null);
  }, [editor, engine]);

  // ── Render ──────────────────────────────────────────
  const openState = openSlot ? engine.slots.get(openSlot.key) : undefined;

  return (
    <div className={`${s.shell} ${showProv ? s.shellShowProv : ""}`}>
      <div className={s.topbar}>
        <div className={s.topbarLeft}>
          <a className={s.back} href="/dashboard">← Dashboard</a>
          <span className={s.logo}>Muses</span>
          <span className={s.tag}>Prompt Writing</span>
        </div>
        <div className={s.topbarRight}>
          <span className={s.help}>
            type <code>【...】</code> · select + <code>⌘K</code>
          </span>
          <ProviderPicker
            providers={providers}
            selected={selected}
            onSelect={(p, m) => { setSelected({ provider: p, model: m }); setPickerOpen(false); }}
            open={pickerOpen}
            setOpen={setPickerOpen}
          />
          <button
            className={`${s.toggleRow} ${showProv ? s.toggleRowActive : ""}`}
            onClick={() => setShowProv(v => !v)}
            title="Highlight AI-filled text"
          >
            {showProv ? "✓ AI marks on" : "AI marks off"}
          </button>
        </div>
      </div>

      <div className={s.scroll}>
        <div className={s.page}>
          <EditorContent editor={editor} className={s.editor} />
        </div>
      </div>

      {/* Selection-task input menu */}
      {selMenu && createPortal(
        <SelectionTaskMenu
          anchor={selMenu.anchor}
          selectedText={selMenu.selectedText}
          onSubmit={submitSelectionTask}
          onClose={() => setSelMenu(null)}
        />,
        document.body,
      )}

      {/* Candidate popover for whichever task is open */}
      {openSlot && openState && createPortal(
        <CandidatePopover
          slotKey={openSlot.key}
          state={openState}
          anchor={openSlot.anchor}
          headerText={openSlot.headerText}
          hasAppendMode={openSlot.isSelectionTask}
          onAccept={(text, mode) => acceptForSlot(openSlot.key, text, mode)}
          onRegenerate={() => regenerateForSlot(openSlot.key)}
          onDiscard={() => discardSlot(openSlot.key)}
          onClose={() => setOpenSlot(null)}
        />,
        document.body,
      )}
    </div>
  );
}

function defaultContent() {
  return `
<h1>Prompt-driven writing</h1>
<p>Two ways to ask AI for help, both non-blocking:</p>
<p>① <strong>Drop a bracket</strong> — write <code>【...】</code> anywhere you'd pause to think; the agent fills it after you move on. AI agent 在生产环境的落地一直是个开放问题。【举一个具体的 AI agent 应用案例，一句话】这类案例的共性是任务边界清晰、容错允许重试。</p>
<p>② <strong>Select + ⌘K</strong> — highlight any text, press <code>⌘K</code>, type an instruction (or pick a default like 翻译/改写/简化), and a task is dispatched without breaking your flow. When it returns, you choose Replace or Append.</p>
<p>Toggle <em>AI marks</em> in the top bar to see which spans came from AI.</p>
  `.trim();
}

"use client";

/**
 * CandidatePopover — shared candidate review UI for prompt-driven AI tasks.
 *
 * Used by both /dashboard-pw (bracket slots) and /dashboard (selection tasks).
 * Renders a fixed-position floating card with:
 *   - header showing the prompt
 *   - one row per candidate with Accept / Edit
 *   - footer with Regenerate / Discard
 *
 * The popover does NOT render itself in a portal — the caller should portal
 * it (or render at top level) so it can escape ancestor stacking contexts.
 */

import { useState } from "react";
import type { Candidate, SlotState } from "@/lib/tiptap-extensions/PromptSlot";
import s from "./CandidatePopover.module.css";

export type AcceptMode = "replace" | "append";

interface Props {
  slotKey: string;
  state: SlotState;
  /** Anchor position in viewport coords. */
  anchor: { top: number; left: number };
  /** Prompt or instruction text shown in the popover header. */
  headerText: string;
  /** Whether to show the Replace / Append action pair (true for selection tasks). */
  hasAppendMode?: boolean;

  onAccept: (text: string, mode: AcceptMode) => void;
  onRegenerate: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

function fmtCost(usd?: number) {
  if (usd == null) return "—";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export default function CandidatePopover({
  slotKey, state, anchor, headerText, hasAppendMode,
  onAccept, onRegenerate, onDiscard, onClose,
}: Props) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  const isErr = state.status === "error";
  const isPending = state.status === "pending";
  const candidates = state.candidates ?? [];

  return (
    <div
      className={s.popover}
      style={{ top: anchor.top, left: anchor.left }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={s.header}>
        <span style={{ color: "#D97149" }}>❮</span>
        <span className={s.headerLabel}>{headerText}</span>
        <span style={{ color: "#D97149" }}>❯</span>
        <button className={s.close} onClick={onClose} aria-label="close">×</button>
      </div>

      {isPending && (
        <div className={s.spinner}>
          <span className={s.spinnerDot} /> generating candidates…
        </div>
      )}

      {isErr && (
        <div className={s.candidate}>
          <div className={s.err}>error: {state.error}</div>
          <div className={s.actions}>
            <button className={`${s.btn} ${s.btnGhost}`} onClick={onRegenerate}>↻ Retry</button>
          </div>
        </div>
      )}

      {!isPending && !isErr && (
        <>
          <div className={s.candidates}>
            {candidates.map((c: Candidate, idx: number) => {
              const isEditing = editingIdx === idx;
              const finalText = isEditing ? editingText : c.text;
              return (
                <div key={idx} className={s.candidate}>
                  {c.error ? (
                    <div className={s.err}>error: {c.error}</div>
                  ) : isEditing ? (
                    <textarea
                      className={s.edit}
                      value={editingText}
                      autoFocus
                      onChange={(e) => setEditingText(e.target.value)}
                    />
                  ) : (
                    <div className={s.text}>{c.text}</div>
                  )}
                  <div className={s.meta}>
                    <span>#{idx + 1}</span>
                    {c.cost_usd != null && <span>{fmtCost(c.cost_usd)}</span>}
                    {c.duration_ms != null && <span>{(c.duration_ms / 1000).toFixed(1)}s</span>}
                    <div className={s.actions}>
                      {!c.error && !isEditing && (
                        <button
                          className={`${s.btn} ${s.btnGhost}`}
                          onClick={() => { setEditingIdx(idx); setEditingText(c.text); }}
                        >Edit</button>
                      )}
                      {isEditing && (
                        <button
                          className={`${s.btn} ${s.btnGhost}`}
                          onClick={() => setEditingIdx(null)}
                        >Cancel</button>
                      )}
                      {!c.error && hasAppendMode && (
                        <button
                          className={`${s.btn} ${s.btnGhost}`}
                          onClick={() => onAccept(finalText, "append")}
                        >↓ Append</button>
                      )}
                      {!c.error && (
                        <button
                          className={s.btn}
                          onClick={() => onAccept(finalText, "replace")}
                        >{hasAppendMode ? "✓ Replace" : "Accept"}</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className={s.footer}>
            <button className={`${s.btn} ${s.btnGhost}`} onClick={onRegenerate}>↻ Regenerate</button>
            <button className={`${s.btn} ${s.btnGhost}`} onClick={onDiscard}>Discard</button>
            <span className={s.footerCost}>
              total {fmtCost(state.totalCost)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

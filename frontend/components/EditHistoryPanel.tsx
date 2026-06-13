"use client";

/**
 * EditHistoryPanel — chronological log of AI edits made to the active article.
 *
 * Shows each accepted candidate (bracket fill, ⌘K replace, ⌘K append) with
 * its before/after diff and a Revert action. Lives in the slot where the
 * legacy ChatPanel used to live.
 */

import type { EditRecord } from "@/lib/hooks/useEditHistory";
import s from "./EditHistoryPanel.module.css";

interface Props {
  records: EditRecord[];
  onRevert: (id: string) => void;
  onClear?: () => void;
}

function fmtTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (sameDay) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtCost(usd?: number) {
  if (usd == null) return null;
  if (usd < 0.001) return `$${(usd * 1000).toFixed(2)}m`;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function preview(text: string, max = 220): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

export default function EditHistoryPanel({ records, onRevert, onClear }: Props) {
  const live = records.filter(r => !r.reverted).length;

  return (
    <div className={s.panel}>
      <div className={s.header}>
        <div className={s.headerLeft}>
          <span className={s.subtitle}>AI Edits</span>
          <span className={s.count}>{live} / {records.length}</span>
        </div>
        <button
          className={s.clearBtn}
          onClick={onClear}
          disabled={records.length === 0 || !onClear}
          title="Clear log (does not undo edits)"
        >Clear</button>
      </div>

      <div className={s.list}>
        {records.length === 0 ? (
          <div className={s.empty}>
            <div className={s.emptyTitle}>No AI edits yet</div>
            <div className={s.emptyHint}>
              Drop a <code>【…】</code> or select text and press <code>⌘K</code>.<br/>
              Every accepted candidate lands here with one-click revert.
            </div>
          </div>
        ) : (
          records.map(r => {
            const isReplace = r.mode === "replace";
            const isAppend = r.mode === "append";
            return (
              <div key={r.id} className={`${s.record} ${r.reverted ? s.recordReverted : ""}`}>
                <div className={s.recordHead}>
                  <span className={`${s.badge} ${r.source === "bracket" ? s.badgeBracket : s.badgeSelection}`}>
                    {r.source === "bracket" ? "【】" : "⌘K"}
                  </span>
                  <span className={s.recordInstruction}>
                    {r.source === "bracket" ? r.promptKey : r.instruction}
                  </span>
                  <span className={s.recordTime}>{fmtTime(r.timestamp)}</span>
                </div>

                <div className={s.diff}>
                  {isReplace && r.originalText && (
                    <div className={s.diffOld}>
                      <span className={s.diffPrefix}>−</span>{preview(r.originalText)}
                    </div>
                  )}
                  {isAppend && (
                    <div className={s.diffOld}>
                      <span className={s.diffPrefix}>↳</span>(appended after selection)
                    </div>
                  )}
                  <div className={s.diffNew}>
                    <span className={s.diffPrefix}>+</span>{preview(r.newText)}
                  </div>
                </div>

                <div className={s.recordFoot}>
                  {r.model && <span className={s.foot}>{r.model}</span>}
                  {fmtCost(r.costUsd) && <span className={s.foot}>· {fmtCost(r.costUsd)}</span>}
                  <div className={s.actions}>
                    {r.reverted ? (
                      <span className={s.revertedLabel}>reverted</span>
                    ) : (
                      <button
                        className={s.revertBtn}
                        onClick={() => onRevert(r.id)}
                        title="Restore the original text"
                      >
                        ↶ Revert
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

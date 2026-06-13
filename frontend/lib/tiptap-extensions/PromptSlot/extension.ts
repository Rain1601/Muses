/**
 * SlotDecorations — a TipTap extension that wraps a ProseMirror plugin to draw
 * decorations for two kinds of "slots":
 *
 *   1. Bracket slots — text matching 【...】 in the doc, found by regex scan.
 *      Each gets an inline `.slot-bracket-*` class + a widget `.slot-dot` at 】.
 *
 *   2. Selection-task slots — runtime ranges registered via plugin meta when the
 *      user invokes ⌘K on a selection. Same decorations, but the range is
 *      tracked through the plugin state and re-mapped on every transaction so
 *      it stays glued to the right text even as the user keeps writing.
 *
 * Slot lifecycle state (pending / ready / error / candidates) is owned by the
 * host React engine and read here via opts.getState().
 */

import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { SLOT_REGEX, isCodeContext } from "./scan";
import type { SlotState, SlotStatus } from "./types";

interface TrackedRange { from: number; to: number; }
interface PluginState { ranges: Map<string, TrackedRange>; }

type SlotMeta =
  | { type: "register"; key: string; from: number; to: number }
  | { type: "unregister"; key: string }
  | { type: "redraw" };

export const slotPluginKey = new PluginKey<PluginState>("slot-decorations");

export interface SlotDecorationOpts {
  /** Returns the latest slot state map (status + candidates), keyed by slot id. */
  getState: () => Map<string, SlotState>;
}

function dotClass(status: SlotStatus): string { return `slot-dot ${status}`; }
function bracketClass(status: SlotStatus): string {
  switch (status) {
    case "pending": return "slot-bracket slot-bracket-pending";
    case "ready":   return "slot-bracket slot-bracket-ready";
    case "error":   return "slot-bracket slot-bracket-error";
    default:        return "slot-bracket";
  }
}

function buildSlotPlugin(opts: SlotDecorationOpts) {
  return new Plugin<PluginState>({
    key: slotPluginKey,
    state: {
      init: () => ({ ranges: new Map() }),
      apply(tr, prev) {
        // Remap all tracked ranges through this transaction's mapping so the
        // selection-task decoration follows the text as the user edits.
        const next = new Map<string, TrackedRange>();
        prev.ranges.forEach((r, k) => {
          const from = tr.mapping.map(r.from);
          const to = tr.mapping.map(r.to);
          if (to > from) next.set(k, { from, to });
        });
        const meta = tr.getMeta(slotPluginKey) as SlotMeta | undefined;
        if (meta) {
          if (meta.type === "register") {
            next.set(meta.key, { from: meta.from, to: meta.to });
          } else if (meta.type === "unregister") {
            next.delete(meta.key);
          }
          // "redraw" is a no-op signal; we just want a re-render. Decorations
          // are recomputed on every state change anyway, so this works.
        }
        return { ranges: next };
      },
    },
    props: {
      decorations(state) {
        const decos: Decoration[] = [];
        const slotMap = opts.getState();
        const cursorPos = state.selection.from;
        const pluginState = slotPluginKey.getState(state);
        const trackedKeys = new Set<string>();

        // ── 1. Selection-task decorations from tracked ranges ─────
        if (pluginState) {
          pluginState.ranges.forEach((range, key) => {
            trackedKeys.add(key);
            const ss = slotMap.get(key);
            const status: SlotStatus = ss?.status ?? "idle";
            if (status === "idle") return;
            decos.push(Decoration.inline(range.from, range.to, { class: bracketClass(status) }));
            decos.push(Decoration.widget(range.to, () => {
              const dot = document.createElement("span");
              dot.className = dotClass(status);
              dot.setAttribute("data-slot-key", key);
              dot.setAttribute("data-slot-from", String(range.from));
              dot.setAttribute("data-slot-to", String(range.to));
              dot.setAttribute("aria-label",
                status === "ready"   ? "candidates ready — click to review" :
                status === "pending" ? "task running…" :
                status === "error"   ? "error — click to see" : "");
              return dot;
            }, { side: 1 }));
          });
        }

        // ── 2. Bracket scan (skip any 【...】 whose key is already tracked) ──
        state.doc.descendants((node, pos, parent) => {
          if (!node.isText || !node.text) return;
          if (isCodeContext(node, parent)) return;
          SLOT_REGEX.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = SLOT_REGEX.exec(node.text)) !== null) {
            const matchFrom = pos + m.index;
            const matchTo = matchFrom + m[0].length;
            const key = m[1].trim();
            if (trackedKeys.has(key)) continue;
            const ss = slotMap.get(key);
            const status: SlotStatus =
              cursorPos >= matchFrom && cursorPos <= matchTo
                ? "idle"
                : ss?.status ?? "idle";
            decos.push(Decoration.inline(matchFrom, matchTo, { class: bracketClass(status) }));
            decos.push(Decoration.widget(matchTo, () => {
              const dot = document.createElement("span");
              dot.className = dotClass(status);
              dot.setAttribute("data-slot-key", key);
              dot.setAttribute("data-slot-from", String(matchFrom));
              dot.setAttribute("data-slot-to", String(matchTo));
              return dot;
            }, { side: 1 }));
          }
        });

        return DecorationSet.create(state.doc, decos);
      },
    },
  });
}

export const SlotDecorations = (opts: SlotDecorationOpts) =>
  Extension.create({
    name: "slot-decorations",
    addProseMirrorPlugins() {
      return [buildSlotPlugin(opts)];
    },
  });

// ── Public helpers for the host React code ────────────────────

/** Register a tracked range with a slot key — used when ⌘K fires a task. */
export function registerSlotRange(view: EditorView, key: string, from: number, to: number) {
  view.dispatch(view.state.tr.setMeta(slotPluginKey, { type: "register", key, from, to }));
}

/** Stop tracking this slot. Call on accept / discard. */
export function unregisterSlotRange(view: EditorView, key: string) {
  view.dispatch(view.state.tr.setMeta(slotPluginKey, { type: "unregister", key }));
}

/** Read the *current* range for a slot (i.e. after any doc edits). */
export function getSlotRange(view: EditorView, key: string): { from: number; to: number } | null {
  const ps = slotPluginKey.getState(view.state);
  return ps?.ranges.get(key) ?? null;
}

/** Force a decoration redraw (e.g. when the slot map status changed externally). */
export function redrawSlots(view: EditorView) {
  view.dispatch(view.state.tr.setMeta(slotPluginKey, { type: "redraw" }));
}

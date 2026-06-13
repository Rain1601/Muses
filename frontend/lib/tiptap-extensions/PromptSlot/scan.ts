/**
 * Document scanning helpers — find 【...】 brackets in a TipTap/ProseMirror doc,
 * skipping code marks and codeBlock children (so 【...】 inside `<code>` is text,
 * not a slot).
 */

import type { SlotMatch } from "./types";

// Match 【...】 — 1..400 chars, no nested brackets, lazy.
export const SLOT_REGEX = /【([^【】]{1,400})】/g;

/** True if the given text node lives inside an inline `code` mark or a codeBlock. */
export function isCodeContext(node: any, parent: any): boolean {
  if (parent && (parent.type.name === "codeBlock" || parent.type.name === "code_block")) return true;
  if (node.marks && node.marks.some((m: any) => m.type.name === "code")) return true;
  return false;
}

/**
 * Walk the doc and emit one SlotMatch per 【...】 occurrence.
 * `cursorPos` is the doc position of the current selection's `from` — used to
 * decide whether the cursor is *inside* a particular slot (= still editing it).
 */
export function extractSlotsFromDoc(doc: any, cursorPos: number): SlotMatch[] {
  const out: SlotMatch[] = [];
  doc.descendants((node: any, pos: number, parent: any) => {
    if (!node.isText || !node.text) return;
    if (isCodeContext(node, parent)) return;
    SLOT_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SLOT_REGEX.exec(node.text)) !== null) {
      const from = pos + m.index;
      const to = from + m[0].length;
      out.push({
        prompt: m[1].trim(),
        from,
        to,
        isEditing: cursorPos >= from && cursorPos <= to,
      });
    }
  });
  return out;
}

/**
 * Suggestions — proposed edits shown in place (Claude Docs' Suggesting mode).
 *
 * A suggestion replaces words by striking them (`suggestionDelete`, <del>) and
 * adding the new words right after (`suggestionInsert`, <ins>). Both marks
 * carry the same `suggestionId` plus who proposed it, the instruction it
 * answered and, when it came from a comment thread, that thread's id.
 * The doc is the store: cards are derived by scanning it, and the marks
 * survive the HTML autosave (and .md via a turndown keep rule).
 *
 * accept → struck words go, the mark comes off the new words.
 * reject → new words go, the strike comes off the old words.
 * Each is one transaction, so one undo restores the open suggestion.
 */
import { Mark, mergeAttributes } from '@tiptap/core';

const sharedAttrs = () => ({
  suggestionId: {
    default: null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-suggestion-id'),
    renderHTML: (a: any) => ({ 'data-suggestion-id': a.suggestionId }),
  },
  author: {
    default: 'claude',
    parseHTML: (el: HTMLElement) => el.getAttribute('data-author') || 'claude',
    renderHTML: (a: any) => ({ 'data-author': a.author }),
  },
  label: {
    default: '',
    parseHTML: (el: HTMLElement) => el.getAttribute('data-label') || '',
    renderHTML: (a: any) => (a.label ? { 'data-label': a.label } : {}),
  },
  threadId: {
    default: null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-thread-id'),
    renderHTML: (a: any) => (a.threadId ? { 'data-thread-id': a.threadId } : {}),
  },
});

export const SuggestionInsert = Mark.create({
  name: 'suggestionInsert',
  inclusive: false,
  excludes: '',
  priority: 1100,
  addAttributes: sharedAttrs,
  parseHTML() {
    return [{ tag: 'ins[data-suggestion-id]', priority: 100 }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['ins', mergeAttributes(HTMLAttributes, { class: 'suggestion-ins' }), 0];
  },
});

export const SuggestionDelete = Mark.create({
  name: 'suggestionDelete',
  inclusive: false,
  excludes: '',
  priority: 1100,
  addAttributes: sharedAttrs,
  parseHTML() {
    // Above StarterKit's Strike, which also claims <del>.
    return [{ tag: 'del[data-suggestion-id]', priority: 100 }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['del', mergeAttributes(HTMLAttributes, { class: 'suggestion-del' }), 0];
  },
});

export interface SuggestionMeta {
  author?: string;
  label?: string;
  threadId?: string | null;
}

export interface SuggestionInfo {
  id: string;
  author: string;
  label: string;
  threadId: string | null;
  deleted: string;
  inserted: string;
  /** Doc position of its first character (for ordering / scrolling). */
  pos: number;
}

type Run = { from: number; to: number; mark: any };

const newSuggestionId = () => `sg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function runs(doc: any, id: string, markName: string): Run[] {
  const out: Run[] = [];
  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return true;
    const m = node.marks.find((mk: any) => mk.type.name === markName && mk.attrs.suggestionId === id);
    if (m) out.push({ from: pos, to: pos + node.nodeSize, mark: m });
    return false;
  });
  return out;
}

/** Text blocks whose every character carries this suggestion's mark (removed whole on accept/reject). */
function wholeBlocks(doc: any, id: string, markName: string): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = [];
  doc.descendants((node: any, pos: number) => {
    if (!node.isTextblock) return true;
    if (node.content.size === 0) return false;
    let all = true;
    node.forEach((child: any) => {
      if (!child.isText || !child.marks.some((mk: any) => mk.type.name === markName && mk.attrs.suggestionId === id)) all = false;
    });
    if (all) out.push({ from: pos, to: pos + node.nodeSize });
    return false;
  });
  return out;
}

/** All open suggestions, in document order. */
export function listSuggestions(editor: any): SuggestionInfo[] {
  const byId = new Map<string, SuggestionInfo>();
  editor.state.doc.descendants((node: any, pos: number) => {
    if (!node.isText) return true;
    for (const m of node.marks) {
      const kind = m.type.name === 'suggestionInsert' ? 'inserted' : m.type.name === 'suggestionDelete' ? 'deleted' : null;
      if (!kind || !m.attrs.suggestionId) continue;
      let s = byId.get(m.attrs.suggestionId);
      if (!s) {
        s = { id: m.attrs.suggestionId, author: m.attrs.author, label: m.attrs.label, threadId: m.attrs.threadId, deleted: '', inserted: '', pos };
        byId.set(s.id, s);
      }
      s[kind] += node.text;
    }
    return false;
  });
  return [...byId.values()].sort((a, b) => a.pos - b.pos);
}

/**
 * Propose replacing [from, to) with `text`. Within one paragraph the new words
 * go inline right after the struck ones and keep their formatting; a range
 * across blocks gets its new words as paragraphs after the last block.
 */
export function proposeReplacement(editor: any, range: { from: number; to: number }, text: string, meta: SuggestionMeta = {}): string {
  const id = newSuggestionId();
  const { state } = editor;
  const schema = state.schema;
  const attrs = { suggestionId: id, author: meta.author ?? 'claude', label: meta.label ?? '', threadId: meta.threadId ?? null };
  const del = schema.marks.suggestionDelete.create(attrs);
  const ins = schema.marks.suggestionInsert.create(attrs);
  const anchor = meta.threadId ? schema.marks.commentAnchor?.create({ threadId: meta.threadId }) : null;

  const $from = state.doc.resolve(range.from);
  const $to = state.doc.resolve(range.to);
  const tr = state.tr.addMark(range.from, range.to, del);

  if ($from.sameParent($to)) {
    // Formatting of the last struck character, minus the suggestion/comment bookkeeping.
    const last = state.doc.nodeAt(Math.max(range.from, range.to - 1));
    let marks = (last?.marks ?? []).filter((m: any) => !['suggestionDelete', 'suggestionInsert', 'commentAnchor'].includes(m.type.name));
    marks = ins.addToSet(marks);
    if (anchor) marks = anchor.addToSet(marks);
    const inline = text.replace(/\s*\n+\s*/g, ' ').trim();
    tr.insert(range.to, schema.text(inline, marks));
  } else {
    const marks = anchor ? [ins, anchor] : [ins];
    const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
      .map((p) => schema.nodes.paragraph.create(null, schema.text(p, marks)));
    tr.insert($to.after($to.depth), paras);
  }
  editor.view.dispatch(tr.scrollIntoView());
  return id;
}

function settle(editor: any, id: string, keep: 'suggestionInsert' | 'suggestionDelete') {
  const drop = keep === 'suggestionInsert' ? 'suggestionDelete' : 'suggestionInsert';
  const { doc } = editor.state;
  const tr = editor.state.tr;
  // Unmark what stays (positions unchanged), then remove what goes, last first.
  for (const r of runs(doc, id, keep)) tr.removeMark(r.from, r.to, r.mark);
  const blocks = wholeBlocks(doc, id, drop);
  const inBlock = (r: Run) => blocks.some((b) => r.from >= b.from && r.to <= b.to);
  const cuts = [...blocks, ...runs(doc, id, drop).filter((r) => !inBlock(r))].sort((a, b) => b.from - a.from);
  for (const c of cuts) tr.delete(c.from, c.to);
  if (tr.docChanged) editor.view.dispatch(tr);
}

export const acceptSuggestion = (editor: any, id: string) => settle(editor, id, 'suggestionInsert');
export const rejectSuggestion = (editor: any, id: string) => settle(editor, id, 'suggestionDelete');

/** Scroll the suggestion into view. */
export function revealSuggestion(editor: any, id: string) {
  const r = runs(editor.state.doc, id, 'suggestionDelete')[0] || runs(editor.state.doc, id, 'suggestionInsert')[0];
  if (!r) return;
  const dom = editor.view.domAtPos(r.from)?.node as any;
  const el = dom?.nodeType === 3 ? dom.parentElement : dom;
  el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
}

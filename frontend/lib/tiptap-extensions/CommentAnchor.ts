/**
 * CommentAnchor — marks the words a comment thread is on (Claude Docs model).
 *
 * The mark carries only the thread id; the thread itself lives on the server
 * (/api/comments). Several threads may overlap (`excludes: ''`), and typing at
 * an edge does not grow the anchor (`inclusive: false`). Serialises to
 * `<span data-comment-id>` so it survives the HTML autosave and, via a
 * turndown keep rule, .md workspace files.
 */
import { Mark, mergeAttributes } from '@tiptap/core';

export const CommentAnchor = Mark.create({
  name: 'commentAnchor',
  inclusive: false,
  excludes: '',
  spanning: true,

  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-comment-id'),
        renderHTML: (a) => ({ 'data-comment-id': a.threadId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'comment-anchor' }), 0];
  },
});

export default CommentAnchor;

type Range = { from: number; to: number };

function anchorMarks(editor: any, threadId: string): Array<Range & { mark: any }> {
  const out: Array<Range & { mark: any }> = [];
  editor.state.doc.descendants((node: any, pos: number) => {
    if (!node.isText) return true;
    for (const mark of node.marks) {
      if (mark.type.name === 'commentAnchor' && mark.attrs.threadId === threadId) {
        out.push({ from: pos, to: pos + node.nodeSize, mark });
      }
    }
    return false;
  });
  return out;
}

/** The span a thread's anchor covers now, or null when its words are gone. */
export function findAnchor(editor: any, threadId: string): Range | null {
  const parts = anchorMarks(editor, threadId);
  if (!parts.length) return null;
  return { from: parts[0].from, to: parts[parts.length - 1].to };
}

/** Thread ids that still have words in the doc. */
export function anchoredThreadIds(editor: any): Set<string> {
  const ids = new Set<string>();
  editor.state.doc.descendants((node: any) => {
    if (!node.isText) return true;
    for (const m of node.marks) if (m.type.name === 'commentAnchor' && m.attrs.threadId) ids.add(m.attrs.threadId);
    return false;
  });
  return ids;
}

export function addAnchor(editor: any, range: Range, threadId: string) {
  const type = editor.schema.marks.commentAnchor;
  const tr = editor.state.tr.addMark(range.from, range.to, type.create({ threadId }));
  editor.view.dispatch(tr);
}

export function removeAnchor(editor: any, threadId: string) {
  const parts = anchorMarks(editor, threadId);
  if (!parts.length) return;
  const tr = editor.state.tr;
  for (const p of parts) tr.removeMark(p.from, p.to, p.mark);
  editor.view.dispatch(tr);
}

/**
 * Replace the words a thread is on, keeping the thread anchored to the new
 * words. Within one paragraph the new text keeps the first character's marks
 * (bold, link…); across blocks the range is replaced by plain paragraphs.
 * Returns false when the anchor is gone (the user deleted those words).
 */
export function replaceAnchorText(editor: any, threadId: string, text: string): boolean {
  const range = findAnchor(editor, threadId);
  if (!range) return false;
  const { state } = editor;
  const $from = state.doc.resolve(range.from);
  const $to = state.doc.resolve(range.to);
  const anchorMark = state.schema.marks.commentAnchor.create({ threadId });

  if ($from.sameParent($to) && !text.includes('\n\n')) {
    const first = state.doc.nodeAt(range.from);
    const marks = anchorMark.addToSet(first?.marks ?? []);
    const tr = state.tr.replaceWith(range.from, range.to, state.schema.text(text, marks));
    editor.view.dispatch(tr.scrollIntoView());
    return true;
  }
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => ({
    type: 'paragraph',
    content: [{ type: 'text', text: p, marks: [{ type: 'commentAnchor', attrs: { threadId } }] }],
  }));
  editor.chain().insertContentAt(range, paragraphs).run();
  return true;
}

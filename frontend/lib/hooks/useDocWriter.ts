/**
 * useDocWriter — Claude-Docs-style drafting for the dashboard editor.
 *
 *   draft(topic)  → POST /api/docs/outline → one PendingBlock per section
 *                   planted at the end of the doc → each filled in turn.
 *   fill(id)      → POST /api/docs/fill for one PendingBlock → its markdown
 *                   replaces the block.
 *
 * Filling runs one section at a time (a queue), so the user watches the doc
 * grow section by section. If the user deletes a pending block while it is
 * being written, the result is dropped: their edit wins.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { findPendingBlock, listPendingBlocks, newPendingId } from '@/lib/tiptap-extensions/PendingBlock';

export interface DraftOptions {
  topic: string;
  skillPrompt?: string;
  /** false → only plant the outline; the user fills sections by hand. */
  fillAll?: boolean;
}

export interface DocWriterState {
  busy: boolean;
  phase: 'idle' | 'outline' | 'filling';
  done: number;
  total: number;
  error: string | null;
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = localStorage.getItem('token');
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // no storage → guest call
  }
  const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body), signal });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = typeof data.detail === 'string' ? data.detail : data.message;
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Mark a pending block's transient status without creating an undo step. */
function setStatus(editor: any, id: string, status: string, error = '') {
  const hit = findPendingBlock(editor, id);
  if (!hit) return false;
  const tr = editor.state.tr.setNodeMarkup(hit.pos, undefined, { ...hit.node.attrs, status, error });
  tr.setMeta('addToHistory', false);
  editor.view.dispatch(tr);
  return true;
}

export function useDocWriter(editor: any, opts: { title?: string; insertTitle?: boolean }) {
  const [state, setState] = useState<DocWriterState>({ busy: false, phase: 'idle', done: 0, total: 0, error: null });
  const topicRef = useRef<string>('');
  const skillRef = useRef<string | undefined>(undefined);
  const titleRef = useRef(opts.title);
  titleRef.current = opts.title;
  const abortRef = useRef<AbortController | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const fillOne = useCallback(async (id: string, signal?: AbortSignal) => {
    if (!editor || editor.isDestroyed) return;
    const hit = findPendingBlock(editor, id);
    if (!hit) return;
    const { heading, intent } = hit.node.attrs;
    const outline = listPendingBlocks(editor).map(({ heading, intent }) => ({ heading: heading || intent, intent: intent || heading }));
    setStatus(editor, id, 'filling');
    try {
      const { markdown } = await post<{ markdown: string }>('/api/docs/fill', {
        topic: topicRef.current || titleRef.current || heading || intent,
        title: titleRef.current,
        heading: heading || intent,
        intent: intent || heading,
        outline,
        docText: editor.getText(),
        skillPrompt: skillRef.current,
      }, signal);
      if (editor.isDestroyed) return;
      const now = findPendingBlock(editor, id);
      if (!now) return; // deleted while writing → the user's edit wins
      const html = await marked.parse(markdown);
      editor.chain().insertContentAt({ from: now.pos, to: now.pos + now.node.nodeSize }, html).run();
    } catch (e: any) {
      if (editor.isDestroyed) return;
      if (e?.name === 'AbortError') setStatus(editor, id, 'idle');
      else setStatus(editor, id, 'error', e?.message || '生成失败');
      throw e;
    }
  }, [editor]);

  /** Queue a single section (from the block's own "写这一节" button). */
  const fill = useCallback((id: string) => {
    queueRef.current = queueRef.current
      .then(() => fillOne(id))
      .catch(() => { /* status already shown on the block */ });
  }, [fillOne]);

  // Hand the fill callback to the PendingBlock node views.
  useEffect(() => {
    if (!editor?.storage?.pendingBlock) return;
    editor.storage.pendingBlock.onFill = fill;
    return () => {
      if (editor.storage?.pendingBlock?.onFill === fill) editor.storage.pendingBlock.onFill = null;
    };
  }, [editor, fill]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const draft = useCallback(async ({ topic, skillPrompt, fillAll = true }: DraftOptions) => {
    if (!editor || state.busy) return;
    topicRef.current = topic.trim();
    skillRef.current = skillPrompt;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ busy: true, phase: 'outline', done: 0, total: 0, error: null });
    try {
      const existingText = editor.getText().trim();
      const outline = await post<{ title: string; sections: Array<{ heading: string; intent: string }> }>(
        '/api/docs/outline',
        { topic: topicRef.current, title: titleRef.current, existingText, skillPrompt },
        ctrl.signal,
      );
      if (editor.isDestroyed) return;
      const blocks = outline.sections.map((s) => ({
        type: 'pendingBlock',
        attrs: { id: newPendingId(), heading: s.heading, intent: s.intent },
      }));
      const ids = blocks.map((b) => b.attrs.id);
      // A DB article already shows its title above the editor; only title-less
      // docs (workspace .md files) get the outline's title as a heading.
      const withTitle = !existingText && opts.insertTitle !== false;
      const content = withTitle ? [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: outline.title }] }, ...blocks] : blocks;
      if (existingText) {
        editor.chain().insertContentAt(editor.state.doc.content.size, content).run();
      } else {
        editor.commands.setContent({ type: 'doc', content }, { emitUpdate: true });
      }
      if (!fillAll) {
        setState({ busy: false, phase: 'idle', done: 0, total: ids.length, error: null });
        return;
      }
      setState((s) => ({ ...s, phase: 'filling', total: ids.length }));
      for (let i = 0; i < ids.length; i++) {
        if (ctrl.signal.aborted) break;
        try {
          await fillOne(ids[i], ctrl.signal);
        } catch (e: any) {
          if (e?.name === 'AbortError') break;
          // one failed section stays as a pending block with "重试"; keep going
        }
        setState((s) => ({ ...s, done: i + 1 }));
      }
      setState((s) => ({ ...s, busy: false, phase: 'idle' }));
    } catch (e: any) {
      setState({ busy: false, phase: 'idle', done: 0, total: 0, error: e?.name === 'AbortError' ? null : (e?.message || '生成失败') });
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }, [editor, fillOne, state.busy]);

  return { ...state, draft, fill, stop };
}

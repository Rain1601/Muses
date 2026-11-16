/**
 * useComments — comment threads for the open doc, anchored to its words.
 *
 *   begin()                 capture the editor selection as a draft thread
 *   submitDraft(body, ai)   mark the words, create the thread, maybe ask Claude
 *   reply(id, body, ai)     add to a thread, maybe ask Claude
 *   askClaude(id)           Claude reads the thread and replies in it; if it
 *                           was asked to change the words, its rewrite lands
 *                           as a suggestion (struck + new words) to accept or
 *                           reject — never straight into the text
 *   setResolved / remove    resolve, reopen, delete (delete also unmarks)
 *
 * A thread whose words were deleted is "detached": it stays in the list with
 * its quoted text, like Claude Docs' Comments list.
 */
'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { addAnchor, anchoredThreadIds, findAnchor, removeAnchor, showCommentDraft } from '@/lib/tiptap-extensions/CommentAnchor';
import { clearPersistedSelection } from '@/lib/tiptap-extensions/SelectionPersistence';
import { listSuggestions, proposeReplacement, rejectSuggestion } from '@/lib/tiptap-extensions/Suggestion';

export interface DocComment {
  id: string;
  threadId: string;
  author: 'user' | 'claude';
  authorName?: string | null;
  body: string;
  toClaude?: boolean;
  createdAt?: string;
}

export interface DocThread {
  id: string;
  anchorText?: string | null;
  resolved: boolean;
  createdAt?: string;
  comments: DocComment[];
}

export interface DraftThread {
  from: number;
  to: number;
  text: string;
}

class CommentRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const MUSES_MENTION = /@(?:muses|claude)\b/i;
export const mentionsMuses = (body: string) => MUSES_MENTION.test(body);

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const token = localStorage.getItem('token');
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // guest
  }
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new CommentRequestError((typeof data.detail === 'string' && data.detail) || data.message || `HTTP ${res.status}`, res.status);
  }
  return res.json();
}

const newThreadId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function useComments(docKey: string | null, editor: any) {
  const [threads, setThreads] = useState<DocThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDraft, setDraft] = useState<(DraftThread & { id: string; editor: Editor }) | null>(null);
  const draft = currentDraft?.editor === editor ? currentDraft : null;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [claudeBusy, setClaudeBusy] = useState<Set<string>>(new Set());
  const [notices, setNotices] = useState<Record<string, string>>({});
  const [anchored, setAnchored] = useState<Set<string>>(new Set());
  const docKeyRef = useRef(docKey);
  docKeyRef.current = docKey;

  useLayoutEffect(() => {
    if (editor && !editor.isDestroyed) showCommentDraft(editor, draft);
  }, [draft, editor]);

  // Load threads for this doc.
  useEffect(() => {
    setThreads([]); setDraft(null); setActiveId(null); setNotices({}); setError(null);
    if (!docKey) return;
    let cancelled = false;
    setLoading(true);
    request<DocThread[]>('GET', `/api/comments?docKey=${encodeURIComponent(docKey)}`)
      .then((t) => { if (!cancelled) setThreads(t); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [docKey]);

  // Track which threads still have words in the doc; clicking an anchor activates its thread.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const refresh = () => setAnchored(anchoredThreadIds(editor));
    const mapDraft = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.docChanged) return;
      setDraft((current) => {
        if (!current || current.editor !== editor) return current;
        const from = transaction.mapping.map(current.from, 1);
        const to = Math.max(from, transaction.mapping.map(current.to, -1));
        const text = transaction.doc.textBetween(from, to, ' ').trim();
        return from === current.from && to === current.to && text === current.text ? current : { ...current, from, to, text };
      });
    };
    refresh();
    editor.on('update', refresh);
    editor.on('transaction', mapDraft);
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-comment-id]') as HTMLElement | null;
      if (el) setActiveId(el.getAttribute('data-comment-id'));
    };
    const dom = editor.view.dom as HTMLElement;
    dom.addEventListener('click', onClick);
    return () => {
      editor.off('update', refresh);
      editor.off('transaction', mapDraft);
      dom.removeEventListener('click', onClick);
    };
  }, [editor]);

  const patchThread = (id: string, fn: (t: DocThread) => DocThread) =>
    setThreads((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));

  const begin = useCallback((): boolean => {
    if (!editor || editor.isDestroyed || draft) return false;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ').trim();
    if (from === to || !text) return false;
    editor.commands.setTextSelection(from);
    clearPersistedSelection(editor);
    setError(null);
    setDraft({ from, to, text, id: newThreadId(), editor });
    setActiveId(null);
    return true;
  }, [draft, editor]);

  const cancelDraft = useCallback(() => {
    setDraft(null);
    setError(null);
    if (!editor || editor.isDestroyed || !draft) return;
    clearPersistedSelection(editor);
    editor.chain().setTextSelection({ from: draft.from, to: draft.to }).focus(undefined, { scrollIntoView: false }).run();
  }, [draft, editor]);

  /** The anchor's words as they read now, leaving out words struck by an open suggestion. */
  const anchorWordsNow = (threadId: string): string | null => {
    const r = findAnchor(editor, threadId);
    if (!r) return null;
    let text = '';
    editor.state.doc.nodesBetween(r.from, r.to, (node: any, pos: number) => {
      if (!node.isText) return true;
      if (node.marks.some((m: any) => m.type.name === 'suggestionDelete')) return false;
      const a = Math.max(r.from, pos) - pos;
      const b = Math.min(r.to, pos + node.nodeSize) - pos;
      text += node.text.slice(a, b);
      return false;
    });
    return text;
  };

  const askClaude = useCallback(async (threadId: string, label?: string) => {
    if (!editor) return;
    setClaudeBusy((s) => new Set(s).add(threadId));
    setNotices((n) => { const { [threadId]: _, ...rest } = n; return rest; });
    try {
      const res = await request<{ comment: DocComment; replacement: string | null }>(
        'POST', `/api/comments/threads/${threadId}/claude`,
        { docText: editor.getText(), anchorText: anchorWordsNow(threadId) ?? undefined });
      patchThread(threadId, (t) => ({ ...t, comments: [...t.comments, res.comment] }));
      if (res.replacement && !editor.isDestroyed) {
        // One open suggestion per thread: withdraw the previous one, then propose anew.
        for (const sg of listSuggestions(editor)) if (sg.threadId === threadId) rejectSuggestion(editor, sg.id);
        const range = findAnchor(editor, threadId);
        if (!range) setNotices((n) => ({ ...n, [threadId]: '原文已不在文档里，没有修改' }));
        else proposeReplacement(editor, range, res.replacement, { author: 'claude', label: label?.slice(0, 80), threadId });
      }
    } catch (e: any) {
      setNotices((n) => ({ ...n, [threadId]: `Muses 回复失败：${e.message}` }));
    } finally {
      setClaudeBusy((s) => { const next = new Set(s); next.delete(threadId); return next; });
    }
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Start a thread on a range (the draft, or ⌘K's selection) and maybe ask Claude. */
  const createThread = useCallback(async (d: DraftThread, body: string, toClaude: boolean, id = newThreadId()) => {
    if (!docKey || !editor || editor.isDestroyed || !body.trim()) return false;
    const trimmedBody = body.trim();
    setError(null);
    // Mark first so the anchor follows edits made while the request is in flight.
    addAnchor(editor, d, id);
    try {
      const c = await request<DocComment>('POST', '/api/comments', {
        docKey, id, body: trimmedBody, anchorText: d.text, toClaude,
      }).catch(async (failure: unknown) => {
        if (!(failure instanceof CommentRequestError) || failure.status !== 409) throw failure;
        const saved = (await request<DocThread[]>('GET', `/api/comments?docKey=${encodeURIComponent(docKey)}`))
          .find((thread) => thread.id === id)?.comments[0];
        if (!saved) throw failure;
        if (saved.body !== trimmedBody || !!saved.toClaude !== toClaude) {
          throw new Error('上次的评论已保存。请复制修改后的内容，取消草稿后重新评论。');
        }
        return saved;
      });
      if (docKeyRef.current !== docKey) return false;
      setThreads((ts) => ts.some((t) => t.id === id) ? ts :
        [...ts, { id, anchorText: d.text, resolved: false, createdAt: c.createdAt, comments: [c] }]);
      setActiveId(id);
      if (toClaude) void askClaude(id, trimmedBody);
      return true;
    } catch (e: any) {
      if (!editor.isDestroyed) removeAnchor(editor, id);
      if (docKeyRef.current === docKey) setError(`评论失败：${e.message}`);
      return false;
    }
  }, [askClaude, docKey, editor]);

  const submitDraft = useCallback(async (body: string, toClaude: boolean) => {
    if (!draft || !editor || editor.isDestroyed) return false;
    const text = editor.state.doc.textBetween(draft.from, draft.to, ' ').trim();
    if (!text) {
      setError('选中的文字已删除。请取消后重新选择。');
      return false;
    }
    if (!(await createThread({ ...draft, text }, body, toClaude, draft.id))) return false;
    setDraft((current) => current?.id === draft.id ? null : current);
    if (!editor.isDestroyed) clearPersistedSelection(editor);
    return true;
  }, [createThread, draft, editor]);

  const reply = useCallback(async (threadId: string, body: string, toClaude: boolean) => {
    if (!docKey || !body.trim()) return false;
    setNotices((n) => { const { [threadId]: _, ...rest } = n; return rest; });
    try {
      const c = await request<DocComment>('POST', '/api/comments', { docKey, threadId, body: body.trim(), toClaude });
      if (docKeyRef.current !== docKey) return false;
      patchThread(threadId, (t) => ({ ...t, comments: [...t.comments, c] }));
      if (toClaude) void askClaude(threadId, body.trim());
      return true;
    } catch (e: any) {
      if (docKeyRef.current === docKey) setNotices((n) => ({ ...n, [threadId]: `回复失败：${e.message}` }));
      return false;
    }
  }, [askClaude, docKey]);

  const setResolved = useCallback(async (threadId: string, resolved: boolean) => {
    try {
      const t = await request<DocThread>('PATCH', `/api/comments/threads/${threadId}`, { resolved });
      patchThread(threadId, (old) => ({ ...old, resolved: t.resolved }));
      if (resolved && activeId === threadId) setActiveId(null);
    } catch (e: any) {
      setNotices((n) => ({ ...n, [threadId]: e.message }));
    }
  }, [activeId]);

  const remove = useCallback(async (threadId: string) => {
    try {
      await request('DELETE', `/api/comments/threads/${threadId}`);
      setThreads((ts) => ts.filter((t) => t.id !== threadId));
      if (editor && !editor.isDestroyed) removeAnchor(editor, threadId);
    } catch (e: any) {
      setNotices((n) => ({ ...n, [threadId]: e.message }));
    }
  }, [editor]);

  const focusThread = useCallback((threadId: string) => {
    setActiveId(threadId);
    if (!editor || editor.isDestroyed) return;
    editor.view.dom.querySelector(`[data-comment-id="${CSS.escape(threadId)}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [editor]);

  const closeThread = useCallback(() => {
    setActiveId(null);
    editor?.commands.focus(undefined, { scrollIntoView: false });
  }, [editor]);

  /** The words a thread is on now (they change when Claude or the user edits them). */
  const currentText = useCallback((threadId: string): string | null => {
    if (!editor || editor.isDestroyed) return null;
    return anchorWordsNow(threadId);
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = useMemo(() => threads.filter((t) => !t.resolved), [threads]);
  const resolvedThreads = useMemo(() => threads.filter((t) => t.resolved), [threads]);

  return {
    threads, open, resolvedThreads, loading, error, draft, activeId, claudeBusy, notices, anchored,
    begin, cancelDraft, submitDraft, createThread, reply, askClaude, setResolved, remove,
    focusThread, setActiveId, closeThread, currentText,
  };
}

export type CommentsApi = ReturnType<typeof useComments>;

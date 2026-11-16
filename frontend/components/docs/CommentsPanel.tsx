'use client';

/**
 * CommentsPanel — the right rail's comment threads (Claude Docs model).
 * Threads are anchored to words in the doc; a comment that mentions @Muses
 * (or is sent with the Muses toggle on) gets a reply in the thread,
 * and a requested rewrite lands as a suggestion: the old words struck, the new
 * ones inserted, until someone accepts or rejects it (here or on its card).
 */
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import type { Editor } from '@tiptap/core';
import { X } from 'lucide-react';
import type { CommentsApi, DraftThread, DocThread } from '@/lib/hooks/useComments';
import type { SuggestionsApi } from '@/lib/hooks/useSuggestions';
import type { SuggestionInfo } from '@/lib/tiptap-extensions/Suggestion';
import { mentionsMuses } from '@/lib/hooks/useComments';

function Composer({
  placeholder, submitLabel, autoFocus, onSubmit, onCancel,
}: {
  placeholder: string;
  submitLabel: string;
  autoFocus?: boolean;
  onSubmit: (body: string, askMuses: boolean) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState('');
  const [askMuses, setAskMuses] = useState(false);
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  const willAsk = askMuses || mentionsMuses(body);
  const send = async () => {
    if (sending || !body.trim()) return;
    setSending(true);
    try {
      if (await onSubmit(body, willAsk)) {
        setBody('');
        setAskMuses(false);
      }
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="cm-composer">
      <textarea
        ref={ref}
        className="cm-input"
        rows={2}
        placeholder={placeholder}
        value={body}
        readOnly={sending}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
          if (e.key === 'Escape' && onCancel && !sending) { e.preventDefault(); onCancel(); }
        }}
      />
      <div className="cm-row">
        <button
          type="button"
          className={`cm-chip${willAsk ? ' on' : ''}`}
          aria-pressed={willAsk}
          disabled={sending}
          onClick={() => setAskMuses((v) => !v)}
          title="请 Muses 回复或建议修改"
        >
          @Muses
        </button>
        <span className="cm-spacer" />
        {onCancel && <button type="button" className="cm-btn" disabled={sending} onClick={onCancel}>取消</button>}
        <button type="button" className="cm-btn primary" disabled={sending || !body.trim()} onClick={send}>
          {sending ? '发送中…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

function SuggestionDiff({ sg }: { sg: SuggestionInfo }) {
  return (
    <div className="sg-diff">
      {sg.deleted && <span className="sg-old">{sg.deleted}</span>}
      {sg.inserted && <span className="sg-new">{sg.inserted}</span>}
    </div>
  );
}

function SuggestionCard({ sg, sugs, threads }: { sg: SuggestionInfo; sugs: SuggestionsApi; threads: CommentsApi }) {
  const active = sugs.activeId === sg.id;
  return (
    <div className={`cm-thread sg-card${active ? ' active' : ''}`} onClick={() => sugs.reveal(sg.id)}>
      <div className="cm-author">
        <span className="cm-spark">✦</span> {sg.author === 'claude' ? 'Muses' : sg.author} 建议
        {sg.label && <span className="sg-label">· {sg.label}</span>}
      </div>
      <SuggestionDiff sg={sg} />
      <div className="cm-row" onClick={(e) => e.stopPropagation()}>
        {sg.threadId && threads.threads.some((t) => t.id === sg.threadId) && (
          <button type="button" className="cm-link" onClick={() => threads.focusThread(sg.threadId!)}>查看线程</button>
        )}
        <span className="cm-spacer" />
        <button type="button" className="cm-btn" onClick={() => sugs.reject(sg.id)}>拒绝</button>
        <button type="button" className="cm-btn primary" onClick={() => sugs.accept(sg.id)}>接受</button>
      </div>
    </div>
  );
}

function ThreadCard({ t, api, detached, sugs, inlineStyle, cardRef }: {
  t: DocThread;
  api: CommentsApi;
  detached: boolean;
  sugs: SuggestionsApi;
  inlineStyle?: CSSProperties;
  cardRef?: RefObject<HTMLDivElement>;
}) {
  const pending = sugs.items.filter((sg) => sg.threadId === t.id);
  const active = api.activeId === t.id;
  const busy = api.claudeBusy.has(t.id);
  const notice = api.notices[t.id];
  return (
    <div
      ref={cardRef}
      className={`cm-thread${active ? ' active' : ''}${t.resolved ? ' resolved' : ''}${inlineStyle ? ' cm-thread-inline' : ''}`}
      style={inlineStyle}
      role={inlineStyle ? 'region' : undefined}
      aria-label={inlineStyle ? '正文旁的评论线程' : undefined}
      onClick={() => api.focusThread(t.id)}
      onKeyDown={(e) => { if (active && e.key === 'Escape') { e.stopPropagation(); api.closeThread(); } }}
    >
      <div className="cm-thread-heading">
        <button type="button" className={`cm-quote cm-quote-trigger${detached ? ' detached' : ''}`} title={detached ? '这段文字已从文档删除' : undefined}>
          {(!detached && api.currentText(t.id)) || t.anchorText}
        </button>
        {inlineStyle && <button type="button" aria-label="关闭评论线程" className="cm-link" onClick={(e) => { e.stopPropagation(); api.closeThread(); }}><X className="size-4" /></button>}
      </div>
      {detached && !t.resolved && <div className="cm-meta">原文已删除</div>}
      {t.comments.map((c) => (
        <div key={c.id} className={`cm-comment${c.author === 'claude' ? ' claude' : ''}`}>
          <div className="cm-author">
            {c.author === 'claude' ? <><span className="cm-spark">✦</span> Muses</> : (c.authorName || '我')}
          </div>
          <div className="cm-body">{c.body}</div>
        </div>
      ))}
      {busy && <div className="cm-comment claude"><div className="cm-author"><span className="cm-spinner" /> Muses 正在回复…</div></div>}
      {notice && <div className="cm-notice">{notice}</div>}
      {pending.map((sg) => (
        <div key={sg.id} className="sg-inline" onClick={(e) => e.stopPropagation()}>
          <div className="cm-meta">待处理的建议</div>
          <SuggestionDiff sg={sg} />
          <div className="cm-row">
            <span className="cm-spacer" />
            <button type="button" className="cm-btn" onClick={() => sugs.reject(sg.id)}>拒绝</button>
            <button type="button" className="cm-btn primary" onClick={() => sugs.accept(sg.id)}>接受</button>
          </div>
        </div>
      ))}
      {active && !t.resolved && (
        <div onClick={(e) => e.stopPropagation()}>
          <Composer placeholder="回复，或 @Muses 让它改这段" submitLabel="回复" onSubmit={(b, ai) => api.reply(t.id, b, ai)} />
        </div>
      )}
      <div className="cm-actions" onClick={(e) => e.stopPropagation()}>
        {t.resolved ? (
          <button type="button" className="cm-link" onClick={() => api.setResolved(t.id, false)}>重新打开</button>
        ) : (
          <button type="button" className="cm-link" onClick={() => api.setResolved(t.id, true)}>解决</button>
        )}
        <button type="button" className="cm-link danger" onClick={() => api.remove(t.id)}>删除</button>
      </div>
    </div>
  );
}

function useInlineCommentPosition(
  editor: Editor | null,
  scrollArea: HTMLElement | null,
  gutter: HTMLElement | null,
  cardRef: RefObject<HTMLDivElement>,
  draft: DraftThread | null,
  threadId: string | null,
) {
  const [position, setPosition] = useState<{ left: number; width: number; top: number; maxHeight: number; hidden: boolean }>();

  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed || !scrollArea || !gutter || (!draft && !threadId)) {
      setPosition(undefined);
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const column = gutter.getBoundingClientRect();
      if (!column.width || editor.isDestroyed || (draft && draft.from === draft.to)) {
        setPosition(undefined);
        return;
      }
      const viewport = scrollArea.getBoundingClientRect();
      const marks = threadId && editor.view.dom.querySelectorAll(`[data-comment-id="${CSS.escape(threadId)}"]`);
      const first = marks && marks[0];
      const last = marks && marks[marks.length - 1];
      const start = draft ? editor.view.coordsAtPos(draft.from) : first && first.getClientRects()[0];
      const end = draft ? editor.view.coordsAtPos(draft.to, -1) : last && last.getBoundingClientRect();
      if (!start || !end) {
        setPosition(undefined);
        return;
      }

      const maxHeight = viewport.height;
      const height = Math.min(cardRef.current?.offsetHeight ?? 0, maxHeight);
      const next = {
        left: column.left,
        width: column.width,
        top: Math.max(viewport.top, Math.min(start.top, viewport.bottom - height)),
        maxHeight,
        hidden: !draft && (end.bottom <= viewport.top || start.top >= viewport.bottom),
      };
      setPosition((previous) => previous && previous.left === next.left && previous.width === next.width &&
        previous.top === next.top && previous.maxHeight === next.maxHeight && previous.hidden === next.hidden ? previous : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };

    update();
    const observer = new ResizeObserver(schedule);
    observer.observe(scrollArea);
    observer.observe(gutter);
    observer.observe(editor.view.dom);
    if (cardRef.current) observer.observe(cardRef.current);
    scrollArea.addEventListener('scroll', schedule, { capture: true, passive: true });
    editor.on('update', schedule);
    return () => {
      observer.disconnect();
      scrollArea.removeEventListener('scroll', schedule, true);
      editor.off('update', schedule);
      cancelAnimationFrame(frame);
    };
  }, [cardRef, draft, editor, gutter, scrollArea, threadId]);

  if (!position) return undefined;
  const { hidden, ...rect } = position;
  return { ...rect, visibility: hidden ? 'hidden' : undefined } satisfies CSSProperties;
}

export default function CommentsPanel({ api, suggestions, editor, scrollArea, gutter }: {
  api: CommentsApi;
  suggestions: SuggestionsApi;
  editor: Editor | null;
  scrollArea: HTMLElement | null;
  gutter: HTMLElement | null;
}) {
  const [showResolved, setShowResolved] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const activeThreadId = !api.draft && api.activeId && api.anchored.has(api.activeId) &&
    api.open.some((thread) => thread.id === api.activeId) ? api.activeId : null;
  const inlineStyle = useInlineCommentPosition(editor, scrollArea, gutter, cardRef, api.draft, activeThreadId);
  useEffect(() => {
    if (activeThreadId && !gutter?.getBoundingClientRect().width) {
      cardRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [activeThreadId, gutter]);

  // Highlight: open threads tinted, the active one stronger, resolved ones plain.
  const css = [
    ...api.resolvedThreads.map((t) => `.comment-anchor[data-comment-id="${t.id}"]{background:none!important;border-bottom:none!important}`),
    api.activeId ? `.comment-anchor[data-comment-id="${api.activeId}"]{background:#d9714940!important;border-bottom-color:#d97149!important}` : '',
    suggestions.activeId ? `[data-suggestion-id="${suggestions.activeId}"]{outline:1px solid #d97149;outline-offset:1px;border-radius:2px}` : '',
  ].join('\n');

  return (
    <div className="cm-panel">
      <style>{css}</style>
      <div className="cm-header">
        <span className="cm-title">评论与建议</span>
        <span className="cm-count">{api.open.length + suggestions.items.length || ''}</span>
        <span className="cm-spacer" />
        <button
          type="button"
          className="cm-btn"
          disabled={!editor || !!api.draft}
          onClick={() => api.begin()}
          title="选中文字后评论（⌘⇧M）"
        >
          + 评论所选
        </button>
      </div>
      <div className="cm-list">
        {!api.draft && api.error && <div className="cm-notice" role="alert">{api.error}</div>}
        {suggestions.items.length > 1 && (
          <div className="cm-row sg-bulk">
            <span className="cm-meta" style={{ margin: 0 }}>{suggestions.items.length} 条建议</span>
            <span className="cm-spacer" />
            <button type="button" className="cm-link" onClick={suggestions.rejectAll}>全部拒绝</button>
            <button type="button" className="cm-link" onClick={suggestions.acceptAll}>全部接受</button>
          </div>
        )}
        {suggestions.items
          .filter((sg) => !sg.threadId || !api.open.some((t) => t.id === sg.threadId))
          .map((sg) => <SuggestionCard key={sg.id} sg={sg} sugs={suggestions} threads={api} />)}
        {api.draft && (
          <div key={api.draft.id} ref={cardRef} className={`cm-thread active${inlineStyle ? ' cm-thread-inline' : ''}`}
            style={inlineStyle} role={inlineStyle ? 'region' : undefined} aria-label={inlineStyle ? '正文旁的新评论' : undefined}>
            <div className="cm-quote">{api.draft.text || '选中的文字已删除'}</div>
            <Composer
              autoFocus
              placeholder="写评论，或 @Muses 让它回答或改这段"
              submitLabel="评论"
              onSubmit={api.submitDraft}
              onCancel={api.cancelDraft}
            />
            {api.error && <div className="cm-notice" role="alert">{api.error}</div>}
          </div>
        )}
        {api.open.map((t) => (
          <Fragment key={t.id}>
            {activeThreadId === t.id && inlineStyle && (
              <button type="button" className="cm-thread cm-thread-preview active" aria-current="true" onClick={() => api.focusThread(t.id)}>
                <span className="cm-quote">{api.currentText(t.id) || t.anchorText}</span>
                <span className="cm-body line-clamp-2">{t.comments[0]?.body}</span>
              </button>
            )}
            <ThreadCard t={t} api={api} sugs={suggestions} detached={!api.anchored.has(t.id)}
              cardRef={activeThreadId === t.id ? cardRef : undefined}
              inlineStyle={activeThreadId === t.id ? inlineStyle : undefined} />
          </Fragment>
        ))}
        {!api.draft && !api.open.length && !suggestions.items.length && !api.loading && (
          <div className="cm-empty">
            <div className="cm-empty-title">还没有评论</div>
            <div>选中文字后点「评论」，或按 <kbd>⌘⇧M</kbd>。<br />在评论里写 @Muses 可以请它回复或建议修改。</div>
          </div>
        )}
        {api.resolvedThreads.length > 0 && (
          <div className="cm-resolved">
            <button type="button" className="cm-link" onClick={() => setShowResolved((v) => !v)}>
              {showResolved ? '▾' : '▸'} 已解决 {api.resolvedThreads.length}
            </button>
            {showResolved && api.resolvedThreads.map((t) => (
              <ThreadCard key={t.id} t={t} api={api} sugs={suggestions} detached={!api.anchored.has(t.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

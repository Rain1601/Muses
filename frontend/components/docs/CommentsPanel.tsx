'use client';

/**
 * CommentsPanel — the right rail's comment threads (Claude Docs model).
 * Laid out as a margin: each card sits level with the words it is anchored to,
 * follows the editor as it scrolls, and lights up together with those words.
 * Threads are anchored to words in the doc; a comment that mentions @Muses
 * (or is sent with the Muses toggle on) gets a reply in the thread,
 * and a requested rewrite lands as a suggestion: the old words struck, the new
 * ones inserted, until someone accepts or rejects it (here or on its card).
 */
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Editor } from '@tiptap/core';
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

/* ── Margin layout ──────────────────────────────────────────────
   Every open card sits level with the words it is anchored to and follows
   the editor as it scrolls. Overlapping cards push each other apart; the
   active card keeps its exact spot and the others make room around it. */

type MarginItem =
  | { key: string; kind: 'draft' }
  | { key: string; kind: 'thread'; id: string }
  | { key: string; kind: 'suggestion'; id: string };

const GAP = 8;

function anchorTop(editor: Editor, item: MarginItem, draft: DraftThread | null): number | null {
  const dom = editor.view.dom as HTMLElement;
  try {
    if (item.kind === 'draft') return draft ? editor.view.coordsAtPos(draft.from).top : null;
    const sel = item.kind === 'thread'
      ? `[data-comment-id="${CSS.escape(item.id)}"]`
      : `[data-suggestion-id="${CSS.escape(item.id)}"]`;
    const el = dom.querySelector(sel);
    const rect = el?.getClientRects()[0];
    return rect ? rect.top : null;
  } catch {
    return null;
  }
}

function useMarginLayout(
  editor: Editor | null,
  scrollArea: HTMLElement | null,
  container: HTMLElement | null,
  items: MarginItem[],
  activeKey: string | null,
  draft: DraftThread | null,
  cards: Map<string, HTMLElement>,
) {
  const [tops, setTops] = useState<Record<string, number>>({});
  const itemsKey = items.map((i) => i.key).join('|');

  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed || !container || !scrollArea) { setTops({}); return; }
    let frame = 0;

    const compute = () => {
      frame = 0;
      if (editor.isDestroyed) return;
      const base = container.getBoundingClientRect().top;
      const placed = items
        .map((item, order) => {
          const top = anchorTop(editor, item, draft);
          return top == null ? null : { key: item.key, want: top - base, h: cards.get(item.key)?.offsetHeight ?? 0, order };
        })
        .filter((x): x is { key: string; want: number; h: number; order: number } => !!x)
        .sort((a, b) => a.want - b.want || a.order - b.order);

      const next: Record<string, number> = {};
      const pivot = placed.findIndex((p) => p.key === activeKey);
      if (pivot >= 0) {
        // The active card follows its words but never leaves the margin, so its reply box and buttons stay reachable.
        const room = container.clientHeight - placed[pivot].h;
        next[placed[pivot].key] = room > 0 ? Math.min(Math.max(placed[pivot].want, 0), room) : 0;
        for (let i = pivot + 1; i < placed.length; i++) {
          const prev = placed[i - 1];
          next[placed[i].key] = Math.max(placed[i].want, next[prev.key] + prev.h + GAP);
        }
        for (let i = pivot - 1; i >= 0; i--) {
          const below = placed[i + 1];
          next[placed[i].key] = Math.min(placed[i].want, next[below.key] - placed[i].h - GAP);
        }
      } else {
        let floor = -Infinity;
        for (const p of placed) {
          next[p.key] = Math.max(p.want, floor);
          floor = next[p.key] + p.h + GAP;
        }
      }
      setTops((prev) => {
        const keys = Object.keys(next);
        const same = keys.length === Object.keys(prev).length && keys.every((k) => Math.abs((prev[k] ?? NaN) - next[k]) < 0.5);
        return same ? prev : next;
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(compute); };

    compute();
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    observer.observe(editor.view.dom);
    cards.forEach((el) => observer.observe(el));
    scrollArea.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    editor.on('update', schedule);
    return () => {
      observer.disconnect();
      scrollArea.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      editor.off('update', schedule);
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, scrollArea, container, itemsKey, activeKey, draft]);

  return tops;
}

function SuggestionCard({ sg, sugs, threads, hovered, onHover }: {
  sg: SuggestionInfo; sugs: SuggestionsApi; threads: CommentsApi; hovered: boolean; onHover: (on: boolean) => void;
}) {
  const active = sugs.activeId === sg.id;
  return (
    <div className={`cm-thread sg-card${active ? ' active' : ''}${hovered ? ' hover' : ''}`}
      onClick={() => { threads.setActiveId(null); sugs.reveal(sg.id); }}
      onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
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

function CommentItem({ c }: { c: DocThread['comments'][number] }) {
  return (
    <div className={`cm-comment${c.author === 'claude' ? ' claude' : ''}`}>
      <div className="cm-author">
        {c.author === 'claude' ? <><span className="cm-spark">✦</span> Muses</> : (c.authorName || '我')}
      </div>
      <div className="cm-body">{c.body}</div>
    </div>
  );
}

function ThreadCard({ t, api, detached, sugs, inMargin, hovered, onHover }: {
  t: DocThread;
  api: CommentsApi;
  detached: boolean;
  sugs: SuggestionsApi;
  /** In the margin the card sits beside its words, so the quote is left out. */
  inMargin?: boolean;
  hovered?: boolean;
  onHover?: (on: boolean) => void;
}) {
  const pending = sugs.items.filter((sg) => sg.threadId === t.id);
  const active = api.activeId === t.id;
  const busy = api.claudeBusy.has(t.id);
  const notice = api.notices[t.id];
  // Inactive margin cards stay compact: first comment, a reply count, the latest reply.
  const compact = inMargin && !active;
  const shown = compact && t.comments.length > 2 ? [t.comments[0], t.comments[t.comments.length - 1]] : t.comments;
  const hidden = t.comments.length - shown.length;
  return (
    <div
      className={`cm-thread${active ? ' active' : ''}${t.resolved ? ' resolved' : ''}${hovered ? ' hover' : ''}${compact ? ' compact' : ''}`}
      onClick={() => { sugs.setActiveId(null); api.focusThread(t.id); }}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      onKeyDown={(e) => { if (active && e.key === 'Escape') { e.stopPropagation(); api.closeThread(); } }}
    >
      {!inMargin && (
        <div className="cm-thread-heading">
          <button type="button" className={`cm-quote cm-quote-trigger${detached ? ' detached' : ''}`} title={detached ? '这段文字已从文档删除' : undefined}>
            {(!detached && api.currentText(t.id)) || t.anchorText}
          </button>
        </div>
      )}
      {detached && !t.resolved && <div className="cm-meta">原文已删除</div>}
      {shown.map((c, i) => (
        <Fragment key={c.id}>
          {i === 1 && hidden > 0 && <div className="cm-more">另有 {hidden} 条回复</div>}
          <CommentItem c={c} />
        </Fragment>
      ))}
      {busy && <div className="cm-comment claude"><div className="cm-author"><span className="cm-spinner" /> Muses 正在处理…</div></div>}
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
      {(!compact || hovered) && (
        <div className="cm-actions" onClick={(e) => e.stopPropagation()}>
          {t.resolved ? (
            <button type="button" className="cm-link" onClick={() => api.setResolved(t.id, false)}>重新打开</button>
          ) : (
            <button type="button" className="cm-link" onClick={() => api.setResolved(t.id, true)}>解决</button>
          )}
          <button type="button" className="cm-link danger" onClick={() => api.remove(t.id)}>删除</button>
        </div>
      )}
    </div>
  );
}

export default function CommentsPanel({ api, suggestions, editor, scrollArea }: {
  api: CommentsApi;
  suggestions: SuggestionsApi;
  editor: Editor | null;
  scrollArea: HTMLElement | null;
}) {
  const [showResolved, setShowResolved] = useState(false);
  const [hover, setHover] = useState<string | null>(null); // margin key: thread:<id> / sg:<id>
  const [margin, setMargin] = useState<HTMLDivElement | null>(null);
  const cards = useRef(new Map<string, HTMLElement>()).current;

  const standalone = suggestions.items.filter((sg) => !sg.threadId || !api.open.some((t) => t.id === sg.threadId));
  const anchoredOpen = api.open.filter((t) => api.anchored.has(t.id));
  const detachedOpen = api.open.filter((t) => !api.anchored.has(t.id));

  const items: MarginItem[] = [
    ...(api.draft ? [{ key: 'draft', kind: 'draft' as const }] : []),
    ...anchoredOpen.map((t) => ({ key: `thread:${t.id}`, kind: 'thread' as const, id: t.id })),
    ...standalone.map((sg) => ({ key: `sg:${sg.id}`, kind: 'suggestion' as const, id: sg.id })),
  ];
  const activeKey = api.draft ? 'draft'
    : api.activeId && anchoredOpen.some((t) => t.id === api.activeId) ? `thread:${api.activeId}`
    : suggestions.activeId ? `sg:${suggestions.activeId}` : null;

  const tops = useMarginLayout(editor, scrollArea, margin, items, activeKey, api.draft, cards);
  const setCard = (key: string) => (el: HTMLDivElement | null) => { if (el) cards.set(key, el); else cards.delete(key); };

  // Hovering the words lights up their card (and the card lights up the words, via the CSS below).
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const dom = editor.view.dom as HTMLElement;
    const keyAt = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      const sg = el?.closest?.('[data-suggestion-id]');
      if (sg) return `sg:${sg.getAttribute('data-suggestion-id')}`;
      const cm = el?.closest?.('[data-comment-id]');
      return cm ? `thread:${cm.getAttribute('data-comment-id')}` : null;
    };
    const onOver = (e: MouseEvent) => setHover(keyAt(e.target));
    const onLeave = () => setHover(null);
    const onClick = (e: MouseEvent) => {
      const key = keyAt(e.target);
      if (key?.startsWith('sg:')) { api.setActiveId(null); suggestions.setActiveId(key.slice(3)); }
      else if (key?.startsWith('thread:')) suggestions.setActiveId(null);
    };
    dom.addEventListener('mouseover', onOver);
    dom.addEventListener('mouseleave', onLeave);
    dom.addEventListener('click', onClick);
    return () => {
      dom.removeEventListener('mouseover', onOver);
      dom.removeEventListener('mouseleave', onLeave);
      dom.removeEventListener('click', onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Scrolling over the margin scrolls the document (cards follow it), unless a tall card can scroll itself.
  const onWheel = (e: React.WheelEvent) => {
    const card = (e.target as HTMLElement).closest('.cm-thread') as HTMLElement | null;
    if (card && card.scrollHeight > card.clientHeight) return;
    scrollArea?.scrollBy({ top: e.deltaY });
  };

  const esc = (id: string) => CSS.escape(id);
  const hoverId = hover?.split(':').slice(1).join(':');
  const css = [
    ...api.resolvedThreads.map((t) => `.comment-anchor[data-comment-id="${esc(t.id)}"]{background:none!important;border-bottom:none!important}`),
    hover?.startsWith('thread:') && hoverId !== api.activeId ? `.comment-anchor[data-comment-id="${esc(hoverId!)}"]{background:#d9714930!important}` : '',
    api.activeId ? `.comment-anchor[data-comment-id="${esc(api.activeId)}"]{background:#d9714948!important;border-bottom-color:#d97149!important}` : '',
    hover?.startsWith('sg:') ? `[data-suggestion-id="${esc(hoverId!)}"]{outline:1px dashed #d97149;outline-offset:1px;border-radius:2px}` : '',
    suggestions.activeId ? `[data-suggestion-id="${esc(suggestions.activeId)}"]{outline:1px solid #d97149;outline-offset:1px;border-radius:2px}` : '',
  ].join('\n');

  const placedStyle = (key: string): CSSProperties =>
    key in tops ? { transform: `translateY(${tops[key]}px)` } : { visibility: 'hidden' };

  const offMargin = detachedOpen.length + api.resolvedThreads.length;

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
      {!api.draft && api.error && <div className="cm-notice cm-banner" role="alert">{api.error}</div>}
      {suggestions.items.length > 1 && (
        <div className="cm-row sg-bulk">
          <span className="cm-meta" style={{ margin: 0 }}>{suggestions.items.length} 条建议</span>
          <span className="cm-spacer" />
          <button type="button" className="cm-link" onClick={suggestions.rejectAll}>全部拒绝</button>
          <button type="button" className="cm-link" onClick={suggestions.acceptAll}>全部接受</button>
        </div>
      )}

      <div
        className="cm-margin"
        ref={setMargin}
        onWheel={onWheel}
        onClick={(e) => { if (e.target === e.currentTarget) { api.closeThread(); suggestions.setActiveId(null); } }}
      >
        {api.draft && (
          <div ref={setCard('draft')} className="cm-thread cm-slot active" style={placedStyle('draft')}>
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
        {anchoredOpen.map((t) => {
          const key = `thread:${t.id}`;
          return (
            <div key={key} ref={setCard(key)} className={`cm-slot${activeKey === key ? ' front' : ''}`} style={placedStyle(key)}>
              <ThreadCard t={t} api={api} sugs={suggestions} detached={false} inMargin
                hovered={hover === key} onHover={(on) => setHover(on ? key : null)} />
            </div>
          );
        })}
        {standalone.map((sg) => {
          const key = `sg:${sg.id}`;
          return (
            <div key={key} ref={setCard(key)} className={`cm-slot${activeKey === key ? ' front' : ''}`} style={placedStyle(key)}>
              <SuggestionCard sg={sg} sugs={suggestions} threads={api}
                hovered={hover === key} onHover={(on) => setHover(on ? key : null)} />
            </div>
          );
        })}
        {!items.length && !api.loading && (
          <div className="cm-empty">
            <div className="cm-empty-title">还没有评论</div>
            <div>选中文字后点「评论」，或按 <kbd>⌘⇧M</kbd>。<br />在评论里写 @Muses 可以请它回复或建议修改。</div>
          </div>
        )}
      </div>

      {offMargin > 0 && (
        <div className="cm-footer">
          <button type="button" className="cm-link" onClick={() => setShowResolved((v) => !v)}>
            {showResolved ? '▾' : '▸'} {[
              detachedOpen.length ? `原文已删除 ${detachedOpen.length}` : '',
              api.resolvedThreads.length ? `已解决 ${api.resolvedThreads.length}` : '',
            ].filter(Boolean).join(' · ')}
          </button>
          {showResolved && (
            <div className="cm-footer-list">
              {[...detachedOpen, ...api.resolvedThreads].map((t) => (
                <ThreadCard key={t.id} t={t} api={api} sugs={suggestions} detached={!api.anchored.has(t.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

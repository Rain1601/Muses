'use client';

/**
 * CommentsPanel — the right rail's comment threads (Claude Docs model).
 * Threads are anchored to words in the doc; a comment that mentions @Claude
 * (or is sent with the Claude toggle on) gets Claude's reply in the thread,
 * and a requested rewrite lands as a suggestion: the old words struck, the new
 * ones inserted, until someone accepts or rejects it (here or on its card).
 */
import { useEffect, useRef, useState } from 'react';
import type { CommentsApi, DocThread } from '@/lib/hooks/useComments';
import type { SuggestionsApi } from '@/lib/hooks/useSuggestions';
import type { SuggestionInfo } from '@/lib/tiptap-extensions/Suggestion';
import { mentionsClaude } from '@/lib/hooks/useComments';

function Composer({
  placeholder, submitLabel, autoFocus, onSubmit, onCancel,
}: {
  placeholder: string;
  submitLabel: string;
  autoFocus?: boolean;
  onSubmit: (body: string, toClaude: boolean) => void;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState('');
  const [toClaude, setToClaude] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  const willAsk = toClaude || mentionsClaude(body);
  const send = () => {
    if (!body.trim()) return;
    onSubmit(body, willAsk);
    setBody('');
    setToClaude(false);
  };
  return (
    <div className="cm-composer">
      <textarea
        ref={ref}
        className="cm-input"
        rows={2}
        placeholder={placeholder}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
          if (e.key === 'Escape' && onCancel) { e.preventDefault(); onCancel(); }
        }}
      />
      <div className="cm-row">
        <button
          type="button"
          className={`cm-chip${willAsk ? ' on' : ''}`}
          onClick={() => setToClaude((v) => !v)}
          title="发给 Claude：Claude 会在线程里回复，需要时直接改这段文字"
        >
          @Claude
        </button>
        <span className="cm-spacer" />
        {onCancel && <button type="button" className="cm-btn" onClick={onCancel}>取消</button>}
        <button type="button" className="cm-btn primary" disabled={!body.trim()} onClick={send}>{submitLabel}</button>
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
        <span className="cm-spark">✦</span> {sg.author === 'claude' ? 'Claude' : sg.author} 建议
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

function ThreadCard({ t, api, detached, sugs }: { t: DocThread; api: CommentsApi; detached: boolean; sugs: SuggestionsApi }) {
  const pending = sugs.items.filter((sg) => sg.threadId === t.id);
  const active = api.activeId === t.id;
  const busy = api.claudeBusy.has(t.id);
  const notice = api.notices[t.id];
  return (
    <div
      className={`cm-thread${active ? ' active' : ''}${t.resolved ? ' resolved' : ''}`}
      onClick={() => api.focusThread(t.id)}
    >
      <div className={`cm-quote${detached ? ' detached' : ''}`} title={detached ? '这段文字已从文档删除' : undefined}>
        {(!detached && api.currentText(t.id)) || t.anchorText}
      </div>
      {detached && !t.resolved && <div className="cm-meta">原文已删除</div>}
      {t.comments.map((c) => (
        <div key={c.id} className={`cm-comment${c.author === 'claude' ? ' claude' : ''}`}>
          <div className="cm-author">
            {c.author === 'claude' ? <><span className="cm-spark">✦</span> Claude</> : (c.authorName || '我')}
          </div>
          <div className="cm-body">{c.body}</div>
        </div>
      ))}
      {busy && <div className="cm-comment claude"><div className="cm-author"><span className="cm-spinner" /> Claude 正在回复…</div></div>}
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
          <Composer placeholder="回复，或 @Claude 让它改这段" submitLabel="回复" onSubmit={(b, ai) => api.reply(t.id, b, ai)} />
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

export default function CommentsPanel({ api, suggestions, enabled }: { api: CommentsApi; suggestions: SuggestionsApi; enabled: boolean }) {
  const [showResolved, setShowResolved] = useState(false);

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
          disabled={!enabled}
          onClick={() => api.begin()}
          title="选中文字后评论（⌘⇧M）"
        >
          + 评论所选
        </button>
      </div>
      <div className="cm-list">
        {api.error && <div className="cm-notice">{api.error}</div>}
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
          <div className="cm-thread active">
            <div className="cm-quote">{api.draft.text}</div>
            <Composer
              autoFocus
              placeholder="写评论；@Claude 让它回答或改这段"
              submitLabel="评论"
              onSubmit={api.submitDraft}
              onCancel={api.cancelDraft}
            />
          </div>
        )}
        {api.open.map((t) => (
          <ThreadCard key={t.id} t={t} api={api} sugs={suggestions} detached={!api.anchored.has(t.id)} />
        ))}
        {!api.draft && !api.open.length && !suggestions.items.length && !api.loading && (
          <div className="cm-empty">
            <div className="cm-empty-title">还没有评论</div>
            <div>选中文字，按 <kbd>⌘⇧M</kbd> 或点「+ 评论所选」。<br />写上 @Claude（或选中后按 ⌘K），Claude 会在线程里回复；要改文字时，它的改法会以建议出现在文中，由你接受或拒绝。</div>
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

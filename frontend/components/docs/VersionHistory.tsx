'use client';

/**
 * VersionHistory — right-rail panel listing a tab's saved versions (newest
 * first). Clicking one previews it in a sandboxed frame; "恢复此版本" puts it
 * back as the tab's content (itself recorded as a new version, so a restore
 * can be undone by restoring the version before it).
 */
import { useCallback, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

interface Revision {
  id: string;
  tabId: string;
  source: 'baseline' | 'save' | 'restore' | string;
  createdAt?: string;
  updatedAt?: string;
  chars: number;
}

const SOURCE_LABEL: Record<string, string> = { baseline: '最初版本', save: '编辑', restore: '恢复' };

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem('token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

function fmt(ts?: string) {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  return same
    ? d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const PREVIEW_CSS = `body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:var(--m-n200);background:var(--m-n900);margin:12px;font-size:13px;line-height:1.6}
h1{font-size:1.3em}h2{font-size:1.1em}img{max-width:100%}del{color:#e5a5a5}ins{color:#a7e0b0;text-decoration:none}
[data-pending-block]{border:1px dashed var(--m-n600);padding:6px;border-radius:6px;color:var(--m-n300)}`;

/** The sandboxed preview frame does not inherit the page's CSS variables: copy the current palette values in. */
const PREVIEW_VARS = ['--m-n200', '--m-n300', '--m-n600', '--m-n900'];
function previewRootCss(): string {
  if (typeof window === 'undefined') return '';
  const cs = getComputedStyle(document.documentElement);
  return `:root{${PREVIEW_VARS.map((v) => `${v}:${cs.getPropertyValue(v).trim()}`).join(';')}}`;
}

export default function VersionHistory({
  articleId, tabId, tabName, refreshKey, onRestored, onClose, beforeRestore,
}: {
  articleId: string;
  tabId: string;
  tabName: string;
  /** Bump to reload the list (e.g. after a save). */
  refreshKey: number;
  onRestored: (content: string) => void;
  onClose: () => void;
  /** Saves unsaved edits first, so the current state is kept as a version. */
  beforeRestore: () => Promise<void>;
}) {
  const [revs, setRevs] = useState<Revision[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { resolvedTheme } = useTheme(); // re-render the preview when the theme flips

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/articles/${articleId}/revisions?tabId=${encodeURIComponent(tabId)}`, { headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRevs(await r.json());
      setError(null);
    } catch (e: any) {
      setError(`加载失败：${e.message}`);
    }
  }, [articleId, tabId]);

  useEffect(() => { setSelected(null); setPreview(null); }, [articleId, tabId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const pick = async (id: string) => {
    setSelected(id);
    setPreview(null);
    try {
      const r = await fetch(`/api/articles/${articleId}/revisions/${id}`, { headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setPreview((await r.json()).content);
    } catch (e: any) {
      setError(`预览失败：${e.message}`);
    }
  };

  const restore = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await beforeRestore();
      const r = await fetch(`/api/articles/${articleId}/revisions/${selected}/restore`, { method: 'POST', headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      onRestored((await r.json()).content);
      setSelected(null);
      setPreview(null);
      await load();
    } catch (e: any) {
      setError(`恢复失败：${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cm-panel">
      <div className="cm-header">
        <span className="cm-title">版本历史</span>
        <span className="cm-count">{tabName}</span>
        <span className="cm-spacer" />
        <button type="button" className="cm-btn" onClick={onClose}>关闭</button>
      </div>
      <div className="cm-list">
        {error && <div className="cm-notice">{error}</div>}
        {!revs.length && !error && (
          <div className="cm-empty">
            <div className="cm-empty-title">还没有历史版本</div>
            <div>保存后，每一段连续编辑（10 分钟内）记为一个版本。</div>
          </div>
        )}
        {revs.map((r, i) => (
          <div key={r.id} className={`cm-thread vh-item${selected === r.id ? ' active' : ''}`} onClick={() => pick(r.id)}>
            <div className="vh-row">
              <span className="vh-time">{fmt(r.updatedAt || r.createdAt)}</span>
              <span className="vh-src">{i === 0 ? '当前' : SOURCE_LABEL[r.source] || r.source}</span>
              <span className="cm-spacer" />
              <span className="vh-size">{r.chars.toLocaleString()} 字</span>
            </div>
            {selected === r.id && (
              <div onClick={(e) => e.stopPropagation()}>
                {preview === null ? (
                  <div className="cm-meta" style={{ marginTop: 6 }}><span className="cm-spinner" /> 加载预览…</div>
                ) : (
                  <iframe className="vh-preview" sandbox="" key={resolvedTheme} srcDoc={`<style>${previewRootCss()}${PREVIEW_CSS}</style>${preview}`} title="版本预览" />
                )}
                <div className="cm-row">
                  <span className="cm-spacer" />
                  {i === 0 ? (
                    <span className="cm-meta" style={{ margin: 0 }}>这就是当前内容</span>
                  ) : (
                    <button type="button" className="cm-btn primary" disabled={busy || preview === null} onClick={restore}>
                      {busy ? '恢复中…' : '恢复此版本'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

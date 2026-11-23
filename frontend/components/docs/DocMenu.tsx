'use client';

/**
 * DocMenu — the "⋯" document menu in the dashboard top bar. Holds the
 * actions that used to sit in two rows above the doc: drafting with Claude,
 * tabs, version history and export. Export covers the open tab as it stands
 * (open suggestions count as not accepted).
 */
import { useEffect, useRef, useState } from 'react';
import { exportDoc, type ExportFormat } from '@/lib/export';
import { OPEN_DOC_WRITER_EVENT } from './DocWriterBar';

const EXPORTS: Array<{ f: ExportFormat; label: string; hint: string }> = [
  { f: 'md', label: '导出 Markdown', hint: '.md，表格转为 Markdown 表格' },
  { f: 'html', label: '导出 HTML', hint: '单文件网页，自带样式' },
  { f: 'pdf', label: '导出 PDF', hint: '打开打印对话框 → 存储为 PDF' },
];

export default function DocMenu({ editor, title, className, onAddTab, historyOpen, onToggleHistory, onError }: {
  editor: any;
  title: string;
  className?: string;
  /** DB articles only: workspace files have no tabs or history. */
  onAddTab?: () => void;
  historyOpen?: boolean;
  onToggleHistory?: () => void;
  onError?: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    // Focus the first item so the menu works from the keyboard.
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus());
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); (ref.current?.firstElementChild as HTMLElement | null)?.focus(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };

  const act = (fn: () => void) => () => { setOpen(false); fn(); };
  const runExport = (f: ExportFormat) => act(async () => {
    try {
      await exportDoc(f, { title, html: editor.getHTML() });
    } catch (e: any) {
      onError?.(`导出失败：${e.message}`);
    }
  });

  return (
    <div className="doc-menu" ref={ref} onKeyDown={onKeyDown}>
      <button
        type="button"
        className={className}
        aria-label="文档菜单"
        title="文档菜单"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={!editor}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div className="doc-menu-pop" role="menu" ref={listRef}>
          <button type="button" role="menuitem" className="doc-menu-item"
            onClick={act(() => window.dispatchEvent(new Event(OPEN_DOC_WRITER_EVENT)))}>
            <span className="doc-menu-label"><span className="spark">✦</span> 让 Claude 写</span>
            <span className="doc-menu-hint">先列大纲，再逐节写 · 也可在正文输入 /</span>
          </button>
          {onAddTab && (
            <button type="button" role="menuitem" className="doc-menu-item" onClick={act(onAddTab)}>
              <span className="doc-menu-label">新建标签页</span>
            </button>
          )}
          {onToggleHistory && (
            <button type="button" role="menuitem" className="doc-menu-item" onClick={act(onToggleHistory)}>
              <span className="doc-menu-label">{historyOpen ? '关闭版本历史' : '版本历史'}</span>
            </button>
          )}
          <div className="doc-menu-sep" role="separator" />
          {EXPORTS.map((it) => (
            <button key={it.f} type="button" role="menuitem" className="doc-menu-item" onClick={runExport(it.f)}>
              <span className="doc-menu-label">{it.label}</span>
              <span className="doc-menu-hint">{it.hint}</span>
            </button>
          ))}
          <div className="doc-menu-foot">导出当前标签页的现状：未处理的建议按未接受计</div>
        </div>
      )}
    </div>
  );
}

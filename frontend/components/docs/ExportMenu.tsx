'use client';

import { useEffect, useRef, useState } from 'react';
import { exportDoc, type ExportFormat } from '@/lib/export';

const ITEMS: Array<{ f: ExportFormat; label: string; hint: string }> = [
  { f: 'md', label: 'Markdown', hint: '.md，表格转为 Markdown 表格' },
  { f: 'html', label: 'HTML', hint: '单文件网页，自带样式' },
  { f: 'pdf', label: 'PDF', hint: '打开打印对话框 → 存储为 PDF' },
];

/** "导出" — exports the open tab as it stands (open suggestions count as not accepted). */
export default function ExportMenu({ editor, title }: { editor: any; title: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const run = async (f: ExportFormat) => {
    setOpen(false);
    setError(null);
    try {
      await exportDoc(f, { title, html: editor.getHTML() });
    } catch (e: any) {
      setError(`导出失败：${e.message}`);
    }
  };

  return (
    <div className="export-menu" ref={ref}>
      <button type="button" className="doc-writer-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        导出
      </button>
      {open && (
        <div className="export-pop" role="menu">
          {ITEMS.map((it) => (
            <button key={it.f} type="button" role="menuitem" className="export-item" onClick={() => run(it.f)}>
              <span className="export-label">{it.label}</span>
              <span className="export-hint">{it.hint}</span>
            </button>
          ))}
          <div className="export-foot">导出当前 tab 的现状：未处理的建议按未接受计</div>
        </div>
      )}
      {error && <span className="doc-writer-error" style={{ marginLeft: 8 }}>{error}</span>}
    </div>
  );
}

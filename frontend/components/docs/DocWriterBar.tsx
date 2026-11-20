'use client';

/**
 * DocWriterBar — the "让 Claude 写" composer above the editor.
 * Hidden until opened from the top-bar ⋯ menu or the "/" slash menu (both fire
 * OPEN_DOC_WRITER_EVENT); open, a panel at the top of the doc takes a topic
 * (+ optional writing skill) and runs useDocWriter.draft: outline as pending
 * blocks at the end of the doc, then fill. Enter writes, Esc / click outside closes.
 * The slash command "让 Claude 写" opens it via the `muses:open-doc-writer` event.
 */
import { useEffect, useRef, useState } from 'react';
import { useDocWriter } from '@/lib/hooks/useDocWriter';

interface SkillOption {
  id: string;
  name: string;
  icon?: string;
  prompt: string;
}

export const OPEN_DOC_WRITER_EVENT = 'muses:open-doc-writer';

export default function DocWriterBar({ editor, title, insertTitle = true }: { editor: any; title?: string; insertTitle?: boolean }) {
  const writer = useDocWriter(editor, { title, insertTitle });
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [skillId, setSkillId] = useState('');
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Click outside closes the composer (the typed topic is kept for next time).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      // The slash command refocuses the editor right after dispatching; take focus after it.
      setTimeout(() => inputRef.current?.focus(), 80);
    };
    window.addEventListener(OPEN_DOC_WRITER_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_DOC_WRITER_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open || skills.length) return;
    let token: string | null = null;
    try { token = localStorage.getItem('token'); } catch { /* guest */ }
    if (!token) return;
    fetch('/api/skills', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : { skills: [] }))
      .then((d) => setSkills(d.skills || []))
      .catch(() => {});
  }, [open, skills.length]);

  const run = (fillAll: boolean) => {
    if (!topic.trim()) return;
    const skill = skills.find((s) => s.id === skillId);
    setOpen(false);
    writer.draft({ topic, skillPrompt: skill?.prompt, fillAll });
  };

  if (writer.busy) {
    return (
      <div className="doc-writer">
        <div className="doc-writer-panel doc-writer-row" style={{ marginTop: 0 }}>
          <span className="pending-block-spinner" />
          <span className="doc-writer-hint">
            {writer.phase === 'outline' ? 'Claude 正在列大纲…' : `Claude 正在逐节写作 · ${Math.min(writer.done + 1, writer.total)}/${writer.total}`}
          </span>
          <span className="doc-writer-spacer" />
          <button type="button" className="pending-block-btn" onClick={writer.stop}>停止</button>
        </div>
      </div>
    );
  }

  // Closed: nothing above the doc. It opens from the top-bar ⋯ menu or the "/" slash menu.
  if (!open) {
    return writer.error ? <div className="doc-writer"><span className="doc-writer-error">{writer.error}</span></div> : null;
  }

  const appending = !!editor && !editor.isDestroyed && editor.getText().trim().length > 0;

  return (
    <div className="doc-writer" ref={rootRef}>
      <div className="doc-writer-panel" role="dialog" aria-label="让 Claude 写">
        <textarea
          ref={inputRef}
          className="doc-writer-input"
          rows={2}
          placeholder="写什么？例如：远程办公对初创团队的利弊，给创始人看"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            // Enter writes; Shift+Enter is a newline. Never act while an IME is composing.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); run(true); }
            if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
          }}
        />
        <div className="doc-writer-row">
          {skills.length > 0 && (
            <select className="doc-writer-select" value={skillId} onChange={(e) => setSkillId(e.target.value)}>
              <option value="">不使用写作技能</option>
              {skills.map((s) => (
                <option key={s.id} value={s.id}>{s.icon ? `${s.icon} ` : ''}{s.name}</option>
              ))}
            </select>
          )}
          <span className="doc-writer-hint">{appending ? '接在文末续写' : '从空白写成整篇'}</span>
          <span className="doc-writer-spacer" />
          <button type="button" className="doc-writer-link" disabled={!topic.trim()} onClick={() => run(false)}>只列大纲</button>
          <button type="button" className="pending-block-btn primary" disabled={!topic.trim()} onClick={() => run(true)}>开始写 ↵</button>
        </div>
      </div>
    </div>
  );
}

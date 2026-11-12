'use client';

/**
 * DocWriterBar — the "让 Claude 写" composer above the editor.
 * Collapsed it is a small pill; open it takes a topic (+ optional writing
 * skill) and runs useDocWriter.draft: outline as pending blocks, then fill.
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

  if (!open) {
    return (
      <div className="doc-writer">
        <button type="button" className="doc-writer-trigger" onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}>
          <span className="spark">✦</span> 让 Claude 写
        </button>
        {writer.error && <span className="doc-writer-error" style={{ marginLeft: 10 }}>{writer.error}</span>}
      </div>
    );
  }

  return (
    <div className="doc-writer">
      <div className="doc-writer-panel">
        <textarea
          ref={inputRef}
          className="doc-writer-input"
          rows={2}
          placeholder="写什么？例如：远程办公对初创团队的利弊，给创始人看"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(true); }
            if (e.key === 'Escape') setOpen(false);
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
          <span className="doc-writer-hint">先列大纲，再一节一节写</span>
          <span className="doc-writer-spacer" />
          <button type="button" className="pending-block-btn" onClick={() => setOpen(false)}>取消</button>
          <button type="button" className="pending-block-btn" disabled={!topic.trim()} onClick={() => run(false)}>只列大纲</button>
          <button type="button" className="pending-block-btn primary" disabled={!topic.trim()} onClick={() => run(true)}>开始写 ⌘↵</button>
        </div>
      </div>
    </div>
  );
}

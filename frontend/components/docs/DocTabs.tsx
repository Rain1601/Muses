'use client';

/**
 * DocTabs — the tab strip above the editor for a DB article (Claude Docs: a
 * doc holds tabs). The main tab is the article's own content and can be
 * renamed but not deleted. Double-click a tab to rename it. Shown only once
 * the article has more than its main tab; version history lives in the ⋯ menu.
 */
import { useState } from 'react';

export interface DocTab {
  id: string;
  name: string;
  order: string;
  isMain?: boolean;
}

export default function DocTabs({
  tabs, activeId, onSelect, onAdd, onRename, onDelete,
}: {
  tabs: DocTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const commit = () => {
    if (editing && draft.trim()) onRename(editing, draft.trim());
    setEditing(null);
  };

  return (
    <div className="doc-tabs" role="tablist">
      {tabs.map((t) => (
        <div key={t.id} className={`doc-tab${t.id === activeId ? ' on' : ''}`}>
          {editing === t.id ? (
            <input
              className="doc-tab-input"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setEditing(null);
              }}
            />
          ) : (
            <button
              type="button"
              role="tab"
              aria-selected={t.id === activeId}
              className="doc-tab-label"
              onClick={() => onSelect(t.id)}
              onDoubleClick={() => { setEditing(t.id); setDraft(t.name); }}
              title="双击重命名"
            >
              {t.name}
            </button>
          )}
          {!t.isMain && t.id === activeId && editing !== t.id && (
            confirmDel === t.id ? (
              <span className="doc-tab-confirm">
                删除？
                <button type="button" onClick={() => { setConfirmDel(null); onDelete(t.id); }}>是</button>
                <button type="button" onClick={() => setConfirmDel(null)}>否</button>
              </span>
            ) : (
              <button type="button" className="doc-tab-x" title="删除这个 tab" onClick={() => setConfirmDel(t.id)}>×</button>
            )
          )}
        </div>
      ))}
      <button type="button" className="doc-tab-add" title="新建 tab" onClick={onAdd}>＋</button>
    </div>
  );
}

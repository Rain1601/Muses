'use client';

/**
 * SelectionToolbar — what shows above a text selection (Claude Docs style):
 * comment first, then ask Muses, text style, inline marks, lists and link.
 * Buttons keep the editor selection (mousedown is prevented) so a click acts
 * on the selected words.
 */
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import {
  MessageSquare, Sparkles, Bold, Italic, Underline, Strikethrough, Code, List, ListOrdered, ListTodo,
  Link2, ChevronDown, Check,
} from 'lucide-react';

type Menu = 'style' | 'list' | 'link' | null;

const STYLES = [
  { key: 'p', label: '正文', isActive: (e: Editor) => e.isActive('paragraph'), run: (e: Editor) => e.chain().focus().setParagraph().run() },
  { key: 'h1', label: '标题 1', isActive: (e: Editor) => e.isActive('heading', { level: 1 }), run: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { key: 'h2', label: '标题 2', isActive: (e: Editor) => e.isActive('heading', { level: 2 }), run: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { key: 'h3', label: '标题 3', isActive: (e: Editor) => e.isActive('heading', { level: 3 }), run: (e: Editor) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { key: 'quote', label: '引用', isActive: (e: Editor) => e.isActive('blockquote'), run: (e: Editor) => e.chain().focus().toggleBlockquote().run() },
];

const LISTS = [
  { key: 'bullet', label: '无序列表', Icon: List, isActive: (e: Editor) => e.isActive('bulletList'), run: (e: Editor) => e.chain().focus().toggleBulletList().run() },
  { key: 'ordered', label: '有序列表', Icon: ListOrdered, isActive: (e: Editor) => e.isActive('orderedList'), run: (e: Editor) => e.chain().focus().toggleOrderedList().run() },
  { key: 'task', label: '任务列表', Icon: ListTodo, isActive: (e: Editor) => e.isActive('taskList'), run: (e: Editor) => e.chain().focus().toggleTaskList().run() },
];

export default function SelectionToolbar({ editor, onComment, onAskMuses }: {
  editor: Editor;
  onComment: () => void;
  onAskMuses?: () => void;
}) {
  const [, setTick] = useState(0);
  const [menu, setMenu] = useState<Menu>(null);
  const [href, setHref] = useState('');
  const linkInput = useRef<HTMLInputElement>(null);

  // Re-render on every transaction so the active states follow the selection.
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    const close = () => setMenu(null);
    editor.on('transaction', bump);
    editor.on('selectionUpdate', close);
    return () => { editor.off('transaction', bump); editor.off('selectionUpdate', close); };
  }, [editor]);

  useEffect(() => { if (menu === 'link') requestAnimationFrame(() => linkInput.current?.focus()); }, [menu]);

  const keep = (e: React.MouseEvent) => e.preventDefault();
  const mark = (name: string, run: () => void, label: string, Icon: typeof Bold, keys: string) => (
    <button type="button" className={`st-btn${editor.isActive(name) ? ' on' : ''}`} onMouseDown={keep} onClick={run}
      aria-label={label} aria-pressed={editor.isActive(name)} title={`${label}（${keys}）`}>
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );

  const style = STYLES.find((s) => s.isActive(editor)) ?? STYLES[0];
  const list = LISTS.find((l) => l.isActive(editor));

  const applyLink = () => {
    const url = href.trim();
    const chain = editor.chain().focus().extendMarkRange('link');
    if (!url) chain.unsetLink().run();
    else chain.setLink({ href: /^(https?:|mailto:|\/|#)/i.test(url) ? url : `https://${url}` }).run();
    setMenu(null);
  };

  if (menu === 'link') {
    return (
      <div className="st-bar" role="toolbar" aria-label="链接">
        <Link2 className="size-4 st-muted" aria-hidden="true" />
        <input
          ref={linkInput}
          className="st-link-input"
          placeholder="粘贴链接，回车确认；留空则移除"
          value={href}
          onChange={(e) => setHref(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
            if (e.key === 'Escape') { e.preventDefault(); setMenu(null); editor.commands.focus(); }
          }}
        />
        <button type="button" className="st-btn" onClick={applyLink} aria-label="确认链接"><Check className="size-4" /></button>
      </div>
    );
  }

  return (
    <div className="st-bar" role="toolbar" aria-label="文字工具">
      <button type="button" className="st-btn st-labelled" onMouseDown={keep} onClick={onComment}
        aria-keyshortcuts="Meta+Shift+M Control+Shift+M" title="评论所选文字（⌘⇧M）">
        <MessageSquare className="size-4" aria-hidden="true" /> 评论
      </button>
      {onAskMuses && (
        <button type="button" className="st-btn st-labelled st-accent" onMouseDown={keep} onClick={onAskMuses}
          aria-keyshortcuts="Meta+K Control+K" title="让 Muses 处理所选文字（⌘K）">
          <Sparkles className="size-4" aria-hidden="true" /> 问 Muses
        </button>
      )}
      <span className="st-sep" aria-hidden="true" />

      <div className="st-group">
        <button type="button" className="st-btn st-labelled" onMouseDown={keep} onClick={() => setMenu(menu === 'style' ? null : 'style')}
          aria-haspopup="menu" aria-expanded={menu === 'style'} title="文本样式">
          {style.label} <ChevronDown className="size-3" aria-hidden="true" />
        </button>
        {menu === 'style' && (
          <div className="st-pop" role="menu">
            {STYLES.map((s) => (
              <button key={s.key} type="button" role="menuitemradio" aria-checked={s.isActive(editor)} className={`st-item st-item-${s.key}`}
                onMouseDown={keep} onClick={() => { s.run(editor); setMenu(null); }}>
                {s.label}{s.isActive(editor) && <Check className="size-3.5" aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}
      </div>
      <span className="st-sep" aria-hidden="true" />

      {mark('bold', () => editor.chain().focus().toggleBold().run(), '加粗', Bold, '⌘B')}
      {mark('italic', () => editor.chain().focus().toggleItalic().run(), '斜体', Italic, '⌘I')}
      {mark('underline', () => editor.chain().focus().toggleUnderline().run(), '下划线', Underline, '⌘U')}
      {mark('strike', () => editor.chain().focus().toggleStrike().run(), '删除线', Strikethrough, '⌘⇧S')}
      {mark('code', () => editor.chain().focus().toggleCode().run(), '行内代码', Code, '⌘E')}
      <span className="st-sep" aria-hidden="true" />

      <div className="st-group">
        <button type="button" className={`st-btn${list ? ' on' : ''}`} onMouseDown={keep} onClick={() => setMenu(menu === 'list' ? null : 'list')}
          aria-haspopup="menu" aria-expanded={menu === 'list'} aria-label="列表" title="列表">
          {list ? <list.Icon className="size-4" aria-hidden="true" /> : <List className="size-4" aria-hidden="true" />}
          <ChevronDown className="size-3" aria-hidden="true" />
        </button>
        {menu === 'list' && (
          <div className="st-pop" role="menu">
            {LISTS.map((l) => (
              <button key={l.key} type="button" role="menuitemradio" aria-checked={l.isActive(editor)} className="st-item"
                onMouseDown={keep} onClick={() => { l.run(editor); setMenu(null); }}>
                <span className="st-item-icon"><l.Icon className="size-4" aria-hidden="true" /> {l.label}</span>
                {l.isActive(editor) && <Check className="size-3.5" aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}
      </div>
      <button type="button" className={`st-btn${editor.isActive('link') ? ' on' : ''}`} onMouseDown={keep}
        onClick={() => { setHref(editor.getAttributes('link').href ?? ''); setMenu('link'); }}
        aria-label="链接" title="链接">
        <Link2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

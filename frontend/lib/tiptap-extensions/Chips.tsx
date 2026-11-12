/**
 * Chips — small inline atoms people act on (Claude Docs model):
 *   dateChip    a date someone may move (deadline, review); click → date picker
 *   statusChip  a value from a closed set (未开始 / 进行中 / 已完成 / 受阻); click → pick
 *
 * Both serialise to a <span> whose text is the readable value, so published
 * Markdown / HTML and Claude's view of the doc still read naturally.
 */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    chips: {
      insertDateChip: (date?: string) => ReturnType;
      insertStatusChip: (value?: string) => ReturnType;
    };
  }
}

export const STATUS_OPTIONS = ['未开始', '进行中', '已完成', '受阻'] as const;
const STATUS_TONE: Record<string, string> = { 未开始: 'gray', 进行中: 'blue', 已完成: 'green', 受阻: 'red' };

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function formatChipDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '日期';
  const [, y, mo, d] = m;
  const label = `${Number(mo)}月${Number(d)}日`;
  return Number(y) === new Date().getFullYear() ? label : `${y}年${label}`;
}

/** Close a popover on outside click / Escape. */
function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as globalThis.Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, close, ref]);
}

function DateChipView({ node, updateAttributes, editor }: NodeViewProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useDismiss(open, () => setOpen(false), ref);
  const date: string = node.attrs.date;
  return (
    <NodeViewWrapper as="span" className="chip-wrap" ref={ref} contentEditable={false}>
      <button
        type="button"
        className="chip chip-date"
        title={date}
        onClick={() => editor.isEditable && setOpen((v) => !v)}
      >
        {formatChipDate(date)}
      </button>
      {open && (
        <span className="chip-pop">
          <input
            type="date"
            autoFocus
            value={date}
            onChange={(e) => { if (e.target.value) updateAttributes({ date: e.target.value }); }}
          />
          <button type="button" className="chip-pop-btn" onClick={() => { updateAttributes({ date: todayISO() }); setOpen(false); }}>今天</button>
        </span>
      )}
    </NodeViewWrapper>
  );
}

function StatusChipView({ node, updateAttributes, editor }: NodeViewProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useDismiss(open, () => setOpen(false), ref);
  const value: string = node.attrs.value;
  return (
    <NodeViewWrapper as="span" className="chip-wrap" ref={ref} contentEditable={false}>
      <button
        type="button"
        className={`chip chip-status tone-${STATUS_TONE[value] || 'gray'}`}
        onClick={() => editor.isEditable && setOpen((v) => !v)}
      >
        <span className="chip-dot" aria-hidden />
        {value}
      </button>
      {open && (
        <span className="chip-pop chip-menu" role="menu">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              role="menuitemradio"
              aria-checked={opt === value}
              className={`chip chip-status tone-${STATUS_TONE[opt]}${opt === value ? ' on' : ''}`}
              onClick={() => { updateAttributes({ value: opt }); setOpen(false); }}
            >
              <span className="chip-dot" aria-hidden />
              {opt}
            </button>
          ))}
        </span>
      )}
    </NodeViewWrapper>
  );
}

export const DateChip = Node.create({
  name: 'dateChip',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      date: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-date') || '',
        renderHTML: (a) => ({ 'data-date': a.date }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-date-chip]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-date-chip': '', class: 'chip chip-date' }), node.attrs.date];
  },
  renderText({ node }) {
    return node.attrs.date;
  },
  addNodeView() {
    return ReactNodeViewRenderer(DateChipView, { as: 'span' });
  },
  addCommands() {
    return {
      insertDateChip: (date) => ({ commands }) =>
        commands.insertContent([{ type: this.name, attrs: { date: date || todayISO() } }, { type: 'text', text: ' ' }]),
    };
  },
});

export const StatusChip = Node.create({
  name: 'statusChip',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      value: {
        default: STATUS_OPTIONS[0],
        parseHTML: (el) => el.getAttribute('data-value') || STATUS_OPTIONS[0],
        renderHTML: (a) => ({ 'data-value': a.value }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-status-chip]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-status-chip': '', class: 'chip chip-status' }), node.attrs.value];
  },
  renderText({ node }) {
    return node.attrs.value;
  },
  addNodeView() {
    return ReactNodeViewRenderer(StatusChipView, { as: 'span' });
  },
  addCommands() {
    return {
      insertStatusChip: (value) => ({ commands }) =>
        commands.insertContent([{ type: this.name, attrs: { value: value || STATUS_OPTIONS[0] } }, { type: 'text', text: ' ' }]),
    };
  },
});

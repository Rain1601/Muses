/**
 * PendingBlock — a placeholder section that says what will be written there.
 *
 * Claude Docs' "outline first, then fill" model: the outline is planted as one
 * PendingBlock per section ({heading, intent}); each is then replaced, one at a
 * time, by the section's real content. Users can also insert one by hand
 * (slash menu "占位块"), edit its heading/intent, and ask for it to be written.
 *
 * The block itself knows nothing about AI. Filling is delegated through
 * `editor.storage.pendingBlock.onFill(id)`, which the dashboard's
 * useDocWriter hook installs. Serialises to `<div data-pending-block …>` so it
 * survives the HTML autosave.
 */
'use client';

import React, { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';

export type PendingStatus = 'idle' | 'filling' | 'error';

export interface PendingBlockStorage {
  onFill: ((id: string) => void) | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pendingBlock: {
      insertPendingBlock: (attrs?: { heading?: string; intent?: string }) => ReturnType;
    };
  }
  interface Storage {
    pendingBlock: PendingBlockStorage;
  }
}

export const newPendingId = () => `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function PendingBlockView({ node, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const { id, heading, intent, status, error } = node.attrs as {
    id: string; heading: string; intent: string; status: PendingStatus; error: string;
  };
  const [editing, setEditing] = useState(!heading && !intent);
  const [h, setH] = useState(heading);
  const [i, setI] = useState(intent);
  const filling = status === 'filling';
  // The handler is installed after the node views first render (useDocWriter's
  // effect), so look it up at click time rather than gating the button on it.
  const canFill = !!(heading || intent);

  const save = () => {
    updateAttributes({ heading: h.trim(), intent: i.trim() });
    setEditing(false);
  };

  return (
    <NodeViewWrapper
      className={`pending-block${filling ? ' is-filling' : ''}${status === 'error' ? ' is-error' : ''}`}
      data-pending-id={id}
      contentEditable={false}
    >
      {editing ? (
        <div className="pending-block-form">
          <input
            className="pending-block-heading-input"
            placeholder="小节标题"
            value={h}
            autoFocus
            onChange={(e) => setH(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
          />
          <textarea
            className="pending-block-intent-input"
            placeholder="这一节要写什么（一句话）"
            rows={2}
            value={i}
            onChange={(e) => setI(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); } }}
          />
          <div className="pending-block-actions">
            <button type="button" className="pending-block-btn primary" onClick={save} disabled={!h.trim() && !i.trim()}>完成</button>
            <button type="button" className="pending-block-btn" onClick={() => (heading || intent ? (setH(heading), setI(intent), setEditing(false)) : deleteNode())}>取消</button>
          </div>
        </div>
      ) : (
        <>
          <div className="pending-block-body">
            <span className="pending-block-mark" aria-hidden>{filling ? <span className="pending-block-spinner" /> : '✦'}</span>
            <div className="pending-block-text">
              {heading && <div className="pending-block-heading">{heading}</div>}
              {intent && <div className="pending-block-intent">{intent}</div>}
              {filling && <div className="pending-block-status">Claude 正在写这一节…</div>}
              {status === 'error' && <div className="pending-block-status error">{error || '生成失败'}</div>}
            </div>
          </div>
          {!filling && (
            <div className="pending-block-actions">
              {canFill && (
                <button type="button" className="pending-block-btn primary" onClick={() => editor.storage.pendingBlock.onFill?.(id)}>
                  {status === 'error' ? '重试' : '写这一节'}
                </button>
              )}
              <button type="button" className="pending-block-btn" onClick={() => setEditing(true)}>编辑</button>
              <button type="button" className="pending-block-btn" onClick={() => deleteNode()}>删除</button>
            </div>
          )}
        </>
      )}
    </NodeViewWrapper>
  );
}

export const PendingBlock = Node.create<Record<string, never>, PendingBlockStorage>({
  name: 'pendingBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addStorage() {
    return { onFill: null };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-id'),
        renderHTML: (a) => ({ 'data-id': a.id }),
      },
      heading: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-heading') || '',
        renderHTML: (a) => ({ 'data-heading': a.heading }),
      },
      intent: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-intent') || '',
        renderHTML: (a) => ({ 'data-intent': a.intent }),
      },
      // Transient: a reload mid-fill comes back idle, never stuck "filling".
      status: { default: 'idle', rendered: false, parseHTML: () => 'idle' },
      error: { default: '', rendered: false, parseHTML: () => '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-pending-block]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    // Text fallback keeps the intent readable anywhere the node view isn't loaded
    // (published Markdown, other editors).
    const label = [node.attrs.heading, node.attrs.intent].filter(Boolean).join(' — ');
    return ['div', mergeAttributes(HTMLAttributes, { 'data-pending-block': '' }), `【待写】${label}`];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PendingBlockView);
  },

  addCommands() {
    return {
      insertPendingBlock:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { id: newPendingId(), heading: attrs.heading ?? '', intent: attrs.intent ?? '' },
          }),
    };
  },
});

/** Find a pending block by id → its position and node, or null. */
export function findPendingBlock(editor: any, id: string): { pos: number; node: any } | null {
  let found: { pos: number; node: any } | null = null;
  editor.state.doc.descendants((node: any, pos: number) => {
    if (found) return false;
    if (node.type.name === 'pendingBlock' && node.attrs.id === id) {
      found = { pos, node };
      return false;
    }
    return true;
  });
  return found;
}

/** All pending blocks in document order. */
export function listPendingBlocks(editor: any): Array<{ id: string; heading: string; intent: string }> {
  const out: Array<{ id: string; heading: string; intent: string }> = [];
  editor.state.doc.descendants((node: any) => {
    if (node.type.name === 'pendingBlock') out.push({ id: node.attrs.id, heading: node.attrs.heading, intent: node.attrs.intent });
    return node.type.name !== 'pendingBlock';
  });
  return out;
}

export default PendingBlock;

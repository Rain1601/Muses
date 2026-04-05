"use client";

import { useRef, useCallback } from "react";

interface Props {
  content: string;
  onChange: (content: string) => void;
  onSendToClaude: (selectedText: string) => void;
}

/**
 * Studio Editor — plain textarea for now, can be swapped with TipTap NotionEditor later.
 * Supports text selection → "Send to Claude" action.
 */
export default function StudioEditor({ content, onChange, onSendToClaude }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSendSelection = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    if (selected.trim()) {
      onSendToClaude(selected);
    }
  }, [onSendToClaude]);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#292524] flex-shrink-0">
        <button
          onClick={handleSendSelection}
          className="text-xs px-2.5 py-1 rounded border border-[#44403C] text-[#A8A29E] hover:text-[#D97757] hover:border-[#D97757] transition-colors"
          title="选中文本后点击，发送到 Claude"
        >
          Send to Claude →
        </button>
        <span className="text-xs text-[#57534E]">选中文本后发送</span>
      </div>

      {/* Editor area */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 w-full p-6 bg-transparent text-[#D6D3D1] text-sm leading-relaxed resize-none outline-none font-mono"
        placeholder="开始写作..."
        spellCheck={false}
      />
    </div>
  );
}

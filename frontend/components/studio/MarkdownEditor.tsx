"use client";

import { useRef, useCallback, useEffect, useState } from "react";

interface Props {
  content: string;
  onChange: (content: string) => void;
  onSelectionChange: (text: string) => void;
  onSave: () => void;
}

export default function MarkdownEditor({ content, onChange, onSelectionChange, onSave }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);

  // Sync line numbers
  useEffect(() => {
    const lines = content.split("\n").length;
    setLineCount(lines);
  }, [content]);

  // Sync scroll between textarea and line numbers
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Track selection
  const handleSelect = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const selected = ta.value.substring(ta.selectionStart, ta.selectionEnd);
    onSelectionChange(selected);
  }, [onSelectionChange]);

  // Generate line numbers
  const lineNumbers = [];
  for (let i = 1; i <= lineCount; i++) {
    lineNumbers.push(
      <div key={i} className="leading-6 text-right pr-3 select-none" style={{ height: "24px" }}>
        {i % 5 === 0 || i === 1 ? (
          <span className="text-[#57534E]">{i}</span>
        ) : (
          <span className="text-transparent">·</span>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Line numbers */}
      <div
        ref={lineNumbersRef}
        className="w-12 flex-shrink-0 overflow-hidden border-r border-[#292524] pt-4 text-xs font-mono"
        style={{ lineHeight: "24px" }}
      >
        {lineNumbers}
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        onSelect={handleSelect}
        onMouseUp={handleSelect}
        onKeyUp={handleSelect}
        className="flex-1 p-4 bg-transparent text-[#D6D3D1] text-sm resize-none outline-none font-mono"
        style={{ lineHeight: "24px", tabSize: 2 }}
        placeholder="开始写作..."
        spellCheck={false}
      />
    </div>
  );
}

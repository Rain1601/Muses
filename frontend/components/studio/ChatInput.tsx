"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  onSend: (text: string) => void;
  streaming: boolean;
  streamingText: string;
  chatHistory: { role: string; content: string }[];
  selection: string;
  activeFile: string | null;
}

/**
 * Chat input panel at bottom of editor — like Cowork's Reply box.
 * Shows conversation history inline, with selection context badge.
 */
export default function ChatInput({ onSend, streaming, streamingText, chatHistory, selection, activeFile }: Props) {
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, streamingText]);

  const handleSubmit = () => {
    if (!input.trim() || streaming) return;
    const msg = selection
      ? `关于选中的文本：\n> ${selection}\n\n${input}`
      : input;
    onSend(msg);
    setInput("");
    setExpanded(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-[#292524] flex flex-col">
      {/* Chat history (expandable) */}
      {expanded && chatHistory.length > 0 && (
        <div ref={scrollRef} className="max-h-[280px] overflow-y-auto px-4 py-3 space-y-3 border-b border-[#292524]">
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#292524] text-[#D6D3D1]"
                  : "text-[#A8A29E]"
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}

          {/* Streaming indicator */}
          {streaming && (
            <div className="flex justify-start">
              <div className="text-[#A8A29E] text-sm leading-relaxed whitespace-pre-wrap">
                {streamingText || (
                  <span className="inline-flex gap-1 items-center">
                    <svg className="w-4 h-4 text-[#D97757] animate-spin" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span className="text-[#57534E]">思考中...</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-3">
        {/* Selection context badge */}
        {selection && (
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded bg-[#292524] border border-[#44403C] text-[#D97757]">
              已选中文本
            </span>
            <span className="text-xs text-[#57534E] truncate max-w-[300px]">
              {selection.slice(0, 60)}{selection.length > 60 ? "..." : ""}
            </span>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Toggle history */}
          {chatHistory.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 text-[#57534E] hover:text-[#A8A29E] transition-colors flex-shrink-0"
              title={expanded ? "收起对话" : "展开对话"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {expanded
                  ? <><polyline points="6 15 12 9 18 15"/></>
                  : <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>
                }
              </svg>
            </button>
          )}

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="flex-1 bg-[#292524] border border-[#44403C] rounded-xl px-4 py-2.5 text-sm text-[#D6D3D1] outline-none resize-none placeholder-[#57534E] focus:border-[#57534E] transition-colors"
            placeholder={streaming ? "Claude 思考中..." : "Reply..."}
            disabled={streaming}
            style={{ maxHeight: 100 }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 100) + "px";
            }}
          />

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs text-[#44403C]">Sonnet 4</span>
            <button
              onClick={handleSubmit}
              disabled={streaming || !input.trim()}
              className="p-2 rounded-lg bg-[#D97757] text-white disabled:opacity-30 hover:bg-[#c4684a] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

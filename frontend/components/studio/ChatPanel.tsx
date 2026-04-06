"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { parseLineRange } from "@/lib/tiptap-extensions/LineNumbers";
import s from "./ChatPanel.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Message {
  role: "user" | "assistant";
  content: string;
  selection?: string; // attached selection context
  timestamp?: Date;
}

export interface ChatPanelHandle {
  sendToClaude: (text: string) => void;
  focusInput: () => void;
}

interface Props {
  activeFile: string | null;
  editorSelection?: string;
  onClearSelection?: () => void;
  onArticleEdit?: (newContent: string) => void;
  getLineContent?: (start: number, end?: number) => string;
}

const ChatPanel = forwardRef<ChatPanelHandle, Props>(({ activeFile, editorSelection, onClearSelection, onArticleEdit, getLineContent }, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hoveredMsg, setHoveredMsg] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const copyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const sendMessage = useCallback(
    async (text: string, selection?: string) => {
      if (!text.trim() || streaming) return;

      // Parse =N or =N-M line range syntax
      let actualMessage = text;
      let selCtx = editorSelection || selection || undefined;
      const lineRange = parseLineRange(text);
      if (lineRange && getLineContent) {
        const lineText = getLineContent(lineRange.lineStart, lineRange.lineEnd);
        if (lineText) {
          selCtx = `[Lines ${lineRange.lineStart}${lineRange.lineEnd ? `-${lineRange.lineEnd}` : "+"}]\n${lineText}`;
        }
        actualMessage = lineRange.cleanMessage || `修改第 ${lineRange.lineStart}${lineRange.lineEnd ? `-${lineRange.lineEnd}` : ""} 行`;
      }

      setMessages((prev) => [...prev, { role: "user", content: text, selection: selCtx, timestamp: new Date() }]);
      setInput("");
      setStreaming(true);
      setMessages((prev) => [...prev, { role: "assistant", content: "", timestamp: new Date() }]);

      try {
        const res = await fetch(`${API_BASE}/api/studio/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: actualMessage,
            filename: activeFile,
            selection: selCtx || null,
            history: messages.slice(-20).map(m => ({ role: m.role, content: m.content })),
          }),
        });

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error("No reader");

        let fullText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of decoder.decode(value).split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "text") {
                fullText += data.content;
                // Show streaming text with article_edit tags stripped
                const displayText = fullText
                  .replace(/<article_edit>[\s\S]*$/, "...")
                  .replace(/<article_edit>[\s\S]*?<\/article_edit>/, "")
                  .trim();
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === "assistant") {
                    updated[updated.length - 1] = { ...last, content: displayText };
                  }
                  return updated;
                });
              } else if (data.type === "error") {
                fullText = data.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...updated[updated.length - 1], role: "assistant", content: data.content };
                  return updated;
                });
              }
            } catch {}
          }
        }

        // Extract article_edit and notify parent for diff view
        const editMatch = fullText.match(/<article_edit>\n?([\s\S]*?)\n?<\/article_edit>/);
        if (editMatch && onArticleEdit) {
          onArticleEdit(editMatch[1].trim());
        }
        // Set final display text (without article_edit tags)
        const finalDisplay = editMatch
          ? fullText.replace(/<article_edit>[\s\S]*?<\/article_edit>/, "").trim() || "Changes generated."
          : fullText;
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: finalDisplay };
          }
          return updated;
        });
      } catch (e: any) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], role: "assistant", content: e.message };
          return updated;
        });
      } finally {
        setStreaming(false);
        onClearSelection?.();
      }
    },
    [activeFile, messages, streaming, onClearSelection, editorSelection]
  );

  useImperativeHandle(ref, () => ({
    sendToClaude: (selectedText: string) => {
      sendMessage(`Please improve this text:\n\n> ${selectedText}`, selectedText);
    },
    focusInput: () => {
      inputRef.current?.focus();
    },
  }));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const retryMessage = (idx: number) => {
    // Find the user message before this assistant message
    const userMsg = messages.slice(0, idx).reverse().find(m => m.role === "user");
    if (userMsg) {
      // Remove from idx onwards and resend
      setMessages(prev => prev.slice(0, idx));
      sendMessage(userMsg.content, userMsg.selection);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className={s.root}>
      {/* Header */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <svg className={s.headerIcon} width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-1v-1h1v1zm2.07-4.75l-.9.92C11.45 13.9 11 14.5 11 15.5h-1v-.25c0-.75.45-1.45 1.17-2.17l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-1.66 1.34-3 3-3s3 1.34 3 3c0 .66-.27 1.26-.93 1.84z"/>
          </svg>
          <span className={s.headerTitle}>Claude</span>
        </div>
        <div className={s.headerRight}>
          {activeFile && <span className={s.headerContext}>{activeFile}</span>}
          {messages.length > 0 && (
            <button onClick={clearChat} className={s.clearBtn} title="Clear chat">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className={s.messages}>
        {messages.length === 0 && (
          <div className={s.emptyState}>
            <div className={s.emptyInner}>
              <p className={s.emptyTitle}>Writing Assistant</p>
              <p className={s.emptyDesc}>
                Select text in the editor and press &#8984;K, or type a question directly.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={msg.role === "user" ? s.msgUser : s.msgAssistant}
            onMouseEnter={() => setHoveredMsg(i)}
            onMouseLeave={() => setHoveredMsg(null)}
          >
            {/* User message */}
            {msg.role === "user" && (
              <div className={s.userBlock}>
                {msg.selection && (
                  <div className={s.msgSelectionChip}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span>{msg.selection.split('\n').length} lines</span>
                  </div>
                )}
                <div className={s.bubbleUser}>{msg.content}</div>
              </div>
            )}

            {/* Assistant message */}
            {msg.role === "assistant" && (
              <div className={s.assistantBlock}>
                {!msg.content ? (
                  <div className={s.streamingIndicator}>
                    <span className={s.streamingDot} />
                    <span className={s.streamingLabel}>Thinking...</span>
                  </div>
                ) : (
                  <>
                    <div className={s.assistantContent}>{msg.content}</div>
                    {/* Action bar — visible on hover or when just completed */}
                    {(hoveredMsg === i || (i === messages.length - 1 && !streaming)) && msg.content && (
                      <div className={s.msgActions}>
                        <button onClick={() => copyMessage(msg.content, i)} className={s.msgActionBtn} title="Copy">
                          {copiedIdx === i ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          )}
                        </button>
                        <button onClick={() => retryMessage(i)} className={s.msgActionBtn} title="Retry">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className={s.inputArea}>
        {editorSelection && (
          <div className={s.selectionContext}>
            <div className={s.selectionHeader}>
              <span className={s.selectionLabel}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                {editorSelection.split('\n').length} lines selected
              </span>
              <button onClick={onClearSelection} className={s.selectionClear}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <pre className={s.selectionBody}>{editorSelection}</pre>
          </div>
        )}
        <div className={s.inputBox}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className={s.textarea}
            placeholder={streaming ? "Generating..." : "Ask or use =5-10 for lines..."}
            disabled={streaming}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 120) + "px";
            }}
          />
          <div className={s.inputFooter}>
            <div className={s.inputMeta}>
              {activeFile && (
                <span className={s.fileChip}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  {activeFile}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={streaming || !input.trim()}
              className={s.sendBtn}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

ChatPanel.displayName = "ChatPanel";

export default ChatPanel;

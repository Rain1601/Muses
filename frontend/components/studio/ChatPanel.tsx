"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ChatPanelHandle {
  sendToClaude: (text: string) => void;
}

interface Props {
  activeFile: string | null;
}

const ChatPanel = forwardRef<ChatPanelHandle, Props>(({ activeFile }, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Send message to Claude API
  const sendMessage = useCallback(
    async (text: string, selection?: string) => {
      if (!text.trim() || streaming) return;

      const userMsg: Message = { role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setStreaming(true);

      // Add empty assistant message for streaming
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const res = await fetch(`${API_BASE}/api/studio/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            filename: activeFile,
            selection: selection || null,
            history: messages.slice(-20),
          }),
        });

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error("No reader");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "text") {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + data.content,
                    };
                  }
                  return updated;
                });
              } else if (data.type === "error") {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: `❌ ${data.content}`,
                  };
                  return updated;
                });
              }
            } catch {}
          }
        }
      } catch (e: any) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: `❌ ${e.message}`,
          };
          return updated;
        });
      } finally {
        setStreaming(false);
      }
    },
    [activeFile, messages, streaming]
  );

  // Expose sendToClaude for parent (selection injection)
  useImperativeHandle(ref, () => ({
    sendToClaude: (selectedText: string) => {
      const prompt = `请帮我改进以下选中的文本：\n\n> ${selectedText}`;
      sendMessage(prompt, selectedText);
    },
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0C0A09]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#292524] flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className="text-[#D97757]"
          >
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-1v-1h1v1zm2.07-4.75l-.9.92C11.45 13.9 11 14.5 11 15.5h-1v-.25c0-.75.45-1.45 1.17-2.17l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-1.66 1.34-3 3-3s3 1.34 3 3c0 .66-.27 1.26-.93 1.84z"
              fill="currentColor"
            />
          </svg>
          <span className="text-xs font-semibold text-[#78716C] uppercase tracking-wider">
            Claude
          </span>
        </div>
        {activeFile && (
          <span className="text-xs text-[#44403C]">
            上下文: {activeFile}
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-[#57534E] max-w-[240px]">
              <p className="text-sm mb-1">Claude 写作助手</p>
              <p className="text-xs leading-relaxed">
                在编辑器中选中文本发送，或直接输入问题。Claude
                会自动感知当前文件内容。
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#292524] text-[#D6D3D1]"
                  : "bg-transparent text-[#A8A29E]"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="whitespace-pre-wrap">
                  {msg.content || (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 bg-[#57534E] rounded-full animate-bounce" />
                      <span
                        className="w-1.5 h-1.5 bg-[#57534E] rounded-full animate-bounce"
                        style={{ animationDelay: "0.15s" }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-[#57534E] rounded-full animate-bounce"
                        style={{ animationDelay: "0.3s" }}
                      />
                    </span>
                  )}
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-[#292524] px-4 py-3 flex-shrink-0"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="flex-1 bg-[#1C1917] border border-[#292524] rounded-lg px-3 py-2 text-sm text-[#D6D3D1] outline-none resize-none placeholder-[#44403C] focus:border-[#44403C] transition-colors"
            placeholder={
              streaming ? "Claude 思考中..." : "输入消息... (Enter 发送)"
            }
            disabled={streaming}
            style={{ maxHeight: 120 }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="p-2 rounded-lg bg-[#D97757] text-white disabled:opacity-30 hover:bg-[#c4684a] transition-colors flex-shrink-0"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
});

ChatPanel.displayName = "ChatPanel";

export default ChatPanel;

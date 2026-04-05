"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface TerminalPanelHandle {
  sendToTerminal: (text: string) => void;
}

interface Props {
  workspacePath?: string;
}

/**
 * Terminal Panel — connects to backend WebSocket that spawns `claude` CLI.
 * Uses a simple pre-based terminal (xterm.js can be swapped in later).
 */
const TerminalPanel = forwardRef<TerminalPanelHandle, Props>(({ workspacePath }, ref) => {
  const [lines, setLines] = useState<string[]>([
    "Connecting to Claude Code CLI...",
  ]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // WebSocket connection
  useEffect(() => {
    const wsUrl = `${API_BASE.replace("http", "ws")}/api/studio/terminal`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setLines((prev) => [...prev, "✓ Connected to Claude Code CLI"]);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "stdout" || msg.type === "stderr") {
        // Split by newlines and append
        const newLines = msg.data.split("\n");
        setLines((prev) => [...prev, ...newLines]);
      } else if (msg.type === "error") {
        setLines((prev) => [...prev, `❌ ${msg.data}`]);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setLines((prev) => [...prev, "⚡ Connection closed"]);
    };

    ws.onerror = () => {
      setLines((prev) => [...prev, "❌ WebSocket error — is the backend running?"]);
    };

    return () => { ws.close(); };
  }, []);

  // Expose sendToTerminal for parent
  useImperativeHandle(ref, () => ({
    sendToTerminal: (text: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "stdin", data: text }));
        setLines((prev) => [...prev, `> ${text.trim()}`]);
      }
    },
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "stdin", data: input + "\n" }));
    setLines((prev) => [...prev, `> ${input}`]);
    setInput("");
  };

  return (
    <div className="h-full flex flex-col bg-[#0C0A09]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#292524] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-[#57534E]"}`} />
          <span className="text-xs font-semibold text-[#78716C] uppercase tracking-wider">Claude Code</span>
        </div>
        {workspacePath && (
          <span className="text-xs text-[#44403C]">{workspacePath}</span>
        )}
      </div>

      {/* Output area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs leading-5 text-[#A8A29E]"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line, i) => (
          <div key={i} className={line.startsWith(">") ? "text-[#D97757]" : line.startsWith("✓") ? "text-green-400" : line.startsWith("❌") ? "text-red-400" : ""}>
            {line}
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center border-t border-[#292524] px-3 py-2 flex-shrink-0">
        <span className="text-[#D97757] text-xs mr-2 font-mono">❯</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-transparent text-[#D6D3D1] text-xs font-mono outline-none placeholder-[#44403C]"
          placeholder={connected ? "输入消息发送给 Claude..." : "等待连接..."}
          disabled={!connected}
        />
      </form>
    </div>
  );
});

TerminalPanel.displayName = "TerminalPanel";

export default TerminalPanel;

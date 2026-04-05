"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import FileExplorer from "@/components/studio/FileExplorer";
import MarkdownEditor from "@/components/studio/MarkdownEditor";
import ChatInput from "@/components/studio/ChatInput";
import DiffView from "@/components/studio/DiffView";
import HistoryPanel from "@/components/studio/HistoryPanel";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface FileItem {
  name: string;
  size: number;
  modified: number;
}

interface HistoryEntry {
  id: number;
  timestamp: number;
  content: string;
  description: string;
}

export default function StudioPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [selection, setSelection] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [pendingChange, setPendingChange] = useState<string | null>(null);
  const historyIdRef = useRef(0);

  // Load file list
  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/studio/files`);
      const data = await res.json();
      setFiles(data.files || []);
    } catch (e) {
      console.error("Failed to load files:", e);
    }
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  // Open file
  const openFile = useCallback(async (filename: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/studio/files/${filename}`);
      const data = await res.json();
      setActiveFile(filename);
      setContent(data.content);
      setSavedContent(data.content);
      setHistory([{
        id: 0,
        timestamp: Date.now(),
        content: data.content,
        description: "打开文件",
      }]);
      historyIdRef.current = 0;
      setChatHistory([]);
      setStreamingText("");
    } catch (e) {
      console.error("Failed to open file:", e);
    }
  }, []);

  // Save file
  const saveFile = useCallback(async (newContent?: string) => {
    if (!activeFile) return;
    const toSave = newContent ?? content;
    try {
      await fetch(`${API_BASE}/api/studio/files/${activeFile}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: toSave }),
      });
      setSavedContent(toSave);
    } catch (e) {
      console.error("Failed to save:", e);
    }
  }, [activeFile, content]);

  // Create file
  const createFile = useCallback(async (filename: string) => {
    try {
      await fetch(`${API_BASE}/api/studio/files/${filename}`, { method: "POST" });
      await loadFiles();
      openFile(filename);
    } catch (e) {
      console.error("Failed to create:", e);
    }
  }, [loadFiles, openFile]);

  // Push history entry
  const pushHistory = useCallback((desc: string, newContent: string) => {
    historyIdRef.current += 1;
    setHistory(prev => [...prev, {
      id: historyIdRef.current,
      timestamp: Date.now(),
      content: newContent,
      description: desc,
    }]);
  }, []);

  // Content change from editor
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

  // Revert to history entry
  const revertTo = useCallback((entry: HistoryEntry) => {
    setContent(entry.content);
    saveFile(entry.content);
    pushHistory(`回退到: ${entry.description}`, entry.content);
  }, [saveFile, pushHistory]);

  // Accept Claude's suggested change
  const acceptChange = useCallback(() => {
    if (!pendingChange) return;
    setContent(pendingChange);
    saveFile(pendingChange);
    pushHistory("Claude 修改 ✓", pendingChange);
    setPendingChange(null);
  }, [pendingChange, saveFile, pushHistory]);

  // Reject Claude's suggested change
  const rejectChange = useCallback(() => {
    setPendingChange(null);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveFile();
      }
      if (pendingChange) {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          acceptChange();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          rejectChange();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveFile, pendingChange, acceptChange, rejectChange]);

  // Send chat message
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;

    const userMsg = { role: "user", content: text };
    setChatHistory(prev => [...prev, userMsg]);
    setStreaming(true);
    setStreamingText("");

    try {
      const res = await fetch(`${API_BASE}/api/studio/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          filename: activeFile,
          selection: selection || null,
          history: chatHistory.slice(-20),
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No reader");

      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "text") {
              fullText += data.content;
              // Hide <article_edit> content during streaming
              const cleanDisplay = fullText
                .replace(/<article_edit>[\s\S]*$/, '... ✍️ 生成修改中')
                .replace(/<article_edit>[\s\S]*?<\/article_edit>/, '');
              setStreamingText(cleanDisplay.trim());
            } else if (data.type === "error") {
              fullText = `❌ ${data.content}`;
              setStreamingText(fullText);
            }
          } catch {}
        }
      }

      // Check if response contains <article_edit> — offer to apply
      const editMatch = fullText.match(/<article_edit>\n?([\s\S]*?)\n?<\/article_edit>/);
      const displayText = editMatch
        ? fullText.replace(/<article_edit>[\s\S]*?<\/article_edit>/, '').trim()
        : fullText;

      setChatHistory(prev => [...prev, { role: "assistant", content: displayText || "已生成修改建议 ↑" }]);
      setStreamingText("");

      if (editMatch) {
        setPendingChange(editMatch[1].trim());
      }
    } catch (e: any) {
      setChatHistory(prev => [...prev, { role: "assistant", content: `❌ ${e.message}` }]);
      setStreamingText("");
    } finally {
      setStreaming(false);
      setSelection("");
    }
  }, [activeFile, selection, chatHistory, streaming, pushHistory]);

  return (
    <div className="h-screen flex flex-col bg-[#1C1917] text-[#FAFAF9]">
      {/* Top bar */}
      <div className="h-11 flex items-center justify-between px-4 border-b border-[#292524] flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-wide">Muses</span>
          <span className="text-xs text-[#57534E]">/</span>
          <span className="text-xs text-[#78716C]">{activeFile || "Studio"}</span>
          {content !== savedContent && <span className="text-[#D97757] text-xs">●</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-[#57534E]">
          <button onClick={() => saveFile()} className="px-2.5 py-1 rounded border border-[#44403C] text-[#A8A29E] hover:text-white hover:border-[#57534E] transition-colors">
            ⌘S
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: File Explorer */}
        <div className="w-[220px] flex-shrink-0 border-r border-[#292524] overflow-hidden">
          <FileExplorer
            files={files}
            activeFile={activeFile}
            onOpenFile={openFile}
            onCreateFile={createFile}
            onRefresh={loadFiles}
          />
        </div>

        {/* Center: Editor + Chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeFile ? (
            <>
              {/* Accept/Reject banner */}
              {pendingChange && (
                <div className="flex items-center justify-between px-4 py-2 bg-[#292524] border-b border-[#44403C] flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#D97757] animate-pulse" />
                    <span className="text-sm text-[#D6D3D1]">Claude 建议了修改</span>
                    <span className="text-xs text-[#57534E]">
                      {(() => {
                        const oldLines = content.split("\n").length;
                        const newLines = pendingChange.split("\n").length;
                        const diff = newLines - oldLines;
                        if (diff > 0) return `+${diff} 行`;
                        if (diff < 0) return `${diff} 行`;
                        return "内容已修改";
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={rejectChange}
                      className="text-xs px-3 py-1 rounded border border-red-800/50 text-red-400 hover:bg-red-900/30 transition-colors"
                    >
                      ✕ Reject
                    </button>
                    <button
                      onClick={acceptChange}
                      className="text-xs px-3 py-1 rounded border border-green-800/50 text-green-400 hover:bg-green-900/30 transition-colors"
                    >
                      ✓ Accept
                    </button>
                  </div>
                </div>
              )}

              {/* Editor area */}
              <div className="flex-1 overflow-hidden">
                {pendingChange ? (
                  <DiffView oldContent={content} newContent={pendingChange} />
                ) : (
                  <MarkdownEditor
                    content={content}
                    onChange={handleContentChange}
                    onSelectionChange={setSelection}
                    onSave={() => {
                      saveFile();
                      pushHistory("手动保存", content);
                    }}
                  />
                )}
              </div>

              {/* Chat input at bottom */}
              <ChatInput
                onSend={sendMessage}
                streaming={streaming}
                streamingText={streamingText}
                chatHistory={chatHistory}
                selection={selection}
                activeFile={activeFile}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#57534E]">
              <div className="text-center">
                <p className="text-lg mb-1">Muses Studio</p>
                <p className="text-sm">选择或创建文件开始写作</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: History Panel */}
        <div className="w-[280px] flex-shrink-0 border-l border-[#292524] overflow-hidden">
          <HistoryPanel
            history={history}
            onRevert={revertTo}
          />
        </div>
      </div>
    </div>
  );
}

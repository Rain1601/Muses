"use client";

import { useState, useEffect } from "react";
import { AdvancedTiptapEditor } from "@/components/AdvancedTiptapEditor";
import '@/app/editor-demo/mermaid-styles.css';

export default function TestEditorPage() {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* 标题编辑 */}
      <div className="container mx-auto py-8 max-w-6xl px-4">
        <div className="bg-card rounded-lg shadow-sm mb-6 p-6 border">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入文章标题..."
            className="w-full text-3xl font-bold border-none shadow-none p-0 h-auto resize-none focus-visible:ring-0 bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
            style={{ fontSize: '2rem', lineHeight: '2.5rem' }}
          />
          <div className="mt-2 text-sm text-muted-foreground">
            测试编辑器 • {mounted ? new Date().toLocaleString() : ''}
          </div>
        </div>

        {/* 原始编辑器 */}
        <div className="mb-8">
          {mounted ? (
            <AdvancedTiptapEditor
              initialContent=""
              onContentChange={setContent}
            />
          ) : (
            <div className="min-h-[500px] p-4 border rounded-md bg-muted/20 animate-pulse">
              <div className="h-8 bg-muted rounded mb-4"></div>
              <div className="h-4 bg-muted rounded mb-2"></div>
              <div className="h-4 bg-muted rounded mb-2 w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          )}
        </div>

        {/* 状态信息 */}
        <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>字数: {content.length}</span>
            <span>状态: 测试</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>原始编辑器</span>
          </div>
        </div>
      </div>
    </div>
  );
}
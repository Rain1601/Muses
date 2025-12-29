"use client";

import { useState, useEffect } from 'react';
import { NotionEditor } from '@/components/NotionEditor';
import { BookOpen, FileText, Check, ArrowLeftRight } from 'lucide-react';
import { useToast } from '@/components/Toast';

interface CoReadModeProps {
  articleId?: string;
  agentId?: string;
  articleContent?: string;
  initialNotes?: string;
  onNotesChange?: (notes: string) => void;
}

export function CoReadMode({
  articleId,
  agentId,
  articleContent = '',
  initialNotes = '',
  onNotesChange
}: CoReadModeProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [isSwapped, setIsSwapped] = useState(false); // 是否交换左右位置
  const { showToast } = useToast();

  // 处理文本选择
  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length > 0) {
      setSelectedText(text);
    } else {
      setSelectedText(null);
    }
  };

  // 处理采纳文本
  const handleAdoptText = () => {
    if (!selectedText) return;

    // 将选中的文本作为引用添加到笔记中
    const quotedText = `> ${selectedText.split('\n').join('\n> ')}`;
    const newNotes = notes
      ? `${notes}\n\n${quotedText}\n\n`
      : `${quotedText}\n\n`;

    setNotes(newNotes);
    if (onNotesChange) {
      onNotesChange(newNotes);
    }

    showToast('文本已添加到笔记', 'success');
    setSelectedText(null);

    // 清除选择
    window.getSelection()?.removeAllRanges();
  };

  // 处理笔记变化
  const handleNotesChange = (content: string) => {
    setNotes(content);
    if (onNotesChange) {
      onNotesChange(content);
    }
  };

  // 阅读区组件
  const ReadingSection = () => (
    <div className={`w-1/2 ${isSwapped ? 'border-l' : 'border-r'} border-border flex flex-col bg-card relative`}>
      {/* 阅读标题 */}
      <div className="border-b border-border p-4 bg-muted/30">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">阅读视图</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          选中文字点击采纳添加到笔记
        </p>
      </div>

      {/* 文章内容（只读） */}
      <div
        className="flex-1 overflow-y-auto p-8"
        onMouseUp={handleTextSelection}
      >
        {articleContent ? (
          <div
            className="prose prose-slate dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: articleContent }}
          />
        ) : (
          <div className="h-full flex items-start justify-center pt-32">
            <div className="text-center bg-background border-2 border-border rounded-xl px-8 py-10 shadow-lg max-w-sm animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <p className="text-base font-medium text-foreground mb-2">暂无内容</p>
              <p className="text-sm text-muted-foreground">请先选择一篇文章</p>
            </div>
          </div>
        )}
      </div>

      {/* 采纳按钮（浮动显示） */}
      {selectedText && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
          <button
            onClick={handleAdoptText}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-lg hover:bg-primary/90 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
          >
            <Check className="w-4 h-4" />
            <span className="text-sm font-medium">采纳到笔记</span>
          </button>
        </div>
      )}
    </div>
  );

  // 笔记区组件
  const NotesSection = () => (
    <div className="w-1/2 flex flex-col bg-background">
      <div className="border-b border-border p-4 bg-muted/30">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">阅读笔记</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          记录你的想法和摘要
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto py-8 max-w-4xl px-8">
          <NotionEditor
            key={`co-read-${articleId || 'new'}-${agentId}`}
            initialContent={notes}
            onChange={handleNotesChange}
            agentId={agentId}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-full relative">
      {/* 左右布局，根据 isSwapped 决定顺序 */}
      {isSwapped ? (
        <>
          <NotesSection />
          <ReadingSection />
        </>
      ) : (
        <>
          <ReadingSection />
          <NotesSection />
        </>
      )}

      {/* 切换左右位置的按钮 */}
      <button
        onClick={() => setIsSwapped(!isSwapped)}
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-card border-2 border-border rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary group"
        title="切换左右位置"
      >
        <ArrowLeftRight className="w-5 h-5 group-hover:scale-110 transition-transform" />
      </button>
    </div>
  );
}

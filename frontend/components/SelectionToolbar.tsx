'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

interface SelectionToolbarProps {
  onRewrite: (text: string, instruction: string) => void;
  onContinue: (text: string, instruction: string) => void;
  selection: {
    text: string;
    range: Range;
    rect: DOMRect;
  } | null;
}

export function SelectionToolbar({ onRewrite, onContinue, selection }: SelectionToolbarProps) {
  const [instruction, setInstruction] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log('SelectionToolbar - Selection changed:', selection); // 调试日志
    if (selection && selection.text.trim()) {
      // 计算位置：鼠标位置的右下方
      const { rect } = selection;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const toolbarWidth = 320; // 预估宽度
      const toolbarHeight = 100; // 预估高度
      
      // 添加滚动偏移
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      
      // 基础位置：鼠标右下方偏移 10px
      let left = rect.x + scrollX + 10;
      let top = rect.y + scrollY + 10;
      
      // 防止超出右边界
      if (left + toolbarWidth > viewportWidth + scrollX) {
        left = rect.x + scrollX - toolbarWidth - 10; // 改为显示在左侧
      }
      
      // 防止超出下边界
      if (top + toolbarHeight > viewportHeight + scrollY) {
        top = rect.y + scrollY - toolbarHeight - 10; // 改为显示在上方
      }
      
      // 确保不会太靠左或太靠上
      if (left < scrollX + 10) {
        left = scrollX + 10;
      }
      if (top < scrollY + 10) {
        top = scrollY + 10;
      }
      
      console.log('SelectionToolbar - Setting position:', { top, left, rect }); // 调试日志
      setPosition({ top, left });
      setIsVisible(true);
      
      // 聚焦输入框
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setIsVisible(false);
      setInstruction('');
    }
  }, [selection]);
  
  // 监听外部的清除事件
  useEffect(() => {
    if (!selection) {
      setIsVisible(false);
      setInstruction('');
    }
  }, [selection]);

  const handleRewrite = () => {
    if (selection) {
      onRewrite(selection.text, instruction || '优化这段文字');
      setIsVisible(false);
      setInstruction('');
    }
  };

  const handleContinue = () => {
    if (selection) {
      onContinue(selection.text, instruction || '继续写下去');
      setIsVisible(false);
      setInstruction('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (instruction.includes('续写') || instruction.includes('继续')) {
        handleContinue();
      } else {
        handleRewrite();
      }
    } else if (e.key === 'Escape') {
      setIsVisible(false);
      setInstruction('');
    }
  };

  if (!isVisible) return null;

  return (
    <div
      ref={toolbarRef}
      className={cn(
        'fixed z-[9999] p-3 bg-popover text-popover-foreground border-2 border-border rounded-lg shadow-xl',
        'animate-in fade-in slide-in-from-top-2 duration-200'
      )}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        minWidth: '300px',
        backgroundColor: '#ffffff',
        color: '#000000',
        border: '2px solid #333'
      }}
    >
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入指令（如：改写得更专业）"
            className="flex-1 px-3 py-1.5 text-sm bg-background text-foreground border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={instruction.includes('续写') || instruction.includes('继续') ? handleContinue : handleRewrite}
            className="p-1.5 hover:bg-accent rounded-md transition-colors"
            title="执行"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 10l6 4-6 4V10z" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRewrite}
            className="flex-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            ✏️ 改写
          </button>
          <button
            onClick={handleContinue}
            className="flex-1 px-3 py-1.5 text-sm bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors"
          >
            ➕ 续写
          </button>
        </div>
      </div>
    </div>
  );
}
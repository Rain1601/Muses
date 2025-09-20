"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Wand2, MessageSquare, PlusCircle, FileText, Languages, RotateCw, Loader2 } from 'lucide-react';

export type TextActionType = 'improve' | 'explain' | 'expand' | 'summarize' | 'translate' | 'rewrite';

interface TextActionToolbarProps {
  selectedText: string;
  position: { x: number; y: number };
  onAction: (actionType: TextActionType, selectedText: string) => Promise<void>;
  onClose: () => void;
  agentId: string;
  isVisible: boolean;
}

const textActionCommands = [
  {
    id: 'improve',
    icon: Wand2,
    name: '改进文本',
    description: '提升文本清晰度和说服力',
    keywords: ['improve', 'gj', '改进', '优化'],
    command: '/improve'
  },
  {
    id: 'explain',
    icon: MessageSquare,
    name: '解释文本',
    description: '详细解释概念和术语',
    keywords: ['explain', 'js', '解释', '说明'],
    command: '/explain'
  },
  {
    id: 'expand',
    icon: PlusCircle,
    name: '扩展文本',
    description: '添加更多细节和例子',
    keywords: ['expand', 'kz', '扩展', '详细'],
    command: '/expand'
  },
  {
    id: 'summarize',
    icon: FileText,
    name: '总结文本',
    description: '提取关键要点',
    keywords: ['summarize', 'zj', '总结', '概括'],
    command: '/summarize'
  },
  {
    id: 'translate',
    icon: Languages,
    name: '翻译文本',
    description: '翻译为其他语言',
    keywords: ['translate', 'fy', '翻译', '语言'],
    command: '/translate'
  },
  {
    id: 'rewrite',
    icon: RotateCw,
    name: '重写文本',
    description: '用不同方式表达',
    keywords: ['rewrite', 'cx', '重写', '改写'],
    command: '/rewrite'
  }
];

export const TextActionToolbar: React.FC<TextActionToolbarProps> = ({
  selectedText,
  position,
  onAction,
  onClose,
  agentId,
  isVisible
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 外部点击关闭逻辑
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // 如果点击的是工具栏内部，不关闭
      if (toolbarRef.current && toolbarRef.current.contains(target)) {
        return;
      }

      // 立即关闭
      onClose();
    };

    // 延迟500ms后开始监听外部点击，给用户足够时间
    const delayedSetup = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 500);

    return () => {
      clearTimeout(delayedSetup);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  // 过滤命令
  const filteredCommands = textActionCommands.filter(command =>
    command.keywords.some(keyword =>
      keyword.toLowerCase().includes(query.toLowerCase())
    ) || query === ''
  );

  // 自动聚焦输入框
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isVisible]);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isVisible) return;

      switch (event.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
          break;
        case 'Enter':
          event.preventDefault();
          if (filteredCommands[selectedIndex]) {
            handleAction(filteredCommands[selectedIndex].id as TextActionType);
          }
          break;
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isVisible, selectedIndex, filteredCommands, onClose]);

  const handleAction = async (actionType: TextActionType) => {
    if (isProcessing) return;

    setIsProcessing(true);

    try {
      await onAction(actionType, selectedText);
      onClose();
    } catch (error) {
      console.error('Text action failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isVisible || !selectedText.trim()) {
    return null;
  }

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 bg-background border border-border rounded-lg shadow-xl overflow-hidden"
      style={{
        left: `${position.x + 10}px`,
        top: `${position.y + 20}px`,
        width: '320px'
      }}
    >
      {/* 选中文本预览 */}
      <div className="px-3 py-2 bg-muted/50 border-b border-border">
        <div className="text-xs text-muted-foreground font-medium">
          选中文本: "{selectedText.slice(0, 30)}{selectedText.length > 30 ? '...' : ''}"
        </div>
      </div>

      {/* 搜索输入框 */}
      <div className="p-3 border-b border-border">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入 / 查看命令..."
          className="w-full px-3 py-2 text-sm border border-input rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground placeholder-muted-foreground"
          disabled={isProcessing}
        />
      </div>

      {/* 命令列表 */}
      <div className="max-h-64 overflow-y-auto">
        {filteredCommands.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
            没有找到匹配的命令
          </div>
        ) : (
          filteredCommands.map((command, index) => {
            const Icon = command.icon;
            const isSelected = index === selectedIndex;
            const isCurrentlyProcessing = isProcessing;

            return (
              <div
                key={command.id}
                className={`px-3 py-2 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-primary/10 border-l-2 border-l-primary'
                    : 'hover:bg-muted/50'
                } ${isCurrentlyProcessing ? 'opacity-50' : ''}`}
                onClick={() => !isCurrentlyProcessing && handleAction(command.id as TextActionType)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-muted rounded">
                    {isCurrentlyProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">
                      {command.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {command.description}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {command.command}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 提示信息 */}
      <div className="px-3 py-2 bg-muted/50 border-t border-border">
        <div className="text-xs text-muted-foreground">
          ↑↓ 选择 • Enter 执行 • Esc 关闭
        </div>
      </div>

      {/* 三角形指示器 */}
      <div className="absolute top-2 -left-2">
        <div className="w-0 h-0 border-r-4 border-t-4 border-b-4 border-r-border border-t-transparent border-b-transparent"></div>
      </div>
    </div>
  );
};

export default TextActionToolbar;
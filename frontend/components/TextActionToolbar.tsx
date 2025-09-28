"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Wand2, MessageSquare, PlusCircle, FileText, Languages, RotateCw, Loader2, Cpu, ChevronRight, ArrowLeft } from 'lucide-react';
import { TextActionDialog } from './TextActionDialog';

export type TextActionType = 'improve' | 'explain' | 'expand' | 'summarize' | 'translate' | 'rewrite';
export type ModelType = 'research' | 'openai' | 'claude' | 'gemini';

export interface ModelConfig {
  provider: string;
  modelId: string;
}

interface TextActionToolbarProps {
  selectedText: string;
  position: { x: number; y: number };
  onAction: (actionType: TextActionType, selectedText: string, modelConfig?: ModelConfig, additionalInput?: string) => Promise<any>;
  onReplace?: (newText: string) => void;
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
  },
  {
    id: 'model',
    icon: Cpu,
    name: '模型',
    description: '选择AI模型',
    keywords: ['model', 'mx', '模型', 'ai'],
    command: '/model',
    hasSubmenu: true
  }
];

const modelCommands = [
  {
    id: 'openai-gpt5',
    name: 'GPT-5 (Latest)',
    description: '最先进的模型，卓越的推理和创造力',
    keywords: ['gpt5', 'gpt-5', 'latest', 'advanced'],
    command: '/gpt5',
    provider: 'openai',
    modelId: 'gpt-5'
  },
  {
    id: 'openai-gpt5-mini',
    name: 'GPT-5 Mini',
    description: '轻量级GPT-5，快速高效',
    keywords: ['gpt5mini', 'gpt-5-mini', 'mini'],
    command: '/gpt5mini',
    provider: 'openai',
    modelId: 'gpt-5-mini'
  },
  {
    id: 'openai-gpt4.1',
    name: 'GPT-4.1',
    description: '增强版GPT-4，性能提升',
    keywords: ['gpt4.1', 'gpt-4.1', 'enhanced'],
    command: '/gpt4.1',
    provider: 'openai',
    modelId: 'gpt-4.1-2025-04-14'
  },
  {
    id: 'claude-sonnet4',
    name: 'Claude Sonnet 4',
    description: '最新Claude模型，能力增强',
    keywords: ['claude', 'sonnet', 'sonnet4', 'anthropic'],
    command: '/sonnet4',
    provider: 'claude',
    modelId: 'claude-sonnet-4-20250514'
  },
  {
    id: 'claude-haiku',
    name: 'Claude Haiku',
    description: '快速高效的Claude模型',
    keywords: ['claude', 'haiku', 'fast'],
    command: '/haiku',
    provider: 'claude',
    modelId: 'claude-3-haiku-20240307'
  }
];

export const TextActionToolbar: React.FC<TextActionToolbarProps> = ({
  selectedText,
  position,
  onAction,
  onReplace,
  onClose,
  agentId,
  isVisible
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModelSubmenu, setShowModelSubmenu] = useState(false);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [selectedModel, setSelectedModel] = useState<ModelConfig | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [currentAction, setCurrentAction] = useState<{ type: TextActionType; name: string } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 当 selectedText 改变或组件不可见时，重置状态到初始工具栏
  useEffect(() => {
    if (selectedText && isVisible) {
      // 重置所有状态到初始值
      setShowActionDialog(false);
      setCurrentAction(null);
      setQuery('');
      setSelectedIndex(0);
      setShowModelSubmenu(false);
      setSelectedModelIndex(0);
      setIsProcessing(false);
    }
  }, [selectedText, isVisible]);

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

  // 过滤模型命令
  const filteredModelCommands = modelCommands.filter(command => {
    if (query === '') return true;
    const queryLower = query.toLowerCase();
    return command.keywords.some(keyword =>
      keyword.toLowerCase().includes(queryLower)
    ) || command.name.toLowerCase().includes(queryLower) ||
    command.description.toLowerCase().includes(queryLower);
  });

  // 自动聚焦输入框
  useEffect(() => {
    if (isVisible && inputRef.current) {
      setQuery('');
      setSelectedIndex(0);
      setShowModelSubmenu(false);
      setSelectedModelIndex(0);

      // 使用 requestAnimationFrame 确保 DOM 更新后再聚焦
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current.focus({ preventScroll: true });
            console.log('✅ 输入框已自动聚焦', document.activeElement === inputRef.current);
          }
        });
      });
    }
  }, [isVisible]);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isVisible) return;

      switch (event.key) {
        case 'Escape':
          if (showModelSubmenu) {
            setShowModelSubmenu(false);
            setSelectedModelIndex(0);
          } else {
            onClose();
          }
          break;
        case 'ArrowDown':
          event.preventDefault();
          if (showModelSubmenu) {
            setSelectedModelIndex(prev => (prev + 1) % filteredModelCommands.length);
          } else {
            setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (showModelSubmenu) {
            setSelectedModelIndex(prev => (prev - 1 + filteredModelCommands.length) % filteredModelCommands.length);
          } else {
            setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
          }
          break;
        case 'ArrowRight':
          event.preventDefault();
          if (!showModelSubmenu && filteredCommands[selectedIndex]?.id === 'model') {
            setShowModelSubmenu(true);
            setSelectedModelIndex(0);
            setQuery(''); // 清空输入框
          }
          break;
        case 'ArrowLeft':
          event.preventDefault();
          if (showModelSubmenu) {
            setShowModelSubmenu(false);
            setSelectedModelIndex(0);
          }
          break;
        case 'Enter':
          event.preventDefault();
          if (showModelSubmenu && filteredModelCommands[selectedModelIndex]) {
            handleModelSelection(filteredModelCommands[selectedModelIndex]);
          } else if (filteredCommands[selectedIndex]) {
            if (filteredCommands[selectedIndex].id === 'model') {
              setShowModelSubmenu(true);
              setSelectedModelIndex(0);
              setQuery(''); // 清空输入框
            } else {
              handleAction(filteredCommands[selectedIndex].id as TextActionType);
            }
          }
          break;
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isVisible, selectedIndex, selectedModelIndex, filteredCommands, filteredModelCommands, showModelSubmenu, onClose]);

  const handleAction = async (actionType: TextActionType) => {
    if (isProcessing) return;

    // 获取动作名称
    const action = textActionCommands.find(cmd => cmd.id === actionType);
    if (!action) return;

    // 设置当前动作并显示对话框
    setCurrentAction({ type: actionType, name: action.name });
    setShowActionDialog(true);
    // 隐藏工具栏但不关闭（保持状态）
    // 工具栏会在对话框关闭后重新显示或完全关闭
  };

  const handleActionConfirm = async (additionalInput: string) => {
    if (!currentAction) throw new Error('No action selected');

    setIsProcessing(true);
    try {
      // 调用实际的文本处理
      const result = await onAction(currentAction.type, selectedText, selectedModel || undefined, additionalInput);

      // 返回处理结果
      return {
        processedText: result?.processedText || result || selectedText,
        explanation: result?.explanation
      };
    } finally {
      setIsProcessing(false);
    }
  };

  const handleActionAccept = (newText: string) => {
    // 替换编辑器中的文本
    if (onReplace) {
      onReplace(newText);
    }
    onClose();
  };

  const handleActionReject = () => {
    // 重新显示工具栏
    setShowActionDialog(false);
    setCurrentAction(null);
  };

  const handleDialogClose = () => {
    setShowActionDialog(false);
    setCurrentAction(null);
    onClose();
  };

  const handleModelSelection = (modelCommand: typeof modelCommands[0]) => {
    // Set the selected model configuration
    setSelectedModel({
      provider: modelCommand.provider,
      modelId: modelCommand.modelId
    });
    setShowModelSubmenu(false);
    setQuery(''); // Clear query
  };

  if (!isVisible || !selectedText.trim()) {
    return null;
  }

  // 如果正在显示动作对话框，隐藏工具栏
  if (showActionDialog && currentAction) {
    return (
      <TextActionDialog
        actionType={currentAction.type}
        actionName={currentAction.name}
        selectedText={selectedText}
        selectedModel={selectedModel}
        position={position}
        onConfirm={handleActionConfirm}
        onAccept={handleActionAccept}
        onReject={handleActionReject}
        onClose={handleDialogClose}
        isVisible={showActionDialog}
      />
    );
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
        {showModelSubmenu ? (
          // 模型子菜单
          <>
            <div className="px-3 py-2 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ArrowLeft
                  className="w-4 h-4 cursor-pointer hover:text-primary"
                  onClick={() => setShowModelSubmenu(false)}
                />
                <Cpu className="w-4 h-4" />
                <span>选择模型</span>
              </div>
            </div>
            {filteredModelCommands.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                没有找到匹配的模型
              </div>
            ) : (
              filteredModelCommands.map((model, index) => {
                const isSelected = index === selectedModelIndex;
                const isCurrentlyProcessing = isProcessing;

                return (
                  <div
                    key={model.id}
                    className={`px-3 py-2 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border-l-2 border-l-primary'
                        : 'hover:bg-muted/50'
                    } ${isCurrentlyProcessing ? 'opacity-50' : ''}`}
                    onClick={() => !isCurrentlyProcessing && handleModelSelection(model.id as ModelType)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-muted rounded">
                        <Cpu className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">
                          {model.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {model.description}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {model.command}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        ) : (
          // 主命令列表
          <>
            {filteredCommands.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                没有找到匹配的命令
              </div>
            ) : (
              filteredCommands.map((command, index) => {
                const Icon = command.icon;
                const isSelected = index === selectedIndex;
                const isCurrentlyProcessing = isProcessing;
                const hasSubmenu = command.hasSubmenu;

                return (
                  <div
                    key={command.id}
                    className={`px-3 py-2 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border-l-2 border-l-primary'
                        : 'hover:bg-muted/50'
                    } ${isCurrentlyProcessing ? 'opacity-50' : ''}`}
                    onClick={() => {
                      if (isCurrentlyProcessing) return;
                      if (command.id === 'model') {
                        setShowModelSubmenu(true);
                        setSelectedModelIndex(0);
                        setQuery(''); // 清空输入框
                      } else {
                        handleAction(command.id as TextActionType);
                      }
                    }}
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
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground font-mono">
                          {command.command}
                        </div>
                        {hasSubmenu && (
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* 提示信息 */}
      <div className="px-3 py-2 bg-muted/50 border-t border-border">
        <div className="text-xs text-muted-foreground">
          {showModelSubmenu
            ? '↑↓ 选择 • Enter 执行 • ← 返回 • Esc 关闭'
            : '↑↓ 选择 • → 展开 • Enter 执行 • Esc 关闭'
          }
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
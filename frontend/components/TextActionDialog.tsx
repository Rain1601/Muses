"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Check, Copy, X, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface TextActionDialogProps {
  actionType: string;
  actionName: string;
  selectedText: string;
  selectedModel?: { provider: string; modelId: string };
  position: { x: number; y: number };
  onConfirm: (additionalInput: string) => Promise<{ processedText: string; explanation?: string }>;
  onAccept: (newText: string) => void;
  onReject: () => void;
  onClose: () => void;
  isVisible: boolean;
}

export const TextActionDialog: React.FC<TextActionDialogProps> = ({
  actionType,
  actionName,
  selectedText,
  selectedModel,
  position,
  onConfirm,
  onAccept,
  onReject,
  onClose,
  isVisible
}) => {
  const [additionalInput, setAdditionalInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ processedText: string; explanation?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState<{ left: number; top: number; width: number; height: number }>({
    left: position.x,
    top: position.y + 20,
    width: 500,
    height: 450
  });

  // 智能调整对话框位置，确保不超出视口边界
  useEffect(() => {
    if (!isVisible) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 对话框尺寸
    const dialogWidth = Math.min(viewportWidth - 40, 500);
    const dialogHeight = 450;

    // 初始位置
    let dialogLeft = position.x;
    let dialogTop = position.y + 20;

    // 检查右边界
    if (dialogLeft + dialogWidth > viewportWidth - 20) {
      dialogLeft = viewportWidth - dialogWidth - 20;
    }

    // 检查左边界
    if (dialogLeft < 20) {
      dialogLeft = 20;
    }

    // 检查底部边界
    if (dialogTop + dialogHeight > viewportHeight - 20) {
      // 尝试显示在选中文本上方
      dialogTop = position.y - dialogHeight - 20;
      // 如果上方也放不下，居中显示
      if (dialogTop < 20) {
        dialogTop = Math.max(20, (viewportHeight - dialogHeight) / 2);
      }
    }

    // 检查顶部边界
    if (dialogTop < 20) {
      dialogTop = 20;
    }

    // 计算实际可用高度
    const availableHeight = Math.min(dialogHeight, viewportHeight - dialogTop - 20);

    setAdjustedPosition({
      left: dialogLeft,
      top: dialogTop,
      width: dialogWidth,
      height: availableHeight
    });
  }, [position, isVisible, result]);

  // 自动聚焦输入框
  useEffect(() => {
    if (isVisible && !result && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible, result]);

  // 处理外部点击
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isVisible) return;

      if (event.key === 'Escape') {
        if (result) {
          handleReject();
        } else {
          onClose();
        }
      } else if (event.key === 'Enter' && !event.shiftKey) {
        if (result) {
          // 如果有结果，Enter接受
          handleAccept();
        } else if (!isProcessing) {
          // 如果没有结果，Enter提交
          event.preventDefault();
          handleSubmit();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, result, isProcessing, additionalInput]);

  const handleSubmit = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await onConfirm(additionalInput);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAccept = () => {
    console.log('点击采纳按钮', result);
    if (result) {
      onAccept(result.processedText);
      onClose();
    }
  };

  const handleReject = () => {
    console.log('点击重试按钮');
    // 重置结果，让用户可以重新输入和处理
    setResult(null);
    setAdditionalInput('');
    setError(null);
    setIsProcessing(false);
    // 重新聚焦输入框
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };

  const handleCopy = async () => {
    // 确保有内容可以复制
    if (!result || !result.processedText) {
      toast.error('没有可复制的内容');
      return;
    }

    const textToCopy = String(result.processedText);
    let copySuccess = false;

    // 使用简单的复制方法
    try {
      // 方法1: 优先尝试 Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
        copySuccess = true;
      }
    } catch (err) {
      // 静默失败，尝试下一个方法
    }

    // 方法2: 使用 execCommand
    if (!copySuccess) {
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      try {
        copySuccess = document.execCommand('copy');
      } catch (err) {
        // 静默失败
      } finally {
        if (document.body.contains(textarea)) {
          document.body.removeChild(textarea);
        }
      }
    }

    // 处理结果
    if (copySuccess) {
      // 使用 toast 提示成功，样式与系统协调
      toast.success('已复制到剪贴板', {
        duration: 2000,
        position: 'bottom-center',
        style: {
          background: 'var(--background)',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
        },
      });

      // 关闭对话框和工具栏
      setTimeout(() => {
        onClose();
      }, 100);
    } else {
      // 复制失败，提示手动复制
      toast.error('复制失败，请手动选择文本复制', {
        duration: 3000,
        position: 'bottom-center',
        style: {
          background: 'var(--background)',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
        },
      });

      // 创建一个可见的文本框让用户手动复制
      const input = document.createElement('input');
      input.value = textToCopy;
      input.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10001;
        padding: 10px;
        border: 2px solid var(--border);
        border-radius: 4px;
        width: 90%;
        max-width: 500px;
        font-size: 14px;
        background: var(--background);
        color: var(--foreground);
      `;

      document.body.appendChild(input);
      input.select();

      // 监听键盘事件，检测用户手动复制
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
          setTimeout(() => {
            document.body.removeChild(input);
            toast.success('已复制到剪贴板', {
              duration: 2000,
              position: 'bottom-center',
              style: {
                background: 'var(--background)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
              },
            });
            onClose();
          }, 100);
          document.removeEventListener('keydown', handleKeyDown);
        }
      };

      document.addEventListener('keydown', handleKeyDown);

      // 5秒后自动移除
      setTimeout(() => {
        if (document.body.contains(input)) {
          document.body.removeChild(input);
          document.removeEventListener('keydown', handleKeyDown);
        }
      }, 5000);
    }
  };


  // 获取操作提示文本
  const getActionHint = () => {
    switch (actionType) {
      case 'improve':
        return '输入改进要求（可选，如：更正式、更简洁等）';
      case 'explain':
        return '输入解释重点（可选，如：技术细节、背景等）';
      case 'expand':
        return '输入扩展方向（可选，如：添加例子、更多细节等）';
      case 'summarize':
        return '输入总结要求（可选，如：要点数量、重点等）';
      case 'translate':
        return '输入目标语言（如：英文、日文、法文等）';
      case 'rewrite':
        return '输入重写风格（可选，如：更友好、更专业等）';
      default:
        return '输入额外要求（可选）';
    }
  };

  if (!isVisible) return null;

  return (
    <div
      ref={dialogRef}
      data-text-action-dialog="true"
      className="fixed z-50 bg-background border border-border rounded-lg shadow-2xl overflow-hidden flex flex-col transition-all duration-150"
      style={{
        left: `${adjustedPosition.left}px`,
        top: `${adjustedPosition.top}px`,
        width: `${adjustedPosition.width}px`,
        height: `${adjustedPosition.height}px`,
        maxHeight: `${adjustedPosition.height}px`
      }}
    >
      {/* 标题栏 */}
      <div className="px-3 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{actionName}</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!result ? (
        // 输入阶段
        <div className="p-3">
          <div className="space-y-2">
            {/* 原文预览 */}
            <div className="p-2 bg-muted/30 rounded-md max-h-[100px] overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-1">原文：</p>
              <p className="text-xs break-words">{selectedText}</p>
            </div>

            {/* 输入框 */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">{getActionHint()}</p>
              <input
                ref={inputRef}
                type="text"
                value={additionalInput}
                onChange={(e) => setAdditionalInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !isProcessing) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={`[${actionName}] 按 Enter 执行...`}
                className="w-full px-3 py-2 text-sm border border-input rounded focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                disabled={isProcessing}
              />
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* 操作提示 */}
            <div className="text-xs text-muted-foreground">
              Enter 执行 • Esc 取消
            </div>
          </div>
        </div>
      ) : (
        // 结果展示阶段
        <div className="flex flex-col flex-1 min-h-0">
          {/* 可滚动的内容区域 */}
          <div className="flex-1 p-3 overflow-y-auto">
            <div className="space-y-3">
              {/* 对比展示 - 垂直布局 */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">原文</p>
                  <div className="p-2 bg-muted/30 rounded-md max-h-[100px] overflow-y-auto">
                    <p className="text-xs whitespace-pre-wrap break-words">{selectedText}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-green-600">处理后</p>
                  <div className="p-2 bg-green-500/5 border border-green-500/20 rounded-md max-h-[150px] overflow-y-auto">
                    <p className="text-xs whitespace-pre-wrap break-words">{result.processedText}</p>
                  </div>
                </div>
              </div>

              {/* 说明（如果有） */}
              {result.explanation && (
                <div className="p-2 bg-blue-500/5 border border-blue-500/20 rounded-md">
                  <p className="text-xs font-medium text-blue-600 mb-1">修改说明</p>
                  <p className="text-xs text-muted-foreground break-words">{result.explanation}</p>
                </div>
              )}
            </div>
          </div>

          {/* 固定在底部的操作按钮 */}
          <div className="border-t border-border px-3 py-2 bg-background flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Enter 采纳 • Esc 重试
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  复制
                </button>
                <button
                  onClick={handleReject}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-destructive/10 hover:bg-destructive/20 text-destructive rounded transition-colors"
                >
                  <X className="w-3 h-3" />
                  重试
                </button>
                <button
                  onClick={handleAccept}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded transition-colors"
                >
                  <Check className="w-3 h-3" />
                  采纳
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 加载状态 */}
      {isProcessing && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">处理中...</span>
            {selectedModel && (
              <span className="text-xs text-muted-foreground">
                使用模型: {selectedModel.provider === 'openai' ? 'OpenAI' : selectedModel.provider === 'claude' ? 'Claude' : selectedModel.provider} {selectedModel.modelId}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TextActionDialog;
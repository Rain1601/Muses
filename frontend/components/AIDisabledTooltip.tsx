"use client";

import React, { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';

interface AIDisabledTooltipProps {
  isVisible: boolean;
  onClose: () => void;
}

export const AIDisabledTooltip: React.FC<AIDisabledTooltipProps> = ({
  isVisible,
  onClose
}) => {
  const [mounted, setMounted] = useState(false);
  const [dontShowUntil, setDontShowUntil] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    // 检查本地存储中的不再显示设置
    const stored = localStorage.getItem('aiTooltipDontShowUntil');
    if (stored) {
      const until = parseInt(stored, 10);
      if (!isNaN(until)) {
        setDontShowUntil(until);
      }
    }
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    // 检查是否在"不再显示"期间内
    if (dontShowUntil && Date.now() < dontShowUntil) {
      onClose();
      return;
    }

    // 5秒后自动关闭
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => {
      clearTimeout(timer);
    };
  }, [isVisible, onClose, dontShowUntil]);

  // 检查是否应该显示
  if (!mounted || !isVisible) return null;
  if (dontShowUntil && Date.now() < dontShowUntil) return null;

  const handleDontShowThisMonth = () => {
    // 设置一个月后的时间戳
    const oneMonthLater = Date.now() + 30 * 24 * 60 * 60 * 1000;
    localStorage.setItem('aiTooltipDontShowUntil', oneMonthLater.toString());
    setDontShowUntil(oneMonthLater);
    onClose();
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
      <div className="bg-background border border-border rounded-lg shadow-xl p-4 max-w-md min-w-[320px]">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 rounded hover:bg-muted transition-colors"
          aria-label="关闭"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        {/* 内容 */}
        <div className="flex items-start gap-3 pr-6">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-medium text-foreground mb-1">
              需要开启 AI 助手
            </h3>
            <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
              点击右上角 <Sparkles className="w-3 h-3 inline mx-0.5" /> 按钮或按 <kbd className="px-1.5 py-0.5 text-[10px] bg-muted rounded font-mono border">⌘O</kbd> 开启 AI 模式
            </p>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleDontShowThisMonth}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                本月不再提示
              </button>
              <span className="text-muted-foreground/30">•</span>
              <button
                onClick={onClose}
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIDisabledTooltip;
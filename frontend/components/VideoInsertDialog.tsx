"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Video, Youtube } from 'lucide-react';

interface VideoInsertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (url: string) => void;
}

export const VideoInsertDialog: React.FC<VideoInsertDialogProps> = ({
  isOpen,
  onClose,
  onInsert,
}) => {
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setUrl('');
      // 延迟聚焦以确保对话框完全渲染
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleInsert = () => {
    if (url.trim()) {
      onInsert(url.trim());
      setUrl('');
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInsert();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* 对话框 */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-background border border-border rounded-lg shadow-lg overflow-hidden">
          {/* 头部 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
                <Video className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">插入视频</h2>
                <p className="text-xs text-muted-foreground mt-0.5">支持 YouTube 和 Bilibili</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-muted rounded-md transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* 内容 */}
          <div className="p-6">
            <div className="space-y-4">
              {/* 输入框 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  视频链接
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="粘贴视频链接..."
                  className="w-full px-4 py-2.5 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground placeholder-muted-foreground transition-all"
                />
              </div>

              {/* 示例 */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">支持的格式：</p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md">
                    <Youtube className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    <code className="flex-1 text-[11px]">https://www.youtube.com/watch?v=...</code>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md">
                    <div className="w-3.5 h-3.5 flex-shrink-0 text-[#00a1d6]">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373Z"/>
                      </svg>
                    </div>
                    <code className="flex-1 text-[11px]">https://www.bilibili.com/video/BV...</code>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 底部操作栏 */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleInsert}
              disabled={!url.trim()}
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
            >
              插入视频
            </button>
          </div>
        </div>

        {/* 键盘提示 */}
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px]">Enter</kbd>
            <span>插入</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px]">Esc</kbd>
            <span>取消</span>
          </span>
        </div>
      </div>
    </>
  );
};

export default VideoInsertDialog;

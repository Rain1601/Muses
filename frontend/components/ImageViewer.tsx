"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Download, Maximize2, Minimize2 } from 'lucide-react';

interface ImageViewerProps {
  src: string;
  alt?: string;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  src,
  alt = "Image",
  isOpen,
  onClose,
  className = ""
}) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // 重置状态
  const resetView = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    setImageLoaded(false);
    setImageError(false);
  }, []);

  // 打开时重置状态
  useEffect(() => {
    if (isOpen) {
      resetView();
    }
  }, [isOpen, resetView]);

  // 键盘快捷键
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case '+':
        case '=':
          zoomIn();
          break;
        case '-':
          zoomOut();
          break;
        case 'r':
        case 'R':
          rotate();
          break;
        case '0':
          resetView();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 缩放函数
  const zoomIn = () => setScale(prev => Math.min(prev * 1.2, 5));
  const zoomOut = () => setScale(prev => Math.max(prev / 1.2, 0.1));
  const rotate = () => setRotation(prev => (prev + 90) % 360);

  // 全屏切换
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // 下载图片
  const downloadImage = async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = alt || 'image';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  // 鼠标拖拽
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 鼠标滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(0.1, Math.min(5, prev * delta)));
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center ${isFullscreen ? 'bg-black' : ''} ${className}`}
      onClick={onClose}
    >
      {/* 工具栏 */}
      <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/50 rounded-lg p-2 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); zoomOut(); }}
          className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
          title="缩小 (-)"
        >
          <ZoomOut className="w-5 h-5" />
        </button>

        <span className="text-white text-sm px-2 py-1 bg-black/30 rounded">
          {Math.round(scale * 100)}%
        </span>

        <button
          onClick={(e) => { e.stopPropagation(); zoomIn(); }}
          className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
          title="放大 (+)"
        >
          <ZoomIn className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-white/20" />

        <button
          onClick={(e) => { e.stopPropagation(); rotate(); }}
          className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
          title="旋转 (R)"
        >
          <RotateCw className="w-5 h-5" />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
          className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
          title="全屏 (F)"
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); downloadImage(); }}
          className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
          title="下载图片"
        >
          <Download className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-white/20" />

        <button
          onClick={onClose}
          className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
          title="关闭 (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 图片信息 */}
      <div className="absolute top-4 left-4 bg-black/50 rounded-lg p-3 text-white text-sm max-w-md">
        <div className="font-medium truncate">{alt}</div>
        <div className="text-white/70 mt-1">
          缩放: {Math.round(scale * 100)}% | 旋转: {rotation}°
        </div>
        <div className="text-white/50 text-xs mt-1">
          快捷键: +/- 缩放 | R 旋转 | F 全屏 | 0 重置 | Esc 关闭
        </div>
      </div>

      {/* 图片容器 */}
      <div
        className="relative max-w-full max-h-full overflow-hidden cursor-move"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {/* 加载状态 */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}

        {/* 错误状态 */}
        {imageError && (
          <div className="flex items-center justify-center p-8 text-white">
            <div className="text-center">
              <div className="text-red-400 mb-2">图片加载失败</div>
              <div className="text-sm text-white/70">请检查图片链接是否有效</div>
            </div>
          </div>
        )}

        {/* 图片 */}
        <img
          src={src}
          alt={alt}
          className={`max-w-none transition-opacity duration-200 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            transformOrigin: 'center center'
          }}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          draggable={false}
        />
      </div>

      {/* 重置按钮 */}
      {(scale !== 1 || rotation !== 0 || position.x !== 0 || position.y !== 0) && (
        <button
          onClick={(e) => { e.stopPropagation(); resetView(); }}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-lg hover:bg-black/70 transition-colors"
        >
          重置视图 (0)
        </button>
      )}
    </div>
  );
};

// Hook for easy image viewing
export const useImageViewer = () => {
  const [viewerState, setViewerState] = useState<{
    isOpen: boolean;
    src: string;
    alt: string;
  }>({
    isOpen: false,
    src: '',
    alt: ''
  });

  const openViewer = (src: string, alt?: string) => {
    setViewerState({
      isOpen: true,
      src,
      alt: alt || 'Image'
    });
  };

  const closeViewer = () => {
    setViewerState(prev => ({ ...prev, isOpen: false }));
  };

  return {
    viewerState,
    openViewer,
    closeViewer,
    ImageViewerComponent: () => (
      <ImageViewer
        src={viewerState.src}
        alt={viewerState.alt}
        isOpen={viewerState.isOpen}
        onClose={closeViewer}
      />
    )
  };
};

export default ImageViewer;
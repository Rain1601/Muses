import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import React, { useState, useRef, useEffect } from 'react';
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

// 定义图片节点的属性
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    resizableImage: {
      setResizableImage: (options: { src: string; alt?: string; width?: string; align?: string }) => ReturnType;
    };
  }
}

// React组件：可调整大小的图片
const ResizableImageComponent = ({ node, updateAttributes }: any) => {
  const [isResizing, setIsResizing] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [currentWidth, setCurrentWidth] = useState<number>(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageWrapperRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // 从节点属性获取宽度百分比
  useEffect(() => {
    const widthStr = node.attrs.width || '100%';
    const percentage = parseInt(widthStr);
    setCurrentWidth(isNaN(percentage) ? 100 : percentage);
  }, [node.attrs.width]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startX.current = e.clientX;

    if (imageWrapperRef.current) {
      const rect = imageWrapperRef.current.getBoundingClientRect();
      startWidth.current = rect.width;
    }

    // 添加全局事件监听器
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const diff = e.clientX - startX.current;
    const newWidth = startWidth.current + diff;
    const percentage = Math.min(Math.max((newWidth / containerWidth) * 100, 10), 100);

    setCurrentWidth(Math.round(percentage));
  };

  const handleMouseUp = () => {
    if (isResizing) {
      setIsResizing(false);
      // 保存最终宽度
      updateAttributes({ width: `${currentWidth}%` });
    }

    // 移除全局事件监听器
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleAlignChange = (align: 'left' | 'center' | 'right') => {
    updateAttributes({ align });
  };

  const currentAlign = node.attrs.align || 'center';

  return (
    <NodeViewWrapper
      className="resizable-image-wrapper"
      style={{
        textAlign: currentAlign,
        margin: '1rem 0'
      }}
    >
      <div
        ref={containerRef}
        style={{
          display: 'inline-block',
          position: 'relative',
          maxWidth: '100%'
        }}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => !isResizing && setShowControls(false)}
      >
        <div
          ref={imageWrapperRef}
          style={{
            position: 'relative',
            width: `${currentWidth}%`,
            display: 'inline-block'
          }}
        >
          <img
            src={node.attrs.src}
            alt={node.attrs.alt}
            style={{
              width: '100%',
              display: 'block',
              borderRadius: '0.5rem',
              userSelect: 'none'
            }}
            draggable={false}
          />

          {/* 对齐控制按钮 */}
          {showControls && !isResizing && (
            <div
              className="image-align-controls"
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                display: 'flex',
                gap: '4px',
                padding: '4px',
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.375rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                zIndex: 10
              }}
            >
              <button
                onClick={() => handleAlignChange('left')}
                style={{
                  padding: '4px',
                  borderRadius: '0.25rem',
                  backgroundColor: currentAlign === 'left' ? 'hsl(var(--primary))' : 'transparent',
                  color: currentAlign === 'left' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentAlign !== 'left') {
                    e.currentTarget.style.backgroundColor = 'hsl(var(--accent))';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentAlign !== 'left') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <AlignLeft size={16} />
              </button>
              <button
                onClick={() => handleAlignChange('center')}
                style={{
                  padding: '4px',
                  borderRadius: '0.25rem',
                  backgroundColor: currentAlign === 'center' ? 'hsl(var(--primary))' : 'transparent',
                  color: currentAlign === 'center' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentAlign !== 'center') {
                    e.currentTarget.style.backgroundColor = 'hsl(var(--accent))';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentAlign !== 'center') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <AlignCenter size={16} />
              </button>
              <button
                onClick={() => handleAlignChange('right')}
                style={{
                  padding: '4px',
                  borderRadius: '0.25rem',
                  backgroundColor: currentAlign === 'right' ? 'hsl(var(--primary))' : 'transparent',
                  color: currentAlign === 'right' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentAlign !== 'right') {
                    e.currentTarget.style.backgroundColor = 'hsl(var(--accent))';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentAlign !== 'right') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <AlignRight size={16} />
              </button>
            </div>
          )}

          {/* 调整大小的手柄 */}
          {showControls && (
            <div
              className="resize-handle"
              onMouseDown={handleMouseDown}
              style={{
                position: 'absolute',
                right: '-6px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '12px',
                height: '40px',
                cursor: 'ew-resize',
                backgroundColor: 'hsl(var(--primary))',
                borderRadius: '0.25rem',
                opacity: isResizing ? 1 : 0.7,
                transition: 'opacity 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div style={{
                width: '2px',
                height: '20px',
                backgroundColor: 'hsl(var(--primary-foreground))',
                borderRadius: '1px'
              }} />
            </div>
          )}

          {/* 显示当前宽度 */}
          {isResizing && (
            <div
              style={{
                position: 'absolute',
                bottom: '-30px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'hsl(var(--foreground))',
                color: 'hsl(var(--background))',
                padding: '4px 8px',
                borderRadius: '0.25rem',
                fontSize: '12px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                zIndex: 1000,
                pointerEvents: 'none',
              }}
            >
              {currentWidth}%
            </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
};

// Tiptap扩展定义
export const ResizableImage = Node.create({
  name: 'resizableImage',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: element => element.getAttribute('src'),
        renderHTML: attributes => {
          if (!attributes.src) {
            return {};
          }
          return {
            src: attributes.src,
          };
        },
      },
      alt: {
        default: null,
        parseHTML: element => element.getAttribute('alt'),
        renderHTML: attributes => {
          return {
            alt: attributes.alt,
          };
        },
      },
      width: {
        default: '100%',
        parseHTML: element => {
          const style = element.getAttribute('style');
          if (style) {
            const widthMatch = style.match(/width:\s*(\d+%)/);
            if (widthMatch) {
              return widthMatch[1];
            }
          }
          return element.getAttribute('width') || '100%';
        },
        renderHTML: attributes => {
          return {
            style: `width: ${attributes.width}`,
          };
        },
      },
      align: {
        default: 'center',
        parseHTML: element => {
          const parent = element.parentElement;
          if (parent) {
            const textAlign = parent.style.textAlign;
            if (textAlign === 'left' || textAlign === 'center' || textAlign === 'right') {
              return textAlign;
            }
          }
          return 'center';
        },
        renderHTML: attributes => {
          return {};
        },
      },
      // 用于上传状态
      isUploading: {
        default: false,
      },
      uploadId: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { align, ...imgAttrs } = HTMLAttributes;

    // 创建包装div用于对齐
    return [
      'div',
      { style: `text-align: ${align || 'center'}; margin: 1rem 0;` },
      ['img', imgAttrs]
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },

  addCommands() {
    return {
      setResizableImage: (options) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        });
      },
    };
  },
});

export default ResizableImage;
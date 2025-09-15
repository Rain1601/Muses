'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import styles from './NotionEditor.module.css';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import Dropcursor from '@tiptap/extension-dropcursor';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Link } from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import css from 'highlight.js/lib/languages/css';
import python from 'highlight.js/lib/languages/python';
import { api } from '@/lib/api';

const lowlight = createLowlight();
lowlight.register('javascript', javascript);
lowlight.register('typescript', typescript);
lowlight.register('css', css);
lowlight.register('python', python);

interface NotionEditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
}

// 可缩放图片组件
const ResizableImageComponent = ({ node, updateAttributes, selected }: any) => {
  const [isResizing, setIsResizing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  const imgRef = React.useRef<HTMLImageElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    setStartPos({ x: e.clientX, y: e.clientY });

    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      setStartSize({ width: rect.width, height: rect.height });
    }
  };

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (imgRef.current) {
        const deltaX = e.clientX - startPos.x;
        const newWidth = Math.max(100, startSize.width + deltaX);

        updateAttributes({
          width: newWidth,
          height: 'auto'
        });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, startPos, startSize, updateAttributes]);

  return (
    <NodeViewWrapper className="resizable-image-wrapper">
      <div className={`image-container ${selected ? 'selected' : ''}`} style={{ position: 'relative', display: 'inline-block' }}>
        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          width={node.attrs.width || 'auto'}
          height={node.attrs.height || 'auto'}
          className="rounded-lg max-w-full h-auto"
          style={{
            width: node.attrs.width ? `${node.attrs.width}px` : 'auto',
            height: node.attrs.height ? `${node.attrs.height}px` : 'auto',
            display: 'block'
          }}
        />
        {selected && (
          <div
            className="resize-handle"
            onMouseDown={handleMouseDown}
            style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              width: '12px',
              height: '12px',
              background: 'hsl(var(--primary))',
              border: '2px solid hsl(var(--background))',
              borderRadius: '50%',
              cursor: 'se-resize',
              zIndex: 10
            }}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
};

// 自定义可缩放图片扩展
const ResizableImage = Node.create({
  name: 'resizableImage',

  group: 'block',

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      width: {
        default: null,
      },
      height: {
        default: null,
      },
      isUploading: {
        default: false,
      },
      uploadId: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'img',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent)
  },
});

export function NotionEditor({ initialContent = '', onChange }: NotionEditorProps) {
  const [mounted, setMounted] = useState(false);

  // 图片上传到GitHub仓库的函数
  const uploadImageToGitHub = useCallback(async (file: File): Promise<string> => {
    console.log('🖼️ Starting image upload:', file.name, file.size, file.type);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (readerEvent) => {
        try {
          const dataURL = readerEvent.target?.result as string;
          if (!dataURL) {
            reject(new Error('Failed to read file'));
            return;
          }

          // 提取Base64数据（去除data:image/jpeg;base64,前缀）
          const base64Data = dataURL.split(',')[1];
          const contentType = dataURL.match(/data:([^;]+)/)?.[1] || 'image/jpeg';

          console.log('📤 Sending API request to /api/upload-image with:', {
            filename: file.name,
            contentType,
            base64Length: base64Data.length
          });

          // 调用API上传图片
          const response = await api.post('/api/upload-image', {
            base64Data,
            contentType,
            filename: file.name
          });

          console.log('✅ Upload successful:', response.data);
          console.log('🔗 Resolving with URL:', response.data.url);
          resolve(response.data.url);
        } catch (error) {
          console.error('❌ Failed to upload image:', error);
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Highlight,
      CodeBlockLowlight.configure({
        lowlight,
      }),
      ResizableImage,
      Dropcursor,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem,
      Link.configure({
        openOnClick: false,
      }),
      TextStyle,
      Color,
    ],
    content: initialContent || '',
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none dark:prose-invert min-h-[400px] px-6 py-6',
        style: 'font-family: "Times New Roman", "SimSun", "宋体", Times, serif;',
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (items) {
          // 收集所有图片文件
          const imageFiles = [];
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') === 0) {
              const file = items[i].getAsFile();
              if (file) {
                imageFiles.push(file);
              }
            }
          }

          if (imageFiles.length > 0) {
            event.preventDefault();
            console.log(`📸 Found ${imageFiles.length} image(s) to upload`);

            // 为每个图片创建唯一ID和占位符
            imageFiles.forEach((file, index) => {
              const uploadId = `upload_${Date.now()}_${index}`;
              console.log(`🆔 Creating upload ID: ${uploadId} for file: ${file.name}`);

              const placeholder = view.state.schema.nodes.resizableImage.create({
                src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDIwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjZjlmYWZiIiBzdHJva2U9IiNlNWU3ZWIiIHN0cm9rZS13aWR0aD0iMiIgcng9IjgiLz4KPGNpcmNsZSBjeD0iMTAwIiBjeT0iNTAiIHI9IjEyIiBzdHJva2U9IiM5Y2EzYWYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIgc3Ryb2tlLWRhc2hhcnJheT0iMTggNiIgb3BhY2l0eT0iMC44Ij4KPGFuaW1hdGVUcmFuc2Zvcm0gYXR0cmlidXRlTmFtZT0idHJhbnNmb3JtIiB0eXBlPSJyb3RhdGUiIHZhbHVlcz0iMCAxMDAgNTA7MzYwIDEwMCA1MCIgZHVyPSIxcyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz4KPC9jaXJjbGU+Cjx0ZXh0IHg9IjEwMCIgeT0iNzUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM2Yjc0ODciIGZvbnQtc2l6ZT0iMTEiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWkiPuS4iuS8oOS4rS4uLjwvdGV4dD4KPC9zdmc+',
                isUploading: true,
                uploadId: uploadId
              });

              const transaction = view.state.tr.replaceSelectionWith(placeholder);
              view.dispatch(transaction);

              // 添加小延迟避免所有请求同时发出
              setTimeout(() => {
                // 异步上传图片
                uploadImageToGitHub(file).then((githubUrl) => {
                  console.log(`🔄 Promise resolved for ${uploadId} with URL:`, githubUrl);
                  // 上传成功后，替换占位符为真实的GitHub URL
                  const currentState = view.state;

                  // 使用uploadId精确找到对应的节点
                  let foundNode = null;
                  let foundPos = -1;

                  currentState.doc.descendants((node, pos) => {
                    if (node.type.name === 'resizableImage' &&
                        node.attrs.isUploading &&
                        node.attrs.uploadId === uploadId) {
                      foundNode = node;
                      foundPos = pos;
                      return false; // 停止遍历
                    }
                  });

                  console.log(`🔍 Found node for ${uploadId}:`, foundNode?.type.name, 'at position:', foundPos);

                  if (foundNode && foundPos >= 0) {
                    console.log(`✅ Updating node ${uploadId} with new src:`, githubUrl);
                    const newTransaction = currentState.tr.setNodeMarkup(foundPos, null, {
                      ...foundNode.attrs,
                      src: githubUrl,
                      isUploading: false,
                      uploadId: null
                    });
                    view.dispatch(newTransaction);
                    console.log(`🎯 Transaction dispatched for ${uploadId}`);
                  } else {
                    console.warn(`⚠️ Node not found for upload ID: ${uploadId}`);
                  }
                }).catch((error) => {
                  console.error(`❌ Promise rejected for ${uploadId} - Image upload failed:`, error);
                  // 上传失败，可以选择保留占位符或者移除节点
                });
              }, index * 200); // 每个图片延迟200ms
            });

            return true;
          }
        }
        return false;
      },
      handleDrop: (view, event, slice, moved) => {
        if (moved || !event.dataTransfer?.files?.length) {
          return false;
        }

        const files = Array.from(event.dataTransfer.files);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));

        if (imageFiles.length > 0) {
          event.preventDefault();
          console.log(`📸 Found ${imageFiles.length} image(s) to drop`);

          const { schema } = view.state;
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });

          if (pos) {
            // 为每个图片创建占位符
            imageFiles.forEach((imageFile, index) => {
              const uploadId = `drop_${Date.now()}_${index}`;
              console.log(`🆔 Creating drop upload ID: ${uploadId} for file: ${imageFile.name}`);

              const placeholder = schema.nodes.resizableImage.create({
                src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDIwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjZjlmYWZiIiBzdHJva2U9IiNlNWU3ZWIiIHN0cm9rZS13aWR0aD0iMiIgcng9IjgiLz4KPGNpcmNsZSBjeD0iMTAwIiBjeT0iNTAiIHI9IjEyIiBzdHJva2U9IiM5Y2EzYWYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIgc3Ryb2tlLWRhc2hhcnJheT0iMTggNiIgb3BhY2l0eT0iMC44Ij4KPGFuaW1hdGVUcmFuc2Zvcm0gYXR0cmlidXRlTmFtZT0idHJhbnNmb3JtIiB0eXBlPSJyb3RhdGUiIHZhbHVlcz0iMCAxMDAgNTA7MzYwIDEwMCA1MCIgZHVyPSIxcyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz4KPC9jaXJjbGU+Cjx0ZXh0IHg9IjEwMCIgeT0iNzUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM2Yjc0ODciIGZvbnQtc2l6ZT0iMTEiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWkiPuS4iuS8oOS4rS4uLjwvdGV4dD4KPC9zdmc+',
                isUploading: true,
                uploadId: uploadId
              });

              const transaction = view.state.tr.insert(pos.pos, placeholder);
              view.dispatch(transaction);

              // 添加小延迟避免所有请求同时发出
              setTimeout(() => {
                // 异步上传图片
                uploadImageToGitHub(imageFile).then((githubUrl) => {
                  console.log(`🔄 Drag Promise resolved for ${uploadId} with URL:`, githubUrl);
                  // 上传成功后，替换占位符为真实的GitHub URL
                  const currentState = view.state;

                  // 使用uploadId精确找到对应的节点
                  let foundNode = null;
                  let foundPos = -1;

                  currentState.doc.descendants((node, pos) => {
                    if (node.type.name === 'resizableImage' &&
                        node.attrs.isUploading &&
                        node.attrs.uploadId === uploadId) {
                      foundNode = node;
                      foundPos = pos;
                      return false; // 停止遍历
                    }
                  });

                  console.log(`🔍 Drag Found node for ${uploadId}:`, foundNode?.type.name, 'at position:', foundPos);

                  if (foundNode && foundPos >= 0) {
                    console.log(`✅ Drag Updating node ${uploadId} with new src:`, githubUrl);
                    const newTransaction = currentState.tr.setNodeMarkup(foundPos, null, {
                      ...foundNode.attrs,
                      src: githubUrl,
                      isUploading: false,
                      uploadId: null
                    });
                    view.dispatch(newTransaction);
                    console.log(`🎯 Drag Transaction dispatched for ${uploadId}`);
                  } else {
                    console.warn(`⚠️ Drag Node not found for upload ID: ${uploadId}`);
                  }
                }).catch((error) => {
                  console.error(`❌ Drag Promise rejected for ${uploadId} - Image upload failed:`, error);
                  // 上传失败，可以选择保留占位符或者移除节点
                });
              }, index * 200); // 每个图片延迟200ms
            });
          }
          return true;
        }

        return false;
      },
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent || '');
    }
  }, [editor, initialContent]);

  if (!mounted || !editor) {
    return (
      <div className="min-h-[400px] px-4 py-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded mb-4"></div>
          <div className="h-4 bg-muted rounded mb-2"></div>
          <div className="h-4 bg-muted rounded mb-2 w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${styles.notionEditor}`}>
      <EditorContent
        editor={editor}
        className="notion-editor-content"
      />
    </div>
  );
}
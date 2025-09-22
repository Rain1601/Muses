'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import styles from './NotionEditor.module.css';
import '../styles/tiptap-placeholder.css';
import '../styles/text-selection.css';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
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
import { useImageViewer } from './ImageViewer';
import TextActionToolbar, { TextActionType, ModelConfig } from './TextActionToolbar';
import AIDisabledTooltip from './AIDisabledTooltip';
import { useTextActions } from '@/lib/hooks/useTextActions';
import { useAIAssistantStore } from '@/store/aiAssistant';

// 创建上下文来传递图片查看器函数
const ImageViewerContext = React.createContext<{
  openViewer: (src: string, alt?: string) => void;
} | null>(null);

const lowlight = createLowlight();
lowlight.register('javascript', javascript);
lowlight.register('typescript', typescript);
lowlight.register('css', css);
lowlight.register('python', python);

interface NotionEditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  agentId?: string; // 当前使用的Agent ID
}

// 可缩放图片组件
const ResizableImageComponent = ({ node, updateAttributes, selected }: any) => {
  const [isResizing, setIsResizing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  const imgRef = React.useRef<HTMLImageElement>(null);
  const imageViewerContext = React.useContext(ImageViewerContext);

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
          className="rounded-lg max-w-full h-auto cursor-pointer transition-opacity hover:opacity-90"
          style={{
            width: node.attrs.width ? `${node.attrs.width}px` : 'auto',
            height: node.attrs.height ? `${node.attrs.height}px` : 'auto',
            display: 'block'
          }}
          onClick={(e) => {
            // 如果正在拖拽resize handle，不要打开图片查看器
            if (!isResizing && imageViewerContext) {
              e.preventDefault();
              e.stopPropagation();
              console.log('Image clicked:', node.attrs.src);
              imageViewerContext.openViewer(node.attrs.src, node.attrs.alt || '图片');
            }
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

export function NotionEditor({ initialContent = '', onChange, agentId }: NotionEditorProps) {
  // Component initialized with agentId
  const { isEnabled: aiAssistantEnabled } = useAIAssistantStore();

  const [mounted, setMounted] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ x: 0, y: 0 });
  const [slashQuery, setSlashQuery] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [showModelSubmenu, setShowModelSubmenu] = useState(false);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);

  // 文本操作工具栏状态
  const [showTextActionToolbar, setShowTextActionToolbar] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [textActionPosition, setTextActionPosition] = useState({ x: 0, y: 0 });
  const [selectionRange, setSelectionRange] = useState<Range | null>(null);

  // AI 禁用提示工具提示状态
  const [showAIDisabledTooltip, setShowAIDisabledTooltip] = useState(false);

  const { viewerState, openViewer, closeViewer, ImageViewerComponent } = useImageViewer();
  const { executeAction } = useTextActions();

  // 文本选择处理已移至全局 selectionchange 监听器

  // 处理文本操作
  const handleTextAction = useCallback(async (actionType: TextActionType, text: string, modelConfig?: ModelConfig, additionalInput?: string) => {
    if (!agentId) {
      console.error('No agent ID provided');
      throw new Error('No agent ID provided');
    }

    try {
      // Log the selected model config for debugging
      if (modelConfig) {
        console.log('Selected model config:', modelConfig);
      }

      const result = await executeAction(agentId, text, actionType, {
        provider: modelConfig?.provider,
        model: modelConfig?.modelId,
        context: additionalInput
      });

      return result;
    } catch (error) {
      console.error('Text action failed:', error);
      throw error;
    }
  }, [agentId, executeAction]);

  // 处理文本替换
  // 注意：这个函数依赖于 editor 实例，但 editor 是由 useEditor hook 创建的
  // 所以我们不把它加入依赖数组，而是在使用时检查
  const handleReplaceText = (newText: string) => {
    if (!editor || !selectionRange) return;

    // 获取选中范围在编辑器中的位置
    const view = editor.view;
    const state = view.state;
    const { from, to } = state.selection;

    // 替换选中的文本
    const transaction = state.tr.replaceRangeWith(
      from,
      to,
      state.schema.text(newText)
    );

    view.dispatch(transaction);

    // 清除选择状态
    setSelectedText('');
    setSelectionRange(null);
    setShowTextActionToolbar(false);

    // 触发onChange回调
    if (onChange) {
      onChange(editor.getHTML());
    }
  };

  // 定义模型选项列表（与TextActionToolbar保持一致）
  const modelOptions = [
    {
      id: 'research',
      name: '开启搜索',
      description: '通用AI研究能力',
      icon: '🔍',
      command: '/research'
    },
    {
      id: 'openai',
      name: 'OpenAI',
      description: 'GPT系列模型',
      icon: '🤖',
      command: '/openai'
    },
    {
      id: 'claude',
      name: 'Claude',
      description: 'Anthropic Claude模型',
      icon: '🧠',
      command: '/claude'
    },
    {
      id: 'gemini',
      name: 'Gemini',
      description: 'Google Gemini模型',
      icon: '✨',
      command: '/gemini'
    }
  ];

  // 定义斜杠命令列表
  const slashCommands = [
    {
      id: 'image',
      name: '图片',
      description: '上传图片到文档',
      icon: '📷',
      keywords: ['img', 'image', 'tp', '图片', '上传'],
      action: (editor: any) => handleFileUpload(editor),
    },
    {
      id: 'model',
      name: '模型',
      description: '选择AI模型',
      icon: '🤖',
      keywords: ['model', 'mx', '模型', 'ai'],
      action: () => {
        setShowModelSubmenu(true);
        setSelectedModelIndex(0);
      },
    },
    {
      id: 'ai',
      name: 'AI 生成',
      description: '使用 AI 生成内容',
      icon: '✨',
      keywords: ['ai', 'generate', '生成', '智能'],
      action: () => {}, // 暂时禁用
      disabled: true,
    },
  ];

  // 根据查询过滤命令
  const filteredCommands = slashCommands.filter(command =>
    command.keywords.some(keyword =>
      keyword.toLowerCase().includes(slashQuery.toLowerCase())
    ) || slashQuery === ''
  );

  // 使用 ref 来存储最新的状态，避免闭包问题
  const slashMenuState = useRef({
    showSlashMenu: false,
    slashQuery: '',
    selectedCommandIndex: 0,
    filteredCommands: [] as any[],
    showModelSubmenu: false,
    selectedModelIndex: 0
  });

  // 更新 ref 状态
  useEffect(() => {
    slashMenuState.current = {
      showSlashMenu,
      slashQuery,
      selectedCommandIndex,
      filteredCommands,
      showModelSubmenu,
      selectedModelIndex
    };
  });

  // 键盘处理函数
  const handleKeyDown = useCallback((view: any, event: KeyboardEvent) => {
    const { state } = view;
    const { selection } = state;
    const { $from } = selection;

    // 检测斜杠输入 - 只在行首显示菜单
    if (event.key === '/') {
      const currentLine = state.doc.textBetween($from.start(), $from.pos);
      if (currentLine === '') {
        setTimeout(() => {
          const coords = view.coordsAtPos($from.pos + 1);
          const editorContent = view.dom.closest('.notion-editor-content') as HTMLElement;
          const editorContentRect = editorContent?.getBoundingClientRect();

          if (editorContentRect) {
            const relativeX = coords.left - editorContentRect.left;
            const relativeY = coords.bottom - editorContentRect.top;
            setSlashMenuPosition({ x: relativeX, y: relativeY });
          } else {
            setSlashMenuPosition({ x: 100, y: 50 });
          }

          setSlashQuery('');
          setSelectedCommandIndex(0);
          setShowSlashMenu(true);
          setShowModelSubmenu(false);
          setSelectedModelIndex(0);
        }, 100);
      }
    }

    // 斜杠菜单激活时的键盘处理
    if (slashMenuState.current.showSlashMenu) {
      // 如果在模型子菜单中
      if (slashMenuState.current.showModelSubmenu) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSelectedModelIndex(prev => (prev + 1) % modelOptions.length);
          return true;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSelectedModelIndex(prev => (prev - 1 + modelOptions.length) % modelOptions.length);
          return true;
        }

        if (event.key === 'ArrowLeft' || event.key === 'Escape') {
          event.preventDefault();
          setShowModelSubmenu(false);
          setSelectedModelIndex(0);
          return true;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          const selectedModel = modelOptions[slashMenuState.current.selectedModelIndex];

          // 删除斜杠命令文本
          const tr = state.tr.delete($from.start(), $from.pos);
          view.dispatch(tr);

          // 隐藏所有菜单
          setShowSlashMenu(false);
          setShowModelSubmenu(false);
          setSlashQuery('');

          // 这里可以添加模型选择的逻辑
          console.log('Selected model:', selectedModel.id);

          return true;
        }

        return true;
      }

      const currentLine = state.doc.textBetween($from.start(), $from.pos);

      // 更新查询字符串（仅在主菜单时）
      if (currentLine.startsWith('/') && !slashMenuState.current.showModelSubmenu) {
        const query = currentLine.substring(1);
        setTimeout(() => setSlashQuery(query), 0);
      }

      // 上下箭头选择命令
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const maxIndex = Math.max(0, slashMenuState.current.filteredCommands.length - 1);
        setSelectedCommandIndex(prev => prev < maxIndex ? prev + 1 : 0);
        return true;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const maxIndex = Math.max(0, slashMenuState.current.filteredCommands.length - 1);
        setSelectedCommandIndex(prev => prev > 0 ? prev - 1 : maxIndex);
        return true;
      }

      // 右箭头进入模型子菜单
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        const filteredCmds = slashMenuState.current.filteredCommands;
        const selectedIndex = slashMenuState.current.selectedCommandIndex;
        const selectedCommand = filteredCmds[selectedIndex];

        if (selectedCommand && selectedCommand.id === 'model') {
          setShowModelSubmenu(true);
          setSelectedModelIndex(0);
        }
        return true;
      }

      // ESC 或空格关闭菜单
      if (event.key === 'Escape' || event.key === ' ') {
        setShowSlashMenu(false);
        setSlashQuery('');
        setShowModelSubmenu(false);
        return true;
      }

      // Enter 执行选中的命令
      if (event.key === 'Enter') {
        event.preventDefault();

        const filteredCmds = slashMenuState.current.filteredCommands;
        const selectedIndex = slashMenuState.current.selectedCommandIndex;
        const selectedCommand = filteredCmds[selectedIndex];

        if (selectedCommand && !selectedCommand.disabled) {
          if (selectedCommand.id === 'model') {
            // 进入模型子菜单
            setShowModelSubmenu(true);
            setSelectedModelIndex(0);
          } else {
            // 删除斜杠命令文本
            const tr = state.tr.delete($from.start(), $from.pos);
            view.dispatch(tr);

            // 隐藏菜单
            setShowSlashMenu(false);
            setSlashQuery('');

            // 执行命令
            setTimeout(() => {
              selectedCommand.action(view);
            }, 10);
          }
        }

        return true;
      }
    }

    return false;
  }, [modelOptions]);

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

          // 生成唯一文件名（不依赖file.name，避免重复）
          const timestamp = new Date().toISOString().replace(/[:-]/g, '').split('.')[0];
          const randomId = Math.random().toString(36).substring(2, 8);
          // 正确处理 SVG 的 MIME 类型 image/svg+xml
          const contentTypeParts = contentType.split('/');
          let ext = 'png';
          if (contentTypeParts.length >= 2) {
            ext = contentTypeParts[1].split('+')[0]; // 去掉 +xml 部分
          }
          if (!['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
            ext = 'png';
          }
          const uniqueFilename = `image_${timestamp}_${randomId}.${ext}`;

          console.log('📤 Sending API request to /api/upload-image with:', {
            filename: uniqueFilename,
            contentType,
            base64Length: base64Data.length
          });

          // 调用API上传图片
          const response = await api.post('/api/upload-image', {
            base64Data,
            contentType,
            filename: uniqueFilename
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

  // 文件上传处理函数
  const handleFileUpload = useCallback((editorInstance: any) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;

    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        Array.from(files).forEach((file, index) => {
          const uploadId = `manual_upload_${Date.now()}_${index}`;
          console.log(`📁 Manual file upload: ${file.name} with ID: ${uploadId}`);

          // 创建占位符
          const placeholder = editorInstance?.state.schema.nodes.resizableImage.create({
            src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDIwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjZjlmYWZiIiBzdHJva2U9IiNlNWU3ZWIiIHN0cm9rZS13aWR0aD0iMiIgcng9IjgiLz4KPGNpcmNsZSBjeD0iMTAwIiBjeT0iNTAiIHI9IjEyIiBzdHJva2U9IiM5Y2EzYWYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIgc3Ryb2tlLWRhc2hhcnJheT0iMTggNiIgb3BhY2l0eT0iMC44Ij4KPGFuaW1hdGVUcmFuc2Zvcm0gYXR0cmlidXRlTmFtZT0idHJhbnNmb3JtIiB0eXBlPSJyb3RhdGUiIHZhbHVlcz0iMCAxMDAgNTA7MzYwIDEwMCA1MCIgZHVyPSIxcyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz4KPC9jaXJjbGU+Cjx0ZXh0IHg9IjEwMCIgeT0iNzUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM2Yjc0ODciIGZvbnQtc2l6ZT0iMTEiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWkiPuS4iuS8oOS4rS4uLjwvdGV4dD4KPC9zdmc+',
            isUploading: true,
            uploadId: uploadId
          });

          if (editorInstance) {
            const transaction = editorInstance.state.tr.replaceSelectionWith(placeholder);
            editorInstance.view.dispatch(transaction);

            // 异步上传
            setTimeout(() => {
              uploadImageToGitHub(file).then((githubUrl) => {
                console.log(`✅ Manual upload completed for ${uploadId} with URL:`, githubUrl);

                // 替换占位符为真实URL
                const currentState = editorInstance.state;
                let foundNode = null;
                let foundPos = -1;

                currentState.doc.descendants((node, pos) => {
                  if (node.type.name === 'resizableImage' &&
                      node.attrs.isUploading &&
                      node.attrs.uploadId === uploadId) {
                    foundNode = node;
                    foundPos = pos;
                    return false;
                  }
                });

                if (foundNode && foundPos >= 0) {
                  const newTransaction = currentState.tr.setNodeMarkup(foundPos, null, {
                    ...foundNode.attrs,
                    src: githubUrl,
                    isUploading: false,
                    uploadId: null
                  });
                  editorInstance.view.dispatch(newTransaction);
                }
              }).catch((error) => {
                console.error(`❌ Manual upload failed for ${uploadId}:`, error);
              });
            }, index * 200);
          }
        });
      }
    };

    input.click();
  }, [uploadImageToGitHub]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Placeholder.configure({
        placeholder: ({ node }) => {
          // 为不同的节点类型设置不同的占位符
          if (node.type.name === 'heading') {
            return '标题'
          }
          return '输入 "/" 查看命令，或开始输入内容...'
        },
        includeChildren: true, // 也在子节点显示占位符
        showOnlyCurrent: true, // 只在当前节点显示
        emptyEditorClass: 'is-editor-empty',
        emptyNodeClass: 'is-empty',
      }),
      StarterKit.configure({
        // 配置斜杠命令
        commands: {
          addCommands() {
            return {
              insertImageCommand: () => ({ commands, editor }) => {
                handleFileUpload(editor);
                return true;
              },
            };
          },
        },
      }),
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
    onUpdate: ({ editor, transaction }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }

      // 移除重复的文本选择检测，已使用全局 selectionchange 监听器

      // 检测斜杠的输入和删除
      const { state } = editor;
      const { selection } = state;
      const { $from } = selection;
      const currentLine = state.doc.textBetween($from.start(), $from.pos);

      // 检查当前行是否以斜杠开头
      if (currentLine.startsWith('/')) {
        // 如果只是斜杠，显示菜单
        if (currentLine === '/') {
          // 计算菜单位置
          const coords = editor.view.coordsAtPos($from.pos);
          const editorRect = editor.view.dom.getBoundingClientRect();

          setSlashMenuPosition({
            x: coords.left - editorRect.left,
            y: coords.top - editorRect.top + 25
          });

          setSlashQuery('');
          setSelectedCommandIndex(0);
          setShowSlashMenu(true);
        }
        // 如果斜杠后面有内容，更新查询
        else {
          setSlashQuery(currentLine.substring(1));
          // 确保菜单仍然显示
          if (!showSlashMenu) {
            const coords = editor.view.coordsAtPos($from.pos);
            const editorRect = editor.view.dom.getBoundingClientRect();

            setSlashMenuPosition({
              x: coords.left - editorRect.left,
              y: coords.top - editorRect.top + 25
            });
            setShowSlashMenu(true);
          }
        }
      }
      // 如果当前行不以斜杠开头，隐藏菜单
      else {
        if (showSlashMenu) {
          setShowSlashMenu(false);
          setSlashQuery('');
        }
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none dark:prose-invert min-h-[400px] px-6 py-6',
        style: 'font-family: "Times New Roman", "SimSun", "宋体", Times, serif;',
      },
      handleKeyDown,
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
  }, [handleFileUpload, uploadImageToGitHub]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 使用更稳定的文本选择检测
  useEffect(() => {
    if (!agentId) return;

    let selectionTimeout: NodeJS.Timeout;

    const checkSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        if (showTextActionToolbar) {
          setShowTextActionToolbar(false);
          setSelectedText('');
          setSelectionRange(null);
        }
        return;
      }

      const selectedText = selection.toString().trim();
      if (selectedText.length >= 3 && aiAssistantEnabled && agentId) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        if (rect.width > 0 && rect.height > 0) {
          setSelectedText(selectedText);
          setSelectionRange(range.cloneRange());
          setTextActionPosition({
            x: rect.right + 10,
            y: rect.bottom + 20
          });
          setShowTextActionToolbar(true);
          setShowAIDisabledTooltip(false); // 隐藏 AI 禁用提示
        }
      } else if (selectedText.length >= 3 && !aiAssistantEnabled) {
        // 显示 AI 禁用提示
        setShowAIDisabledTooltip(true);
        setShowTextActionToolbar(false);
      } else {
        // 清理所有状态
        if (showTextActionToolbar) {
          setShowTextActionToolbar(false);
          setSelectedText('');
          setSelectionRange(null);
        }
        if (showAIDisabledTooltip) {
          setShowAIDisabledTooltip(false);
        }
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      // 延迟检查选择，给浏览器时间更新选择
      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(checkSelection, 100);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // 对于键盘选择（Shift + 方向键）
      if (event.shiftKey) {
        clearTimeout(selectionTimeout);
        selectionTimeout = setTimeout(checkSelection, 100);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      clearTimeout(selectionTimeout);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [agentId, aiAssistantEnabled]);

  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent || '');
    }
  }, [editor, initialContent]);

  // 点击外部关闭斜杠菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSlashMenu) {
        const target = event.target as HTMLElement;
        if (!target.closest('.slash-menu')) {
          setShowSlashMenu(false);
          setSlashQuery('');
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showSlashMenu]);

  // 当过滤结果改变时重置选中索引
  useEffect(() => {
    if (filteredCommands.length > 0 && selectedCommandIndex >= filteredCommands.length) {
      setSelectedCommandIndex(0);
    }
  }, [filteredCommands.length, selectedCommandIndex]);

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
    <div className={`w-full ${styles.notionEditor} relative ${showTextActionToolbar ? 'keep-selection-highlight' : ''}`}>
      <ImageViewerContext.Provider value={{ openViewer }}>
        <EditorContent
          editor={editor}
          className="notion-editor-content"
        />
      </ImageViewerContext.Provider>

      {/* 图片查看器 */}
      <ImageViewerComponent />

      {/* 斜杠命令菜单 */}
      {showSlashMenu && filteredCommands.length > 0 && (
        <div
          className="slash-menu absolute z-50 bg-popover border border-border rounded-md shadow-md p-1 min-w-[200px] max-w-[300px]"
          style={{
            left: `${slashMenuPosition.x}px`,
            top: `${slashMenuPosition.y}px`,
          }}
        >
          {showModelSubmenu ? (
            // 模型子菜单
            <>
              <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 text-sm font-medium">
                <span className="text-lg">🤖</span>
                <span>选择模型</span>
              </div>
              {modelOptions.map((model, index) => {
                const isSelected = index === selectedModelIndex;
                return (
                  <button
                    key={model.id}
                    className={`w-full text-left px-3 py-2 rounded-sm flex items-center gap-2 transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'hover:bg-accent hover:text-accent-foreground'
                    }`}
                    onClick={() => {
                      const view = editor?.view;
                      if (view) {
                        // 删除斜杠命令文本
                        const { state } = view;
                        const { selection } = state;
                        const { $from } = selection;
                        const tr = state.tr.delete($from.start(), $from.pos);
                        view.dispatch(tr);

                        // 隐藏所有菜单
                        setShowSlashMenu(false);
                        setShowModelSubmenu(false);
                        setSlashQuery('');

                        // 这里可以添加模型选择的逻辑
                        console.log('Selected model:', model.id);
                      }
                    }}
                  >
                    <span className="text-lg">{model.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium">{model.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {model.description}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-xs text-muted-foreground">Enter</span>
                    )}
                  </button>
                );
              })}
              <div className="px-3 py-1 text-xs text-muted-foreground border-t border-border mt-1">
                <div className="flex items-center justify-between">
                  <span>↑↓ 选择</span>
                  <span>← 返回</span>
                  <span>Enter 确认</span>
                </div>
              </div>
            </>
          ) : (
            // 主菜单
            <>
              {filteredCommands.map((command, index) => {
                const isSelected = index === selectedCommandIndex;
                const matchedKeyword = command.keywords.find(keyword =>
                  keyword.toLowerCase().includes(slashQuery.toLowerCase())
                );

                return (
                  <button
                    key={command.id}
                    className={`w-full text-left px-3 py-2 rounded-sm flex items-center gap-2 transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'hover:bg-accent hover:text-accent-foreground'
                    } ${command.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => {
                      if (!command.disabled) {
                        if (command.id === 'model') {
                          setShowModelSubmenu(true);
                          setSelectedModelIndex(0);
                        } else {
                          const view = editor?.view;
                          if (view) {
                            // 删除斜杠命令文本
                            const { state } = view;
                            const { selection } = state;
                            const { $from } = selection;
                            const tr = state.tr.delete($from.start(), $from.pos);
                            view.dispatch(tr);

                            // 隐藏菜单
                            setShowSlashMenu(false);
                            setSlashQuery('');

                            // 执行命令
                            command.action(editor);
                          }
                        }
                      }
                    }}
                    disabled={command.disabled}
                  >
                    <span className="text-lg">{command.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-1">
                        {command.name}
                        {matchedKeyword && slashQuery && (
                          <span className="text-xs px-1 py-0.5 bg-muted rounded text-muted-foreground">
                            {matchedKeyword}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {command.description}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isSelected && (
                        <span className="text-xs text-muted-foreground">
                          {command.id === 'model' ? '→' : 'Enter'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* 底部提示 */}
              <div className="px-3 py-1 text-xs text-muted-foreground border-t border-border mt-1">
                <div className="flex items-center justify-between">
                  <span>↑↓ 选择</span>
                  <span>→ 展开</span>
                  <span>Enter 确认</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 文本操作工具栏 */}
      <TextActionToolbar
        selectedText={selectedText}
        position={textActionPosition}
        onAction={handleTextAction}
        onReplace={handleReplaceText}
        onClose={() => {
          setShowTextActionToolbar(false);
          // 保持选中状态，不清除selectedText和selectionRange
          // 这样用户可以继续使用 Cmd+B 等快捷键操作
        }}
        agentId={agentId || ''}
        isVisible={showTextActionToolbar && !!agentId && aiAssistantEnabled}
      />

      {/* AI 禁用提示工具提示 */}
      <AIDisabledTooltip
        isVisible={showAIDisabledTooltip}
        onClose={() => setShowAIDisabledTooltip(false)}
      />
    </div>
  );
}
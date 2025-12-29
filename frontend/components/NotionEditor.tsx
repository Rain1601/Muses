'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import styles from './NotionEditor.module.css';
import '../styles/tiptap-placeholder.css';
import '../styles/text-selection.css';
import '../styles/video-responsive.css';
import '../styles/editor-selection-persist.css';
import '../styles/collapsible-code.css';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import CollapsibleCodeBlock from '@/lib/tiptap-extensions/CollapsibleCodeBlock';
import ResizableImage from '@/lib/tiptap-extensions/ResizableImage';
import BilibiliVideo from '@/lib/tiptap-extensions/BilibiliVideo';
import Youtube from '@tiptap/extension-youtube';
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
// Lowlight 现在在 CollapsibleCodeBlock 中处理
import { api } from '@/lib/api';
import { VideoInsertDialog } from './VideoInsertDialog';
import { useImageViewer } from './ImageViewer';
import TextActionToolbar, { TextActionType, ModelConfig } from './TextActionToolbar';
import AIDisabledTooltip from './AIDisabledTooltip';
import { useTextActions } from '@/lib/hooks/useTextActions';
import { useAIAssistantStore } from '@/store/aiAssistant';
// import { SelectionHighlight } from '@/lib/tiptap-extensions/SelectionHighlight';  // 移除装饰系统

// 创建上下文来传递图片查看器函数
const ImageViewerContext = React.createContext<{
  openViewer: (src: string, alt?: string) => void;
} | null>(null);

// lowlight 配置已移至 CollapsibleCodeBlock 组件中

interface NotionEditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  agentId?: string; // 当前使用的Agent ID
}

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
  const [showVideoInput, setShowVideoInput] = useState(false);

  // 文本操作工具栏状态
  const [showTextActionToolbar, setShowTextActionToolbar] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [textActionPosition, setTextActionPosition] = useState({ x: 0, y: 0 });
  const [selectionRange, setSelectionRange] = useState<Range | null>(null);

  // AI 禁用提示工具提示状态
  const [showAIDisabledTooltip, setShowAIDisabledTooltip] = useState(false);

  // 使用 ref 避免闭包问题和重复触发
  const toolbarStateRef = useRef({
    showTextActionToolbar: false,
    showAIDisabledTooltip: false,
    lastSelectionTime: 0,
    lastSelectedText: ''
  });

  // 同步更新 ref
  useEffect(() => {
    toolbarStateRef.current.showTextActionToolbar = showTextActionToolbar;
    toolbarStateRef.current.showAIDisabledTooltip = showAIDisabledTooltip;
  }, [showTextActionToolbar, showAIDisabledTooltip]);

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

    // 设置光标位置到替换文本的末尾，保持焦点
    const newCursorPos = from + newText.length;
    editor.chain()
      .focus()
      .setTextSelection(newCursorPos)
      .run();

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

  // 视频插入处理函数 - 使用 useRef 存储以便在定义时访问最新的 editor
  const editorRef = useRef<any>(null);

  // 视频插入处理
  const insertVideo = useCallback((url: string) => {
    if (!url || !url.trim()) return;

    const currentEditor = editorRef.current;
    console.log('🎬 尝试插入视频:', url);

    if (!currentEditor || !currentEditor.commands) {
      console.error('❌ Editor 未初始化');
      alert('编辑器未正确初始化，请刷新页面重试');
      return;
    }

    // 检测是 YouTube 还是 Bilibili
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      console.log('🔴 检测到 YouTube 视频');
      try {
        const result = currentEditor.commands.setYoutubeVideo({
          src: url,
          width: '100%',
          height: 480
        });
        console.log('✅ YouTube 插入结果:', result);
        if (!result) {
          alert('YouTube 视频插入失败，请检查链接格式');
        }
      } catch (error) {
        console.error('❌ YouTube 插入错误:', error);
        alert('YouTube 视频插入失败: ' + (error as Error).message);
      }
    } else if (url.includes('bilibili.com')) {
      console.log('🔵 检测到 Bilibili 视频');
      try {
        const result = currentEditor.commands.setBilibiliVideo({ src: url });
        console.log('✅ Bilibili 插入结果:', result);
        if (!result) {
          alert('Bilibili 视频插入失败，请检查链接格式');
        }
      } catch (error) {
        console.error('❌ Bilibili 插入错误:', error);
        alert('Bilibili 视频插入失败: ' + (error as Error).message);
      }
    } else {
      alert('不支持的视频平台，目前仅支持 YouTube 和 Bilibili');
    }
  }, []);

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
      id: 'video',
      name: '视频',
      description: '插入 YouTube/Bilibili 视频',
      icon: '🎬',
      keywords: ['video', 'youtube', 'bilibili', 'sp', '视频', 'b站'],
      action: () => {
        // 显示视频插入对话框
        setShowVideoInput(true);
      },
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
    // 当文本操作工具栏显示时，阻止编辑器处理键盘输入
    // 让工具栏的输入框独占键盘输入
    if (toolbarStateRef.current.showTextActionToolbar) {
      // 只允许编辑器处理格式化快捷键（Cmd+B, Cmd+I 等）
      if (event.metaKey || event.ctrlKey) {
        return false; // 让编辑器处理
      }
      // 阻止其他所有键盘输入
      event.preventDefault();
      event.stopPropagation();
      return true; // 阻止编辑器处理
    }

    const { state } = view;
    const { selection } = state;
    const { $from } = selection;

    // 检测空格键，用于触发列表转换（输入 "1. " 后按空格自动创建有序列表）
    if (event.key === ' ' && !slashMenuState.current.showSlashMenu) {
      const currentLine = state.doc.textBetween($from.start(), $from.pos);
      // 匹配 "数字. " 格式（如 "1. "）
      const orderedListMatch = currentLine.match(/^(\d+)\.$/);
      if (orderedListMatch) {
        event.preventDefault();

        // 使用 editorRef 来访问 editor 实例，立即执行以减少闪烁
        if (editorRef.current) {
          // 先转换为有序列表，再删除 "1." 文本
          editorRef.current.chain()
            .deleteRange({ from: $from.start(), to: $from.pos })
            .toggleOrderedList()
            .focus()
            .run();
        }
        return true;
      }
      // 匹配 "- " 或 "* " 格式（无序列表）
      const bulletListMatch = currentLine.match(/^[-*]$/);
      if (bulletListMatch) {
        event.preventDefault();

        // 使用 editorRef 来访问 editor 实例，立即执行以减少闪烁
        if (editorRef.current) {
          // 先转换为无序列表，再删除 "-" 或 "*" 文本
          editorRef.current.chain()
            .deleteRange({ from: $from.start(), to: $from.pos })
            .toggleBulletList()
            .focus()
            .run();
        }
        return true;
      }
    }

    // 检测斜杠输入 - 只在行首显示菜单
    if (event.key === '/') {
      const currentLine = state.doc.textBetween($from.start(), $from.pos);
      if (currentLine === '') {
        setTimeout(() => {
          // 确保位置不超出文档范围
          const pos = Math.min($from.pos + 1, view.state.doc.content.size);
          const coords = view.coordsAtPos(pos);
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
          } else if (selectedCommand.id === 'video') {
            // 视频命令：删除斜杠文本，显示对话框
            const tr = state.tr.delete($from.start(), $from.pos);
            view.dispatch(tr);

            setShowSlashMenu(false);
            setSlashQuery('');
            setShowVideoInput(true);
          } else {
            // 其他命令：删除斜杠文本，执行命令，隐藏菜单
            const tr = state.tr.delete($from.start(), $from.pos);
            view.dispatch(tr);

            setShowSlashMenu(false);
            setSlashQuery('');

            // 执行命令
            setTimeout(() => {
              const editorFromView = (view as any).editor;
              selectedCommand.action(editorFromView || view);
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
    onCreate: ({ editor }) => {
      console.log('✅ Editor 创建成功');
      console.log('📦 加载的扩展:', editor.extensionManager.extensions.map(e => e.name));
      console.log('🔍 setYoutubeVideo 可用:', typeof (editor.commands as any).setYoutubeVideo);
      console.log('🔍 setBilibiliVideo 可用:', typeof (editor.commands as any).setBilibiliVideo);
      // 保存 editor 到 ref
      editorRef.current = editor;
    },
    extensions: [
      Placeholder.configure({
        placeholder: ({ node }) => {
          // 为不同的节点类型设置不同的占位符
          if (node.type.name === 'heading') {
            return '标题'
          }
          return '输入 "/" 查看命令，或开始输入内容...'
        },
        showOnlyCurrent: true, // 只在当前节点显示
        emptyEditorClass: 'is-editor-empty',
        emptyNodeClass: 'is-empty',
      }),
      StarterKit.configure({
        // 启用列表的自动转换
        orderedList: {
          HTMLAttributes: {
            class: 'list-decimal ml-6',
          },
        },
        bulletList: {
          HTMLAttributes: {
            class: 'list-disc ml-6',
          },
        },
        listItem: {
          HTMLAttributes: {
            class: 'my-1',
          },
        },
        // 禁用 CodeBlock，因为我们使用自定义的 CollapsibleCodeBlock
        codeBlock: false,
      }),
      Highlight,
      CollapsibleCodeBlock,
      ResizableImage,
      Youtube.configure({
        width: '100%',
        height: 480,
        controls: true,
        nocookie: true,
        allowFullscreen: true,
        addPasteHandler: false, // 禁用自动粘贴，避免页面刷新
        HTMLAttributes: {
          style: 'max-width: 100%; height: auto; aspect-ratio: 16/9;'
        }
      }),
      BilibiliVideo.configure({
        width: '100%',
        height: 480,
        allowFullscreen: true,
      }),
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
      // SelectionHighlight.configure({
      //   highlightClass: 'selection-highlight-decoration',
      // }),
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
    if (!editor) {
      console.log('⏳ Editor not ready yet, skipping selection detection');
      return;
    }
    console.log('✅ Selection detection effect running with editor:', !!editor);

    let selectionTimeout: NodeJS.Timeout;
    let isSelecting = false;

    const checkSelection = () => {
      try {
        const selection = window.getSelection();

        // 错误处理：selection 可能为 null
        if (!selection) {
          console.warn('⚠️ getSelection returned null');
          return;
        }

        // 没有选中文本
        if (selection.isCollapsed || selection.rangeCount === 0) {
        // 只有在确实需要关闭时才关闭
        if (toolbarStateRef.current.showTextActionToolbar && !isSelecting) {
          setShowTextActionToolbar(false);
          setSelectedText('');
          setSelectionRange(null);
          toolbarStateRef.current.lastSelectedText = '';
        }
        if (toolbarStateRef.current.showAIDisabledTooltip) {
          setShowAIDisabledTooltip(false);
        }
        return;
      }

      const selectedText = selection.toString().trim();

      // 避免重复处理相同的选择
      const now = Date.now();
      if (selectedText === toolbarStateRef.current.lastSelectedText &&
          now - toolbarStateRef.current.lastSelectionTime < 500) {
        return;
      }

      if (selectedText.length >= 3 && aiAssistantEnabled && agentId) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        if (rect.width > 0 && rect.height > 0) {
          // 更新状态
          toolbarStateRef.current.lastSelectedText = selectedText;
          toolbarStateRef.current.lastSelectionTime = now;

          setSelectedText(selectedText);
          setSelectionRange(range.cloneRange());

          // 计算工具栏位置，确保不超出屏幕
          const toolbarX = Math.min(rect.right + 10, window.innerWidth - 340);
          const toolbarY = rect.bottom + 20;

          setTextActionPosition({
            x: Math.max(10, toolbarX),
            y: toolbarY
          });

          setShowTextActionToolbar(true);
          setShowAIDisabledTooltip(false);

          console.log('📍 Text selection detected:', selectedText.slice(0, 50));
        }
      } else if (selectedText.length >= 3 && !aiAssistantEnabled) {
        // 显示 AI 禁用提示
        setShowAIDisabledTooltip(true);
        setShowTextActionToolbar(false);
        toolbarStateRef.current.lastSelectedText = '';
      } else {
        // 清理状态
        if (toolbarStateRef.current.showTextActionToolbar) {
          setShowTextActionToolbar(false);
          setSelectedText('');
          setSelectionRange(null);
          toolbarStateRef.current.lastSelectedText = '';
        }
        if (toolbarStateRef.current.showAIDisabledTooltip) {
          setShowAIDisabledTooltip(false);
        }
      }
      } catch (error) {
        console.error('❌ Error in checkSelection:', error);
      }
    };

    const handleMouseDown = () => {
      isSelecting = true;
    };

    const handleMouseUp = (event: MouseEvent) => {
      // 避免点击工具栏时触发
      const target = event.target as HTMLElement;
      if (target.closest('[data-text-action-toolbar]') ||
          target.closest('[data-text-action-dialog]')) {
        return;
      }

      // 延迟检查选择
      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(() => {
        checkSelection();
        isSelecting = false;
      }, 150);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // 支持更多键盘选择组合
      const isSelectKey = (
        event.shiftKey ||                                    // Shift + 方向键
        (event.metaKey && event.shiftKey) ||                // Cmd + Shift + 方向键
        (event.ctrlKey && event.shiftKey) ||                // Ctrl + Shift + 方向键
        ((event.metaKey || event.ctrlKey) && event.key === 'a')  // Cmd/Ctrl + A 全选
      );

      const isNavigationKey = [
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End', 'PageUp', 'PageDown'
      ].includes(event.key);

      // 如果是选择相关的按键，检查选择
      if (isSelectKey || (event.shiftKey && isNavigationKey)) {
        clearTimeout(selectionTimeout);
        selectionTimeout = setTimeout(checkSelection, 100);
      }
    };

    // 输入法事件处理 - 当工具栏显示时阻止输入法修改选中文本
    const handleCompositionStart = (e: CompositionEvent) => {
      if (toolbarStateRef.current.showTextActionToolbar) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleCompositionUpdate = (e: CompositionEvent) => {
      if (toolbarStateRef.current.showTextActionToolbar) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleCompositionEnd = (e: CompositionEvent) => {
      if (toolbarStateRef.current.showTextActionToolbar) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // 事件监听
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keyup', handleKeyUp);

    // 在捕获阶段监听输入法事件，确保在编辑器处理之前拦截
    document.addEventListener('compositionstart', handleCompositionStart, true);
    document.addEventListener('compositionupdate', handleCompositionUpdate, true);
    document.addEventListener('compositionend', handleCompositionEnd, true);

    return () => {
      clearTimeout(selectionTimeout);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('compositionstart', handleCompositionStart, true);
      document.removeEventListener('compositionupdate', handleCompositionUpdate, true);
      document.removeEventListener('compositionend', handleCompositionEnd, true);
    };
  }, [agentId, aiAssistantEnabled, editor]);

  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
      if (initialContent !== editor.getHTML()) {
        editor.commands.setContent(initialContent || '');
      }
    }
  }, [editor, initialContent]);

  // 当文本操作工具栏显示时，禁用编辑器以防止输入冲突
  useEffect(() => {
    if (editor) {
      editor.setEditable(!showTextActionToolbar);
      console.log('🔒 Editor editable:', !showTextActionToolbar);
    }
  }, [editor, showTextActionToolbar]);

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
    <div className={`w-full ${styles.notionEditor} relative`}>
      <ImageViewerContext.Provider value={{ openViewer }}>
        <EditorContent
          editor={editor}
          className="notion-editor-content"
        />
      </ImageViewerContext.Provider>

      {/* 图片查看器 */}
      <ImageViewerComponent />

      {/* 视频插入对话框 */}
      <VideoInsertDialog
        isOpen={showVideoInput}
        onClose={() => setShowVideoInput(false)}
        onInsert={insertVideo}
      />

      {/* 斜杠命令菜单 */}
      {showSlashMenu && (showModelSubmenu || filteredCommands.length > 0) && (
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
                        } else if (command.id === 'video') {
                          // 视频命令：删除斜杠文本，显示对话框
                          const view = editor?.view;
                          if (view) {
                            const { state } = view;
                            const { selection } = state;
                            const { $from } = selection;
                            const tr = state.tr.delete($from.start(), $from.pos);
                            view.dispatch(tr);
                          }

                          setShowSlashMenu(false);
                          setSlashQuery('');
                          setShowVideoInput(true);
                        } else {
                          // 其他命令：删除斜杠文本，执行命令，隐藏菜单
                          const view = editor?.view;
                          if (view) {
                            const { state } = view;
                            const { selection } = state;
                            const { $from } = selection;
                            const tr = state.tr.delete($from.start(), $from.pos);
                            view.dispatch(tr);

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
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import styles from './NotionEditor.module.css';
import '../styles/tiptap-placeholder.css';
import '../styles/text-selection.css';
import '../styles/video-responsive.css';
import '../styles/editor-selection-persist.css';
import '../styles/collapsible-code.css';
import '../styles/editor-line-numbers.css';
import '../styles/notion-drag-handle.css';
import '../styles/pending-block.css';
import '../styles/comments.css';
import '../styles/chips-charts.css';
import StarterKit from '@tiptap/starter-kit';
import { SlotDecorations, AiSource } from '@/lib/tiptap-extensions/PromptSlot';
import type { SlotState } from '@/lib/tiptap-extensions/PromptSlot';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import CollapsibleCodeBlock from '@/lib/tiptap-extensions/CollapsibleCodeBlock';
import ResizableImage from '@/lib/tiptap-extensions/ResizableImage';
import BilibiliVideo from '@/lib/tiptap-extensions/BilibiliVideo';
import SelectionPersistence from '@/lib/tiptap-extensions/SelectionPersistence';
import { LineNumbers } from '@/lib/tiptap-extensions/LineNumbers';
import Youtube from '@tiptap/extension-youtube';
import DragHandle from '@tiptap/extension-drag-handle';
import PendingBlock from '@/lib/tiptap-extensions/PendingBlock';
import CommentAnchor from '@/lib/tiptap-extensions/CommentAnchor';
import { SuggestionInsert, SuggestionDelete, proposeReplacement } from '@/lib/tiptap-extensions/Suggestion';
import { DateChip, StatusChip } from '@/lib/tiptap-extensions/Chips';
import ChartBlock, { tableNodeToCsv } from '@/lib/tiptap-extensions/ChartBlock';
import ExtensionGuard, { EXTENSION_OPT_OUT_ATTRS } from '@/lib/tiptap-extensions/ExtensionGuard';
// Dropcursor 已包含在 StarterKit 中，无需单独导入
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
import { useTextActions, TextActionEditRecord } from '@/lib/hooks/useTextActions';
import { getContextConfig } from '@/components/ContextConfigPanel';
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
  onSelectionChange?: (selectedText: string, from?: number, to?: number) => void;
  onEditorReady?: (editor: any) => void;
  /**
   * Returns the live slot-state map so the bracket decoration plugin can render
   * status dots. When omitted, brackets render as plain text and the system is
   * inert. Both PromptSlot and AiSource are otherwise always loaded.
   */
  getSlotState?: () => Map<string, SlotState>;
  /** 当前文章标题 — 注入到文档上下文 header；同时在编辑区顶部展示为可编辑大标题 */
  articleTitle?: string;
  /**
   * 标题变化回调 (trim 后非空才触发, debounce 700ms + onBlur flush)。
   * 不传 → 编辑区顶部标题区不渲染 (例如 Studio Markdown 文件场景)。
   */
  onTitleChange?: (title: string) => void;
  /** 本文最近 AI 编辑记录 — 后端 ContextBuilder 据此拼"最近 N 次编辑"段 */
  editHistory?: TextActionEditRecord[];
}

export function NotionEditor({ initialContent = '', onChange, agentId, onSelectionChange, onEditorReady, getSlotState, articleTitle, onTitleChange, editHistory }: NotionEditorProps) {
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

  // ── 编辑区顶部可编辑大标题 ───────────────────────────────
  // non-controlled with seed: 切文章时父组件用 key 触发 remount, 自然 re-seed。
  const [titleDraft, setTitleDraft] = useState<string>(articleTitle ?? '');
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleLastSavedRef = useRef<string>(articleTitle ?? '');
  const titleFocusedRef = useRef<boolean>(false);

  // textarea 自动撑高
  const resizeTitleTextarea = useCallback(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // 同文章被 sidebar 重命名时 key 不变 → 非聚焦下回填到 textarea, 聚焦时不动以免抢用户输入
  useEffect(() => {
    if (articleTitle === undefined) return;
    if (titleFocusedRef.current) return;
    if (articleTitle === titleDraft) return;
    setTitleDraft(articleTitle);
    titleLastSavedRef.current = articleTitle;
    // 下一帧再 resize, 等 React 把新值刷进 DOM
    requestAnimationFrame(resizeTitleTextarea);
  }, [articleTitle]);  // eslint-disable-line react-hooks/exhaustive-deps

  // 首次 mount 后撑高一次 (长标题)
  useEffect(() => { resizeTitleTextarea(); }, [resizeTitleTextarea]);

  const flushTitle = useCallback((value: string) => {
    if (!onTitleChange) return;
    const trimmed = value.trim();
    if (!trimmed) return;  // 空标题不提交, 保留原值; placeholder 占位
    if (trimmed === titleLastSavedRef.current) return;
    titleLastSavedRef.current = trimmed;
    onTitleChange(trimmed);
  }, [onTitleChange]);

  const handleTitleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setTitleDraft(v);
    resizeTitleTextarea();
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    titleDebounceRef.current = setTimeout(() => flushTitle(v), 700);
  }, [flushTitle, resizeTitleTextarea]);

  const handleTitleBlur = useCallback(() => {
    titleFocusedRef.current = false;
    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
      titleDebounceRef.current = null;
    }
    flushTitle(titleDraft);
  }, [flushTitle, titleDraft]);

  const handleTitleFocus = useCallback(() => {
    titleFocusedRef.current = true;
  }, []);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // IME 候选 Enter 不能误触发失焦
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      titleRef.current?.blur();
    }
  }, []);

  // unmount 时 flush 未保存改动, 防止切文章时丢
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) {
        clearTimeout(titleDebounceRef.current);
        titleDebounceRef.current = null;
      }
      const trimmed = titleDraft.trim();
      if (onTitleChange && trimmed && trimmed !== titleLastSavedRef.current) {
        onTitleChange(trimmed);
      }
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

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

      // ── Context Injection: 从 editor 抽出文档全文 + 选区位置 ──
      // editor 由 useEditor 创建, 此处通过闭包访问 (调用时已初始化)。
      // 失败回退到旧行为(不注入文档上下文), 不影响主流程。
      let articleContent: string | undefined;
      let selectionStart: number | undefined;
      let selectionEnd: number | undefined;
      try {
        if (editor) {
          const blockSep = '\n\n';
          articleContent = editor.getText({ blockSeparator: blockSep });
          const { from, to } = editor.state.selection;
          selectionStart = editor.state.doc.textBetween(0, from, blockSep).length;
          selectionEnd = editor.state.doc.textBetween(0, to, blockSep).length;
        }
      } catch (extractErr) {
        console.warn('Failed to extract editor context (falling back to no doc context):', extractErr);
        articleContent = undefined;
      }

      const result = await executeAction(agentId, text, actionType, {
        provider: modelConfig?.provider,
        model: modelConfig?.modelId,
        context: additionalInput,
        articleTitle,
        articleContent,
        selectionStart,
        selectionEnd,
        editHistory,
        contextConfig: getContextConfig() as unknown as Record<string, unknown>,
      });

      return result;
    } catch (error) {
      console.error('Text action failed:', error);
      throw error;
    }
    // editor 由 useEditor 内部 ref 管理, 此处闭包访问即可; 不加入 deps 避免每次
    // 编辑器内部刷新都重建 callback (TextActionToolbar 也会跟着 re-mount)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, executeAction, articleTitle, editHistory]);

  // 处理文本替换
  // 注意：这个函数依赖于 editor 实例，但 editor 是由 useEditor hook 创建的
  // 所以我们不把它加入依赖数组，而是在使用时检查
  const handleReplaceText = (newText: string) => {
    if (!editor || !selectionRange) return;

    // 获取选中范围在编辑器中的位置
    const view = editor.view;
    const state = view.state;
    const { from, to } = state.selection;

    // AI 结果以建议的形式落地（划掉原文 + 插入新文），由用户接受或拒绝
    proposeReplacement(editor, { from, to }, newText, { author: 'claude' });

    // 清除选择状态
    setSelectedText('');
    setSelectionRange(null);
    setShowTextActionToolbar(false);

    // 光标放到建议插入文字的末尾 (原文 + 新文)，保持焦点
    const newCursorPos = to + newText.length;
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

  // "/" opens the menu at line start, after whitespace, or after CJK punctuation
  // ("状态：/日期"), so inline chips can be inserted mid-line. Returns where the
  // "/query" text starts so a command deletes just that, not the whole line.
  const slashTrigger = (state: any): { from: number; query: string } | null => {
    const { $from } = state.selection;
    if (!state.selection.empty || !$from.parent.isTextblock) return null;
    const line = state.doc.textBetween($from.start(), $from.pos, undefined, '\ufffc');
    const m = line.match(/(?:^|[\s，。：；、！？（）【】「」])\/([^\s/]*)$/);
    return m ? { from: $from.pos - m[1].length - 1, query: m[1] } : null;
  };

  // 定义斜杠命令列表 (Notion 风格分组)
  const slashCommands: Array<{
    id: string;
    name: string;
    description: string;
    group: string;
    keywords: string[];
    action: (editor: any) => void;
    disabled?: boolean;
  }> = [
    // 基础块
    {
      id: 'h1',
      name: '标题 1',
      description: '一级大标题',
      group: '基础块',
      keywords: ['h1', 'heading1', '标题1', 'biaoti1', 'bt1'],
      action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      id: 'h2',
      name: '标题 2',
      description: '二级中等标题',
      group: '基础块',
      keywords: ['h2', 'heading2', '标题2', 'biaoti2', 'bt2'],
      action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      id: 'h3',
      name: '标题 3',
      description: '三级小标题',
      group: '基础块',
      keywords: ['h3', 'heading3', '标题3', 'biaoti3', 'bt3'],
      action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      id: 'quote',
      name: '引用',
      description: '引用文本块',
      group: '基础块',
      keywords: ['quote', 'yy', '引用', 'yinyong'],
      action: (editor) => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      id: 'divider',
      name: '分割线',
      description: '插入水平分割线',
      group: '基础块',
      keywords: ['divider', 'hr', 'fgx', '分割线', 'fenge'],
      action: (editor) => editor.chain().focus().setHorizontalRule().run(),
    },
    {
      id: 'code',
      name: '代码块',
      description: '语法高亮 + 可折叠',
      group: '基础块',
      keywords: ['code', 'codeblock', 'dm', '代码', 'daima'],
      action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    },

    // 列表
    {
      id: 'todo',
      name: '待办列表',
      description: '可勾选的复选框',
      group: '列表',
      keywords: ['todo', 'task', 'db', '待办', 'daiban', 'checkbox'],
      action: (editor) => editor.chain().focus().toggleTaskList().run(),
    },
    {
      id: 'bullet',
      name: '无序列表',
      description: '项目符号列表',
      group: '列表',
      keywords: ['bullet', 'ul', 'wxlb', '无序', 'wuxu', 'list'],
      action: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      id: 'ordered',
      name: '有序列表',
      description: '编号列表',
      group: '列表',
      keywords: ['ordered', 'ol', 'yxlb', '有序', 'youxu', 'numbered'],
      action: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },

    // 高级
    {
      id: 'table',
      name: '表格',
      description: '插入 3×3 表格',
      group: '高级',
      keywords: ['table', 'bg', '表格', 'biaoge'],
      action: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      id: 'highlight',
      name: '文字高亮',
      description: '黄色背景高亮',
      group: '高级',
      keywords: ['highlight', 'gl', '高亮', 'gaoliang', 'mark'],
      action: (editor) => editor.chain().focus().toggleHighlight().run(),
    },

    // 插入
    {
      id: 'date',
      name: '日期',
      description: '可点选修改的日期（截止、评审…）',
      group: '插入',
      keywords: ['date', 'rq', '日期', 'riqi', 'deadline', '截止'],
      action: (editor) => editor.chain().focus().insertDateChip().run(),
    },
    {
      id: 'status',
      name: '状态',
      description: '未开始 / 进行中 / 已完成 / 受阻',
      group: '插入',
      keywords: ['status', 'zt', '状态', 'zhuangtai', 'dropdown', '下拉'],
      action: (editor) => editor.chain().focus().insertStatusChip().run(),
    },
    {
      id: 'chart',
      name: '图表',
      description: '柱状 / 折线图；紧跟在表格下方时用表格的数据',
      group: '插入',
      keywords: ['chart', 'tb', '图表', 'tubiao', 'graph', 'bar', 'line', '柱状', '折线'],
      action: (editor) => {
        // Right under a table → draw that table's rows.
        const { $from } = editor.state.selection;
        const blockStart = $from.depth >= 1 ? $from.before(1) : $from.pos;
        const above = editor.state.doc.resolve(blockStart).nodeBefore;
        const csv = above?.type.name === 'table' ? tableNodeToCsv(above) : undefined;
        editor.chain().focus().insertChart(csv ? { csv } : {}).run();
      },
    },
    {
      id: 'image',
      name: '图片',
      description: '上传图片到文档',
      group: '插入',
      keywords: ['img', 'image', 'tp', '图片', '上传', 'tupian'],
      action: (editor: any) => handleFileUpload(editor),
    },
    {
      id: 'video',
      name: '视频',
      description: '插入 YouTube / Bilibili',
      group: '插入',
      keywords: ['video', 'youtube', 'bilibili', 'sp', '视频', 'b站', 'shipin'],
      action: () => {
        setShowVideoInput(true);
      },
    },

    // AI
    {
      id: 'model',
      name: '模型',
      description: '选择 AI 模型',
      group: 'AI',
      keywords: ['model', 'mx', '模型', 'moxing'],
      action: () => {
        setShowModelSubmenu(true);
        setSelectedModelIndex(0);
      },
    },
    {
      id: 'ai',
      name: '让 Claude 写',
      description: '先列大纲，再逐节写',
      group: 'AI',
      keywords: ['ai', 'claude', 'generate', 'write', '生成', 'shengcheng', '写', 'xie'],
      action: () => {
        window.dispatchEvent(new CustomEvent('muses:open-doc-writer'));
      },
    },
    {
      id: 'pending',
      name: '占位块',
      description: '写下这一节要写什么，稍后让 Claude 写',
      group: 'AI',
      keywords: ['pending', 'placeholder', 'zw', '占位', 'zhanwei', 'outline', '大纲'],
      action: (editor) => editor.chain().focus().insertPendingBlock().run(),
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

      const trigger = slashTrigger(state);

      // 更新查询字符串（仅在主菜单时）
      if (trigger && !slashMenuState.current.showModelSubmenu) {
        const query = trigger.query;
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
        const filteredCmds = slashMenuState.current.filteredCommands;
        const selectedIndex = slashMenuState.current.selectedCommandIndex;
        const selectedCommand = filteredCmds[selectedIndex];
        // No matching command (e.g. "和/或" typed as prose) → close the menu, keep Enter.
        if (!selectedCommand && !slashMenuState.current.showModelSubmenu) {
          setShowSlashMenu(false);
          setSlashQuery('');
          return false;
        }
        event.preventDefault();
        const slashFrom = slashTrigger(state)?.from ?? $from.start();

        if (selectedCommand && !selectedCommand.disabled) {
          if (selectedCommand.id === 'model') {
            // 进入模型子菜单
            setShowModelSubmenu(true);
            setSelectedModelIndex(0);
          } else if (selectedCommand.id === 'video') {
            // 视频命令：删除斜杠文本，显示对话框
            const tr = state.tr.delete(slashFrom, $from.pos);
            view.dispatch(tr);

            setShowSlashMenu(false);
            setSlashQuery('');
            setShowVideoInput(true);
          } else {
            // 其他命令：删除 "/query" 文本，执行命令，隐藏菜单
            const tr = state.tr.delete(slashFrom, $from.pos);
            view.dispatch(tr);

            setShowSlashMenu(false);
            setSlashQuery('');

            // 执行命令
            setTimeout(() => {
              // TipTap puts the editor on view.dom, not on the view itself.
              const editorFromView = (view.dom as any).editor || editorRef.current;
              selectedCommand.action(editorFromView);
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
      onEditorReady?.(editor);
    },
    extensions: [
      ExtensionGuard,
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
        // 禁用 Link，因为我们单独配置它
        link: false,
      }),
      AiSource,
      PendingBlock,
      CommentAnchor,
      SuggestionInsert,
      SuggestionDelete,
      DateChip,
      StatusChip,
      ChartBlock,
      ...(getSlotState ? [SlotDecorations({ getState: getSlotState })] : []),
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
      SelectionPersistence.configure({
        className: 'selection-decoration',
        onSelectionPersist: (info) => {
          onSelectionChange?.(info.text, info.from, info.to);
        },
        onSelectionClear: () => {
          onSelectionChange?.('', undefined, undefined);
        },
      }),
      LineNumbers,
      DragHandle.configure({
        render: () => {
          const el = document.createElement('div');
          el.className = 'notion-drag-handle';
          el.setAttribute('aria-label', '拖拽块');
          // 6 个小圆点 (Notion ⋮⋮ 标志)
          el.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <circle cx="4" cy="3" r="1.2"/>
              <circle cx="10" cy="3" r="1.2"/>
              <circle cx="4" cy="7" r="1.2"/>
              <circle cx="10" cy="7" r="1.2"/>
              <circle cx="4" cy="11" r="1.2"/>
              <circle cx="10" cy="11" r="1.2"/>
            </svg>
          `;
          return el;
        },
      }),
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
      const trigger = slashTrigger(state);

      // 光标前是一个 "/query"（行首、空白或中文标点之后）
      if (trigger) {
        // 如果只是斜杠，显示菜单
        if (trigger.query === '') {
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
          setSlashQuery(trigger.query);
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
      // 光标前没有 "/query"，隐藏菜单
      else {
        if (showSlashMenu) {
          setShowSlashMenu(false);
          setSlashQuery('');
        }
      }
    },
    editorProps: {
      attributes: {
        ...EXTENSION_OPT_OUT_ATTRS,
        class: 'notranslate prose prose-lg max-w-none focus:outline-none dark:prose-invert min-h-[400px] px-6 py-6',
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

  // Selection detection is now handled by the SelectionPersistence TipTap extension

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
      {articleTitle !== undefined && onTitleChange && (
        <div className={styles.docTitleWrap}>
          <textarea
            ref={titleRef}
            className={styles.docTitle}
            value={titleDraft}
            placeholder="Untitled"
            rows={1}
            maxLength={200}
            spellCheck={false}
            onChange={handleTitleInput}
            onBlur={handleTitleBlur}
            onFocus={handleTitleFocus}
            onKeyDown={handleTitleKeyDown}
          />
        </div>
      )}
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

      {/* 斜杠命令菜单 — Notion 风格列表 */}
      {showSlashMenu && (showModelSubmenu || filteredCommands.length > 0) && (
        <div
          className="slash-menu absolute z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[260px] max-w-[320px]"
          style={{
            left: `${slashMenuPosition.x}px`,
            top: `${slashMenuPosition.y}px`,
          }}
        >
          {showModelSubmenu ? (
            // 模型子菜单
            <>
              <div className="px-3 pt-1.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                选择模型
              </div>
              {modelOptions.map((model, index) => {
                const isSelected = index === selectedModelIndex;
                return (
                  <button
                    key={model.id}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/60'
                    }`}
                    onClick={() => {
                      const view = editor?.view;
                      if (view) {
                        const { state } = view;
                        const { selection } = state;
                        const { $from } = selection;
                        const tr = state.tr.delete($from.start(), $from.pos);
                        view.dispatch(tr);

                        setShowSlashMenu(false);
                        setShowModelSubmenu(false);
                        setSlashQuery('');

                        console.log('Selected model:', model.id);
                      }
                    }}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm leading-tight truncate">{model.name}</span>
                      <span className="text-xs text-muted-foreground leading-tight truncate">
                        {model.description}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="text-[11px] text-muted-foreground shrink-0">Enter</span>
                    )}
                  </button>
                );
              })}
              <div className="px-3 pt-1 pb-0.5 mt-1 border-t border-border text-[11px] text-muted-foreground flex items-center justify-between">
                <span>↑↓ 选择</span>
                <span>← 返回</span>
                <span>Enter 确认</span>
              </div>
            </>
          ) : (
            // 主菜单 — 分组列表 (Notion 风格)
            <>
              {(() => {
                // 按 group 分组, 保留原 flatIndex 给键盘导航
                const grouped: Array<[string, Array<{ cmd: typeof filteredCommands[number]; flatIndex: number }>]> = [];
                const groupMap = new Map<string, Array<{ cmd: typeof filteredCommands[number]; flatIndex: number }>>();
                filteredCommands.forEach((cmd, flatIndex) => {
                  const g = cmd.group || '其他';
                  if (!groupMap.has(g)) {
                    groupMap.set(g, []);
                    grouped.push([g, groupMap.get(g)!]);
                  }
                  groupMap.get(g)!.push({ cmd, flatIndex });
                });

                return grouped.map(([groupName, items]) => (
                  <div key={groupName} className="mb-0.5 last:mb-0">
                    <div className="px-3 pt-1.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {groupName}
                    </div>
                    {items.map(({ cmd: command, flatIndex }) => {
                      const isSelected = flatIndex === selectedCommandIndex;
                      const matchedKeyword = command.keywords.find(keyword =>
                        keyword.toLowerCase().includes(slashQuery.toLowerCase())
                      );

                      return (
                        <button
                          key={command.id}
                          className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-3 transition-colors ${
                            isSelected
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-accent/60'
                          } ${command.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={() => {
                            if (command.disabled) return;
                            if (command.id === 'model') {
                              setShowModelSubmenu(true);
                              setSelectedModelIndex(0);
                              return;
                            }
                            const view = editor?.view;
                            if (!view) return;
                            const { state } = view;
                            const { $from } = state.selection;
                            const tr = state.tr.delete(slashTrigger(state)?.from ?? $from.start(), $from.pos);
                            view.dispatch(tr);
                            setShowSlashMenu(false);
                            setSlashQuery('');
                            if (command.id === 'video') {
                              setShowVideoInput(true);
                            } else {
                              command.action(editor);
                            }
                          }}
                          disabled={command.disabled}
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm leading-tight truncate">{command.name}</span>
                            <span className="text-xs text-muted-foreground leading-tight truncate">
                              {command.description}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {matchedKeyword && slashQuery && (
                              <span className="text-[11px] text-muted-foreground font-mono">
                                /{matchedKeyword}
                              </span>
                            )}
                            {isSelected && (
                              <span className="text-[11px] text-muted-foreground">
                                {command.id === 'model' ? '→' : 'Enter'}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ));
              })()}

              {/* 底部提示 */}
              <div className="px-3 pt-1 pb-0.5 mt-1 border-t border-border text-[11px] text-muted-foreground flex items-center justify-between">
                <span>↑↓ 选择</span>
                <span>→ 展开</span>
                <span>Enter 确认</span>
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
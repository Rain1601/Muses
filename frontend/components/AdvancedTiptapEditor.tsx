'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
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
import Mathematics from '@tiptap/extension-mathematics';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import css from 'highlight.js/lib/languages/css';
import python from 'highlight.js/lib/languages/python';

import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { 
  Bold, Italic, Highlighter, WandSparkles, Edit3, ArrowRight,
  Code, List, ListOrdered, Quote, ImageIcon, Plus, Type, Hash,
  Upload, Link as LinkIcon, Clipboard, Settings, Table as TableIcon,
  CheckSquare, Palette, Calculator, Superscript as SuperIcon,
  Subscript as SubIcon, Youtube, Eye, EyeOff, Menu, Grip
} from 'lucide-react';

import { uploadToGitHub, getGitHubConfig } from '@/lib/github-upload';

const lowlight = createLowlight();
lowlight.register('javascript', javascript);
lowlight.register('typescript', typescript);
lowlight.register('css', css);
lowlight.register('python', python);

// 图片上传函数
async function uploadImageToGitHub(file: File): Promise<string> {
  try {
    const config = getGitHubConfig();
    if (config) {
      const githubUrl = await uploadToGitHub(file, config);
      return githubUrl;
    } else {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
  } catch (error) {
    console.error('图片上传失败:', error);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }
}

// 目录导航扩展
const TableOfContents = Extension.create({
  name: 'tableOfContents',

  addOptions() {
    return {
      onUpdate: () => {},
    };
  },

  onUpdate() {
    const headings: Array<{ level: number; text: string; id: string }> = [];
    
    this.editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        const text = node.textContent;
        const level = node.attrs.level;
        const id = `heading-${pos}`;
        
        // 为标题添加ID
        const { tr } = this.editor.state;
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, id });
        
        headings.push({ level, text, id });
      }
    });

    this.options.onUpdate(headings);
  },
});

// YouTube嵌入扩展
const YoutubeEmbed = Extension.create({
  name: 'youtubeEmbed',

  addCommands() {
    return {
      insertYoutube: (url: string) => ({ commands }) => {
        const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
        if (videoId) {
          return commands.insertContent(`
            <div class="youtube-embed" data-video-id="${videoId}">
              <iframe 
                width="560" 
                height="315" 
                src="https://www.youtube.com/embed/${videoId}" 
                frameborder="0" 
                allowfullscreen>
              </iframe>
            </div>
          `);
        }
        return false;
      },
    };
  },
});

// 折叠块扩展
const CollapsibleBlock = Extension.create({
  name: 'collapsibleBlock',

  addCommands() {
    return {
      insertCollapsible: () => ({ commands }) => {
        return commands.insertContent(`
          <details class="collapsible-block">
            <summary>点击展开/折叠</summary>
            <div class="collapsible-content">
              <p>这里是可折叠的内容...</p>
            </div>
          </details>
        `);
      },
    };
  },
});

// 粘贴图片处理扩展
const ImagePasteHandler = Extension.create({
  name: 'imagePasteHandler',

  addOptions() {
    return {
      uploadFunction: uploadImageToGitHub,
    };
  },

  addProseMirrorPlugins() {
    const extensionThis = this;
    
    return [
      new Plugin({
        key: new PluginKey('imagePasteHandler'),
        props: {
          handlePaste: (view, event) => {
            const items = Array.from(event.clipboardData?.items || []);
            const imageItems = items.filter(item => item.type.startsWith('image/'));

            if (imageItems.length > 0) {
              event.preventDefault();
              
              imageItems.forEach(async (item) => {
                const file = item.getAsFile();
                if (file) {
                  try {
                    const { tr } = view.state;
                    const pos = view.state.selection.from;
                    tr.insertText('📸 上传图片中...', pos);
                    view.dispatch(tr);
                    
                    const imageUrl = await extensionThis.options.uploadFunction(file);
                    
                    setTimeout(() => {
                      const { state } = view;
                      const currentPos = state.selection.from;
                      const newTr = state.tr;
                      newTr.delete(currentPos - 11, currentPos);
                      const imageNode = state.schema.nodes.image.create({
                        src: imageUrl,
                        alt: file.name,
                        title: file.name
                      });
                      newTr.insert(currentPos - 11, imageNode);
                      view.dispatch(newTr);
                    }, 100);
                  } catch (error) {
                    console.error('图片上传失败:', error);
                  }
                }
              });
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});

// AI增强的Markdown语法扩展
const MarkdownShortcuts = Extension.create({
  name: 'markdownShortcuts',

  addOptions() {
    return {
      onAITrigger: () => {},
    };
  },

  addKeyboardShortcuts() {
    return {
      'Space': () => {
        const { selection } = this.editor.state;
        const { $from } = selection;
        const text = $from.parent.textContent;
        
        // 标题
        if (text === '#') {
          this.editor.chain().focus().deleteRange({ from: $from.pos - 1, to: $from.pos }).toggleHeading({ level: 1 }).run();
          return true;
        }
        if (text === '##') {
          this.editor.chain().focus().deleteRange({ from: $from.pos - 2, to: $from.pos }).toggleHeading({ level: 2 }).run();
          return true;
        }
        if (text === '###') {
          this.editor.chain().focus().deleteRange({ from: $from.pos - 3, to: $from.pos }).toggleHeading({ level: 3 }).run();
          return true;
        }
        
        // 其他格式
        if (text === '>') {
          this.editor.chain().focus().deleteRange({ from: $from.pos - 1, to: $from.pos }).toggleBlockquote().run();
          return true;
        }
        if (text === '-' || text === '*' || text === '+') {
          this.editor.chain().focus().deleteRange({ from: $from.pos - 1, to: $from.pos }).toggleBulletList().run();
          return true;
        }
        if (text === '- [ ]') {
          this.editor.chain().focus().deleteRange({ from: $from.pos - 5, to: $from.pos }).toggleTaskList().run();
          return true;
        }
        if (/^\d+\.$/.test(text)) {
          this.editor.chain().focus().deleteRange({ from: $from.pos - text.length, to: $from.pos }).toggleOrderedList().run();
          return true;
        }
        if (text === '```') {
          this.editor.chain().focus().deleteRange({ from: $from.pos - 3, to: $from.pos }).toggleCodeBlock().run();
          return true;
        }

        // AI触发逻辑：如果当前行有一定内容，且光标在行末，触发AI对话
        const currentPos = $from.pos;
        const lineStart = $from.start();
        const lineText = text.trim();
        
        if (lineText.length > 0 && currentPos === $from.end()) {
          // 获取光标位置用于定位AI对话框
          const dom = this.editor.view.domAtPos(currentPos);
          if (dom.node && dom.node.parentElement) {
            const rect = dom.node.parentElement.getBoundingClientRect();
            this.options.onAITrigger({
              x: rect.left,
              y: rect.bottom + 5,
              context: lineText
            });
            return true;
          }
        }
        
        return false;
      },
    };
  },
});

// 斜杠命令扩展
const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      onTrigger: () => {},
    };
  },

  addKeyboardShortcuts() {
    return {
      '/': () => {
        const { selection } = this.editor.state;
        const { $from } = selection;
        const isLineStart = $from.parentOffset === 0;
        const isEmptyLine = $from.parent.textContent === '';
        
        if (isLineStart || isEmptyLine) {
          this.options.onTrigger();
          return true;
        }
        return false;
      },
    };
  },
});

// Command+K 快捷键扩展
const CommandKExtension = Extension.create({
  name: 'commandK',

  addOptions() {
    return {
      onTrigger: () => {},
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        const { selection } = this.editor.state;
        const { $from } = selection;
        
        // 获取光标位置
        const coords = this.editor.view.coordsAtPos($from.pos);
        this.options.onTrigger({
          x: coords.left,
          y: coords.bottom + 10,
        });
        
        return true;
      },
    };
  },
});

export function AdvancedTiptapEditor() {
  const [mounted, setMounted] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showTableOfContents, setShowTableOfContents] = useState(false);
  const [tableOfContents, setTableOfContents] = useState<Array<{ level: number; text: string; id: string }>>([]);
  const [selectedText, setSelectedText] = useState('');
  const [currentColor, setCurrentColor] = useState('#000000');
  
  // AI 交互状态
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiDialogPosition, setAIDialogPosition] = useState({ x: 0, y: 0 });
  const [aiPrompt, setAIPrompt] = useState('');
  const [aiLoading, setAILoading] = useState(false);
  const [showAIToolbar, setShowAIToolbar] = useState(false);
  
  // Command+K 对话框状态
  const [showCommandK, setShowCommandK] = useState(false);
  const [commandKPosition, setCommandKPosition] = useState({ x: 0, y: 0 });
  const [commandKInput, setCommandKInput] = useState('');
  const [commandSuggestions, setCommandSuggestions] = useState<Array<{
    id: string;
    text: string;
    icon: string;
    count: number;
  }>>([
    { id: 'continue', text: '帮我接着开头的内容，继续写完后面的部分', icon: '✍️', count: 0 },
    { id: 'expand', text: '帮我根据这里的标题和目标，继续写新的内容', icon: '📝', count: 0 },
    { id: 'next', text: '基于上一段写下一段内容', icon: '➡️', count: 0 },
    { id: 'outline', text: '根据主题生成文章大纲', icon: '📋', count: 0 },
    { id: 'improve', text: '优化当前段落的表达', icon: '✨', count: 0 },
    { id: 'summarize', text: '总结上文的要点', icon: '📊', count: 0 },
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 全局 ESC 键监听
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showCommandK) {
          setShowCommandK(false);
          event.preventDefault();
        } else if (showAIDialog) {
          setShowAIDialog(false);
          event.preventDefault();
        } else if (showSlashMenu) {
          setShowSlashMenu(false);
          event.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCommandK, showAIDialog, showSlashMenu]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Highlight.configure({ multicolor: true }),
      CodeBlockLowlight.configure({ lowlight, defaultLanguage: 'javascript' }),
      Image.configure({ inline: false, allowBase64: true }),
      Dropcursor.configure({ color: '#3b82f6', width: 2 }),
      
      // 表格
      Table,
      TableRow,
      TableHeader,
      TableCell,
      
      // 任务列表
      TaskList,
      TaskItem.configure({ nested: true }),
      
      // 链接
      Link.configure({ openOnClick: false, autolink: true }),
      
      // 文字样式
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      
      // 数学公式
      Mathematics,
      Superscript,
      Subscript,
      
      // 自定义扩展
      ImagePasteHandler.configure({ uploadFunction: uploadImageToGitHub }),
      MarkdownShortcuts.configure({
        onAITrigger: ({ x, y, context }: { x: number; y: number; context: string }) => {
          setAIDialogPosition({ x, y });
          setAIPrompt(context);
          setShowAIDialog(true);
        },
      }),
      SlashCommands.configure({
        onTrigger: () => setShowSlashMenu(true),
      }),
      CommandKExtension.configure({
        onTrigger: ({ x, y }: { x: number; y: number }) => {
          setCommandKPosition({ x, y });
          setShowCommandK(true);
          setCommandKInput('');
        },
      }),
      TableOfContents.configure({
        onUpdate: (headings: Array<{ level: number; text: string; id: string }>) => {
          setTableOfContents(headings);
        },
      }),
      YoutubeEmbed,
      CollapsibleBlock,
    ],
    content: `
      <h1>🚀 全功能 Notion 风格编辑器</h1>
      <p>这是一个功能完整的现代化编辑器，支持 Notion 的大部分核心功能。</p>
      
      <h2>✨ 已实现的功能</h2>
      
      <h3>📝 基础格式</h3>
      <ul>
        <li><strong>粗体</strong>、<em>斜体</em>、<mark>高亮</mark></li>
        <li><span style="color: #ff0000">彩色文字</span></li>
        <li>上标：E=mc<sup>2</sup>，下标：H<sub>2</sub>O</li>
        <li><a href="https://tiptap.dev">自动链接识别</a></li>
      </ul>
      
      <h3>📋 列表和任务</h3>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="true">✅ 支持任务列表</li>
        <li data-type="taskItem" data-checked="false">☐ 可以勾选完成状态</li>
        <li data-type="taskItem" data-checked="false">☐ 支持嵌套任务</li>
      </ul>
      
      <h3>📊 表格支持</h3>
      <table>
        <tr>
          <th>功能</th>
          <th>状态</th>
          <th>描述</th>
        </tr>
        <tr>
          <td>表格</td>
          <td>✅ 完成</td>
          <td>可调整大小的表格</td>
        </tr>
        <tr>
          <td>数学公式</td>
          <td>✅ 完成</td>
          <td>LaTeX 语法支持</td>
        </tr>
      </table>
      
      <h3>🧮 数学公式</h3>
      <p>行内公式：$E = mc^2$</p>
      <p>块级公式：</p>
      <div data-type="math" data-language="latex">
        $$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$
      </div>
      
      <h3>💻 代码块</h3>
      <pre><code class="language-javascript">function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}</code></pre>
      
      <blockquote>
        <p><strong>快捷输入提示：</strong></p>
        <ul>
          <li>输入 <code>#</code> + 空格 → 标题</li>
          <li>输入 <code>- [ ]</code> + 空格 → 任务列表</li>
          <li>输入 <code>></code> + 空格 → 引用块</li>
          <li>输入 <code>/</code> → 快速插入菜单</li>
          <li>复制粘贴图片 → 自动上传</li>
        </ul>
      </blockquote>
      
      <details class="collapsible-block">
        <summary>🎯 可折叠内容块</summary>
        <div class="collapsible-content">
          <p>这是一个可以折叠和展开的内容块，适合组织长文档。</p>
          <p>你可以在这里放置详细信息、技术细节或者补充说明。</p>
        </div>
      </details>
      
      <p>现在开始创作你的内容吧！🎉</p>
    `,
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, ' ');
      const trimmedText = text.trim();
      setSelectedText(trimmedText);
      
      // 如果选中了文字，显示AI工具栏
      if (trimmedText.length > 0 && from !== to) {
        setShowAIToolbar(true);
      } else {
        setShowAIToolbar(false);
      }
    },
  });

  // 斜杠命令处理
  const handleSlashCommand = useCallback((command: string) => {
    if (!editor) return;

    switch (command) {
      case 'table':
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        break;
      case 'task':
        editor.chain().focus().toggleTaskList().run();
        break;
      case 'math':
        editor.chain().focus().insertContent('$\\LaTeX$').run();
        break;
      case 'youtube':
        const url = prompt('输入YouTube链接:');
        if (url) {
          (editor.commands as any).insertYoutube(url);
        }
        break;
      case 'collapsible':
        (editor.commands as any).insertCollapsible();
        break;
      case 'image':
        const imageUrl = prompt('输入图片链接:');
        if (imageUrl) {
          editor.chain().focus().setImage({ src: imageUrl }).run();
        }
        break;
      case 'code':
        editor.chain().focus().toggleCodeBlock().run();
        break;
      case 'quote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'heading1':
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case 'heading2':
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case 'heading3':
        editor.chain().focus().toggleHeading({ level: 3 }).run();
        break;
    }
    
    setShowSlashMenu(false);
  }, [editor]);

  // 文件上传处理
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      try {
        const imageUrl = await uploadImageToGitHub(file);
        editor?.chain().focus().setImage({ src: imageUrl, alt: file.name }).run();
      } catch (error) {
        console.error('图片上传失败:', error);
      }
    }
    event.target.value = '';
  }, [editor]);

  // AI处理函数
  const handleAIAction = useCallback(async (action: 'continue' | 'rewrite' | 'improve' | 'explain', text?: string) => {
    if (!editor) return;
    
    setAILoading(true);
    try {
      // 模拟AI处理延迟
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const targetText = text || selectedText || aiPrompt;
      let result = '';
      
      switch (action) {
        case 'continue':
          result = `${targetText} 这里是AI续写的内容，基于上下文继续发展这个主题...`;
          break;
        case 'rewrite':
          result = `这里是AI改写后的内容，保持原意但表达更清晰：${targetText.split('').reverse().join('')}`;
          break;
        case 'improve':
          result = `${targetText}，并且增加了更多细节和深度分析...`;
          break;
        case 'explain':
          result = `💡 **解释**: ${targetText}\n\n这段内容的含义是...`;
          break;
      }
      
      if (selectedText && action !== 'continue') {
        // 替换选中的文字
        const { from, to } = editor.state.selection;
        editor.chain().focus().deleteRange({ from, to }).insertContent(result).run();
      } else {
        // 在当前位置插入内容
        editor.chain().focus().insertContent(result).run();
      }
      
      setShowAIDialog(false);
      setShowAIToolbar(false);
      setSelectedText('');
      
    } catch (error) {
      console.error('AI处理失败:', error);
    } finally {
      setAILoading(false);
    }
  }, [editor, selectedText, aiPrompt]);

  // 自定义AI提示处理
  const handleCustomAIPrompt = useCallback(async (customPrompt: string) => {
    if (!editor || !customPrompt.trim()) return;
    
    setAILoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const context = aiPrompt || selectedText || '';
      const result = `🤖 **AI回应**: 基于您的要求"${customPrompt}"，结合上下文"${context}"，这里是生成的内容...`;
      
      editor.chain().focus().insertContent(result).run();
      setShowAIDialog(false);
      
    } catch (error) {
      console.error('AI处理失败:', error);
    } finally {
      setAILoading(false);
    }
  }, [editor, aiPrompt, selectedText]);

  // Command+K 处理函数
  const handleCommandK = useCallback(async (command: string, isPreset: boolean = false, presetId?: string) => {
    if (!editor || !command.trim()) return;
    
    setAILoading(true);
    
    // 更新使用统计
    if (isPreset && presetId) {
      setCommandSuggestions(prev => {
        const updated = prev.map(s => 
          s.id === presetId ? { ...s, count: s.count + 1 } : s
        );
        // 根据使用频率排序
        return updated.sort((a, b) => b.count - a.count);
      });
    }
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 获取当前段落内容作为上下文
      const { $from } = editor.state.selection;
      const paragraph = $from.parent.textContent;
      
      let result = '';
      
      // 根据不同的预设指令生成不同的内容
      if (command.includes('继续写完后面')) {
        result = `\n\n继续上文：${paragraph.slice(0, 50)}...\n\n这里是AI根据开头内容生成的后续段落，延续之前的思路和风格...`;
      } else if (command.includes('根据这里的标题')) {
        result = `\n\n基于标题展开：\n\n1. 首先，我们需要理解核心概念...\n2. 其次，探讨具体的实现方案...\n3. 最后，总结关键要点...`;
      } else if (command.includes('基于上一段')) {
        result = `\n\n延续上一段的观点，我们可以进一步探讨...\n\n这里是基于前文逻辑推导出的新内容...`;
      } else {
        result = `\n\n🤖 **AI生成**: 基于您的指令"${command}"，这里是生成的内容...\n\n${command}的相关内容...`;
      }
      
      editor.chain().focus().insertContent(result).run();
      setShowCommandK(false);
      setCommandKInput('');
      
    } catch (error) {
      console.error('AI处理失败:', error);
    } finally {
      setAILoading(false);
    }
  }, [editor]);

  if (!mounted || !editor) {
    return <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded mb-4"></div>
        <div className="h-96 bg-gray-200 rounded"></div>
      </div>
    </div>;
  }

  return (
    <div className="flex gap-4">
      {/* 主编辑器 */}
      <Card className="flex-1 p-6 relative">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">🚀 全功能编辑器</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowTableOfContents(!showTableOfContents)}
            >
              <Menu className="w-4 h-4 mr-1" />
              目录
            </Button>
          </div>
          
          {/* 工具栏 */}
          <div className="flex flex-wrap gap-2 mb-4 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            {/* 基础格式 */}
            <div className="flex gap-1 border-r pr-2 mr-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={editor.isActive('bold') ? 'bg-gray-200 dark:bg-gray-700' : ''}
              >
                <Bold className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={editor.isActive('italic') ? 'bg-gray-200 dark:bg-gray-700' : ''}
              >
                <Italic className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className={editor.isActive('highlight') ? 'bg-gray-200 dark:bg-gray-700' : ''}
              >
                <Highlighter className="w-4 h-4" />
              </Button>
            </div>

            {/* 文字颜色 */}
            <div className="flex gap-1 border-r pr-2 mr-2">
              <input
                type="color"
                value={currentColor}
                onChange={(e) => {
                  setCurrentColor(e.target.value);
                  editor.chain().focus().setColor(e.target.value).run();
                }}
                className="w-8 h-8 rounded cursor-pointer"
                title="文字颜色"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().toggleSuperscript().run()}
                className={editor.isActive('superscript') ? 'bg-gray-200 dark:bg-gray-700' : ''}
                title="上标"
              >
                <SuperIcon className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().toggleSubscript().run()}
                className={editor.isActive('subscript') ? 'bg-gray-200 dark:bg-gray-700' : ''}
                title="下标"
              >
                <SubIcon className="w-4 h-4" />
              </Button>
            </div>

            {/* 表格和列表 */}
            <div className="flex gap-1 border-r pr-2 mr-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                title="插入表格"
              >
                <TableIcon className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                className={editor.isActive('taskList') ? 'bg-gray-200 dark:bg-gray-700' : ''}
                title="任务列表"
              >
                <CheckSquare className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={editor.isActive('bulletList') ? 'bg-gray-200 dark:bg-gray-700' : ''}
                title="无序列表"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>

            {/* 其他功能 */}
            <div className="flex gap-1 border-r pr-2 mr-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={editor.isActive('codeBlock') ? 'bg-gray-200 dark:bg-gray-700' : ''}
                title="代码块"
              >
                <Code className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().insertContent('$\\LaTeX$').run()}
                title="数学公式"
              >
                <Calculator className="w-4 h-4" />
              </Button>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    title="上传图片"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </Button>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="prose prose-sm max-w-none">
          <EditorContent 
            editor={editor} 
            className="min-h-[500px] p-4 border rounded-md focus-within:border-blue-500"
          />
        </div>

        {/* 增强版选中文字工具栏 */}
        {selectedText && showAIToolbar && (
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-3">
              <WandSparkles className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                已选中: "{selectedText.slice(0, 50)}{selectedText.length > 50 ? '...' : ''}"
              </span>
            </div>
            
            {/* AI功能区 */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAIAction('rewrite')}
                disabled={aiLoading}
                className="justify-start bg-white dark:bg-gray-800"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                {aiLoading ? '处理中...' : 'AI改写'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAIAction('continue')}
                disabled={aiLoading}
                className="justify-start bg-white dark:bg-gray-800"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                {aiLoading ? '处理中...' : 'AI续写'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAIAction('improve')}
                disabled={aiLoading}
                className="justify-start bg-white dark:bg-gray-800"
              >
                <WandSparkles className="w-4 h-4 mr-2" />
                {aiLoading ? '处理中...' : 'AI优化'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAIAction('explain')}
                disabled={aiLoading}
                className="justify-start bg-white dark:bg-gray-800"
              >
                <Type className="w-4 h-4 mr-2" />
                {aiLoading ? '处理中...' : 'AI解释'}
              </Button>
            </div>
            
            {/* 传统格式化功能 */}
            <div className="flex gap-2 pt-2 border-t border-blue-200 dark:border-blue-700">
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={editor.isActive('bold') ? 'bg-gray-200 dark:bg-gray-700' : ''}
              >
                <Bold className="w-4 h-4 mr-1" />
                加粗
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={editor.isActive('italic') ? 'bg-gray-200 dark:bg-gray-700' : ''}
              >
                <Italic className="w-4 h-4 mr-1" />
                斜体
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const url = prompt('输入链接地址:');
                  if (url) {
                    editor.chain().focus().setLink({ href: url }).run();
                  }
                }}
              >
                <LinkIcon className="w-4 h-4 mr-1" />
                链接
              </Button>
            </div>
          </div>
        )}

        {/* 斜杠命令菜单 */}
        {showSlashMenu && (
          <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border shadow-lg">
            <div className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">快速插入</div>
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" variant="ghost" onClick={() => handleSlashCommand('table')} className="justify-start">
                <TableIcon className="w-4 h-4 mr-2" />表格
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleSlashCommand('task')} className="justify-start">
                <CheckSquare className="w-4 h-4 mr-2" />任务列表
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleSlashCommand('math')} className="justify-start">
                <Calculator className="w-4 h-4 mr-2" />数学公式
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleSlashCommand('youtube')} className="justify-start">
                <Youtube className="w-4 h-4 mr-2" />YouTube
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleSlashCommand('collapsible')} className="justify-start">
                <EyeOff className="w-4 h-4 mr-2" />折叠块
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleSlashCommand('image')} className="justify-start">
                <ImageIcon className="w-4 h-4 mr-2" />图片
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleSlashCommand('code')} className="justify-start">
                <Code className="w-4 h-4 mr-2" />代码块
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleSlashCommand('quote')} className="justify-start">
                <Quote className="w-4 h-4 mr-2" />引用
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowSlashMenu(false)} className="justify-start col-span-3">
                取消
              </Button>
            </div>
          </div>
        )}

        {/* AI对话框 */}
        {showAIDialog && (
          <div 
            className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg border shadow-xl p-4 min-w-80 max-w-md"
            style={{
              left: Math.min(aiDialogPosition.x, window.innerWidth - 350),
              top: Math.min(aiDialogPosition.y, window.innerHeight - 200),
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <WandSparkles className="w-5 h-5 text-purple-600" />
              <h4 className="font-semibold text-gray-800 dark:text-gray-200">AI 写作助手</h4>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAIDialog(false)}
                className="ml-auto p-1 h-6 w-6"
              >
                ✕
              </Button>
            </div>
            
            {aiPrompt && (
              <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                <span className="text-gray-600 dark:text-gray-400">上下文: </span>
                <span className="text-gray-800 dark:text-gray-200">"{aiPrompt.slice(0, 100)}..."</span>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Button
                size="sm"
                onClick={() => handleAIAction('continue')}
                disabled={aiLoading}
                className="justify-start"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                {aiLoading ? '生成中...' : '续写'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAIAction('improve')}
                disabled={aiLoading}
                className="justify-start"
              >
                <WandSparkles className="w-4 h-4 mr-2" />
                优化
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAIAction('rewrite')}
                disabled={aiLoading}
                className="justify-start"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                改写
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAIAction('explain')}
                disabled={aiLoading}
                className="justify-start"
              >
                <Type className="w-4 h-4 mr-2" />
                解释
              </Button>
            </div>
            
            <div className="border-t pt-3">
              <Input
                placeholder="或者输入自定义指令..."
                className="mb-2"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const target = e.target as HTMLInputElement;
                    handleCustomAIPrompt(target.value);
                    target.value = '';
                  }
                }}
                disabled={aiLoading}
              />
              <div className="text-xs text-gray-500 dark:text-gray-400">
                💡 提示：在任意行末按空格可触发AI助手
              </div>
            </div>
          </div>
        )}

        {/* Command+K AI对话框 */}
        {showCommandK && (
          <>
            {/* 背景遮罩 */}
            <div 
              className="fixed inset-0 z-40 bg-black/10"
              onClick={() => setShowCommandK(false)}
            />
            
            {/* 对话框 */}
            <div 
              className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg border shadow-2xl p-4 w-96"
              style={{
                left: Math.min(commandKPosition.x - 50, window.innerWidth - 400),
                top: Math.min(commandKPosition.y, window.innerHeight - 400),
              }}
            >
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded">
                  <WandSparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  AI 写作助手
                </span>
                <kbd className="ml-auto text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                  ⌘K
                </kbd>
              </div>
              
              <Input
                autoFocus
                value={commandKInput}
                onChange={(e) => setCommandKInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCommandK(commandKInput);
                  } else if (e.key === 'Escape') {
                    setShowCommandK(false);
                  }
                }}
                placeholder="输入指令或描述你想要的内容..."
                className="w-full"
                disabled={aiLoading}
              />
            </div>

            {/* 常用指令列表 */}
            <div className="space-y-1 max-h-64 overflow-y-auto">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                常用指令 {commandSuggestions[0].count > 0 && '(按使用频率排序)'}
              </div>
              {commandSuggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  onClick={() => handleCommandK(suggestion.text, true, suggestion.id)}
                  disabled={aiLoading}
                  className="w-full text-left p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 
                           transition-colors flex items-center gap-2 group disabled:opacity-50"
                >
                  <span className="text-lg">{suggestion.icon}</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                    {suggestion.text}
                  </span>
                  {suggestion.count > 0 && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100">
                      使用 {suggestion.count} 次
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* 底部提示 */}
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>↵ 执行 • Esc 取消</span>
                {aiLoading && <span className="animate-pulse">AI 正在生成...</span>}
              </div>
            </div>
          </div>
          </>
        )}
      </Card>

      {/* 目录导航 */}
      {showTableOfContents && (
        <Card className="w-64 p-4">
          <h4 className="font-semibold mb-3 flex items-center">
            <Menu className="w-4 h-4 mr-2" />
            目录导航
          </h4>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {tableOfContents.map((heading, index) => (
              <button
                key={index}
                className={`block w-full text-left px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors ${
                  heading.level === 1 ? 'font-semibold' : 
                  heading.level === 2 ? 'ml-4 font-medium' : 
                  'ml-8 text-gray-600 dark:text-gray-400'
                }`}
                onClick={() => {
                  const element = document.getElementById(heading.id);
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {heading.text}
              </button>
            ))}
            {tableOfContents.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                暂无标题
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
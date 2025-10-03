'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import CollapsibleCodeBlock from '@/lib/tiptap-extensions/CollapsibleCodeBlock';
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
import '../styles/collapsible-code.css';

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

interface ArticleNotionEditorProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
  placeholder?: string;
}

export function ArticleNotionEditor({ 
  initialContent = '', 
  onContentChange,
  placeholder = '开始写作...'
}: ArticleNotionEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [showCommandK, setShowCommandK] = useState(false);
  const [commandKPosition, setCommandKPosition] = useState({ x: 0, y: 0 });
  const [commandKInput, setCommandKInput] = useState('');
  const [aiLoading, setAILoading] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [showAIToolbar, setShowAIToolbar] = useState(false);
  
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
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCommandK]);

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
      CollapsibleCodeBlock,
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
      CommandKExtension.configure({
        onTrigger: ({ x, y }: { x: number; y: number }) => {
          setCommandKPosition({ x, y });
          setShowCommandK(true);
          setCommandKInput('');
        },
      }),
    ],
    content: initialContent || `
      <h1>开始您的创作</h1>
      <p>${placeholder}</p>
      <p>💡 <strong>使用提示：</strong></p>
      <ul>
        <li>按 <strong>⌘K</strong> 打开 AI 写作助手</li>
        <li>选中文字显示 AI 工具栏</li>
        <li>复制粘贴图片自动上传</li>
        <li>支持 Markdown 语法快捷输入</li>
      </ul>
    `,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onContentChange?.(html);
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, ' ');
      const trimmedText = text.trim();
      setSelectedText(trimmedText);
      
      if (trimmedText.length > 0 && from !== to) {
        setShowAIToolbar(true);
      } else {
        setShowAIToolbar(false);
      }
    },
  });

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
        return updated.sort((a, b) => b.count - a.count);
      });
    }
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 获取当前段落内容作为上下文
      const { $from } = editor.state.selection;
      const paragraph = $from.parent.textContent;
      
      let result = '';
      
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

  // AI处理函数
  const handleAIAction = useCallback(async (action: 'continue' | 'rewrite' | 'improve' | 'explain') => {
    if (!editor) return;
    
    setAILoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      let result = '';
      
      switch (action) {
        case 'continue':
          result = `${selectedText} 这里是AI续写的内容，基于上下文继续发展这个主题...`;
          break;
        case 'rewrite':
          result = `这里是AI改写后的内容，保持原意但表达更清晰：${selectedText}`;
          break;
        case 'improve':
          result = `${selectedText}，并且增加了更多细节和深度分析...`;
          break;
        case 'explain':
          result = `💡 **解释**: ${selectedText}\n\n这段内容的含义是...`;
          break;
      }
      
      if (selectedText && action !== 'continue') {
        const { from, to } = editor.state.selection;
        editor.chain().focus().deleteRange({ from, to }).insertContent(result).run();
      } else {
        editor.chain().focus().insertContent(result).run();
      }
      
      setShowAIToolbar(false);
      setSelectedText('');
      
    } catch (error) {
      console.error('AI处理失败:', error);
    } finally {
      setAILoading(false);
    }
  }, [editor, selectedText]);

  if (!mounted || !editor) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="prose prose-lg max-w-none">
        <EditorContent 
          editor={editor} 
          className="min-h-[600px] focus:outline-none"
        />
      </div>

      {/* AI 工具栏 - 精简版 */}
      {selectedText && showAIToolbar && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <WandSparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-gray-700 font-medium">
              已选中: "{selectedText.slice(0, 40)}{selectedText.length > 40 ? '...' : ''}"
            </span>
          </div>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAIAction('rewrite')}
              disabled={aiLoading}
              className="h-8 px-3"
            >
              <Edit3 className="w-3 h-3 mr-1" />
              改写
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAIAction('continue')}
              disabled={aiLoading}
              className="h-8 px-3"
            >
              <ArrowRight className="w-3 h-3 mr-1" />
              续写
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAIAction('improve')}
              disabled={aiLoading}
              className="h-8 px-3"
            >
              <WandSparkles className="w-3 h-3 mr-1" />
              优化
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAIAction('explain')}
              disabled={aiLoading}
              className="h-8 px-3"
            >
              <Type className="w-3 h-3 mr-1" />
              解释
            </Button>
          </div>
        </div>
      )}

      {/* Command+K AI对话框 */}
      {showCommandK && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/5"
            onClick={() => setShowCommandK(false)}
          />
          
          <div 
            className="fixed z-50 bg-white rounded-lg border border-gray-200 shadow-xl p-4 w-96"
            style={{
              left: Math.min(commandKPosition.x - 50, window.innerWidth - 400),
              top: Math.min(commandKPosition.y, window.innerHeight - 400),
            }}
          >
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <WandSparkles className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">
                  AI 写作助手
                </span>
                <kbd className="ml-auto text-xs px-1.5 py-0.5 bg-gray-100 rounded">
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

            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>↵ 执行 • Esc 取消</span>
                {aiLoading && <span className="animate-pulse">AI 正在生成...</span>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ArticleNotionEditorWrapper(props: ArticleNotionEditorProps) {
  return <ArticleNotionEditor {...props} />;
}
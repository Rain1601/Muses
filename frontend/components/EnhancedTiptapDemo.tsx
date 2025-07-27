'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Extension } from '@tiptap/core';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import css from 'highlight.js/lib/languages/css';
import python from 'highlight.js/lib/languages/python';

const lowlight = createLowlight();
lowlight.register('javascript', javascript);
lowlight.register('typescript', typescript);
lowlight.register('css', css);
lowlight.register('python', python);
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { 
  Bold, Italic, Highlighter, WandSparkles, Edit3, ArrowRight,
  Code, List, ListOrdered, Quote, Image, Plus, Type, Hash
} from 'lucide-react';

// 自定义Mermaid扩展
const MermaidBlock = Extension.create({
  name: 'mermaidBlock',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addCommands() {
    return {
      insertMermaidBlock: () => ({ commands }) => {
        return commands.insertContent(`
          <div class="mermaid-block" data-type="mermaid">
            <pre><code class="language-mermaid">graph TD
    A[开始] --> B{判断条件}
    B -->|是| C[执行操作]
    B -->|否| D[结束]
    C --> D</code></pre>
          </div>
        `);
      },
    };
  },
});

// Notion风格的斜杠命令扩展
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
        
        // 检查是否在行首或空行
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

// Markdown风格标题输入扩展
const MarkdownHeadings = Extension.create({
  name: 'markdownHeadings',

  addKeyboardShortcuts() {
    return {
      'Space': () => {
        const { selection } = this.editor.state;
        const { $from } = selection;
        const text = $from.parent.textContent;
        
        // 检查是否是标题语法
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
        if (text === '####') {
          this.editor.chain().focus().deleteRange({ from: $from.pos - 4, to: $from.pos }).toggleHeading({ level: 4 }).run();
          return true;
        }
        if (text === '#####') {
          this.editor.chain().focus().deleteRange({ from: $from.pos - 5, to: $from.pos }).toggleHeading({ level: 5 }).run();
          return true;
        }
        if (text === '######') {
          this.editor.chain().focus().deleteRange({ from: $from.pos - 6, to: $from.pos }).toggleHeading({ level: 6 }).run();
          return true;
        }
        
        // 检查其他Markdown语法
        if (text === '>') {
          this.editor.chain().focus().deleteRange({ from: $from.pos - 1, to: $from.pos }).toggleBlockquote().run();
          return true;
        }
        if (text === '-' || text === '*' || text === '+') {
          this.editor.chain().focus().deleteRange({ from: $from.pos - 1, to: $from.pos }).toggleBulletList().run();
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
        
        return false;
      },
    };
  },
});

export function EnhancedTiptapDemo() {
  const [mounted, setMounted] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');
  const [selectedText, setSelectedText] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false, // 禁用默认代码块，使用lowlight版本
      }),
      Highlight.configure({
        multicolor: true,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'javascript',
      }),
      MermaidBlock,
      SlashCommands.configure({
        onTrigger: () => {
          setShowSlashMenu(true);
        },
      }),
      MarkdownHeadings,
    ],
    content: `
      <h1>增强版 Tiptap 编辑器演示</h1>
      <p>这是一个具备Notion风格功能的编辑器demo，支持丰富的内容类型。</p>
      
      <h2>功能特性</h2>
      <ul>
        <li><strong>Markdown语法</strong> - 支持 # 标题、&gt; 引用、- 列表等</li>
        <li><strong>代码块</strong> - 支持语法高亮，输入三个反引号 + 空格</li>
        <li><strong>Mermaid图表</strong> - 流程图、时序图等</li>
        <li><strong>斜杠命令</strong> - 按斜杠快速插入内容</li>
        <li><strong>丰富格式</strong> - 引用、列表、高亮等</li>
      </ul>

      <h3>代码块示例</h3>
      <pre><code class="language-javascript">function hello() {
  console.log('Hello, Tiptap!');
  return 'Amazing editor';
}</code></pre>

      <h3>Markdown快捷输入</h3>
      <blockquote>
        <p>试试以下Markdown语法：</p>
        <ul>
          <li>输入 # + 空格 → 标题1</li>
          <li>输入 ## + 空格 → 标题2</li>
          <li>输入 ### + 空格 → 标题3</li>
          <li>输入 &gt; + 空格 → 引用块</li>
          <li>输入 - + 空格 → 无序列表</li>
          <li>输入 1. + 空格 → 有序列表</li>
          <li>输入三个反引号 + 空格 → 代码块</li>
          <li>按斜杠打开快速插入菜单</li>
        </ul>
      </blockquote>

      <p>现在开始创作你的内容吧！</p>
    `,
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, ' ');
      setSelectedText(text.trim());
    },
  });

  // AI对话框处理
  const handleAIGenerate = useCallback(() => {
    if (!editor || !aiPrompt) return;
    
    const generatedText = `\n**AI生成内容：** ${aiPrompt} - 这是基于你的提示生成的示例内容。`;
    editor.chain().focus().insertContent(generatedText).run();
    
    setShowAIDialog(false);
    setAIPrompt('');
  }, [editor, aiPrompt]);

  // 改写功能
  const handleRewrite = useCallback(() => {
    if (!editor || !selectedText) return;
    
    const rewrittenText = `**[改写后]** ${selectedText.replace(/\s+/g, ' ')}的改进版本`;
    editor.chain().focus().insertContent(rewrittenText).run();
  }, [editor, selectedText]);

  // 续写功能
  const handleContinue = useCallback(() => {
    if (!editor || !selectedText) return;
    
    const continuedText = ` **[续写]** 基于"${selectedText.slice(-20)}"继续发展的内容...`;
    editor.chain().focus().insertContentAt(editor.state.selection.to, continuedText).run();
  }, [editor, selectedText]);

  // 斜杠命令处理
  const handleSlashCommand = useCallback((command: string) => {
    if (!editor) return;

    switch (command) {
      case 'code':
        editor.chain().focus().toggleCodeBlock().run();
        break;
      case 'mermaid':
        (editor.commands as any).insertMermaidBlock();
        break;
      case 'quote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'bullet':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'ordered':
        editor.chain().focus().toggleOrderedList().run();
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

  if (!mounted || !editor) {
    return <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded mb-4"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    </div>;
  }

  return (
    <Card className="p-6 relative">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">增强版 Tiptap 编辑器</h3>
        
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

          {/* 标题 */}
          <div className="flex gap-1 border-r pr-2 mr-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 dark:bg-gray-700' : ''}
            >
              H1
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 dark:bg-gray-700' : ''}
            >
              H2
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 dark:bg-gray-700' : ''}
            >
              H3
            </Button>
          </div>

          {/* 列表和引用 */}
          <div className="flex gap-1 border-r pr-2 mr-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={editor.isActive('bulletList') ? 'bg-gray-200 dark:bg-gray-700' : ''}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={editor.isActive('orderedList') ? 'bg-gray-200 dark:bg-gray-700' : ''}
            >
              <ListOrdered className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={editor.isActive('blockquote') ? 'bg-gray-200 dark:bg-gray-700' : ''}
            >
              <Quote className="w-4 h-4" />
            </Button>
          </div>

          {/* 代码和图表 */}
          <div className="flex gap-1 border-r pr-2 mr-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              className={editor.isActive('codeBlock') ? 'bg-gray-200 dark:bg-gray-700' : ''}
            >
              <Code className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => (editor.commands as any).insertMermaidBlock()}
            >
              <Hash className="w-4 h-4" />
            </Button>
          </div>

          {/* AI助手 */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAIDialog(true)}
          >
            <WandSparkles className="w-4 h-4 mr-1" />
            AI助手
          </Button>
        </div>
      </div>

      <div className="prose prose-sm max-w-none">
        <EditorContent 
          editor={editor} 
          className="min-h-[400px] p-4 border rounded-md focus-within:border-blue-500"
        />
      </div>

      {/* 选中文字的工具栏 */}
      {selectedText && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
              已选中: "{selectedText.slice(0, 50)}{selectedText.length > 50 ? '...' : ''}"
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRewrite}
              className="flex items-center gap-1"
            >
              <Edit3 className="w-4 h-4" />
              改写
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleContinue}
              className="flex items-center gap-1"
            >
              <ArrowRight className="w-4 h-4" />
              续写
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedText('')}
            >
              取消选择
            </Button>
          </div>
        </div>
      )}

      {/* 斜杠命令菜单 */}
      {showSlashMenu && (
        <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border shadow-lg">
          <div className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">快速插入</div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSlashCommand('heading1')}
              className="justify-start"
            >
              <Type className="w-4 h-4 mr-2" />
              标题 1
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSlashCommand('heading2')}
              className="justify-start"
            >
              <Type className="w-4 h-4 mr-2" />
              标题 2
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSlashCommand('bullet')}
              className="justify-start"
            >
              <List className="w-4 h-4 mr-2" />
              无序列表
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSlashCommand('ordered')}
              className="justify-start"
            >
              <ListOrdered className="w-4 h-4 mr-2" />
              有序列表
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSlashCommand('quote')}
              className="justify-start"
            >
              <Quote className="w-4 h-4 mr-2" />
              引用块
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSlashCommand('code')}
              className="justify-start"
            >
              <Code className="w-4 h-4 mr-2" />
              代码块
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSlashCommand('mermaid')}
              className="justify-start"
            >
              <Hash className="w-4 h-4 mr-2" />
              Mermaid图
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSlashMenu(false)}
              className="justify-start"
            >
              取消
            </Button>
          </div>
        </div>
      )}

      {/* AI对话框 */}
      {showAIDialog && (
        <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 mb-3">
            <WandSparkles className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">AI 写作助手</span>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="输入你的想法，比如：写一段关于技术发展的内容..."
              value={aiPrompt}
              onChange={(e) => setAIPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAIGenerate();
                }
                if (e.key === 'Escape') {
                  setShowAIDialog(false);
                }
              }}
              className="flex-1"
              autoFocus
            />
            <Button 
              size="sm" 
              onClick={handleAIGenerate}
              disabled={!aiPrompt.trim()}
            >
              生成
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setShowAIDialog(false)}
            >
              取消
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
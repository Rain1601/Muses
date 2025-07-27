'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Bold, Italic, Highlighter, WandSparkles, Edit3, ArrowRight } from 'lucide-react';

// 自定义扩展：空格触发AI对话框
const SpaceTrigger = Extension.create({
  name: 'spaceTrigger',

  addOptions() {
    return {
      onTrigger: () => {},
    };
  },

  addKeyboardShortcuts() {
    return {
      'Space': () => {
        const { selection } = this.editor.state;
        const { $from } = selection;
        
        // 检查是否在空行或段落开始
        const isEmptyLine = $from.parent.textContent === '';
        const isLineStart = $from.parentOffset === 0;
        
        if (isEmptyLine || isLineStart) {
          this.options.onTrigger();
          return true;
        }
        
        return false;
      },
    };
  },
});

// 自定义扩展：持久高亮
const PersistentHighlight = Extension.create({
  name: 'persistentHighlight',

  addOptions() {
    return {
      highlights: [],
    };
  },

  addProseMirrorPlugins() {
    const extensionThis = this;
    
    return [
      new Plugin({
        key: new PluginKey('persistentHighlight'),
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr: any, decorationSet: any, oldState: any, newState: any) {
            const highlights = extensionThis.options.highlights;
            const decorations = highlights.map(({ from, to }: { from: number; to: number }) => {
              return Decoration.inline(from, to, {
                class: 'bg-yellow-200 dark:bg-yellow-900/50',
              });
            });
            
            return DecorationSet.create(newState.doc, decorations);
          },
        },
        props: {
          decorations(state: any) {
            return this.getState(state);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      addPersistentHighlight: (from: number, to: number) => ({ editor }: { editor: any }) => {
        this.options.highlights.push({ from, to });
        editor.view.updateState(editor.state);
        return true;
      },
      clearPersistentHighlights: () => ({ editor }: { editor: any }) => {
        this.options.highlights = [];
        editor.view.updateState(editor.state);
        return true;
      },
    } as any;
  },
});

export function TiptapDemo() {
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiDialogPosition, setAIDialogPosition] = useState({ x: 0, y: 0 });
  const [aiPrompt, setAIPrompt] = useState('');
  const [selectedText, setSelectedText] = useState('');

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Highlight.configure({
        multicolor: true,
      }),
      SpaceTrigger.configure({
        onTrigger: () => {
          setShowAIDialog(true);
        },
      }),
      PersistentHighlight.configure({
        highlights: [],
      }),
    ],
    content: `
      <h2>Tiptap 3.0 编辑器扩展能力演示</h2>
      <p>这是一个展示Tiptap扩展能力的demo编辑器。</p>
      <p><strong>功能特性：</strong></p>
      <ul>
        <li>在空行或行首按<strong>空格键</strong>触发AI对话框</li>
        <li>选中文字后会显示<strong>工具栏</strong>（改写、续写、高亮）</li>
        <li>支持<strong>持久高亮</strong>功能</li>
      </ul>
      <p>试试选中这段文字，或在新行按空格键。</p>
    `,
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, ' ');
      setSelectedText(text);
    },
  });

  // 监听editor变化，动态设置AI对话框位置
  useEffect(() => {
    if (editor && showAIDialog) {
      try {
        const { view } = editor;
        const { from } = view.state.selection;
        const coords = view.coordsAtPos(from);
        
        setAIDialogPosition({
          x: coords.left,
          y: coords.top + 20,
        });
      } catch (error) {
        // 设置默认位置
        setAIDialogPosition({ x: 100, y: 100 });
      }
    }
  }, [editor, showAIDialog]);

  // AI对话框处理
  const handleAIGenerate = useCallback(() => {
    if (!editor || !aiPrompt) return;
    
    // 模拟AI生成内容
    const generatedText = `\n${aiPrompt} - 这是AI根据提示生成的内容示例。`;
    editor.chain().focus().insertContent(generatedText).run();
    
    setShowAIDialog(false);
    setAIPrompt('');
  }, [editor, aiPrompt]);

  // 改写功能
  const handleRewrite = useCallback(() => {
    if (!editor || !selectedText) return;
    
    // 模拟改写
    const rewrittenText = `[改写后的内容: ${selectedText}]`;
    editor.chain().focus().insertContent(rewrittenText).run();
  }, [editor, selectedText]);

  // 续写功能
  const handleContinue = useCallback(() => {
    if (!editor || !selectedText) return;
    
    // 模拟续写
    const continuedText = ` [续写内容基于: ${selectedText.slice(-20)}...]`;
    editor.chain().focus().insertContentAt(editor.state.selection.to, continuedText).run();
  }, [editor, selectedText]);

  // 持久高亮
  const handlePersistentHighlight = useCallback(() => {
    if (!editor) return;
    
    const { from, to } = editor.state.selection;
    // 直接调用扩展的commands
    (editor.commands as any).addPersistentHighlight(from, to);
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <Card className="p-6 relative">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Tiptap 3.0 编辑器演示</h3>
        <div className="flex gap-2 mb-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? 'bg-gray-200' : ''}
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={editor.isActive('italic') ? 'bg-gray-200' : ''}
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={editor.isActive('highlight') ? 'bg-gray-200' : ''}
          >
            <Highlighter className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => (editor.commands as any).clearPersistentHighlights()}
          >
            清除所有高亮
          </Button>
        </div>
      </div>

      <div className="prose prose-sm max-w-none">
        <EditorContent editor={editor} className="min-h-[300px] p-4 border rounded-md" />
      </div>

      {/* 选中文字的工具栏 */}
      {selectedText && (
        <div className="mt-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg flex gap-2 items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            已选中: "{selectedText.slice(0, 30)}..."
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRewrite}
            className="flex items-center gap-1"
          >
            <Edit3 className="w-4 h-4" />
            改写
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleContinue}
            className="flex items-center gap-1"
          >
            <ArrowRight className="w-4 h-4" />
            续写
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handlePersistentHighlight}
            className="flex items-center gap-1"
          >
            <Highlighter className="w-4 h-4" />
            高亮
          </Button>
        </div>
      )}

      {/* AI对话框 */}
      {showAIDialog && (
        <div 
          className="absolute z-50 bg-white dark:bg-gray-800 shadow-xl rounded-lg p-4 border"
          style={{
            left: `${aiDialogPosition.x}px`,
            top: `${aiDialogPosition.y}px`,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <WandSparkles className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium">AI 写作助手</span>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="输入你的想法..."
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
              className="w-64"
              autoFocus
            />
            <Button size="sm" onClick={handleAIGenerate}>
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
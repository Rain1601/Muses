'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Bold, Italic, Highlighter, WandSparkles, Edit3, ArrowRight } from 'lucide-react';

export function SimpleTiptapDemo() {
  const [mounted, setMounted] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');
  const [selectedText, setSelectedText] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Highlight.configure({
        multicolor: true,
      }),
    ],
    content: `
      <h2>Tiptap 3.0 编辑器扩展能力演示</h2>
      <p>这是一个展示Tiptap扩展能力的简化版demo编辑器。</p>
      <p><strong>功能特性：</strong></p>
      <ul>
        <li>支持基础的富文本编辑</li>
        <li>选中文字后可以进行操作</li>
        <li>模拟AI写作功能</li>
      </ul>
      <p>试试选中这段文字，然后点击下方的操作按钮。</p>
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
    
    // 模拟AI生成内容
    const generatedText = `\n**AI生成内容：** ${aiPrompt} - 这是基于你的提示生成的示例内容。`;
    editor.chain().focus().insertContent(generatedText).run();
    
    setShowAIDialog(false);
    setAIPrompt('');
  }, [editor, aiPrompt]);

  // 改写功能
  const handleRewrite = useCallback(() => {
    if (!editor || !selectedText) return;
    
    // 模拟改写
    const rewrittenText = `**[改写后]** ${selectedText.replace(/\s+/g, ' ')}的改进版本`;
    editor.chain().focus().insertContent(rewrittenText).run();
  }, [editor, selectedText]);

  // 续写功能
  const handleContinue = useCallback(() => {
    if (!editor || !selectedText) return;
    
    // 模拟续写
    const continuedText = ` **[续写]** 基于"${selectedText.slice(-20)}"继续发展的内容...`;
    editor.chain().focus().insertContentAt(editor.state.selection.to, continuedText).run();
  }, [editor, selectedText]);

  // 触发空格功能
  const handleSpaceTrigger = useCallback(() => {
    setShowAIDialog(true);
  }, []);

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
        <h3 className="text-lg font-semibold mb-2">Tiptap 3.0 编辑器演示</h3>
        <div className="flex gap-2 mb-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? 'bg-gray-200' : ''}
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => editor.chain().focus().toggleItalic().run()}
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
            onClick={handleSpaceTrigger}
          >
            <WandSparkles className="w-4 h-4 mr-1" />
            AI助手
          </Button>
        </div>
      </div>

      <div className="prose prose-sm max-w-none">
        <EditorContent editor={editor} className="min-h-[300px] p-4 border rounded-md focus-within:border-blue-500" />
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
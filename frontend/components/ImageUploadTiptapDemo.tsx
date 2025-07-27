'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import Dropcursor from '@tiptap/extension-dropcursor';
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
  Upload, Link, Clipboard, Settings
} from 'lucide-react';

const lowlight = createLowlight();
lowlight.register('javascript', javascript);
lowlight.register('typescript', typescript);
lowlight.register('css', css);
lowlight.register('python', python);

import { uploadToGitHub, getGitHubConfig } from '@/lib/github-upload';

// 图片上传到GitHub的函数
async function uploadImageToGitHub(file: File): Promise<string> {
  try {
    // 获取GitHub配置
    const config = getGitHubConfig();
    
    if (config) {
      // 使用真实的GitHub API上传
      console.log('正在上传到GitHub...');
      const githubUrl = await uploadToGitHub(file, config);
      console.log('GitHub上传成功:', githubUrl);
      return githubUrl;
    } else {
      console.log('未配置GitHub，使用本地预览...');
      // 如果没有GitHub配置，回退到本地预览
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.readAsDataURL(file);
      });
    }
  } catch (error) {
    console.error('GitHub上传失败，使用本地预览:', error);
    // 上传失败时回退到本地预览
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
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
                    // 显示上传中状态
                    const { tr } = view.state;
                    const pos = view.state.selection.from;
                    
                    // 插入临时占位符
                    tr.insertText('📸 上传图片中...', pos);
                    view.dispatch(tr);
                    
                    // 上传图片
                    const imageUrl = await extensionThis.options.uploadFunction(file);
                    
                    // 替换占位符为实际图片
                    setTimeout(() => {
                      const { state } = view;
                      const currentPos = state.selection.from;
                      const newTr = state.tr;
                      
                      // 删除占位符文本
                      newTr.delete(currentPos - 11, currentPos);
                      
                      // 插入图片节点
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
          
          handleDrop: (view, event) => {
            const files = Array.from(event.dataTransfer?.files || []);
            const imageFiles = files.filter(file => file.type.startsWith('image/'));

            if (imageFiles.length > 0) {
              event.preventDefault();
              
              const coordinates = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });
              
              if (coordinates) {
                imageFiles.forEach(async (file) => {
                  try {
                    const imageUrl = await extensionThis.options.uploadFunction(file);
                    
                    setTimeout(() => {
                      const { tr } = view.state;
                      const imageNode = view.state.schema.nodes.image.create({
                        src: imageUrl,
                        alt: file.name,
                        title: file.name
                      });
                      
                      tr.insert(coordinates.pos, imageNode);
                      view.dispatch(tr);
                    }, 100);
                    
                  } catch (error) {
                    console.error('图片上传失败:', error);
                  }
                });
              }
              
              return true;
            }
            
            return false;
          },
        },
      }),
    ];
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

export function ImageUploadTiptapDemo() {
  const [mounted, setMounted] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showGitHubConfig, setShowGitHubConfig] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [githubRepo, setGithubRepo] = useState('Rain1601/Muses');
  const [githubPath, setGithubPath] = useState('uploads');

  useEffect(() => {
    setMounted(true);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false, // 禁用默认代码块
      }),
      Highlight.configure({
        multicolor: true,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'javascript',
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'editor-image',
        },
      }),
      Dropcursor.configure({
        color: '#3b82f6',
        width: 2,
      }),
      ImagePasteHandler.configure({
        uploadFunction: uploadImageToGitHub,
      }),
      SlashCommands.configure({
        onTrigger: () => {
          setShowSlashMenu(true);
        },
      }),
      MarkdownHeadings,
    ],
    content: `
      <h1>支持图片的 Tiptap 编辑器</h1>
      <p>这是一个支持图片上传和复制粘贴的现代化编辑器。</p>
      
      <h2>图片功能特性</h2>
      <ul>
        <li><strong>复制粘贴</strong> - 直接粘贴剪贴板中的图片</li>
        <li><strong>拖拽上传</strong> - 将图片文件拖拽到编辑器中</li>
        <li><strong>URL插入</strong> - 通过链接插入网络图片</li>
        <li><strong>文件上传</strong> - 选择本地文件上传</li>
        <li><strong>GitHub集成</strong> - 图片自动上传到GitHub仓库</li>
      </ul>

      <h3>使用方法</h3>
      <blockquote>
        <p>试试以下操作：</p>
        <ul>
          <li>复制一张图片，然后在编辑器中粘贴（Ctrl+V）</li>
          <li>将图片文件拖拽到编辑器中</li>
          <li>点击工具栏的图片按钮插入网络图片</li>
          <li>使用 # + 空格创建标题</li>
          <li>按 / 打开快速插入菜单</li>
        </ul>
      </blockquote>

      <p>现在试试添加一些图片吧！📸</p>
    `,
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, ' ');
      setSelectedText(text.trim());
    },
  });

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
    // 清空input值
    event.target.value = '';
  }, [editor]);

  // URL插入图片
  const handleImageUrlInsert = useCallback(() => {
    if (imageUrl && editor) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl('');
      setShowImageDialog(false);
    }
  }, [editor, imageUrl]);

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
      case 'image':
        setShowImageDialog(true);
        break;
      case 'code':
        editor.chain().focus().toggleCodeBlock().run();
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
        <div className="h-96 bg-gray-200 rounded"></div>
      </div>
    </div>;
  }

  return (
    <Card className="p-6 relative">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">支持图片的增强版编辑器</h3>
        
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

          {/* 图片工具 */}
          <div className="flex gap-1 border-r pr-2 mr-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowImageDialog(true)}
            >
              <ImageIcon className="w-4 h-4" />
            </Button>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="inline-block">
                <Button
                  size="sm"
                  variant="outline"
                >
                  <Upload className="w-4 h-4" />
                </Button>
              </div>
            </label>
          </div>

          {/* 其他工具 */}
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
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={editor.isActive('bulletList') ? 'bg-gray-200 dark:bg-gray-700' : ''}
            >
              <List className="w-4 h-4" />
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

          {/* AI助手和设置 */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAIDialog(true)}
          >
            <WandSparkles className="w-4 h-4 mr-1" />
            AI助手
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowGitHubConfig(true)}
          >
            <Settings className="w-4 h-4" />
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

      {/* 图片插入对话框 */}
      {showImageDialog && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-3">
            <ImageIcon className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">插入图片</span>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="输入图片URL..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleImageUrlInsert();
                }
                if (e.key === 'Escape') {
                  setShowImageDialog(false);
                }
              }}
              className="flex-1"
              autoFocus
            />
            <Button 
              size="sm" 
              onClick={handleImageUrlInsert}
              disabled={!imageUrl.trim()}
            >
              插入
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setShowImageDialog(false)}
            >
              取消
            </Button>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            提示：也可以直接复制粘贴图片或拖拽图片文件到编辑器中
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
              onClick={() => handleSlashCommand('image')}
              className="justify-start"
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              图片
            </Button>
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
              onClick={() => handleSlashCommand('bullet')}
              className="justify-start"
            >
              <List className="w-4 h-4 mr-2" />
              无序列表
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
              onClick={() => setShowSlashMenu(false)}
              className="justify-start col-span-2"
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

      {/* GitHub配置对话框 */}
      {showGitHubConfig && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">GitHub上传配置</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                GitHub Token (需要repo权限)
              </label>
              <Input
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxx"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                仓库 (owner/repo)
              </label>
              <Input
                placeholder="Rain1601/Muses"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                上传路径
              </label>
              <Input
                placeholder="uploads"
                value={githubPath}
                onChange={(e) => setGithubPath(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button 
              size="sm" 
              onClick={() => {
                // 保存配置
                if (githubToken && githubRepo) {
                  const [owner, repo] = githubRepo.split('/');
                  const config = { owner, repo, token: githubToken, path: githubPath };
                  // 这里可以调用saveGitHubConfig(config)
                  localStorage.setItem('github-upload-config', JSON.stringify(config));
                  console.log('GitHub配置已保存');
                }
                setShowGitHubConfig(false);
              }}
              disabled={!githubToken || !githubRepo}
            >
              保存
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setShowGitHubConfig(false)}
            >
              取消
            </Button>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            💡 配置后图片将自动上传到GitHub仓库，未配置时使用本地预览
          </div>
        </div>
      )}

      {/* 使用提示 */}
      <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <div className="text-sm text-yellow-700 dark:text-yellow-300">
          <div className="font-medium mb-1">💡 图片功能提示：</div>
          <ul className="text-xs space-y-1">
            <li>• 复制图片后直接粘贴（Ctrl+V 或 Cmd+V）</li>
            <li>• 拖拽图片文件到编辑器中</li>
            <li>• 点击上传按钮选择文件</li>
            <li>• 点击图片图标输入网络图片URL</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
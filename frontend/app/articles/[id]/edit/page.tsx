'use client';

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import dynamic from 'next/dynamic';
import Navigation from "@/components/Navigation";
import { useUserStore } from "@/store/user";
import { api, processApi } from "@/lib/api";
import { DiffViewer } from "@/components/DiffViewer";
import { LLMResponse } from "@/lib/types/llm-response";
import { useTheme } from 'next-themes';
import { SelectionToolbar } from '@/components/SelectionToolbar';
import { cn } from '@/lib/utils';

// 动态导入编辑器组件以避免 SSR 问题
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
);

// 这些插件将在运行时动态加载，无需在顶层导入

// 动态导入编辑器样式
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import 'highlight.js/styles/github.css'; // 默认代码高亮主题
import './editor-dark-styles.css'; // 自定义暗色模式样式

interface Article {
  id: string;
  title: string;
  content: string;
  summary?: string;
  publishStatus: string;
  agent: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export default function EditArticlePage() {
  const router = useRouter();
  const params = useParams();
  const { user, isLoading: userLoading } = useUserStore();
  const { theme, systemTheme } = useTheme();
  const articleId = params.id as string;

  const [article, setArticle] = useState<Article | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [editorPlugins, setEditorPlugins] = useState<any>({
    remarkPlugins: [],
    rehypePlugins: []
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<Array<{id: string, name: string, url: string}>>([]);
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [diffData, setDiffData] = useState<{original: string; modified: string} | null>(null);
  const [aiResponse, setAiResponse] = useState<LLMResponse | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selection, setSelection] = useState<{text: string; range: Range; rect: DOMRect} | null>(null);
  const [pendingAction, setPendingAction] = useState<{type: 'rewrite' | 'continue'; text: string; instruction: string} | null>(null);
  const [highlightedText, setHighlightedText] = useState<{start: number; end: number; text: string} | null>(null);
  const highlightIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const highlightedTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [highlightOverlay, setHighlightOverlay] = useState<{top: number; left: number; width: number; height: number} | null>(null);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/');
      return;
    }
    
    if (user && articleId) {
      fetchArticle();
    }
  }, [articleId, user, userLoading, router]);

  // 加载编辑器插件和配置 Mermaid
  useEffect(() => {
    const loadPlugins = async () => {
      try {
        // 动态加载插件和样式
        const [remarkGfmModule, rehypeHighlightModule, rehypeKatexModule] = await Promise.all([
          import('remark-gfm'),
          import('rehype-highlight'),
          import('rehype-katex')
        ]);

        // 动态加载 katex CSS
        if (typeof document !== 'undefined') {
          const katexCSS = document.querySelector('link[href*="katex"]');
          if (!katexCSS) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css';
            document.head.appendChild(link);
          }
        }

        // 配置 Mermaid
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          theme: 'default',
          startOnLoad: true,
          fontFamily: 'inherit',
          fontSize: 14,
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true
          },
          sequence: {
            useMaxWidth: true
          },
          gantt: {
            useMaxWidth: true
          }
        });

        setEditorPlugins({
          remarkPlugins: [remarkGfmModule.default],
          rehypePlugins: [
            [rehypeHighlightModule.default, { ignoreMissing: true }],
            rehypeKatexModule.default
          ]
        });
      } catch (error) {
        console.error('Failed to load editor plugins:', error);
        // 设置基础插件作为fallback
        setEditorPlugins({
          remarkPlugins: [],
          rehypePlugins: []
        });
      }
    };

    loadPlugins();
  }, []);

  // 清除现有的高亮元素
  const clearExistingHighlight = () => {
    const overlay = document.getElementById('selection-highlight-overlay');
    const marker = document.getElementById('selection-text-marker');
    if (overlay) overlay.remove();
    if (marker) marker.remove();
  };

  // 高亮文本函数 - 简化版本，保持选中状态
  const highlightTextInTextarea = (textarea: HTMLTextAreaElement, start: number, end: number) => {
    // 保存textarea引用和高亮信息
    highlightedTextareaRef.current = textarea;
    
    // 添加持续高亮的类
    textarea.classList.add('has-persistent-highlight');
    
    // 保持选中状态
    textarea.setSelectionRange(start, end);
    
    // 创建一个定时器来维持选中状态
    let maintainSelectionInterval: NodeJS.Timeout;
    
    const maintainSelection = () => {
      if (highlightedText && highlightedTextareaRef.current === textarea) {
        // 检查当前选中范围
        if (textarea.selectionStart !== start || textarea.selectionEnd !== end) {
          // 恢复选中
          textarea.setSelectionRange(start, end);
        }
      }
    };
    
    // 每100ms检查并恢复选中状态
    maintainSelectionInterval = setInterval(maintainSelection, 100);
    
    // 获取编辑器容器并添加视觉提示
    const editorContainer = textarea.closest('.w-md-editor');
    if (editorContainer) {
      // 移除旧的标记
      const oldMarker = editorContainer.querySelector('.highlight-marker');
      if (oldMarker) oldMarker.remove();
      
      // 创建新的标记
      const marker = document.createElement('div');
      marker.className = 'highlight-marker';
      marker.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: rgba(255, 235, 59, 0.9);
        color: #000;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        z-index: 1000;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      `;
      marker.textContent = `已高亮 ${end - start} 个字符`;
      (editorContainer as HTMLElement).style.position = 'relative';
      editorContainer.appendChild(marker);
    }
    
    // 保存清理函数
    (textarea as any).cleanupSelection = () => {
      clearInterval(maintainSelectionInterval);
      textarea.classList.remove('has-persistent-highlight');
      const marker = document.querySelector('.highlight-marker');
      if (marker) marker.remove();
      // 清除选中
      textarea.setSelectionRange(textarea.selectionEnd, textarea.selectionEnd);
    };
  };
  
  // 清除高亮
  const clearHighlight = () => {
    // 清除高亮的textarea
    if (highlightedTextareaRef.current) {
      const textarea = highlightedTextareaRef.current;
      
      // 调用清理函数
      if ((textarea as any).cleanupSelection) {
        (textarea as any).cleanupSelection();
      }
      
      // 移除选中
      if (textarea.selectionStart !== textarea.selectionEnd) {
        textarea.setSelectionRange(textarea.selectionEnd, textarea.selectionEnd);
      }
      highlightedTextareaRef.current = null;
    }
    
    setHighlightedText(null);
    setSelection(null);
  };
  
  // ESC键处理和点击外部清除高亮
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearHighlight();
      }
    };
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // 如果点击的是工具栏或者高亮的文本区域，不清除
      if (target.closest('.selection-toolbar') || 
          target.closest('#selection-toolbar') ||
          target.closest('.persistent-highlight') ||
          target.closest('.w-md-editor-text-input')) {
        return;
      }
      
      // 点击其他地方清除高亮
      if (highlightedText) {
        clearHighlight();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickOutside);
      // 清理定时器
      if (highlightIntervalRef.current) {
        clearInterval(highlightIntervalRef.current);
      }
    };
  }, [highlightedText]);

  // 处理文本选择
  useEffect(() => {
    const handleSelection = (e?: Event) => {
      console.log('handleSelection called from:', e?.type || 'manual'); // 调试
      
      // 尝试从事件目标获取选择
      let selection = window.getSelection();
      
      // 如果是从textarea触发的事件，尝试获取textarea的选择
      if (e && e.target && (e.target as HTMLElement).tagName === 'TEXTAREA') {
        const textarea = e.target as HTMLTextAreaElement;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        
        console.log('Textarea selection:', {
          start,
          end,
          text: selectedText,
          hasSelection: start !== end
        });
        
        if (start !== end && selectedText.trim().length > 0) {
          // 获取鼠标的实际位置
          const mouseEvent = e as MouseEvent;
          const mouseX = mouseEvent.clientX || 0;
          const mouseY = mouseEvent.clientY || 0;
          
          // 创建一个DOMRect，位置在鼠标位置
          const rect = {
            top: mouseY,
            left: mouseX,
            bottom: mouseY + 20,
            right: mouseX + 100,
            width: 100,
            height: 20,
            x: mouseX,
            y: mouseY
          };
          
          console.log('Setting selection from textarea with mouse position:', {
            text: selectedText,
            mouseX,
            mouseY
          });
          
          setSelection({ 
            text: selectedText.trim(), 
            range: null as any, // textarea没有range对象
            rect: rect as DOMRect
          });
          
          // 保存高亮位置
          setHighlightedText({ start, end, text: selectedText });
          
          // 高亮选中的文本
          highlightTextInTextarea(textarea, start, end);
          
          // 不要清除选择，让高亮函数来维持选中状态
          
          return;
        }
      }
      
      // 原有的选择逻辑
      console.log('Selection object:', {
        selection: selection,
        rangeCount: selection?.rangeCount,
        isCollapsed: selection?.isCollapsed,
        toString: selection?.toString()
      });
      
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const text = selection.toString();
        
        console.log('Selection details:', {
          text: text,
          trimmedText: text.trim(),
          length: text.length,
          trimmedLength: text.trim().length,
          isCollapsed: selection.isCollapsed
        });
        
        if (text.trim().length > 0) {
          const rect = range.getBoundingClientRect();
          
          console.log('Rect details:', rect);
          
          if (rect) {
            console.log('Selection detected:', text, rect);
            setSelection({ text: text.trim(), range, rect });
            
          }
        }
      } else {
        setSelection(null);
      }
    };

    // 直接在编辑器元素上添加监听
    const setupEditorListeners = () => {
      // 查找所有可能的编辑器元素
      const editorElements = [
        ...Array.from(document.querySelectorAll('.w-md-editor-text-input')),
        ...Array.from(document.querySelectorAll('.w-md-editor-text textarea')),
        ...Array.from(document.querySelectorAll('.w-md-editor textarea')),
        ...Array.from(document.querySelectorAll('textarea'))
      ];
      
      console.log('Found editor elements:', editorElements.length); // 调试
      
      editorElements.forEach((element, index) => {
        console.log(`Adding listener to element ${index}:`, element.className); // 调试
        
        // 专门为 textarea 添加更精确的事件处理
        if (element.tagName === 'TEXTAREA') {
          const textarea = element as HTMLTextAreaElement;
          
          // 鼠标释放时检查选择
          textarea.addEventListener('mouseup', (e) => {
            setTimeout(() => {
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const selectedText = textarea.value.substring(start, end);
              
              console.log('Textarea mouseup selection:', {
                start,
                end,
                text: selectedText,
                hasSelection: start !== end
              });
              
              if (start !== end && selectedText.trim().length > 0) {
                // 保存鼠标位置到事件对象
                const mouseEvent = e as MouseEvent;
                (mouseEvent as any).mouseX = mouseEvent.clientX;
                (mouseEvent as any).mouseY = mouseEvent.clientY;
                handleSelection(mouseEvent);
              }
            }, 50); // 小延迟确保选择完成
          });
          
          // 键盘选择
          textarea.addEventListener('keyup', (e) => {
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
              handleSelection(e);
            }
          });
        } else {
          element.addEventListener('mouseup', handleSelection);
          element.addEventListener('keyup', handleSelection);
        }
      });
      
      // 移除全局 selectionchange 监听，因为它总是返回 isCollapsed: true
      // document.addEventListener('selectionchange', handleSelection);
    };

    // 延迟执行以确保编辑器已渲染
    const timer = setTimeout(setupEditorListeners, 1000);
    
    // 如果内容变化，重新设置监听器
    const observer = new MutationObserver(() => {
      setupEditorListeners();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener('selectionchange', handleSelection);
      
      // 清理所有添加的监听器
      document.querySelectorAll('.w-md-editor-text-input, .w-md-editor-text textarea, .w-md-editor textarea, textarea').forEach(element => {
        element.removeEventListener('mouseup', handleSelection);
        element.removeEventListener('keyup', handleSelection);
      });
    };
  }, []);

  // 处理 Mermaid 图表渲染
  useEffect(() => {
    const renderMermaid = async () => {
      if (content.includes('```mermaid')) {
        try {
          const mermaid = (await import('mermaid')).default;
          // 等待 DOM 更新后再渲染
          setTimeout(() => {
            mermaid.init(undefined, document.querySelectorAll('.mermaid'));
          }, 100);
        } catch (error) {
          console.error('Mermaid rendering error:', error);
        }
      }
    };

    renderMermaid();
  }, [content]);

  const fetchArticle = async () => {
    try {
      const response = await api.get(`/api/articles/${articleId}`);
      const data = response.data.article;
      setArticle(data);
      setTitle(data.title);
      setContent(data.content);
    } catch (error) {
      console.error("Failed to fetch article:", error);
      router.push("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put(`/api/articles/${articleId}`, {
        title,
        content,
      });
      
      // 显示成功提示
      const toast = document.createElement('div');
      toast.className = 'fixed top-20 right-6 z-50 px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2';
      toast.textContent = '✓ 保存成功';
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.classList.add('animate-out', 'fade-out', 'slide-out-to-top-2');
        setTimeout(() => toast.remove(), 200);
      }, 2000);
    } catch (error) {
      // 显示错误提示
      const toast = document.createElement('div');
      toast.className = 'fixed top-20 right-6 z-50 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2';
      toast.textContent = '✗ 保存失败';
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.classList.add('animate-out', 'fade-out', 'slide-out-to-top-2');
        setTimeout(() => toast.remove(), 200);
      }, 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!confirm("确定要发布这篇文章吗？")) return;
    
    setIsSaving(true);
    try {
      await api.put(`/api/articles/${articleId}`, {
        title,
        content,
        publishStatus: "published",
      });
      router.push(`/articles/${articleId}/publish`);
    } catch (error) {
      alert("发布失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAIImprove = async () => {
    if (!aiInstruction.trim()) {
      alert("请输入改进要求");
      return;
    }

    setIsSaving(true);
    try {
      // 判断任务类型
      const isRewriteTask = aiInstruction.includes('修改') || aiInstruction.includes('改写') || 
                           aiInstruction.includes('优化') || aiInstruction.includes('润色');
      
      // 使用新的结构化API
      const response = await processApi.improveArticle({
        articleId,
        agentId: article?.agent.id || '',
        instructions: aiInstruction,
        taskType: isRewriteTask ? 'rewrite' : 'continue'
      });
      
      setAiResponse(response);
      
      // 如果是改写任务，显示差异对比
      if (response.type === 'rewrite' && response.metadata?.original) {
        setDiffData({
          original: response.metadata.original,
          modified: response.result
        });
        setShowDiffViewer(true);
      } else {
        // 直接应用结果
        setContent(response.result);
        alert("AI处理完成");
      }
      
      setAiInstruction("");
    } catch (error) {
      console.error('AI improve error:', error);
      alert("处理失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyAIChanges = () => {
    if (aiResponse && pendingAction) {
      if (pendingAction.type === 'rewrite') {
        // 替换选中的文本
        const newContent = content.replace(pendingAction.text, aiResponse.result);
        setContent(newContent);
      } else {
        // 已在 handleSelectionContinue 中处理
      }
      setShowDiffViewer(false);
      setDiffData(null);
      setPendingAction(null);
      alert("已应用AI修改");
    }
  };

  const handleCancelDiff = () => {
    setShowDiffViewer(false);
    setDiffData(null);
    setAiResponse(null);
  };

  const handleSelectionRewrite = async (text: string, instruction: string) => {
    if (!article?.agent.id) {
      alert('文章信息加载中，请稍后再试');
      return;
    }
    
    setPendingAction({ type: 'rewrite', text, instruction });
    
    try {
      const response = await processApi.processText({
        input: instruction,
        context: text,
        agentId: article.agent.id,
        options: { taskType: 'rewrite' }
      });
      
      if (response.type === 'rewrite' && response.metadata?.original) {
        setDiffData({
          original: text,
          modified: response.result
        });
        setAiResponse(response);
        setShowDiffViewer(true);
      }
    } catch (error) {
      alert('处理失败');
    }
  };

  const handleSelectionContinue = async (text: string, instruction: string) => {
    if (!article?.agent.id) {
      alert('文章信息加载中，请稍后再试');
      return;
    }
    
    setPendingAction({ type: 'continue', text, instruction });
    
    try {
      const response = await processApi.processText({
        input: instruction,
        context: text,
        agentId: article.agent.id,
        options: { taskType: 'continue' }
      });
      
      // 显示确认对话框
      if (confirm(`是否在选中文本后添加以下内容？\n\n${response.result}`)) {
        // 在选中文本后插入新内容
        const currentPos = content.indexOf(text) + text.length;
        const newContent = content.slice(0, currentPos) + '\n\n' + response.result + content.slice(currentPos);
        setContent(newContent);
      }
    } catch (error) {
      alert('处理失败');
    }
  };

  // 图片上传处理
  const handleImageUpload = async (file: File): Promise<string> => {
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/api/upload/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.data.success) {
        const imageUrl = `http://localhost:8080${response.data.file.url}`;
        const imageInfo = {
          id: response.data.file.id,
          name: file.name,
          url: imageUrl
        };
        
        // 添加到已上传图片列表
        setUploadedImages(prev => [...prev, imageInfo]);
        
        return imageUrl;
      } else {
        throw new Error('Upload failed');
      }
    } catch (error: any) {
      console.error('Image upload failed:', error);
      alert('图片上传失败：' + (error.response?.data?.detail || '未知错误'));
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  // 单纯上传图片，不插入编辑器
  const handleImageUploadOnly = async (file: File) => {
    try {
      await handleImageUpload(file);
      alert(`图片 "${file.name}" 上传成功！可在侧边栏选择插入。`);
    } catch (error) {
      // 错误处理已在 handleImageUpload 中完成
    }
  };

  // 插入已上传的图片到编辑器
  const handleInsertImage = (imageInfo: {id: string, name: string, url: string}) => {
    const imageMarkdown = `![${imageInfo.name}](${imageInfo.url})\n`;
    setContent(prev => prev + imageMarkdown);
  };

  // 处理拖拽上传
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      alert('请选择图片文件');
      return;
    }

    for (const file of imageFiles) {
      try {
        const imageUrl = await handleImageUpload(file);
        const imageMarkdown = `![${file.name}](${imageUrl})\n`;
        setContent(prev => prev + imageMarkdown);
      } catch (error) {
        console.error('Failed to upload image:', file.name);
      }
    }
  };

  // 处理文件选择上传（仅上传，不插入）
  const handleFileSelectUploadOnly = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        alert(`文件 ${file.name} 不是图片格式`);
        continue;
      }
      
      try {
        await handleImageUploadOnly(file);
      } catch (error) {
        console.error('Failed to upload image:', file.name);
      }
    }
    
    // 重置input
    e.target.value = '';
  };

  // 处理文件选择上传并插入
  const handleFileSelectAndInsert = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        alert(`文件 ${file.name} 不是图片格式`);
        continue;
      }
      
      try {
        const imageUrl = await handleImageUpload(file);
        const imageMarkdown = `![${file.name}](${imageUrl})\n`;
        setContent(prev => prev + imageMarkdown);
      } catch (error) {
        console.error('Failed to upload image:', file.name);
      }
    }
    
    // 重置input
    e.target.value = '';
  };

  if (userLoading || isLoading || !article) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* 编辑器顶部工具栏 */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ← 返回
              </Link>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xl font-bold bg-transparent border-0 focus:outline-none placeholder-muted-foreground"
                placeholder="文章标题"
              />
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-accent transition-colors"
              >
                {showPreview ? '👁️ 隐藏预览' : '👀 显示预览'}
              </button>
              <button
                onClick={() => setShowAIPanel(!showAIPanel)}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-accent transition-colors"
              >
                AI助手
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-1.5 text-sm border rounded-lg hover:bg-accent disabled:opacity-50 transition-colors"
              >
                {isSaving ? "保存中..." : "保存草稿"}
              </button>
              <button
                onClick={handlePublish}
                disabled={isSaving}
                className="px-4 py-1.5 text-sm bg-gradient-to-br from-primary to-accent text-white rounded-lg hover:from-primary/90 hover:to-accent/90 transition-all duration-200 disabled:opacity-50 shadow-md hover:shadow-lg"
              >
                发布
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6" style={{ height: 'calc(100vh - 120px)' }}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
          {/* 主编辑区 */}
          <div 
            className={cn(
              "h-full transition-all duration-300",
              showPreview ? "lg:col-span-3" : "lg:col-span-4"
            )}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={(e) => e.preventDefault()}
          >
            {isUploading && (
              <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg z-50">
                正在上传图片...
              </div>
            )}
            <div 
              style={{ height: 'calc(100vh - 200px)' }}
              onMouseUp={(e) => {
                console.log('MouseUp in editor container');
                // 强制触发选择检测
                setTimeout(() => {
                  const selection = window.getSelection();
                  if (selection && selection.toString().trim()) {
                    console.log('Force selection check:', selection.toString());
                  }
                }, 100);
              }}
            >
              <MDEditor
                value={content}
                onChange={(val) => setContent(val || '')}
                height="100%"
                visibleDragbar={false}
                textareaProps={{
                  placeholder: '开始编写您的文章...\n\n支持功能:\n- 📷 图片：工具栏按钮 或 拖拽上传 或 侧边栏快速上传\n- 📊 Mermaid图表：```mermaid\n- 💻 代码高亮：```语言名\n- 🔢 数学公式：$inline$ 或 $$block$$\n- 📝 表格、任务列表等 GitHub 风格 Markdown',
                  style: {
                    fontSize: 14,
                    lineHeight: 1.6,
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  }
                }}
                preview={showPreview ? "live" : "edit"}
                hideToolbar={false}
                data-color-mode={(theme === 'system' ? systemTheme : theme) as 'dark' | 'light'}
              previewOptions={{
                remarkPlugins: editorPlugins.remarkPlugins,
                rehypePlugins: editorPlugins.rehypePlugins,
                components: {
                  code: ({ node, inline, className, children, ...props }: any) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const language = match ? match[1] : '';
                    
                    // Mermaid 图表处理
                    if (language === 'mermaid') {
                      return (
                        <div className="mermaid" style={{ textAlign: 'center' }}>
                          {String(children).replace(/\n$/, '')}
                        </div>
                      );
                    }
                    
                    return inline ? (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    ) : (
                      <pre className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    );
                  },
                  img: ({ src, alt, ...props }: any) => (
                    <img 
                      src={src} 
                      alt={alt} 
                      {...props}
                      className="max-w-full h-auto rounded-lg shadow-sm"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjRjVGNUY1IiBzdHJva2U9IiNEOUQ5RDkiLz4KPGC4dGggZD0iTTEyIDhWMTZNOCAxMkgxNiIgc3Ryb2tlPSIjOTk5OTk5IiBzdHJva2Utd2lkdGg9IjIiIGZcUm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
                        target.alt = alt + ' (图片加载失败)';
                      }}
                    />
                  )
                }
              }}
              extraCommands={[
                // 自定义工具栏命令
                {
                  name: 'image',
                  keyCommand: 'image',
                  buttonProps: { 'aria-label': '插入图片', title: '插入图片' },
                  icon: (
                    <svg width="12" height="12" viewBox="0 0 20 20">
                      <path fill="currentColor" d="M15 9c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4-7H1c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1h18c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1zM2 4h16v8l-3.5-3.5c-.3-.3-.7-.3-1 0L8 14l-2.5-2.5c-.3-.3-.7-.3-1 0L2 14V4z"/>
                    </svg>
                  ),
                  execute: (state: any) => {
                    // 触发文件选择对话框
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.multiple = true;
                    input.onchange = async (e: any) => {
                      const files = Array.from(e.target.files || []);
                      for (const file of files) {
                        try {
                          const imageUrl = await handleImageUpload(file as File);
                          const imageMarkdown = `![${(file as File).name}](${imageUrl})\n`;
                          setContent(prev => prev + imageMarkdown);
                        } catch (error) {
                          console.error('Failed to upload image:', (file as File).name);
                        }
                      }
                    };
                    input.click();
                    
                    // 返回当前状态，不修改编辑器内容（将通过上传回调修改）
                    return { text: state.text, selection: state.selection };
                  }
                },
                {
                  name: 'mermaid',
                  keyCommand: 'mermaid',
                  buttonProps: { 'aria-label': '插入Mermaid图表', title: '插入Mermaid图表' },
                  icon: (
                    <svg width="12" height="12" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M3 3h18v18H3V3zm16 16V5H5v14h14zM8 17l1.5-1.5L12 18l2.5-2.5L16 17l-4-4-4 4z"/>
                    </svg>
                  ),
                  execute: (state: any) => {
                    const mermaidText = '\n```mermaid\ngraph TD\n    A[开始] --> B[处理]\n    B --> C[结束]\n```\n';
                    return {
                      text: state.text.slice(0, state.selection.start) + mermaidText + state.text.slice(state.selection.end),
                      selection: {
                        start: state.selection.start + mermaidText.length,
                        end: state.selection.start + mermaidText.length
                      }
                    };
                  }
                }
              ]}
              />
            </div>
          </div>

          {/* 侧边栏 */}
          {showPreview && (
          <div className="space-y-6 h-full overflow-y-auto pr-2">
            {/* 文章信息 */}
            <div className="p-4 border rounded-lg bg-card">
              <h3 className="font-medium mb-3">文章信息</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">使用Agent</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                      {article.agent.avatar || "✨"}
                    </div>
                    <span>{article.agent.name}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">状态</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      article.publishStatus === "published"
                        ? "bg-green-100 text-green-800"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {article.publishStatus === "published" ? "已发布" : "草稿"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">字数</span>
                  <span>{content.length} 字</span>
                </div>
              </div>
            </div>

            {/* 差异对比面板 */}
            {showDiffViewer && diffData && (
              <div className="p-4 border rounded-lg bg-card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">AI修改对比</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleApplyAIChanges}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      应用修改
                    </button>
                    <button
                      onClick={handleCancelDiff}
                      className="px-3 py-1 text-sm border rounded hover:bg-accent transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
                <DiffViewer
                  original={diffData.original}
                  modified={diffData.modified}
                  mode="inline"
                  className="max-h-96 overflow-y-auto"
                />
                {aiResponse?.metadata?.suggestions && (
                  <div className="mt-3 p-3 bg-blue-50 rounded text-sm">
                    <p className="font-medium text-blue-900 mb-1">AI建议：</p>
                    <ul className="list-disc list-inside text-blue-800">
                      {aiResponse.metadata.suggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* AI助手面板 */}
            {showAIPanel && !showDiffViewer && (
              <div className="p-4 border rounded-lg bg-card">
                <h3 className="font-medium mb-3">AI助手</h3>
                <div className="space-y-3">
                  <textarea
                    value={aiInstruction}
                    onChange={(e) => setAiInstruction(e.target.value)}
                    className="w-full h-24 p-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none bg-background"
                    placeholder="告诉AI您想如何改进文章..."
                  />
                  <button
                    onClick={handleAIImprove}
                    disabled={isSaving}
                    className="w-full py-2 bg-gradient-to-br from-primary to-accent text-white rounded-lg hover:from-primary/90 hover:to-accent/90 transition-all duration-200 text-sm disabled:opacity-50 shadow-md hover:shadow-lg"
                  >
                    {isSaving ? "优化中..." : "AI优化"}
                  </button>
                  
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>快捷指令：</p>
                    <button
                      onClick={() => setAiInstruction("请帮我修改和优化文章结构，使逻辑更清晰")}
                      className="block w-full text-left px-2 py-1 hover:bg-accent rounded transition-colors"
                    >
                      • 修改结构（对比模式）
                    </button>
                    <button
                      onClick={() => setAiInstruction("请帮我修改并修正语法错误")}
                      className="block w-full text-left px-2 py-1 hover:bg-accent rounded transition-colors"
                    >
                      • 修改语法（对比模式）
                    </button>
                    <button
                      onClick={() => setAiInstruction("请继续写下去，添加更多相关内容")}
                      className="block w-full text-left px-2 py-1 hover:bg-accent rounded transition-colors"
                    >
                      • 续写内容
                    </button>
                    <button
                      onClick={() => setAiInstruction("请帮我改写并精简内容，保留核心观点")}
                      className="block w-full text-left px-2 py-1 hover:bg-accent rounded transition-colors"
                    >
                      • 改写精简（对比模式）
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 图片管理 */}
            <div className="p-4 border rounded-lg bg-card">
              <h3 className="font-medium mb-3">📷 图片管理</h3>
              <div className="space-y-3">
                {/* 上传区域 */}
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelectUploadOnly}
                    className="hidden"
                    id="image-upload-only"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelectAndInsert}
                    className="hidden"
                    id="image-upload-insert"
                  />
                  
                  <label
                    htmlFor="image-upload-only"
                    className="flex items-center justify-center w-full p-2 border rounded cursor-pointer hover:border-primary hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-sm">上传图片</span>
                    </div>
                  </label>
                  
                  <label
                    htmlFor="image-upload-insert"
                    className="flex items-center justify-center w-full p-2 bg-gradient-to-br from-primary to-accent text-white rounded cursor-pointer hover:from-primary/90 hover:to-accent/90 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span className="text-sm">上传并插入</span>
                    </div>
                  </label>
                </div>

                {/* 已上传图片列表 */}
                {uploadedImages.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">已上传图片：</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {uploadedImages.map((img, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs">
                          <span className="truncate flex-1" title={img.name}>
                            {img.name}
                          </span>
                          <button
                            onClick={() => handleInsertImage(img)}
                            className="ml-2 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                            title="插入到编辑器"
                          >
                            插入
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  <p>💡 提示：</p>
                  <p>• 上传图片：仅上传，稍后选择插入</p>
                  <p>• 上传并插入：直接插入到编辑器当前位置</p>
                  <p>• 拖拽到编辑器：自动上传并插入</p>
                  <p>• 支持：JPG, PNG, GIF, WebP, SVG (≤5MB)</p>
                </div>
              </div>
            </div>

            {/* 编辑器功能说明 */}
            <div className="p-4 border rounded-lg bg-card">
              <h3 className="font-medium mb-3">编辑器功能</h3>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>实时预览</span>
                  <span className="text-green-600">✓</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>语法高亮</span>
                  <span className="text-green-600">✓</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>图片预览</span>
                  <span className="text-green-600">✓</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Mermaid图表</span>
                  <span className="text-green-600">✓</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>数学公式</span>
                  <span className="text-green-600">✓</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>GitHub风格</span>
                  <span className="text-green-600">✓</span>
                </div>
                <hr className="my-2" />
                <div className="text-xs">
                  <p className="font-medium mb-1">支持的语法：</p>
                  <div>![alt](url) - 图片</div>
                  <div>```mermaid - Mermaid图</div>
                  <div>```语言 - 代码块</div>
                  <div>$公式$ - 行内数学</div>
                  <div>$$公式$$ - 块级数学</div>
                  <div>表格、任务列表、删除线等</div>
                </div>
                <hr className="my-2" />
                <div className="text-xs">
                  <p className="font-medium mb-1">快捷键：</p>
                  <div className="space-y-1">
                    <div 
                      className="p-1 rounded hover:bg-accent cursor-help transition-colors"
                      title="加粗选中文本或在光标位置插入加粗格式"
                    >
                      <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl/Cmd + B</kbd>: 粗体
                    </div>
                    <div 
                      className="p-1 rounded hover:bg-accent cursor-help transition-colors"
                      title="斜体选中文本或在光标位置插入斜体格式"
                    >
                      <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl/Cmd + I</kbd>: 斜体
                    </div>
                    <div 
                      className="p-1 rounded hover:bg-accent cursor-help transition-colors"
                      title="将选中文本转换为链接或插入链接格式"
                    >
                      <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl/Cmd + K</kbd>: 链接
                    </div>
                    <div 
                      className="p-1 rounded hover:bg-accent cursor-help transition-colors"
                      title="将选中文本转换为行内代码或插入代码格式"
                    >
                      <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl/Cmd + `</kbd>: 代码
                    </div>
                    <div 
                      className="p-1 rounded hover:bg-accent cursor-help transition-colors"
                      title="插入代码块，支持语法高亮"
                    >
                      <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl/Cmd + Shift + K</kbd>: 代码块
                    </div>
                    <div 
                      className="p-1 rounded hover:bg-accent cursor-help transition-colors"
                      title="在当前行插入分割线"
                    >
                      <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl/Cmd + H</kbd>: 分割线
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
          
          {/* 高亮指示器 */}
          {highlightedText && (
            <div 
              className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 
                        bg-yellow-500 text-black px-4 py-2 rounded-full 
                        shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2
                        border-2 border-yellow-600"
              ref={(el) => {
                if (el) {
                  // 3秒后自动消失，但高亮保持
                  setTimeout(() => {
                    el.classList.add('animate-out', 'fade-out', 'slide-out-to-top-2');
                    setTimeout(() => {
                      // 只隐藏提示，不清除选择
                      el.style.display = 'none';
                    }, 200);
                  }, 3000);
                }
              }}
            >
              <span className="text-sm font-medium">
                🎯 已高亮: {highlightedText.text.substring(0, 30)}{highlightedText.text.length > 30 ? '...' : ''}
              </span>
              <button 
                onClick={clearHighlight}
                className="ml-2 hover:opacity-80 bg-yellow-600 text-white px-2 py-0.5 rounded-md text-xs font-bold"
                title="清除高亮 (ESC)"
              >
                清除
              </button>
            </div>
          )}
          
          <SelectionToolbar
            selection={selection}
            onRewrite={handleSelectionRewrite}
            onContinue={handleSelectionContinue}
          />
        </div>
      </div>
    </div>
  );
}
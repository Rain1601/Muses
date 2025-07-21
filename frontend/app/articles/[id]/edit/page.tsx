'use client';

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import dynamic from 'next/dynamic';
import Navigation from "@/components/Navigation";
import { useUserStore } from "@/store/user";
import { api } from "@/lib/api";

// 动态导入编辑器组件以避免 SSR 问题
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
);

// 这些插件将在运行时动态加载，无需在顶层导入

// 动态导入编辑器样式
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import 'highlight.js/styles/github.css'; // 代码高亮主题

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
      alert("保存成功");
    } catch (error) {
      alert("保存失败");
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
      const response = await api.post("/api/generate/improve", {
        articleId,
        agentId: article?.agent.id,
        instructions: aiInstruction,
      });
      
      setContent(response.data.article.content);
      setAiInstruction("");
      alert("AI优化完成");
    } catch (error) {
      alert("优化失败");
    } finally {
      setIsSaving(false);
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
      <div className="border-b bg-background sticky top-0 z-10">
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
                className="text-xl font-bold bg-transparent border-0 focus:outline-none"
                placeholder="文章标题"
              />
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowAIPanel(!showAIPanel)}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted"
              >
                AI助手
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-1.5 text-sm border rounded-lg hover:bg-muted disabled:opacity-50"
              >
                {isSaving ? "保存中..." : "保存草稿"}
              </button>
              <button
                onClick={handlePublish}
                disabled={isSaving}
                className="px-4 py-1.5 text-sm bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg hover:from-violet-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 shadow-md hover:shadow-lg"
              >
                发布
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 主编辑区 */}
          <div 
            className="lg:col-span-3"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={(e) => e.preventDefault()}
          >
            {isUploading && (
              <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg z-50">
                正在上传图片...
              </div>
            )}
            <MDEditor
              value={content}
              onChange={(val) => setContent(val || '')}
              height={600}
              visibleDragbar={false}
              textareaProps={{
                placeholder: '开始编写您的文章...\n\n支持功能:\n- 📷 图片：工具栏按钮 或 拖拽上传 或 侧边栏快速上传\n- 📊 Mermaid图表：```mermaid\n- 💻 代码高亮：```语言名\n- 🔢 数学公式：$inline$ 或 $$block$$\n- 📝 表格、任务列表等 GitHub 风格 Markdown',
                style: {
                  fontSize: 14,
                  lineHeight: 1.6,
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                },
              }}
              preview="live"
              hideToolbar={false}
              data-color-mode="light"
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
                      <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
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

          {/* 侧边栏 */}
          <div className="space-y-6">
            {/* 文章信息 */}
            <div className="p-4 border rounded-lg">
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
                        : "bg-gray-100 text-gray-800"
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

            {/* AI助手面板 */}
            {showAIPanel && (
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-3">AI助手</h3>
                <div className="space-y-3">
                  <textarea
                    value={aiInstruction}
                    onChange={(e) => setAiInstruction(e.target.value)}
                    className="w-full h-24 p-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder="告诉AI您想如何改进文章..."
                  />
                  <button
                    onClick={handleAIImprove}
                    disabled={isSaving}
                    className="w-full py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg hover:from-violet-600 hover:to-purple-700 transition-all duration-200 text-sm disabled:opacity-50 shadow-md hover:shadow-lg"
                  >
                    {isSaving ? "优化中..." : "AI优化"}
                  </button>
                  
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>快捷指令：</p>
                    <button
                      onClick={() => setAiInstruction("请帮我优化文章结构，使逻辑更清晰")}
                      className="block w-full text-left px-2 py-1 hover:bg-muted rounded"
                    >
                      • 优化结构
                    </button>
                    <button
                      onClick={() => setAiInstruction("请帮我检查并修正语法错误")}
                      className="block w-full text-left px-2 py-1 hover:bg-muted rounded"
                    >
                      • 检查语法
                    </button>
                    <button
                      onClick={() => setAiInstruction("请帮我扩充内容，添加更多细节")}
                      className="block w-full text-left px-2 py-1 hover:bg-muted rounded"
                    >
                      • 扩充内容
                    </button>
                    <button
                      onClick={() => setAiInstruction("请帮我精简内容，保留核心观点")}
                      className="block w-full text-left px-2 py-1 hover:bg-muted rounded"
                    >
                      • 精简内容
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 图片管理 */}
            <div className="p-4 border rounded-lg">
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
                    className="flex items-center justify-center w-full p-2 border border-gray-300 rounded cursor-pointer hover:border-primary hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-sm">上传图片</span>
                    </div>
                  </label>
                  
                  <label
                    htmlFor="image-upload-insert"
                    className="flex items-center justify-center w-full p-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded cursor-pointer hover:from-violet-600 hover:to-purple-700 transition-all duration-200 shadow-sm hover:shadow-md"
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
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
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
            <div className="p-4 border rounded-lg">
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
                      className="p-1 rounded hover:bg-gray-100 cursor-help transition-colors"
                      title="加粗选中文本或在光标位置插入加粗格式"
                    >
                      <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Ctrl/Cmd + B</kbd>: 粗体
                    </div>
                    <div 
                      className="p-1 rounded hover:bg-gray-100 cursor-help transition-colors"
                      title="斜体选中文本或在光标位置插入斜体格式"
                    >
                      <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Ctrl/Cmd + I</kbd>: 斜体
                    </div>
                    <div 
                      className="p-1 rounded hover:bg-gray-100 cursor-help transition-colors"
                      title="将选中文本转换为链接或插入链接格式"
                    >
                      <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Ctrl/Cmd + K</kbd>: 链接
                    </div>
                    <div 
                      className="p-1 rounded hover:bg-gray-100 cursor-help transition-colors"
                      title="将选中文本转换为行内代码或插入代码格式"
                    >
                      <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Ctrl/Cmd + `</kbd>: 代码
                    </div>
                    <div 
                      className="p-1 rounded hover:bg-gray-100 cursor-help transition-colors"
                      title="插入代码块，支持语法高亮"
                    >
                      <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Ctrl/Cmd + Shift + K</kbd>: 代码块
                    </div>
                    <div 
                      className="p-1 rounded hover:bg-gray-100 cursor-help transition-colors"
                      title="在当前行插入分割线"
                    >
                      <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Ctrl/Cmd + H</kbd>: 分割线
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
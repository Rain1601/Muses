"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUserStore } from "@/store/user";
import { auth } from "@/lib/auth";
import Navigation from "@/components/Navigation";
import { ArticleCompactList } from "@/components/ArticleCompactList";
import { ArticleDetailView } from "@/components/ArticleDetailView";
import { NotionEditor } from '@/components/NotionEditor';
import '@/app/editor-demo/mermaid-styles.css';
import { api } from "@/lib/api";
import { List, Info } from "lucide-react";

interface Article {
  id: string;
  title: string;
  content: string;
  summary?: string;
  publishStatus: string;
  createdAt: string;
  updatedAt: string;
  agent?: {
    name: string;
    avatar?: string;
  };
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, checkAuth, logout } = useUserStore();
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isEditing, setIsEditing] = useState(true);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingContent, setEditingContent] = useState("");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [rightPanelMode, setRightPanelMode] = useState<'toc' | 'info'>('toc');
  const [activeHeading, setActiveHeading] = useState<string>('');
  const [showSaveToast, setShowSaveToast] = useState(false);

  useEffect(() => {
    // 处理OAuth回调
    const token = searchParams.get("token");
    if (token) {
      auth.handleCallback(token).then(() => {
        checkAuth();
        router.replace("/dashboard");
      });
    } else if (!user) {
      checkAuth();
    }
  }, [searchParams, user, checkAuth, router]);

  // 自动保存功能
  const autoSave = useCallback(async () => {
    if (!editingContent.trim() && !editingTitle.trim()) return;

    try {
      if (selectedArticle) {
        // 更新现有文章
        await api.put(`/api/articles/${selectedArticle.id}`, {
          title: editingTitle || '无标题',
          content: editingContent,
          publishStatus: selectedArticle.publishStatus
        });
      } else {
        // 创建新文章
        const response = await api.post('/api/articles', {
          title: editingTitle || '无标题',
          content: editingContent,
          publishStatus: 'draft'
        });
        setSelectedArticle(response.data);
      }
      setLastSaved(new Date());
    } catch (error) {
      console.error('自动保存失败:', error);
    }
  }, [editingTitle, editingContent, selectedArticle]);

  // 手动保存功能（Cmd+S）
  const manualSave = useCallback(async () => {
    if (!editingContent.trim() && !editingTitle.trim()) return;

    try {
      if (selectedArticle) {
        // 更新现有文章
        await api.put(`/api/articles/${selectedArticle.id}`, {
          title: editingTitle || '无标题',
          content: editingContent,
          publishStatus: selectedArticle.publishStatus
        });
      } else {
        // 创建新文章
        const response = await api.post('/api/articles', {
          title: editingTitle || '无标题',
          content: editingContent,
          publishStatus: 'draft'
        });
        setSelectedArticle(response.data);
      }
      setLastSaved(new Date());

      // 显示保存成功提示
      setShowSaveToast(true);
      setTimeout(() => {
        setShowSaveToast(false);
      }, 1000);
    } catch (error) {
      console.error('手动保存失败:', error);
    }
  }, [editingTitle, editingContent, selectedArticle]);

  // 每10秒自动保存
  useEffect(() => {
    if (!isEditing) return;

    const interval = setInterval(autoSave, 10000);
    return () => clearInterval(interval);
  }, [autoSave, isEditing]);

  // 监听编辑器滚动，更新当前活跃的标题
  useEffect(() => {
    if (!isEditing) return;

    const handleScroll = () => {
      const editorElement = document.querySelector('.notion-editor-content .ProseMirror');
      if (!editorElement) return;

      const headings = editorElement.querySelectorAll('h1, h2, h3, h4');
      const scrollTop = editorElement.scrollTop;
      const containerRect = editorElement.getBoundingClientRect();

      let currentHeading = '';

      // 找到当前视区内最接近顶部的标题
      Array.from(headings).forEach((heading) => {
        const rect = heading.getBoundingClientRect();
        const relativeTop = rect.top - containerRect.top;

        if (relativeTop <= 100 && relativeTop >= -100) {
          currentHeading = heading.textContent?.trim() || '';
        }
      });

      setActiveHeading(currentHeading);
    };

    const editorElement = document.querySelector('.notion-editor-content .ProseMirror');
    if (editorElement) {
      editorElement.addEventListener('scroll', handleScroll);
      // 初始检查
      handleScroll();

      return () => {
        editorElement.removeEventListener('scroll', handleScroll);
      };
    }
  }, [isEditing, editingContent]);

  // 监听Shift+Cmd+S快捷键
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'S') {
        event.preventDefault();
        manualSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [manualSave]);

  // 当选择文章时，直接进入编辑模式并加载内容
  const handleArticleSelect = (article: Article) => {
    setSelectedArticle(article);
    setIsEditing(true);
    setEditingTitle(article.title);
    setEditingContent(article.content);
  };

  // 切换到编辑模式
  const handleStartEditing = () => {
    setIsEditing(true);
    if (!selectedArticle) {
      // 创建新文章
      setEditingTitle("");
      setEditingContent("");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* 主内容区 - 三栏布局 */}
      <main className="flex h-[calc(100vh-80px)]">
        {/* 左侧栏 - 文章列表 */}
        <aside className="w-80 bg-card border-r border-border flex-shrink-0">
          <ArticleCompactList
            onArticleSelect={handleArticleSelect}
            selectedArticleId={selectedArticle?.id}
          />
        </aside>

        {/* 中间区域 - 编辑器 */}
        <section className="flex-1 bg-background">
          {isEditing && (editingTitle || editingContent || selectedArticle) ? (
            <div className="h-full flex flex-col">
              {/* 编辑器标题栏 */}
              <div className="border-b border-border p-4 bg-card/50">
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  placeholder="文章标题..."
                  className="w-full text-2xl font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
                />
                <div className="flex items-center mt-2">
                  <div className="text-sm text-muted-foreground">
                    {lastSaved && `上次保存: ${lastSaved.toLocaleTimeString()}`}
                  </div>
                </div>
              </div>

              {/* Notion风格编辑器 */}
              <div className="flex-1 overflow-auto">
                <div className="container mx-auto py-8 max-w-4xl px-8">
                  {/* Notion 编辑器 */}
                  <div className="mb-8">
                    <NotionEditor
                      initialContent={editingContent}
                      onChange={setEditingContent}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-medium mb-2">开始写作</h3>
                <p className="text-sm">选择左侧文章开始编辑，或点击新建创作新文章</p>
              </div>
            </div>
          )}
        </section>

        {/* 右侧栏 - 信息面板 */}
        <aside className="w-72 bg-muted/30 border-l border-border flex-shrink-0 hidden lg:block">
          <div className="h-full flex flex-col">
            {/* 切换标签 */}
            <div className="border-b border-border bg-card">
              <div className="flex">
                <button
                  className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 ${
                    rightPanelMode === 'toc'
                      ? 'border-primary text-primary bg-primary/10 font-semibold'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30 hover:border-muted-foreground/30'
                  }`}
                  onClick={() => setRightPanelMode('toc')}
                >
                  <div className="flex items-center gap-2">
                    <List className="w-4 h-4" />
                    <span>目录</span>
                  </div>
                </button>
                <button
                  className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 ${
                    rightPanelMode === 'info'
                      ? 'border-primary text-primary bg-primary/10 font-semibold'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30 hover:border-muted-foreground/30'
                  }`}
                  onClick={() => setRightPanelMode('info')}
                >
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    <span>文章信息</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 内容区 */}
            <div className="flex-1 p-4 overflow-y-auto smooth-scroll">
              {rightPanelMode === 'toc' ? (
                /* 目录 */
                <div>
                  {(() => {
                    const content = isEditing ? editingContent : (selectedArticle?.content || '');

                    // 解析HTML内容中的标题
                    const extractHeadings = (htmlContent: string) => {
                      const headingMatches = htmlContent.match(/<h[1-4][^>]*>(.*?)<\/h[1-4]>/gi) || [];
                      return headingMatches.map(match => {
                        const levelMatch = match.match(/<h([1-4])/i);
                        const level = levelMatch ? parseInt(levelMatch[1]) : 1;
                        const textMatch = match.match(/<h[1-4][^>]*>(.*?)<\/h[1-4]>/i);
                        const text = textMatch ? textMatch[1].replace(/<[^>]*>/g, '').trim() : '';
                        return { level, text };
                      });
                    };

                    const headingObjects = extractHeadings(content);

                    if (headingObjects.length === 0) {
                      return (
                        <div className="text-center py-12">
                          <div className="mb-4 flex justify-center">
                            <List className="w-12 h-12 text-muted-foreground/40" />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {isEditing ? '添加标题后这里会显示目录' : '暂无标题结构'}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-1">
                        {headingObjects.map((heading, index) => {
                          const { level, text } = heading;
                          const headingId = `heading-${index}-${text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '-')}`;

                          const scrollToHeading = () => {
                            // 通过文本内容匹配查找编辑器中的标题
                            const editorElement = document.querySelector('.notion-editor-content .ProseMirror');
                            if (editorElement) {
                              const allHeadings = editorElement.querySelectorAll('h1, h2, h3, h4');
                              const targetHeading = Array.from(allHeadings).find(el =>
                                el.textContent?.trim() === text
                              );
                              if (targetHeading) {
                                targetHeading.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'center'
                                });
                                // 临时高亮效果
                                targetHeading.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                                setTimeout(() => {
                                  targetHeading.style.backgroundColor = '';
                                }, 2000);
                              }
                            }
                          };

                          const isActive = activeHeading === text;

                          return (
                            <div
                              key={index}
                              className={`text-sm cursor-pointer transition-all duration-200 rounded px-3 py-2 -mx-1 ${
                                isActive
                                  ? 'bg-primary/10 text-primary border-l-2 border-primary font-medium'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30 active:bg-muted/50'
                              }`}
                              style={{ paddingLeft: `${(level - 1) * 12 + 12}px` }}
                              onClick={scrollToHeading}
                              title={`跳转到: ${text}`}
                            >
                              {text}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              ) : selectedArticle ? (
                /* 文章信息 */
                <div className="space-y-4 sidebar-content">
                  {/* 基本信息 */}
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">基本信息</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">状态</span>
                        <span className={`px-2 py-1 text-xs rounded ${
                          selectedArticle.publishStatus === 'published'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        }`}>
                          {selectedArticle.publishStatus === 'published' ? '已发布' : '草稿'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">字数</span>
                        <span className="text-foreground">{selectedArticle.content.replace(/[#*`_\[\]()!-]/g, '').replace(/\s+/g, '').length} 字</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">创建</span>
                        <span className="text-foreground">{new Date(selectedArticle.createdAt).toLocaleDateString('zh-CN')}</span>
                      </div>
                      {selectedArticle.updatedAt !== selectedArticle.createdAt && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">更新</span>
                          <span className="text-foreground">{new Date(selectedArticle.updatedAt).toLocaleDateString('zh-CN')}</span>
                        </div>
                      )}
                      {selectedArticle.agent && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Agent</span>
                          <span className="text-foreground">{selectedArticle.agent.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 摘要 */}
                  {selectedArticle.summary && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">摘要</h4>
                      <p className="text-sm text-foreground/80 leading-relaxed bg-muted/20 rounded p-3">{selectedArticle.summary}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="mb-4 flex justify-center">
                    {rightPanelMode === 'toc' ? (
                      <List className="w-12 h-12 text-muted-foreground/40" />
                    ) : (
                      <Info className="w-12 h-12 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {rightPanelMode === 'toc' ? '开始写作后这里会显示目录' : '选中文章后显示详细信息'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </main>

      {/* 保存成功Toast提示 */}
      {showSaveToast && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in duration-200">
          <div className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-sm font-medium">保存成功</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
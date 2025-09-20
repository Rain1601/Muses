"use client";

import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUserStore } from "@/store/user";
import { auth } from "@/lib/auth";
import Navigation from "@/components/Navigation";
import { ArticleCompactList } from "@/components/ArticleCompactList";
import { ArticleDetailView } from "@/components/ArticleDetailView";
import { NotionEditor } from '@/components/NotionEditor';
import { SyncPanel } from '@/components/SyncPanel';
import { FileImport } from '@/components/FileImport';
import '@/app/editor-demo/mermaid-styles.css';
import { api } from "@/lib/api";
import { List, Info, GitBranch, ChevronLeft, ChevronRight, Send, Save, Eye, Clock, PenTool } from "lucide-react";
import { useToast } from "@/components/Toast";
import { usePublishNotification } from "@/components/PublishNotification";
import { prepareFilesForGitHub } from "@/lib/publish-utils";

interface Article {
  id: string;
  title: string;
  content: string;
  summary?: string;
  publishStatus: string;
  createdAt: string;
  updatedAt: string;
  agentId?: string;
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
  const [rightPanelMode, setRightPanelMode] = useState<'toc' | 'info' | 'sync'>('toc');
  const [activeHeading, setActiveHeading] = useState<string>('');
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [defaultAgent, setDefaultAgent] = useState<any>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // 添加刷新key，用于强制刷新文章列表
  const [recentArticles, setRecentArticles] = useState<Article[]>([]); // 存储最近的文章列表
  const titleInputRef = useRef<HTMLInputElement>(null); // 标题输入框引用
  const { showToast, ToastContainer } = useToast();
  const { showNotifications, NotificationContainer } = usePublishNotification();

  // 获取默认agent和最近文章
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // 获取默认agent
        const agentResponse = await api.get('/api/agents');
        const agents = agentResponse.data.agents || [];
        const defaultAgentFound = agents.find((a: any) => a.isDefault) || agents[0];
        setDefaultAgent(defaultAgentFound);

        // 获取最近的文章列表
        const articlesResponse = await api.get('/api/articles', {
          params: { page: 1, page_size: 10, sort_by: 'updatedAt', sort_order: 'desc' }
        });
        setRecentArticles(articlesResponse.data.articles || []);
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      }
    };
    fetchInitialData();
  }, [refreshKey]); // 当refreshKey变化时重新获取

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
        if (!defaultAgent?.id) {
          console.error('没有找到默认agent');
          showToast('请先创建一个Agent', 'warning');
          return;
        }
        const response = await api.post('/api/articles', {
          title: editingTitle || '无标题',
          content: editingContent,
          publishStatus: 'draft',
          agentId: defaultAgent.id
        });
        setSelectedArticle(response.data.article || response.data);
      }
      setLastSaved(new Date());
    } catch (error) {
      console.error('自动保存失败:', error);
    }
  }, [editingTitle, editingContent, selectedArticle, defaultAgent, showToast]);

  // 手动保存功能（Cmd+S）
  const manualSave = useCallback(async () => {
    if (!editingContent.trim() && !editingTitle.trim()) return;

    setIsSaving(true);
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
        if (!defaultAgent?.id) {
          console.error('没有找到默认agent');
          showToast('请先创建一个Agent', 'warning');
          return;
        }
        const response = await api.post('/api/articles', {
          title: editingTitle || '无标题',
          content: editingContent,
          publishStatus: 'draft',
          agentId: defaultAgent.id
        });
        setSelectedArticle(response.data.article || response.data);
      }
      setLastSaved(new Date());

      // 显示保存成功提示
      setShowSaveToast(true);
      setTimeout(() => {
        setShowSaveToast(false);
      }, 1000);
    } catch (error) {
      console.error('手动保存失败:', error);
    } finally {
      setIsSaving(false);
    }
  }, [editingTitle, editingContent, selectedArticle, defaultAgent, showToast]);

  // 处理文件导入完成
  const handleImportComplete = (result: any) => {
    console.log('Import completed:', result);
    setShowImportDialog(false);

    showToast({
      title: '导入成功',
      description: `成功导入 ${result.imported_count} 篇文章`,
      type: 'success'
    });

    // 刷新文章列表（通过重新挂载 ArticleCompactList 组件）
    window.location.reload();
  };

  // 发布文章功能
  const handlePublish = useCallback(async () => {
    if (!editingContent.trim() && !editingTitle.trim()) {
      showToast('请先添加内容再发布', 'warning');
      return;
    }

    setIsPublishing(true);
    try {
      // 先保存文章
      let articleToPublish;

      if (selectedArticle?.id) {
        // 更新现有文章并设为已发布
        const response = await api.put(`/api/articles/${selectedArticle.id}`, {
          title: editingTitle || '无标题',
          content: editingContent,
          publishStatus: 'published'
        });
        articleToPublish = response.data.article || response.data;
        setSelectedArticle(articleToPublish);
        // 更新成功后立即刷新列表
        setRefreshKey(prev => prev + 1);
      } else {
        // 创建新文章并直接发布
        if (!selectedArticle?.agentId && !defaultAgent?.id) {
          console.error('没有找到默认agent');
          showToast('请先创建一个Agent', 'warning');
          return;
        }
        const response = await api.post('/api/articles', {
          title: editingTitle || '无标题',
          content: editingContent,
          publishStatus: 'published',
          agentId: selectedArticle?.agentId || defaultAgent.id
        });
        articleToPublish = response.data.article || response.data;
        setSelectedArticle(articleToPublish);
        // 创建新文章后也刷新列表
        setRefreshKey(prev => prev + 1);
      }

      // 确保我们有文章ID
      if (!articleToPublish?.id) {
        showToast('文章保存成功，但无法获取文章ID', 'warning');
        return;
      }

      // 发布到 GitHub
      let githubPublishSuccess = false;
      // 使用新的发布通知系统
      const notifications = [
        { message: '正在保存文章...', type: 'info' as const },
        { message: '正在发布到 GitHub...', type: 'info' as const }
      ];
      showNotifications(notifications);

      try {
        // 生成文件路径：使用年/月/文章文件夹/index.md结构
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        // 生成文件夹名：日期-标题
        const titleSlug = (editingTitle || '无标题')
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
          .replace(/^-|-$/g, '');
        const folderName = `${year}-${month}-${day}-${titleSlug}`;

        // 文件路径：posts/年/月/文章文件夹/index.md
        const articleFolder = `posts/${year}/${month}/${folderName}`;
        const filePath = `${articleFolder}/index.md`;

        // 生成带有Frontmatter的内容
        const frontmatter = `---
title: "${editingTitle || '无标题'}"
date: "${year}-${month}-${day}"
tags: []
categories: []
author: "Muses"
summary: ""
---

`;

        // 由于图片现在自动上传到GitHub并获得稳定链接，不需要处理图片文件
        // 直接使用编辑内容，图片链接已经是GitHub的raw链接
        const fullContent = frontmatter + editingContent;

        console.log('Publishing article to:', filePath);

        // 只需要上传主文章文件
        await api.post('/api/publish/github/batch', {
          articleId: articleToPublish.id,
          repoUrl: 'https://github.com/Rain1601/rain.blog.repo',
          commitMessage: `发布文章: ${editingTitle || '无标题'}`,
          files: [{
            path: filePath,
            content: fullContent,
            encoding: "utf-8"
          }]
        });

        githubPublishSuccess = true;
        // 更新通知序列以显示成功状态
        const successNotifications = [
          { message: '文章保存成功', type: 'success' as const },
          { message: '发布成功！', type: 'success' as const, isRepositoryLink: true, repositoryUrl: 'https://github.com/Rain1601/rain.blog.repo' }
        ];
        showNotifications(successNotifications);
      } catch (githubError: any) {
        console.error('GitHub 发布失败:', githubError);
        let errorMsg = 'GitHub 发布失败';

        // Handle different error formats
        if (githubError.response?.data?.detail) {
          // If detail is an object, extract the message
          if (typeof githubError.response.data.detail === 'object') {
            errorMsg = githubError.response.data.detail.msg ||
                      githubError.response.data.detail.message ||
                      'GitHub 发布失败，请检查配置';
          } else {
            errorMsg = String(githubError.response.data.detail);
          }
        } else if (githubError.message) {
          errorMsg = githubError.message;
        }

        // Ensure errorMsg is always a string
        errorMsg = String(errorMsg);

        // GitHub 发布失败不影响文章状态，仅提示
        // GitHub 发布失败的通知序列
        const failureNotifications = [
          { message: '文章已保存', type: 'success' as const },
          { message: `GitHub 发布失败: ${errorMsg}`, type: 'error' as const }
        ];
        showNotifications(failureNotifications);
      }

      setLastSaved(new Date());

      // 发布成功后保持在当前文章
      if (githubPublishSuccess) {
        // 可以添加一些视觉反馈，比如显示发布成功的标记
        console.log('文章已成功发布到 GitHub');
        // 文章列表已经在上面setSelectedArticle时刷新了，这里不需要再次刷新
      }
    } catch (error: any) {
      console.error('发布失败:', error);
      let errorMessage = '发布失败，请重试';

      // Handle different error formats
      if (error.response?.data?.detail) {
        // If detail is an object, extract the message string
        if (typeof error.response.data.detail === 'object') {
          errorMessage = error.response.data.detail.msg ||
                        error.response.data.detail.message ||
                        '发布失败，请查看控制台了解详情';
        } else {
          errorMessage = String(error.response.data.detail);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      // 发布失败通知
      const errorNotifications = [
        { message: errorMessage, type: 'error' as const }
      ];
      showNotifications(errorNotifications);
    } finally {
      setIsPublishing(false);
    }
  }, [editingTitle, editingContent, selectedArticle, showToast]);

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
    // 更新页面标题
    document.title = article.title || '无标题 - Muses';
  };

  // 自动聚焦标题输入框
  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      // 使用setTimeout确保DOM更新完成
      setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
          // 如果是"无标题"，选中全部文本
          if (editingTitle === '无标题') {
            titleInputRef.current.select();
          }
        }
      }, 100);
    }
  }, [isEditing, selectedArticle]);

  // 页面标题管理
  useEffect(() => {
    if (!isEditing || !selectedArticle) {
      document.title = 'Dashboard - Muses';
    } else {
      document.title = editingTitle || '无标题 - Muses';
    }
  }, [isEditing, selectedArticle, editingTitle]);

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
      <ToastContainer />
      <NotificationContainer />

      {/* 主内容区 - 三栏布局 */}
      <main className="flex h-[calc(100vh-80px)]">
        {/* 左侧栏 - 文章列表 */}
        <aside className={`bg-card border-r border-border flex-shrink-0 transition-all duration-300 ${
          leftPanelCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-80 opacity-100'
        }`}>
          <ArticleCompactList
            key={refreshKey}
            onArticleSelect={handleArticleSelect}
            selectedArticleId={selectedArticle?.id}
            onImportClick={() => setShowImportDialog(true)}
          />
        </aside>

        {/* 中间区域 - 编辑器 */}
        <section className="flex-1 bg-background relative">
          {/* 左侧栏收缩展开按钮 */}
          <button
            onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
            className="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2 z-10 w-6 h-12 bg-card border border-border rounded-r-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center text-muted-foreground hover:text-foreground"
            title={leftPanelCollapsed ? "展开文章列表" : "收缩文章列表"}
          >
            {leftPanelCollapsed ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronLeft className="w-3 h-3" />
            )}
          </button>

          {/* 右侧栏收缩展开按钮 */}
          <button
            onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
            className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-1/2 z-10 w-6 h-12 bg-card border border-border rounded-l-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center text-muted-foreground hover:text-foreground"
            title={rightPanelCollapsed ? "展开侧栏" : "收缩侧栏"}
          >
            {rightPanelCollapsed ? (
              <ChevronLeft className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>

          {isEditing && (editingTitle || editingContent || selectedArticle) ? (
            <div className="h-full flex flex-col">
              {/* 编辑器标题栏 */}
              <div className="border-b border-border p-4 bg-card/50">
                <div className="flex items-start justify-between">
                  <div className="flex-1 mr-4">
                    <input
                      ref={titleInputRef}
                      type="text"
                      value={editingTitle}
                      onChange={(e) => {
                        setEditingTitle(e.target.value);
                        // 动态更新页面标题
                        document.title = e.target.value || '无标题 - Muses';
                      }}
                      onBlur={async () => {
                        // 标题失去焦点时，如果标题有变化，保存并刷新列表
                        if (selectedArticle && editingTitle !== selectedArticle.title) {
                          try {
                            await api.put(`/api/articles/${selectedArticle.id}`, {
                              title: editingTitle || '无标题',
                              content: editingContent,
                              publishStatus: selectedArticle.publishStatus
                            });

                            // 更新当前选中的文章对象
                            setSelectedArticle({
                              ...selectedArticle,
                              title: editingTitle || '无标题'
                            });

                            // 刷新文章列表以显示新标题
                            setRefreshKey(prev => prev + 1);
                            setLastSaved(new Date());
                          } catch (error) {
                            console.error('更新标题失败:', error);
                          }
                        }
                      }}
                      placeholder="文章标题..."
                      className="w-full text-2xl font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
                    />
                    <div className="flex items-center mt-2">
                      <div className="text-sm text-muted-foreground">
                        {lastSaved && `上次保存: ${lastSaved.toLocaleTimeString()}`}
                      </div>
                    </div>
                  </div>

                  {/* 操作按钮组 */}
                  <div className="flex items-center gap-2 mt-1">
                    {/* 手动保存按钮 */}
                    <button
                      onClick={manualSave}
                      disabled={isSaving || (!editingTitle.trim() && !editingContent.trim())}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground bg-muted/20 hover:bg-muted/40 border-0 rounded-md hover:shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="手动保存 (Shift+Cmd+S)"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSaving ? '保存中...' : '保存'}</span>
                    </button>

                    {/* 发布按钮 */}
                    <button
                      onClick={handlePublish}
                      disabled={isPublishing || (!editingTitle.trim() && !editingContent.trim())}
                      className="flex items-center gap-1 px-4 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      title="发布文章"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isPublishing ? '发布中...' : '发布'}</span>
                    </button>
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
              <div className="text-center">
                <div className="text-6xl mb-6">📝</div>
                <h3 className="text-2xl font-semibold mb-3 text-foreground">开始写作</h3>
                <p className="text-sm text-muted-foreground mb-8">选择一篇文章继续编辑，或创建新的文章</p>

                <div className="flex gap-4 justify-center">
                  {/* 返回最近文章按钮 */}
                  {recentArticles.length > 0 && (
                    <button
                      onClick={() => {
                        const mostRecent = recentArticles[0];
                        handleArticleSelect(mostRecent);
                      }}
                      className="group flex items-center gap-3 px-6 py-3 bg-card border border-border rounded-lg hover:border-primary/50 hover:shadow-md transition-all duration-200"
                    >
                      <Clock className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      <div className="text-left">
                        <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          继续最近的文章
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">
                          {recentArticles[0].title || '无标题'}
                        </div>
                      </div>
                    </button>
                  )}

                  {/* 新建文章按钮 */}
                  <button
                    onClick={async () => {
                      try {
                        if (!defaultAgent?.id) {
                          showToast('请先创建一个Agent', 'warning');
                          return;
                        }
                        // 创建新的草稿文章
                        const response = await api.post('/api/articles', {
                          title: '无标题',
                          content: '',
                          publishStatus: 'draft',
                          agentId: defaultAgent.id
                        });
                        const newArticle = response.data.article || response.data;

                        // 选中新创建的文章并进入编辑模式
                        setSelectedArticle(newArticle);
                        setEditingTitle(newArticle.title);
                        setEditingContent(newArticle.content);
                        setIsEditing(true);

                        // 刷新文章列表
                        setRefreshKey(prev => prev + 1);

                        showToast('新文章已创建', 'success');
                      } catch (error) {
                        console.error('创建文章失败:', error);
                        showToast('创建文章失败', 'error');
                      }
                    }}
                    className="group flex items-center gap-3 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-md transition-all duration-200"
                  >
                    <PenTool className="w-5 h-5" />
                    <div className="text-left">
                      <div className="text-sm font-medium">
                        创建新文章
                      </div>
                      <div className="text-xs opacity-90 mt-0.5">
                        开始撰写新的内容
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 右侧栏 - 信息面板 */}
        <aside className={`bg-muted/30 border-l border-border flex-shrink-0 hidden lg:block transition-all duration-300 ${
          rightPanelCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-72 opacity-100'
        }`}>
          <div className="h-full flex flex-col">
            {/* 切换标签 */}
            <div className="border-b border-border bg-card">
              <div className="flex">
                <button
                  className={`flex-1 px-3 py-3 text-sm font-medium border-b-2 transition-all duration-200 ${
                    rightPanelMode === 'toc'
                      ? 'border-primary text-primary bg-primary/10 font-semibold'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30 hover:border-muted-foreground/30'
                  }`}
                  onClick={() => setRightPanelMode('toc')}
                >
                  <div className="flex items-center gap-1.5">
                    <List className="w-3.5 h-3.5" />
                    <span>目录</span>
                  </div>
                </button>
                <button
                  className={`flex-1 px-3 py-3 text-sm font-medium border-b-2 transition-all duration-200 ${
                    rightPanelMode === 'info'
                      ? 'border-primary text-primary bg-primary/10 font-semibold'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30 hover:border-muted-foreground/30'
                  }`}
                  onClick={() => setRightPanelMode('info')}
                >
                  <div className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    <span>信息</span>
                  </div>
                </button>
                <button
                  className={`flex-1 px-3 py-3 text-sm font-medium border-b-2 transition-all duration-200 ${
                    rightPanelMode === 'sync'
                      ? 'border-primary text-primary bg-primary/10 font-semibold'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30 hover:border-muted-foreground/30'
                  }`}
                  onClick={() => setRightPanelMode('sync')}
                  disabled={!selectedArticle}
                >
                  <div className="flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>同步</span>
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
              ) : rightPanelMode === 'sync' ? (
                /* 同步面板 */
                selectedArticle ? (
                  <SyncPanel
                    articleId={selectedArticle.id}
                    onSyncComplete={() => {
                      console.log('同步完成');
                    }}
                  />
                ) : (
                  <div className="text-center py-12">
                    <GitBranch className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
                    <div className="text-sm text-muted-foreground">选中文章后可以进行同步操作</div>
                  </div>
                )
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
                    {rightPanelMode === 'toc' ? '开始写作后这里会显示目录' :
                     rightPanelMode === 'sync' ? '选中文章后可以进行同步操作' :
                     '选中文章后显示详细信息'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </main>

      {/* 文件导入对话框 */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <FileImport
            onImportComplete={handleImportComplete}
            onClose={() => setShowImportDialog(false)}
          />
        </div>
      )}

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
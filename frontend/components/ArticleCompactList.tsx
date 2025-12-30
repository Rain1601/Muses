"use client";

import { useState, useEffect, useRef, useLayoutEffect, memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { ArticleListItem } from "./ArticleListItem";
import { api } from "@/lib/api";
import { Plus, Search, Upload } from "lucide-react";
import { useToast } from "./Toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

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

interface ArticleCompactListProps {
  articles?: Article[]; // 外部传入的文章列表
  onArticleSelect?: (article: Article) => void;
  selectedArticleId?: string;
  onImportClick?: () => void;
  onArticlesChange?: (articles: Article[]) => void; // 文章列表改变时的回调
  refreshTrigger?: number; // 用于触发列表刷新的标志
}

function ArticleCompactListComponent({
  articles: externalArticles,
  onArticleSelect,
  selectedArticleId,
  onImportClick,
  onArticlesChange,
  refreshTrigger
}: ArticleCompactListProps) {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<Article | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [translateDialogOpen, setTranslateDialogOpen] = useState(false);
  const [articleToTranslate, setArticleToTranslate] = useState<Article | null>(null);
  const [translating, setTranslating] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<string>('zh-CN');
  const [unpublishDialogOpen, setUnpublishDialogOpen] = useState(false);
  const [articleToUnpublish, setArticleToUnpublish] = useState<Article | null>(null);
  const [unpublishing, setUnpublishing] = useState(false);
  const { showToast } = useToast();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);

  // 保存滚动位置的辅助函数
  const saveScrollPosition = () => {
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
    }
  };

  // 辅助函数：更新文章列表
  const updateArticles = useCallback((newArticles: Article[]) => {
    setArticles(newArticles);
    onArticlesChange?.(newArticles);
  }, [onArticlesChange]);

  // 同步外部文章列表
  useEffect(() => {
    if (externalArticles) {
      setArticles(externalArticles);
    } else {
      fetchArticles();
    }
  }, [externalArticles]);

  useEffect(() => {
    if (!externalArticles) {
      fetchArticles();
    }
  }, []);

  // 监听滚动容器的滚动事件，持续保存滚动位置
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      scrollPositionRef.current = container.scrollTop;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // 当 refreshTrigger 改变时重新获取文章列表
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      saveScrollPosition();
      fetchArticles();
    }
  }, [refreshTrigger]);

  // 使用 useLayoutEffect 恢复滚动位置
  // 除了初始加载，其他时候都恢复保存的滚动位置
  useLayoutEffect(() => {
    if (isInitialLoadRef.current) {
      // 初始加载，不恢复滚动位置
      isInitialLoadRef.current = false;
      return;
    }

    if (scrollContainerRef.current && scrollPositionRef.current > 0) {
      scrollContainerRef.current.scrollTop = scrollPositionRef.current;
    }
  }, [filteredArticles]);

  useEffect(() => {
    console.log('📝 Filter effect running - articles count:', articles.length, 'searchTerm:', searchTerm);
    if (searchTerm.trim()) {
      const filtered = articles.filter(article =>
        article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredArticles(filtered);
    } else {
      setFilteredArticles(articles);
    }
  }, [articles, searchTerm]);

  const fetchArticles = async () => {
    try {
      const response = await api.get("/api/articles", {
        params: { page: 1, limit: 50 }
      });
      updateArticles(response.data.articles || []);
    } catch (error) {
      console.error("Failed to fetch articles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (article: Article) => {
    setArticleToDelete(article);
    setDeleteError(null);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!articleToDelete) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await api.delete(`/api/articles/${articleToDelete.id}`);
      // 保存滚动位置
      saveScrollPosition();
      updateArticles(articles.filter(a => a.id !== articleToDelete.id));
      setDeleteDialogOpen(false);
      setArticleToDelete(null);
    } catch (error: any) {
      console.error("Failed to delete article:", error);
      setDeleteError(error.response?.data?.detail || "删除失败，请重试");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setArticleToDelete(null);
    setDeleteError(null);
  };

  const handleTranslateClick = (article: Article) => {
    setArticleToTranslate(article);
    setTranslateDialogOpen(true);
  };

  const handleTranslateConfirm = async () => {
    console.log('🚀 handleTranslateConfirm called - NEW VERSION');
    if (!articleToTranslate) return;

    setTranslating(true);

    try {
      // 启动翻译任务
      console.log('📡 Sending translate request...');
      const response = await api.post(`/api/articles/${articleToTranslate.id}/translate`, {
        targetLanguage
      });

      const taskId = response.data.taskId;
      console.log('✅ Translation task started:', taskId);

      // 将任务保存到 localStorage，方便任务中心显示
      const taskData = {
        taskId,
        status: 'pending',
        progress: 0,
        total: 0,
        task_type: 'translate_article',
        article_id: articleToTranslate.id,
        target_language: targetLanguage,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const storedTasks = localStorage.getItem('muses_tasks');
      const tasks = storedTasks ? JSON.parse(storedTasks) : [];
      tasks.unshift(taskData); // 添加到列表开头
      localStorage.setItem('muses_tasks', JSON.stringify(tasks));

      // 触发自定义事件通知任务中心更新
      window.dispatchEvent(new Event('muses-task-update'));
      console.log('✅ Task saved to localStorage:', taskData);

      // 立即关闭对话框并显示提示
      console.log('🔴 Closing dialog NOW...');
      setTranslating(false);
      setTranslateDialogOpen(false);
      setArticleToTranslate(null);
      console.log('🎉 Dialog should be closed, showing toast...');
      showToast('翻译任务已启动，请在任务中心查看进度', 'success');

      // 在后台轮询任务进度（不阻塞用户）
      const pollInterval = setInterval(async () => {
        try {
          const taskResponse = await api.get(`/api/articles/tasks/${taskId}`);
          const task = taskResponse.data;

          console.log('Task status:', task.status, 'Progress:', task.progress, '/', task.total);

          // 更新 localStorage 中的任务状态
          const storedTasks = localStorage.getItem('muses_tasks');
          if (storedTasks) {
            const tasks = JSON.parse(storedTasks);
            const updatedTasks = tasks.map((t: any) =>
              t.taskId === taskId
                ? { ...t, ...task, updatedAt: new Date().toISOString() }
                : t
            );
            localStorage.setItem('muses_tasks', JSON.stringify(updatedTasks));

            // 触发自定义事件通知任务中心更新
            window.dispatchEvent(new Event('muses-task-update'));
          }

          if (task.status === 'completed') {
            clearInterval(pollInterval);

            // 任务完成，获取新文章ID
            const articleId = task.result?.article_id;
            if (articleId) {
              // 获取新文章详情
              const articleResponse = await api.get(`/api/articles/${articleId}`);
              const translatedArticle = articleResponse.data.article;

              // 保存滚动位置
              saveScrollPosition();

              // 添加到文章列表
              updateArticles([translatedArticle, ...articles]);

              // 显示成功通知
              showToast('翻译完成！已创建新文章', 'success');
            }
          } else if (task.status === 'failed') {
            clearInterval(pollInterval);
            showToast(task.error || '翻译失败，请重试', 'error');
          }
          // 如果状态是 pending 或 running，继续轮询
        } catch (pollError: any) {
          console.error('Failed to poll task status:', pollError);
          clearInterval(pollInterval);
          showToast('无法获取翻译进度', 'error');
        }
      }, 2000); // 每2秒轮询一次

      // 设置超时保护（5分钟）
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 300000);

    } catch (error: any) {
      console.error('Failed to start translation:', error);
      showToast(error.response?.data?.detail || '启动翻译失败，请重试', 'error');
      setTranslating(false);
    }
  };

  const handleTranslateCancel = () => {
    setTranslateDialogOpen(false);
    setArticleToTranslate(null);
  };

  const handleUnpublishClick = (article: Article) => {
    setArticleToUnpublish(article);
    setUnpublishDialogOpen(true);
  };

  const handleUnpublishConfirm = async () => {
    if (!articleToUnpublish) return;

    setUnpublishing(true);

    try {
      await api.delete(`/api/publish/github/${articleToUnpublish.id}`);

      showToast('文章已从GitHub下架', 'success');

      // 保存滚动位置
      saveScrollPosition();

      // 刷新文章列表
      fetchArticles();

      // 关闭对话框
      setUnpublishDialogOpen(false);
      setArticleToUnpublish(null);
    } catch (error: any) {
      console.error('Failed to unpublish article:', error);
      const errorMessage = error.response?.data?.detail || '下架失败，请重试';
      showToast(errorMessage, 'error');
    } finally {
      setUnpublishing(false);
    }
  };

  const handleUnpublishCancel = () => {
    setUnpublishDialogOpen(false);
    setArticleToUnpublish(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部操作区 */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">文章管理</h2>
          <div className="flex items-center gap-2">
            {onImportClick && (
              <Button
                size="sm"
                variant="outline"
                onClick={onImportClick}
                className="flex items-center gap-1"
              >
                <Upload className="w-4 h-4" />
                导入
              </Button>
            )}
            <Button
              size="sm"
              onClick={async () => {
                try {
                  // 获取默认agent
                  const agentResponse = await api.get('/api/agents');
                  const agents = agentResponse.data.agents || [];
                  const defaultAgent = agents.find((a: any) => a.isDefault) || agents[0];

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

                  // 添加到文章列表并选中
                  updateArticles([newArticle, ...articles]);
                  onArticleSelect?.(newArticle);

                  showToast('新文章已创建', 'success');
                } catch (error) {
                  console.error('创建文章失败:', error);
                  showToast('创建文章失败', 'error');
                }
              }}
              className="flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              新建
            </Button>
          </div>
        </div>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索文章..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="text-xs text-muted-foreground">
          共 {filteredArticles.length} 篇文章
        </div>
      </div>

      {/* 文章列表 */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {filteredArticles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-sm text-muted-foreground text-center">
              {searchTerm ? "未找到匹配的文章" : "还没有文章，点击新建开始创作吧"}
            </p>
          </div>
        ) : (
          <div>
            {filteredArticles.map((article) => (
              <ArticleListItem
                key={article.id}
                article={article}
                isSelected={selectedArticleId === article.id}
                onClick={() => onArticleSelect?.(article)}
                onDelete={() => handleDeleteClick(article)}
                onTranslate={() => handleTranslateClick(article)}
                onUnpublish={() => handleUnpublishClick(article)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={handleDeleteCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除文章</DialogTitle>
            <DialogDescription>
              确定要删除文章 <strong>"{articleToDelete?.title}"</strong> 吗？
              {articleToDelete && (
                <div className="mt-2 text-sm text-muted-foreground">
                  如果文章已同步到 GitHub，将同时从 GitHub 仓库中删除。此操作不可撤销。
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{deleteError}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleDeleteCancel}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 翻译确认对话框 */}
      <Dialog open={translateDialogOpen} onOpenChange={handleTranslateCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>翻译文章</DialogTitle>
            <DialogDescription>
              将文章 <strong>"{articleToTranslate?.title}"</strong> 翻译为双语对照版本
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">目标语言</label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background"
                disabled={translating}
              >
                <option value="zh-CN">简体中文</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
                <option value="ko">한국어</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="es">Español</option>
              </select>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                💡 翻译后将生成新文章，格式为：原文段落 + 翻译段落，保留所有图片
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
                ⏱️ 翻译过程可能需要1-3分钟，请耐心等待...
              </p>
            </div>
          </div>

          {translating && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 animate-pulse" style={{ width: '100%' }} />
                </div>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                正在翻译段落，请稍候...
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleTranslateCancel}
              disabled={translating}
            >
              取消
            </Button>
            <Button
              onClick={handleTranslateConfirm}
              disabled={translating}
            >
              {translating ? "翻译中..." : "开始翻译"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 下架确认对话框 */}
      <Dialog open={unpublishDialogOpen} onOpenChange={handleUnpublishCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认下架文章</DialogTitle>
            <DialogDescription>
              确定要从 GitHub 下架文章 <strong>"{articleToUnpublish?.title}"</strong> 吗？
            </DialogDescription>
          </DialogHeader>

          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md p-3">
            <p className="text-sm text-orange-800 dark:text-orange-300">
              ⚠️ 此操作将：
            </p>
            <ul className="text-sm text-orange-700 dark:text-orange-400 mt-2 space-y-1 ml-4 list-disc">
              <li>从 GitHub 仓库中删除文章文件（包括图片）</li>
              <li>将文章状态改为"草稿"</li>
              <li>保留本地文章，可以重新发布</li>
            </ul>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleUnpublishCancel}
              disabled={unpublishing}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnpublishConfirm}
              disabled={unpublishing}
            >
              {unpublishing ? "下架中..." : "确认下架"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 使用 memo 优化，只在 props 真正改变时才重新渲染
export const ArticleCompactList = memo(ArticleCompactListComponent, (prevProps, nextProps) => {
  // 返回 true 表示 props 相同（不重新渲染），返回 false 表示 props 不同（需要重新渲染）
  const shouldSkipRender = (
    prevProps.selectedArticleId === nextProps.selectedArticleId &&
    prevProps.refreshTrigger === nextProps.refreshTrigger &&
    prevProps.articles === nextProps.articles // 使用引用相等性检查
  );

  if (!shouldSkipRender) {
    console.log('🔄 ArticleCompactList will re-render because:', {
      selectedArticleIdChanged: prevProps.selectedArticleId !== nextProps.selectedArticleId,
      refreshTriggerChanged: prevProps.refreshTrigger !== nextProps.refreshTrigger,
      articlesChanged: prevProps.articles !== nextProps.articles,
      prevSelectedId: prevProps.selectedArticleId,
      nextSelectedId: nextProps.selectedArticleId,
      prevRefreshTrigger: prevProps.refreshTrigger,
      nextRefreshTrigger: nextProps.refreshTrigger
    });
  }

  return shouldSkipRender;
});
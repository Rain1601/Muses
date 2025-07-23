'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUserStore } from '@/store/user';
import { api } from '@/lib/api';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import MarkdownRenderer from '@/components/MarkdownRenderer';

interface Article {
  id: string;
  title: string;
  content: string;
  summary?: string;
  publishStatus: string;
  publishedAt?: string;
  githubUrl?: string;
  createdAt: string;
  updatedAt: string;
  agent?: {
    name: string;
    avatar?: string;
  };
}

export default function ArticleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isLoading } = useUserStore();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const articleId = params.id as string;

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
      return;
    }

    if (user && articleId) {
      fetchArticle();
    }
  }, [user, isLoading, router, articleId]);



  const fetchArticle = async () => {
    try {
      const response = await api.get(`/api/articles/${articleId}`);
      setArticle(response.data.article);
    } catch (error: any) {
      console.error('Failed to fetch article:', error);
      if (error.response?.status === 404) {
        setError('文章不存在');
      } else {
        setError('加载文章失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    router.push(`/articles/${articleId}/edit`);
  };

  const handlePublish = () => {
    router.push(`/articles/${articleId}/publish`);
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这篇文章吗？删除后无法恢复。')) {
      return;
    }

    try {
      await api.delete(`/api/articles/${articleId}`);
      alert('文章已删除');
      router.push('/articles');
    } catch (error: any) {
      console.error('Delete error:', error);
      alert('删除失败：' + (error.response?.data?.detail || '未知错误'));
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">{error}</h1>
          <Button
            onClick={() => router.push('/articles')}
          >
            返回文章列表
          </Button>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">文章不存在</h1>
          <Button
            onClick={() => router.push('/articles')}
          >
            返回文章列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* 头部操作栏 */}
      <div className="flex justify-between items-center mb-8">
        <button
          onClick={() => router.push('/articles')}
          className="text-muted-foreground hover:text-foreground flex items-center"
        >
          ← 返回文章列表
        </button>
        
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={handleEdit}
          >
            编辑
          </Button>
          
          {article.publishStatus === 'draft' && (
            <Button
              onClick={handlePublish}
            >
              发布
            </Button>
          )}
          
          <Button
            variant="destructive"
            onClick={handleDelete}
          >
            删除
          </Button>
        </div>
      </div>

      {/* 文章元信息 */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          {/* 主要作者：GitHub用户 */}
          {user?.avatarUrl && (
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="w-12 h-12 rounded-full border-2 border-gray-200"
            />
          )}
                      <div className="flex-1">
              <p className="font-bold text-lg text-gray-900 dark:text-gray-100">{user?.username || 'Unknown User'}</p>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground dark:text-gray-400">
              <span>{new Date(article.createdAt).toLocaleString()}</span>
              <span>•</span>
              <div className="flex items-center space-x-1">
                <span>由</span>
                <div className="inline-flex items-center space-x-1">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                    {article.agent?.avatar || "✨"}
                  </div>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">{article.agent?.name || 'AI助手'}</span>
                </div>
                <span>协作</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <span
            className={`px-3 py-1 rounded-full text-sm ${
              article.publishStatus === 'published'
                ? 'bg-green-100 text-green-800'
                : article.publishStatus === 'scheduled'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {article.publishStatus === 'published'
              ? '已发布'
              : article.publishStatus === 'scheduled'
              ? '定时发布'
              : '草稿'}
          </span>

          {article.githubUrl && (
            <a
              href={article.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              在 GitHub 上查看
            </a>
          )}
        </div>
      </div>

      {/* 文章标题 */}
      <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100">{article.title}</h1>

      {/* 文章摘要 */}
      {article.summary && (
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-8 border border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">摘要</h2>
          <p className="text-muted-foreground dark:text-gray-300">{article.summary}</p>
        </div>
      )}

      {/* 文章内容 */}
      <MarkdownRenderer 
        content={article.content}
        className="prose prose-lg max-w-none"
      />

      {/* 底部信息 */}
      <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center text-sm text-muted-foreground dark:text-gray-400">
          <span>创建时间: {new Date(article.createdAt).toLocaleString()}</span>
          <span>最后更新: {new Date(article.updatedAt).toLocaleString()}</span>
        </div>
      </div>
      </div>
    </div>
  );
}
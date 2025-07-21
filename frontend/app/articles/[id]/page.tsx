'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUserStore } from '@/store/user';
import { api } from '@/lib/api';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';

// 导入样式
import 'highlight.js/styles/github.css';

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

  // 处理 Mermaid 图表渲染和 katex 加载
  useEffect(() => {
    const loadStylesAndRender = async () => {
      try {
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
        
        // 处理 Mermaid 图表
        if (article?.content && article.content.includes('```mermaid')) {
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
          // 等待 DOM 更新后再渲染
          setTimeout(() => {
            mermaid.init(undefined, document.querySelectorAll('.mermaid'));
          }, 100);
        }
      } catch (error) {
        console.error('Failed to load styles or render Mermaid:', error);
      }
    };

    loadStylesAndRender();
  }, [article?.content]);

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
            <p className="font-bold text-lg">{user?.username || 'Unknown User'}</p>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>{new Date(article.createdAt).toLocaleString()}</span>
              <span>•</span>
              <div className="flex items-center space-x-1">
                <span>由</span>
                <div className="inline-flex items-center space-x-1">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                    {article.agent?.avatar || "✨"}
                  </div>
                  <span className="font-medium text-emerald-600">{article.agent?.name || 'AI助手'}</span>
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
              className="text-blue-600 hover:underline text-sm"
            >
              在 GitHub 上查看
            </a>
          )}
        </div>
      </div>

      {/* 文章标题 */}
      <h1 className="text-4xl font-bold mb-6">{article.title}</h1>

      {/* 文章摘要 */}
      {article.summary && (
        <div className="bg-gray-50 p-4 rounded-lg mb-8">
          <h2 className="font-semibold mb-2">摘要</h2>
          <p className="text-muted-foreground">{article.summary}</p>
        </div>
      )}

      {/* 文章内容 */}
      <div className="prose prose-lg max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[
            [rehypeHighlight, { ignoreMissing: true }],
            rehypeKatex
          ]}
          components={{
            // 代码块自定义样式
            code: ({ node, inline, className, children, ...props }: any) => {
              const match = /language-(\w+)/.exec(className || '');
              const language = match ? match[1] : '';
              
              // Mermaid 图表处理
              if (language === 'mermaid') {
                return (
                  <div className="mermaid bg-white p-4 border rounded-lg my-4" style={{ textAlign: 'center' }}>
                    {String(children).replace(/\n$/, '')}
                  </div>
                );
              }
              
              return inline ? (
                <code className={`${className} bg-gray-100 px-1 rounded text-sm`} {...props}>
                  {children}
                </code>
              ) : (
                <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto border">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              );
            },
            // 图片优化
            img: ({ src, alt, ...props }: any) => (
              <img 
                src={src} 
                alt={alt} 
                {...props}
                className="max-w-full h-auto rounded-lg shadow-sm my-4"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjRjVGNUY1IiBzdHJva2U9IiNEOUQ5RDkiLz4KPGC4dGggZD0iTTEyIDhWMTZNOCAxMkgxNiIgc3Ryb2tlPSIjOTk5OTk5IiBzdHJva2Utd2lkdGg9IjIiIGZcUm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
                  target.alt = alt + ' (图片加载失败)';
                }}
              />
            ),
            // 表格样式优化
            table: ({ children, ...props }: any) => (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full border-collapse border border-gray-300" {...props}>
                  {children}
                </table>
              </div>
            ),
            th: ({ children, ...props }: any) => (
              <th className="border border-gray-300 px-4 py-2 bg-gray-50 font-medium text-left" {...props}>
                {children}
              </th>
            ),
            td: ({ children, ...props }: any) => (
              <td className="border border-gray-300 px-4 py-2" {...props}>
                {children}
              </td>
            ),
            // 标题样式优化
            h1: ({ children, ...props }: any) => (
              <h1 className="text-3xl font-bold mt-8 mb-4 border-b pb-2" {...props}>
                {children}
              </h1>
            ),
            h2: ({ children, ...props }: any) => (
              <h2 className="text-2xl font-bold mt-6 mb-3" {...props}>
                {children}
              </h2>
            ),
            h3: ({ children, ...props }: any) => (
              <h3 className="text-xl font-bold mt-4 mb-2" {...props}>
                {children}
              </h3>
            ),
            // 引用块样式
            blockquote: ({ children, ...props }: any) => (
              <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-50 italic" {...props}>
                {children}
              </blockquote>
            )
          }}
        >
          {article.content}
        </ReactMarkdown>
      </div>

      {/* 底部信息 */}
      <div className="mt-12 pt-8 border-t border-gray-200">
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <span>创建时间: {new Date(article.createdAt).toLocaleString()}</span>
          <span>最后更新: {new Date(article.updatedAt).toLocaleString()}</span>
        </div>
      </div>
      </div>
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/user';
import { api } from '@/lib/api';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Article {
  id: string;
  title: string;
  summary?: string;
  publishStatus: string;
  createdAt: string;
  agent?: {
    name: string;
    avatar?: string;
  };
}

export default function ArticlesPage() {
  const router = useRouter();
  const { user, isLoading } = useUserStore();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
      return;
    }

    if (user) {
      fetchArticles();
    }
  }, [user, isLoading, router]);

  const fetchArticles = async () => {
    try {
      const response = await api.get('/api/articles');
      setArticles(response.data.articles || []);
    } catch (error) {
      console.error('Failed to fetch articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (articleId: string, title: string) => {
    if (!confirm(`确定要删除文章"${title}"吗？删除后无法恢复。`)) {
      return;
    }

    try {
      await api.delete(`/api/articles/${articleId}`);
      setArticles(articles.filter(article => article.id !== articleId));
      alert('文章已删除');
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

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">我的文章</h1>
        <Button
          onClick={() => router.push('/articles/new')}
        >
          创建新文章
        </Button>
      </div>

      {articles.length === 0 ? (
        <Card className="text-center py-16 border-dashed border-2 border-border/60">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-3xl mb-6 mx-auto transition-all duration-300 hover:bg-primary/20 dark:hover:bg-primary/30">
            🪶
          </div>
          <h3 className="text-lg font-semibold mb-2">还没有文章</h3>
          <p className="text-muted-foreground mb-6">创建您的第一篇文章，开始创作之旅</p>
          <Button
            onClick={() => router.push('/articles/new')}
            size="lg"
          >
            创建第一篇文章
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Card
              key={article.id}
              className="relative group cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
              onClick={() => router.push(`/articles/${article.id}`)}
            >
              {/* 删除按钮 */}
              <Button
                variant="destructive"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(article.id, article.title);
                }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full"
                title="删除文章"
              >
                ✕
              </Button>

              <CardHeader className="pb-3">
                <h3 className="font-semibold text-lg line-clamp-2 pr-6">
                  {article.title}
                </h3>
              </CardHeader>

              <CardContent className="pt-0">
                {article.summary && (
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                    {article.summary}
                  </p>
                )}
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    {user?.avatarUrl && (
                      <img
                        src={user.avatarUrl}
                        alt={user.username}
                        className="w-6 h-6 rounded-full"
                      />
                    )}
                    <div className="flex items-center space-x-1">
                      <span className="text-muted-foreground font-medium">
                        {user?.username || 'Unknown User'}
                      </span>
                      <span className="text-xs text-muted-foreground">与</span>
                      <div className="w-4 h-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                        {article.agent?.avatar || "✨"}
                      </div>
                      <span className="text-xs text-emerald-600 font-medium">
                        {article.agent?.name || 'AI助手'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <Badge
                      variant={
                        article.publishStatus === 'published'
                          ? 'success'
                          : article.publishStatus === 'scheduled'
                          ? 'warning'
                          : 'draft'
                      }
                    >
                      {article.publishStatus === 'published'
                        ? '已发布'
                        : article.publishStatus === 'scheduled'
                        ? '定时发布'
                        : '草稿'}
                    </Badge>
                    <span className="text-muted-foreground mt-1 text-xs">
                      {new Date(article.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-0">
                <div className="w-full flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/articles/${article.id}/edit`);
                    }}
                    className="flex-1"
                  >
                    编辑
                  </Button>
                  {article.publishStatus === 'draft' && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/articles/${article.id}/publish`);
                      }}
                      className="flex-1"
                    >
                      发布
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
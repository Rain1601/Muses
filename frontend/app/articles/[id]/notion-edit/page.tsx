'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUserStore } from '@/store/user';
import { api } from '@/lib/api';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save, Eye, Share2 } from 'lucide-react';
import AdvancedTiptapWrapper from '@/components/AdvancedTiptapWrapper';
import '@/app/editor-demo/mermaid-styles.css';

interface Article {
  id: string;
  title: string;
  content: string;
  summary?: string;
  publishStatus: string;
  createdAt: string;
  updatedAt: string;
}

export default function NotionEditPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isLoading } = useUserStore();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
      return;
    }

    if (user && params.id) {
      fetchArticle();
    }
  }, [user, isLoading, router, params.id]);

  const fetchArticle = async () => {
    try {
      const response = await api.get(`/api/articles/${params.id}`);
      const articleData = response.data.article;
      setArticle(articleData);
      setTitle(articleData.title);
      setContent(articleData.content || '');
    } catch (error) {
      console.error('Failed to fetch article:', error);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!article || !title.trim()) return;

    setSaving(true);
    try {
      await api.put(`/api/articles/${article.id}`, {
        title: title.trim(),
        content,
      });
      
      // 更新本地状态
      setArticle({ ...article, title: title.trim(), content });
      
      // 显示保存成功提示
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      successDiv.textContent = '✅ 保存成功';
      document.body.appendChild(successDiv);
      
      setTimeout(() => {
        document.body.removeChild(successDiv);
      }, 2000);
      
    } catch (error) {
      console.error('Failed to save article:', error);
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 自动保存功能
  useEffect(() => {
    if (!article) return;
    
    const autoSaveTimer = setTimeout(() => {
      if (title !== article.title || content !== article.content) {
        handleSave();
      }
    }, 5000); // 5秒后自动保存

    return () => clearTimeout(autoSaveTimer);
  }, [title, content, article]);

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">文章未找到</h2>
          <Button onClick={() => router.push('/dashboard')}>
            返回文章列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* 顶部工具栏 */}
      <div className="border-b bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard')}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回
              </Button>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-sm text-muted-foreground">
                  Notion 风格编辑器
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/articles/${article.id}`)}
              >
                <Eye className="w-4 h-4 mr-1" />
                预览
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="w-4 h-4 mr-1" />
                {saving ? '保存中...' : '保存'}
              </Button>
              <Button
                size="sm"
                onClick={() => router.push(`/articles/${article.id}/publish`)}
                className="bg-green-600 hover:bg-green-700"
              >
                <Share2 className="w-4 h-4 mr-1" />
                发布
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 编辑器区域 */}
      <div className="container mx-auto py-8 max-w-6xl px-4">
        {/* 标题编辑 */}
        <div className="bg-card rounded-lg shadow-sm mb-6 p-6 border">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入文章标题..."
            className="text-3xl font-bold border-none shadow-none p-0 h-auto resize-none focus-visible:ring-0 bg-transparent text-foreground placeholder:text-muted-foreground"
            style={{ fontSize: '2rem', lineHeight: '2.5rem' }}
          />
          <div className="mt-2 text-sm text-muted-foreground">
            创建于 {new Date(article.createdAt).toLocaleString()} 
            {article.updatedAt !== article.createdAt && (
              <span> • 更新于 {new Date(article.updatedAt).toLocaleString()}</span>
            )}
          </div>
        </div>

        {/* Notion 编辑器 */}
        <div className="mb-8">
          <AdvancedTiptapWrapper />
        </div>

        {/* 底部状态栏 */}
        <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>字数: {content.length}</span>
            <span>状态: {article.publishStatus === 'published' ? '已发布' : '草稿'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span>自动保存已启用</span>
          </div>
        </div>
      </div>
    </div>
  );
}
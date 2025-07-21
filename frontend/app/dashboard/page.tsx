"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUserStore } from "@/store/user";
import { auth } from "@/lib/auth";
import Link from "next/link";
import axios from "axios";

interface Article {
  id: string;
  title: string;
  summary?: string;
  publishStatus: string;
  createdAt: string;
  agent: {
    name: string;
    avatar?: string;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, checkAuth, logout } = useUserStore();
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    if (user) {
      fetchArticles();
    }
  }, [user]);

  const fetchArticles = async () => {
    try {
      const response = await axios.get("/api/articles");
      setArticles(response.data.articles);
    } catch (error) {
      console.error("Failed to fetch articles:", error);
    } finally {
      setIsLoading(false);
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
      {/* 顶部导航 */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold">Muses</h1>
              <nav className="flex space-x-6">
                <Link href="/dashboard" className="text-primary font-medium">
                  工作台
                </Link>
                <Link href="/agents" className="text-muted-foreground hover:text-foreground">
                  Agent管理
                </Link>
                <Link href="/settings" className="text-muted-foreground hover:text-foreground">
                  设置
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {user.username}
              </span>
              {user.avatarUrl && (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <button
                onClick={logout}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                退出
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="container mx-auto px-4 py-8">
        {/* 快捷操作 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">快捷操作</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/articles/new"
              className="p-6 border rounded-lg hover:border-primary transition-colors text-center"
            >
              <div className="text-3xl mb-2">📝</div>
              <h3 className="font-medium">新建文章</h3>
              <p className="text-sm text-muted-foreground mt-1">
                从素材生成新文章
              </p>
            </Link>
            <Link
              href="/agents"
              className="p-6 border rounded-lg hover:border-primary transition-colors text-center"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xl font-bold mb-2 mx-auto">
                ✨
              </div>
              <h3 className="font-medium">管理Agent</h3>
              <p className="text-sm text-muted-foreground mt-1">
                创建和编辑AI助手
              </p>
            </Link>
            <Link
              href="/articles"
              className="p-6 border rounded-lg hover:border-primary transition-colors text-center"
            >
              <div className="text-3xl mb-2">📚</div>
              <h3 className="font-medium">查看历史</h3>
              <p className="text-sm text-muted-foreground mt-1">
                浏览所有文章
              </p>
            </Link>
          </div>
        </div>

        {/* 最近文章 */}
        <div>
          <h2 className="text-xl font-semibold mb-6">最近文章</h2>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-12 border rounded-lg">
              <p className="text-muted-foreground mb-4">还没有创建任何文章</p>
              <Link
                href="/articles/new"
                className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
              >
                创建第一篇文章
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/articles/${article.id}`}
                  className="p-4 border rounded-lg hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium line-clamp-2">{article.title}</h3>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        article.publishStatus === "published"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {article.publishStatus === "published" ? "已发布" : "草稿"}
                    </span>
                  </div>
                  {article.summary && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {article.summary}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{article.agent.name}</span>
                    <span>
                      {new Date(article.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
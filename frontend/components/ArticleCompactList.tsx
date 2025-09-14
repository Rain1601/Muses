"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { ArticleListItem } from "./ArticleListItem";
import { api } from "@/lib/api";
import { Plus, Search } from "lucide-react";

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
  onArticleSelect?: (article: Article) => void;
  selectedArticleId?: string;
}

export function ArticleCompactList({ onArticleSelect, selectedArticleId }: ArticleCompactListProps) {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);

  useEffect(() => {
    fetchArticles();
  }, []);

  useEffect(() => {
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
      setArticles(response.data.articles || []);
    } catch (error) {
      console.error("Failed to fetch articles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (articleId: string) => {
    if (!confirm("确定要删除这篇文章吗？")) return;

    try {
      await api.delete(`/api/articles/${articleId}`);
      setArticles(articles.filter(a => a.id !== articleId));
    } catch (error) {
      console.error("Failed to delete article:", error);
    }
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
          <Button
            size="sm"
            onClick={() => router.push("/articles/notion-new")}
            className="flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            新建
          </Button>
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
      <div className="flex-1 overflow-y-auto">
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
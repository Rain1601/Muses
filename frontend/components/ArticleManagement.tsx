"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserStore } from "@/store/user";
import Link from "next/link";

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

interface ArticleListResponse {
  articles: Article[];
  total?: number;
  page?: number;
  page_size?: number;
  total_pages?: number;
}

interface ArticleManagementProps {
  showTitle?: boolean;
  maxItems?: number;
  showPagination?: boolean;
}

export default function ArticleManagement({ 
  showTitle = true, 
  maxItems,
  showPagination = true 
}: ArticleManagementProps) {
  const router = useRouter();
  const { user } = useUserStore();
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isComposing, setIsComposing] = useState(false);

  const pageSize = maxItems || 9;

  useEffect(() => {
    if (user) {
      fetchArticles();
    }
  }, [user, statusFilter, sortBy, sortOrder, currentPage]);

  const fetchArticles = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: pageSize.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      if (searchTerm) {
        params.append("search", searchTerm);
      }

      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const response = await api.get(`/api/articles?${params.toString()}`);
      const data: ArticleListResponse = response.data;
      
      setArticles(data.articles || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch (error) {
      console.error("Failed to fetch articles:", error);
      setArticles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (articleId: string, title: string) => {
    if (!confirm(`确定要删除文章"${title}"吗？删除后无法恢复。`)) {
      return;
    }

    try {
      await api.delete(`/api/articles/${articleId}`);
      fetchArticles(); // 重新获取文章列表
    } catch (error: any) {
      console.error("Delete error:", error);
      alert("删除失败：" + (error.response?.data?.detail || "未知错误"));
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    if (isComposing) return;
    e.preventDefault();
    setCurrentPage(1);
    fetchArticles();
  };

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setSortBy("createdAt");
    setSortOrder("desc");
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div>
      {/* 标题栏和快速操作 */}
      <div className="mb-6">
        {showTitle && (
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-xl font-semibold">文章管理</h2>
            <div className="flex gap-2">
              <Button
                onClick={() => router.push("/articles/new")}
                size="sm"
              >
                新建文章
              </Button>
              <Button
                onClick={() => router.push("/articles/notion-new")}
                size="sm"
                variant="outline"
              >
                ✨ Notion编辑器
              </Button>
            </div>
          </div>
        )}

        {/* 搜索框 */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="搜索标题、摘要或内容..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isComposing) {
                  handleSearch(e);
                }
              }}
            />
          </div>
          <Button type="submit" variant="outline">
            搜索
          </Button>
        </form>
      </div>

      {/* 筛选和排序 */}
      <div className="mb-6 space-y-4">{/* This block was split to separate search from filters */}

        <div className="flex gap-4 flex-wrap items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">状态:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="published">已发布</SelectItem>
                <SelectItem value="scheduled">定时发布</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">排序:</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">时间</SelectItem>
                <SelectItem value="title">标题</SelectItem>
                <SelectItem value="publishStatus">状态</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">降序</SelectItem>
                <SelectItem value="asc">升序</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="text-muted-foreground"
          >
            重置
          </Button>
        </div>

        {/* 结果统计 */}
        <div className="text-sm text-muted-foreground">
          共找到 {total} 篇文章
          {searchTerm && ` (搜索: "${searchTerm}")`}
          {statusFilter !== "all" && ` (状态: ${statusFilter === "draft" ? "草稿" : statusFilter === "published" ? "已发布" : "定时发布"})`}
        </div>
      </div>

      {/* 文章列表 */}
      {articles.length === 0 ? (
        <div className="text-center py-12 border rounded-lg border-dashed">
          <div className="text-4xl mb-4">📝</div>
          <p className="text-muted-foreground mb-4">
            {searchTerm || statusFilter !== "all" ? "没有找到符合条件的文章" : "还没有创建任何文章"}
          </p>
          {!searchTerm && statusFilter === "all" && (
            <Button
              onClick={() => router.push("/articles/new")}
            >
              创建第一篇文章
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((article) => (
              <Card
                key={article.id}
                className="relative group cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-lg border-border/50 bg-background flex flex-col"
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

                <CardContent className="pt-0 flex-1">
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
                        <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                          {article.agent?.avatar || "✨"}
                        </div>
                        <span className="text-xs text-primary font-medium">
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
                  <div className="w-full flex gap-1 items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/articles/${article.id}/edit`);
                      }}
                      className="flex-1 text-xs whitespace-nowrap"
                    >
                      📝 编辑
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/articles/${article.id}/notion-edit`);
                      }}
                      className="flex-1 text-xs whitespace-nowrap"
                      title="使用 Notion 风格编辑器"
                    >
                      ✨ Notion
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/articles/${article.id}/publish`);
                      }}
                      className="flex-1 text-xs whitespace-nowrap"
                      disabled={article.publishStatus === 'published'}
                    >
                      🚀 {article.publishStatus === 'published' ? '已发布' : '发布'}
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* 分页 */}
          {showPagination && totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 mt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                上一页
              </Button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else {
                    if (currentPage <= 4) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = currentPage - 3 + i;
                    }
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                下一页
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
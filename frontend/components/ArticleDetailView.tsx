"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Calendar,
  User,
  FileText,
  Edit3,
  Share2,
  Trash2,
  Clock,
  Hash
} from "lucide-react";
import { marked } from 'marked';

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

interface ArticleDetailViewProps {
  article: Article;
  onEdit?: () => void;
}

export function ArticleDetailView({ article, onEdit }: ArticleDetailViewProps) {
  const router = useRouter();
  const [htmlContent, setHtmlContent] = useState("");
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    if (article.content) {
      // 转换Markdown为HTML
      const convertMarkdown = async () => {
        const html = await marked(article.content);
        setHtmlContent(html);
      };
      convertMarkdown().catch(console.error);

      // 计算字数
      const text = article.content.replace(/[#*`_\[\]()!-]/g, '').replace(/\s+/g, '');
      setWordCount(text.length);
    }
  }, [article.content]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'published':
        return '已发布';
      case 'draft':
        return '草稿';
      default:
        return '未知';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };


  const handleDelete = async () => {
    if (!confirm("确定要删除这篇文章吗？")) return;
    // 删除逻辑由父组件处理
  };

  return (
    <div className="h-full flex flex-col article-preview-enter">
      {/* 头部 - 标题和操作 */}
      <div className="border-b border-border p-6 bg-card/50">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 pr-4">
            <h1 className="text-2xl font-bold text-foreground mb-2 leading-tight">
              {article.title || '无标题'}
            </h1>

            {/* 状态标签 */}
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(article.publishStatus)}>
                {getStatusText(article.publishStatus)}
              </Badge>
              {article.summary && (
                <Badge variant="outline" className="text-xs">
                  有摘要
                </Badge>
              )}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">

            <Button
              size="sm"
              onClick={() => router.push(`/articles/${article.id}/publish`)}
              disabled={article.publishStatus === 'published'}
              className="flex items-center gap-1 hover-lift disabled:hover:transform-none disabled:hover:shadow-none"
            >
              <Share2 className="w-4 h-4" />
              {article.publishStatus === 'published' ? '已发布' : '发布'}
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="flex items-center gap-1 hover-lift"
            >
              <Trash2 className="w-4 h-4" />
              删除
            </Button>
          </div>
        </div>

        {/* 元信息 */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>创建于 {formatDate(article.createdAt)}</span>
          </div>

          {article.updatedAt !== article.createdAt && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>更新于 {formatDate(article.updatedAt)}</span>
            </div>
          )}

          <div className="flex items-center gap-1">
            <Hash className="w-4 h-4" />
            <span>{wordCount} 字</span>
          </div>

          {article.agent && (
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              <span>{article.agent.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-6">
        {article.summary && (
          <div className="mb-6 p-4 bg-muted/30 rounded-lg border-l-4 border-primary">
            <h3 className="font-medium text-sm mb-2 text-muted-foreground">摘要</h3>
            <p className="text-sm leading-relaxed">{article.summary}</p>
          </div>
        )}

        <div className="border-t border-border mb-6"></div>

        {/* 文章内容 */}
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <div
            dangerouslySetInnerHTML={{ __html: htmlContent }}
            className="leading-relaxed"
          />
        </div>

        {!article.content.trim() && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">文章内容为空</p>
          </div>
        )}
      </div>
    </div>
  );
}
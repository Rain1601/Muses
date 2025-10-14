"use client";

import { Badge } from "./ui/badge";
import { FileText, Trash2, MoreHorizontal, Languages, CloudOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";

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

interface ArticleListItemProps {
  article: Article;
  isSelected?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onPublish?: () => void;
  onDelete?: () => void;
  onTranslate?: () => void;
  onUnpublish?: () => void;
}

export function ArticleListItem({
  article,
  isSelected = false,
  onClick,
  onDelete,
  onTranslate,
  onUnpublish
}: ArticleListItemProps) {

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


  return (
    <div
      className={`
        group relative px-4 py-3 border-b border-border/40 cursor-pointer transition-all duration-200
        ${isSelected
          ? 'bg-primary/10 border-l-2 border-l-primary'
          : 'hover:bg-accent/50'
        }
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-2">
          {/* 标题行 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <FileText className="w-4 h-4 text-muted-foreground/70 flex-shrink-0" />
              <h3 className={`
                font-medium text-sm leading-tight truncate
                ${isSelected ? 'text-primary' : 'text-foreground'}
              `}>
                {article.title || '无标题'}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={`text-xs px-1.5 py-0.5 flex-shrink-0 ${getStatusColor(article.publishStatus)}`}
              >
                {getStatusText(article.publishStatus)}
              </Badge>

              {onDelete && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onTranslate && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onTranslate();
                        }}
                      >
                        <Languages className="w-4 h-4 mr-2" />
                        翻译
                      </DropdownMenuItem>
                    )}
                    {onUnpublish && article.publishStatus === 'published' && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onUnpublish();
                        }}
                        className="text-orange-600 focus:text-orange-600"
                      >
                        <CloudOff className="w-4 h-4 mr-2" />
                        下架
                      </DropdownMenuItem>
                    )}
                    {(onTranslate || onUnpublish) && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
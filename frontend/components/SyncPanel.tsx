"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Download,
  Upload,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  GitBranch,
  History,
  FileText
} from 'lucide-react';
import { api } from '@/lib/api';

interface SyncStatus {
  article: {
    id: string;
    title: string;
    syncStatus: 'local' | 'synced' | 'conflict';
    firstSyncAt?: string;
    lastSyncAt?: string;
    syncCount: string;
    githubUrl?: string;
    repoPath?: string;
    localModifiedAt: string;
    githubModifiedAt?: string;
  };
  syncHistory: Array<{
    id: string;
    syncType: string;
    syncDirection: string;
    syncStatus: string;
    hasChanges: boolean;
    conflictType?: string;
    errorMessage?: string;
    createdAt: string;
  }>;
}

interface SyncPanelProps {
  articleId: string;
  onSyncComplete?: () => void;
}

export function SyncPanel({ articleId, onSyncComplete }: SyncPanelProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [conflictDialog, setConflictDialog] = useState<{
    open: boolean;
    localContent: string;
    githubContent: string;
    localModifiedAt: string;
    githubModifiedAt: string;
  }>({
    open: false,
    localContent: '',
    githubContent: '',
    localModifiedAt: '',
    githubModifiedAt: ''
  });

  const fetchSyncStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/sync/status/${articleId}`);
      setSyncStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSyncStatus();
  }, [articleId]);

  const handlePullFromGitHub = async (forceOverwrite = false) => {
    try {
      setSyncing(true);
      const response = await api.post('/api/sync/pull-from-github', {
        articleId,
        forceOverwrite
      });

      if (response.data.conflict) {
        // 显示冲突解决对话框
        setConflictDialog({
          open: true,
          localContent: response.data.localContent,
          githubContent: response.data.githubContent,
          localModifiedAt: response.data.localModifiedAt,
          githubModifiedAt: response.data.githubModifiedAt
        });
      } else {
        // 同步成功
        await fetchSyncStatus();
        onSyncComplete?.();
      }
    } catch (error) {
      console.error('Failed to pull from GitHub:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleResolveConflict = async (resolution: 'use_local' | 'use_github' | 'use_custom', customContent?: string) => {
    try {
      setSyncing(true);
      await api.post('/api/sync/resolve-conflict', {
        articleId,
        resolution,
        customContent
      });

      setConflictDialog({ ...conflictDialog, open: false });
      await fetchSyncStatus();
      onSyncComplete?.();
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    } finally {
      setSyncing(false);
    }
  };

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case 'local':
        return <Badge variant="secondary">仅本地</Badge>;
      case 'synced':
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">已同步</Badge>;
      case 'conflict':
        return <Badge variant="destructive">冲突</Badge>;
      default:
        return <Badge variant="outline">未知</Badge>;
    }
  };

  const getSyncIcon = (syncType: string, syncStatus: string) => {
    if (syncStatus === 'failed') return <XCircle className="w-4 h-4 text-red-500" />;
    if (syncStatus === 'conflict') return <AlertTriangle className="w-4 h-4 text-yellow-500" />;

    switch (syncType) {
      case 'pull_from_github':
        return <Download className="w-4 h-4 text-blue-500" />;
      case 'push_to_github':
        return <Upload className="w-4 h-4 text-green-500" />;
      case 'conflict_resolved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <GitBranch className="w-4 h-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!syncStatus) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>无法获取同步状态</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 同步状态卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                同步状态
              </CardTitle>
              <CardDescription>
                文章与 GitHub 的同步情况
              </CardDescription>
            </div>
            {getSyncStatusBadge(syncStatus.article.syncStatus)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">同步次数:</span>
              <span className="ml-2 font-medium">{syncStatus.article.syncCount}</span>
            </div>
            {syncStatus.article.firstSyncAt && (
              <div>
                <span className="text-muted-foreground">首次同步:</span>
                <span className="ml-2 font-medium">
                  {new Date(syncStatus.article.firstSyncAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
            )}
            {syncStatus.article.lastSyncAt && (
              <div>
                <span className="text-muted-foreground">最后同步:</span>
                <span className="ml-2 font-medium">
                  {new Date(syncStatus.article.lastSyncAt).toLocaleString('zh-CN')}
                </span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">本地修改:</span>
              <span className="ml-2 font-medium">
                {new Date(syncStatus.article.localModifiedAt).toLocaleString('zh-CN')}
              </span>
            </div>
          </div>

          {/* GitHub 信息 */}
          {syncStatus.article.githubUrl && (
            <div className="pt-4 border-t">
              <div className="text-sm space-y-2">
                <div>
                  <span className="text-muted-foreground">GitHub 路径:</span>
                  <code className="ml-2 px-2 py-1 bg-muted rounded text-xs">
                    {syncStatus.article.repoPath}
                  </code>
                </div>
                <div>
                  <a
                    href={syncStatus.article.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    在 GitHub 中查看 →
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* 同步操作 */}
          <div className="pt-4 border-t">
            <div className="flex gap-2">
              <Button
                onClick={() => handlePullFromGitHub(false)}
                disabled={syncing || !syncStatus.article.githubUrl}
                size="sm"
                variant="outline"
              >
                {syncing ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                从 GitHub 拉取
              </Button>

              {syncStatus.article.syncStatus === 'conflict' && (
                <Button
                  onClick={() => handlePullFromGitHub(true)}
                  disabled={syncing}
                  size="sm"
                  variant="destructive"
                >
                  <Download className="w-4 h-4 mr-2" />
                  强制覆盖
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 同步历史 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            同步历史
          </CardTitle>
          <CardDescription>
            最近的同步操作记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          {syncStatus.syncHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>暂无同步记录</p>
            </div>
          ) : (
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {syncStatus.syncHistory.map((record, index) => (
                  <div key={record.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    {getSyncIcon(record.syncType, record.syncStatus)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {record.syncType === 'pull_from_github' ? '从 GitHub 拉取' :
                           record.syncType === 'push_to_github' ? '推送到 GitHub' :
                           record.syncType === 'conflict_resolved' ? '冲突已解决' : record.syncType}
                        </span>
                        <Badge
                          variant={record.syncStatus === 'success' ? 'default' : record.syncStatus === 'failed' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {record.syncStatus === 'success' ? '成功' :
                           record.syncStatus === 'failed' ? '失败' :
                           record.syncStatus === 'conflict' ? '冲突' : record.syncStatus}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(record.createdAt).toLocaleString('zh-CN')}
                        {record.hasChanges && <span className="ml-2 text-blue-600">• 有内容变更</span>}
                      </div>
                      {record.errorMessage && (
                        <div className="text-xs text-red-600 mt-1 break-words">
                          {record.errorMessage}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* 冲突解决对话框 */}
      <Dialog open={conflictDialog.open} onOpenChange={(open) => setConflictDialog({ ...conflictDialog, open })}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>内容冲突</DialogTitle>
            <DialogDescription>
              本地和 GitHub 版本都有修改，请选择如何处理这个冲突。
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="local" className="flex-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="local">本地版本</TabsTrigger>
              <TabsTrigger value="github">GitHub 版本</TabsTrigger>
            </TabsList>

            <TabsContent value="local" className="mt-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  最后修改: {new Date(conflictDialog.localModifiedAt).toLocaleString('zh-CN')}
                </div>
                <ScrollArea className="h-64 w-full border rounded-md p-4">
                  <pre className="text-sm whitespace-pre-wrap">{conflictDialog.localContent}</pre>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="github" className="mt-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  最后修改: {new Date(conflictDialog.githubModifiedAt).toLocaleString('zh-CN')}
                </div>
                <ScrollArea className="h-64 w-full border rounded-md p-4">
                  <pre className="text-sm whitespace-pre-wrap">{conflictDialog.githubContent}</pre>
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => handleResolveConflict('use_local')}
              disabled={syncing}
            >
              使用本地版本
            </Button>
            <Button
              variant="outline"
              onClick={() => handleResolveConflict('use_github')}
              disabled={syncing}
            >
              使用 GitHub 版本
            </Button>
            <Button
              onClick={() => setConflictDialog({ ...conflictDialog, open: false })}
              variant="secondary"
            >
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
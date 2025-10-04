"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Clock, CheckCircle2, XCircle, Loader2, FileText, ChevronRight, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface Task {
  taskId: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  total: number;
  currentStep?: string;
  createdAt: string;
  updatedAt: string;
  result?: {
    article_id?: string;
    title?: string;
  };
  error?: string;
  // 任务元数据
  task_type?: string;
  article_id?: string;
  target_language?: string;
}

interface TaskCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onArticleClick?: (articleId: string) => void;
}

export function TaskCenter({ isOpen, onClose, onArticleClick }: TaskCenterProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  // 获取所有任务（从本地存储）
  const fetchTasks = () => {
    try {
      const storedTasks = localStorage.getItem('muses_tasks');
      if (storedTasks) {
        const taskList: Task[] = JSON.parse(storedTasks);
        // 按创建时间倒序排列
        taskList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTasks(taskList);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  // 监听 localStorage 变化
  useEffect(() => {
    if (!isOpen) return;

    // 立即获取任务
    fetchTasks();

    // 监听 storage 事件（跨标签页变化）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'muses_tasks') {
        fetchTasks();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 监听自定义事件（同一标签页内的变化）
    const handleTaskUpdate = () => {
      fetchTasks();
    };
    window.addEventListener('muses-task-update', handleTaskUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('muses-task-update', handleTaskUpdate);
    };
  }, [isOpen]);

  // 轮询更新进行中的任务
  useEffect(() => {
    if (!isOpen) return;

    // 每2秒轮询一次进行中的任务
    const interval = setInterval(async () => {
      const storedTasks = localStorage.getItem('muses_tasks');
      if (!storedTasks) return;

      const taskList: Task[] = JSON.parse(storedTasks);
      const runningTasks = taskList.filter(t => t.status === 'pending' || t.status === 'running');

      if (runningTasks.length === 0) return;

      // 更新每个运行中任务的状态
      for (const task of runningTasks) {
        try {
          const response = await api.get(`/api/articles/tasks/${task.taskId}`);
          const updatedTask = response.data;

          // 更新任务列表
          const updatedTasks = taskList.map(t =>
            t.taskId === task.taskId ? { ...t, ...updatedTask } : t
          );
          localStorage.setItem('muses_tasks', JSON.stringify(updatedTasks));

          // 触发更新事件
          window.dispatchEvent(new Event('muses-task-update'));
        } catch (error) {
          console.error(`Failed to update task ${task.taskId}:`, error);
        }
      }

      fetchTasks();
    }, 2000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // 获取任务类型显示名称
  const getTaskTypeName = (type?: string) => {
    switch (type) {
      case 'translate_article':
        return '翻译文章';
      case 'generate_article':
        return '生成文章';
      default:
        return '任务';
    }
  };

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '等待中';
      case 'running':
        return '进行中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      default:
        return '未知';
    }
  };

  // 清除所有已完成/失败的任务
  const clearFinishedTasks = () => {
    const activeTasks = tasks.filter(t => t.status === 'pending' || t.status === 'running');
    localStorage.setItem('muses_tasks', JSON.stringify(activeTasks));
    fetchTasks();
  };

  // 删除单个任务
  const deleteTask = (taskId: string) => {
    const updatedTasks = tasks.filter(t => t.taskId !== taskId);
    localStorage.setItem('muses_tasks', JSON.stringify(updatedTasks));
    fetchTasks();
  };

  const runningTasks = tasks.filter(t => t.status === 'pending' || t.status === 'running');
  const finishedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'failed');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>任务中心</span>
            {finishedTasks.length > 0 && (
              <button
                onClick={clearFinishedTasks}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                清除已完成
              </button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">暂无任务</p>
            </div>
          ) : (
            <>
              {/* 进行中的任务 */}
              {runningTasks.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    进行中 ({runningTasks.length})
                  </h3>
                  <div className="space-y-2">
                    {runningTasks.map(task => (
                      <TaskItem
                        key={task.taskId}
                        task={task}
                        onDelete={deleteTask}
                        onArticleClick={onArticleClick}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 已完成的任务 */}
              {finishedTasks.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    历史记录 ({finishedTasks.length})
                  </h3>
                  <div className="space-y-2">
                    {finishedTasks.map(task => (
                      <TaskItem
                        key={task.taskId}
                        task={task}
                        onDelete={deleteTask}
                        onArticleClick={onArticleClick}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 任务项组件
function TaskItem({
  task,
  onDelete,
  onArticleClick
}: {
  task: Task;
  onDelete: (taskId: string) => void;
  onArticleClick?: (articleId: string) => void;
}) {
  const isRunning = task.status === 'pending' || task.status === 'running';
  const progress = task.total > 0 ? Math.round((task.progress / task.total) * 100) : 0;

  const getTaskTypeName = (type?: string) => {
    switch (type) {
      case 'translate_article':
        return '翻译文章';
      case 'generate_article':
        return '生成文章';
      default:
        return '任务';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '等待中';
      case 'running':
        return '进行中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      default:
        return '未知';
    }
  };

  return (
    <div className="border border-border rounded-lg p-3 bg-card hover:bg-accent/5 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="mt-0.5">
            {getStatusIcon(task.status)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {getTaskTypeName(task.task_type)}
              </span>
              <span className="text-xs text-muted-foreground">
                {getStatusText(task.status)}
              </span>
            </div>

            {/* 进度条 */}
            {isRunning && task.total > 0 && (
              <div className="mt-2 space-y-1">
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{task.currentStep || `${task.progress}/${task.total}`}</span>
                  <span>{progress}%</span>
                </div>
              </div>
            )}

            {/* 完成后的结果 */}
            {task.status === 'completed' && task.result?.article_id && (
              <button
                onClick={() => onArticleClick?.(task.result!.article_id!)}
                className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <FileText className="w-3 h-3" />
                <span>{task.result.title || '查看文章'}</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}

            {/* 错误信息 */}
            {task.status === 'failed' && task.error && (
              <p className="mt-2 text-xs text-red-500">{task.error}</p>
            )}

            {/* 时间信息 */}
            <div className="mt-1 text-xs text-muted-foreground">
              {new Date(task.createdAt).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </div>

        {/* 删除按钮 */}
        {!isRunning && (
          <button
            onClick={() => onDelete(task.taskId)}
            className="text-muted-foreground hover:text-foreground p-1"
            title="删除任务"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

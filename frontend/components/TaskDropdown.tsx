"use client";

import { useState } from "react";
import { ClipboardList, FileText, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isActiveTask, type ArticleTask } from "@/lib/hooks/useArticleTasks";

interface TaskDropdownProps {
  tasks: ArticleTask[];
  disabled: boolean;
  triggerClassName: string;
  onCancel: (id: string) => Promise<void>;
  onRemove: (id?: string) => void;
  onArticleClick: (id: string) => void;
}

const statusLabels: Record<ArticleTask["status"], string> = {
  pending: "待处理",
  running: "处理中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const actionStyle = "rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-ring active:bg-accent disabled:opacity-60";

export function TaskDropdown({ tasks, disabled, triggerClassName, onCancel, onRemove, onArticleClick }: TaskDropdownProps) {
  const [open, setOpen] = useState(false);
  const active = tasks.filter(isActiveTask);
  const history = tasks.filter((task) => !isActiveTask(task));

  const openArticle = (id: string) => {
    setOpen(false);
    onArticleClick(id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={`${triggerClassName} relative`} disabled={disabled}
          aria-label={active.length ? `任务，${active.length} 项待处理或处理中` : "任务"} title="任务">
          <ClipboardList className="size-4" aria-hidden="true" />
          {active.length > 0 && (
            <span aria-hidden="true" className="pointer-events-none absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-xs tabular-nums text-primary-foreground">
              {active.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} collisionPadding={12} aria-label="任务"
        className="dark flex max-h-[var(--radix-popover-content-available-height)] w-96 max-w-[calc(100vw-1.5rem)] flex-col p-0 font-sans shadow-none motion-reduce:animate-none">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <h2 className="text-sm font-medium">任务</h2>
          {history.length > 0 && <button type="button" className={actionStyle} onClick={() => onRemove()}>清除记录</button>}
        </div>
        <div className="min-h-0 overflow-y-auto px-4 pb-3">
          {tasks.length === 0 && <p className="py-3 text-xs text-muted-foreground">暂无任务</p>}
          {active.length > 0 && (
            <ul className="divide-y divide-border" aria-label="待处理和处理中的任务">
              {active.map(task => <TaskItem key={task.taskId} task={task} onCancel={onCancel} onRemove={onRemove} onArticleClick={openArticle} />)}
            </ul>
          )}
          {history.length > 0 && (
            <section aria-label="历史记录" className={active.length ? "mt-3" : undefined}>
              <h3 className="pb-1 text-xs text-muted-foreground">历史记录</h3>
              <ul className="divide-y divide-border">
                {history.map(task => <TaskItem key={task.taskId} task={task} onCancel={onCancel} onRemove={onRemove} onArticleClick={openArticle} />)}
              </ul>
            </section>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TaskItem({ task, onCancel, onRemove, onArticleClick }: {
  task: ArticleTask;
  onCancel: TaskDropdownProps["onCancel"];
  onRemove: TaskDropdownProps["onRemove"];
  onArticleClick: TaskDropdownProps["onArticleClick"];
}) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(false);
  const active = isActiveTask(task);
  const resultId = task.result?.article_id;
  const articleTitle = task.sourceTitle || (task.status !== "completed" ? task.result?.title : undefined);
  const type = task.task_type === "translate_article" ? "翻译文章" : task.task_type === "generate_article" ? "生成文章" : "任务";

  const cancel = async () => {
    setCancelling(true);
    setCancelError(false);
    try {
      await onCancel(task.taskId);
    } catch {
      setCancelError(true);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <li className="py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-sm font-medium">{type}</span>
          <span className="text-xs text-muted-foreground">{statusLabels[task.status]}</span>
        </div>
        {active ? (
          <button type="button" disabled={cancelling} onClick={cancel} className={`${actionStyle} shrink-0`}>
            {cancelling ? "取消中…" : "取消"}
          </button>
        ) : (
          <button type="button" onClick={() => onRemove(task.taskId)} className={actionStyle} aria-label="移除任务记录">
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {articleTitle && <p className="break-words text-xs text-muted-foreground">{articleTitle}</p>}
      {task.status === "running" && task.total > 0 && (
        <div className="mt-1 text-xs text-muted-foreground">
          <progress className="block h-1.5 w-full accent-primary" value={task.progress} max={task.total} aria-label="处理进度" />
          <p className="mt-1">{task.currentStep || `已处理 ${task.progress}/${task.total}`}</p>
        </div>
      )}
      {task.status === "completed" && resultId && (
        <button type="button" onClick={() => onArticleClick(resultId)} className="mt-1 flex gap-1 rounded-sm text-left text-xs text-primary hover:underline focus-visible:outline focus-visible:outline-ring">
          <FileText className="size-3 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{task.result?.title || "查看文章"}</span>
        </button>
      )}
      {task.status === "failed" && task.error && <p className="mt-1 break-words text-xs text-muted-foreground">{task.error}</p>}
      {cancelError && <p role="alert" className="mt-1 text-xs text-muted-foreground">取消失败，请重试。</p>}
      <time dateTime={task.createdAt} className="mt-1 block text-xs tabular-nums text-muted-foreground">
        {new Date(task.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
      </time>
    </li>
  );
}

"use client";

import { isAxiosError } from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export interface ArticleTask {
  taskId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  total: number;
  currentStep?: string;
  createdAt: string;
  result?: { article_id?: string; title?: string };
  error?: string;
  task_type?: string;
  sourceTitle?: string;
}

const STORAGE_KEY = "muses_tasks";
const taskPath = (id: string) => `/api/articles/tasks/${encodeURIComponent(id)}`;

export const isActiveTask = (task: ArticleTask) => task.status === "pending" || task.status === "running";

export function useArticleTasks(enabled: boolean) {
  const [tasks, setTasks] = useState<ArticleTask[]>([]);
  const latest = useRef<ArticleTask[]>([]);
  const canPersist = useRef(true);

  const readTasks = useCallback((): ArticleTask[] => {
    if (!canPersist.current) return latest.current;
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      return Array.isArray(stored) ? stored : [];
    } catch {
      return latest.current;
    }
  }, []);

  const updateTasks = useCallback((update: (current: ArticleTask[]) => ArticleTask[]) => {
    const current = readTasks();
    const next = update(current);
    if (next === current) return;
    latest.current = next;
    setTasks(next);
    if (canPersist.current) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        canPersist.current = false;
      }
    }
  }, [readTasks]);

  useEffect(() => {
    if (!enabled) return;
    const sync = () => { latest.current = readTasks(); setTasks(latest.current); };
    const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) sync(); };
    sync();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [enabled, readTasks]);

  const hasActiveTasks = tasks.some(isActiveTask);
  useEffect(() => {
    if (!enabled || !hasActiveTasks) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      const active = readTasks().filter(isActiveTask);
      const updates = await Promise.all(active.map(async (task): Promise<Partial<ArticleTask> | undefined> => {
        try {
          const { data } = await api.get<ArticleTask>(taskPath(task.taskId), { signal: controller.signal });
          return data;
        } catch (error) {
          if (isAxiosError(error) && error.response?.status === 404) {
            return { status: "failed", error: "任务已无法查询，请重新提交" };
          }
          // A connection failure leaves the last known status visible until the next poll.
          return undefined;
        }
      }));
      if (controller.signal.aborted) return;
      const byId = new Map(active.map((task, index) => [task.taskId, updates[index]]));
      updateTasks((current) => {
        const next = current.map((task) => {
          const update = byId.get(task.taskId);
          if (!update || !isActiveTask(task)) return task;
          if (task.status === "running" && (update.status === "pending" ||
            (update.status === "running" && (update.progress ?? 0) < task.progress))) return task;
          return { ...task, ...update };
        });
        return next.some((task, index) => task !== current[index]) ? next : current;
      });
      timer = setTimeout(poll, 2000);
    };

    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [enabled, hasActiveTasks, readTasks, updateTasks]);

  const addTask = useCallback((task: ArticleTask) => {
    updateTasks((current) => [task, ...current.filter(({ taskId }) => taskId !== task.taskId)]);
  }, [updateTasks]);

  const cancelTask = async (taskId: string) => {
    const { data } = await api.post<ArticleTask>(`${taskPath(taskId)}/cancel`);
    updateTasks((current) => current.map((task) => task.taskId === taskId ? { ...task, ...data } : task));
  };

  const removeHistory = (taskId?: string) => {
    updateTasks((current) => current.filter((task) => isActiveTask(task) || (taskId && task.taskId !== taskId)));
  };

  return { tasks: enabled ? tasks : [], addTask, cancelTask, removeHistory };
}

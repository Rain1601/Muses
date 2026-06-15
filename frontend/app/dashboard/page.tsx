"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import { useUserStore } from "@/store/user";
import { NotionEditor } from "@/components/NotionEditor";
import SettingsPanel from "@/components/studio/SettingsPanel";
import PublishHistoryPanel from "@/components/PublishHistoryPanel";
import SkillLibrary from "@/components/SkillLibrary";
import ContextConfigPanel from "@/components/ContextConfigPanel";
import { TaskCenter } from "@/components/TaskCenter";
import { FileImport } from "@/components/FileImport";
import { persistSelection, clearPersistedSelection } from "@/lib/tiptap-extensions/SelectionPersistence";
import { getLineContent } from "@/lib/tiptap-extensions/LineNumbers";
import { isCodeContext, registerSlotRange, unregisterSlotRange, getSlotRange } from "@/lib/tiptap-extensions/PromptSlot";
import { useSlotEngine } from "@/lib/hooks/useSlotEngine";
import { useEditHistory, newEditId } from "@/lib/hooks/useEditHistory";
import CandidatePopover, { type AcceptMode } from "@/components/CandidatePopover";
import SelectionTaskMenu from "@/components/SelectionTaskMenu";
import EditHistoryPanel from "@/components/EditHistoryPanel";
import { createPortal } from "react-dom";
import s from "./dashboard.module.css";

// HTML → Markdown converter (lazy loaded)
const getTurndownService = async () => {
  const TurndownService = (await import("turndown")).default;
  const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  return td;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
// History panel — kept the old localStorage key for migration; widths trimmed
// to roughly match the left sidebar so the editor gets more breathing room.
const CHAT_WIDTH_KEY = "muses-chat-panel-width";
const CHAT_WIDTH_DEFAULT = 280;
const CHAT_WIDTH_MIN = 240;
const CHAT_WIDTH_MAX = 380;

interface FileItem { name: string; path: string; size: number; modified: number; }
interface DBArticle { id: string; title: string; summary?: string; publishStatus: string; publishedAt?: string; githubUrl?: string; createdAt: string; updatedAt: string; }
interface FolderNode { name: string; path: string; files: FileItem[]; folders: FolderNode[]; expanded: boolean; }

export default function Dashboard() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, checkAuth } = useUserStore();
  useEffect(() => { checkAuth(); }, [checkAuth]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, router]);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [dbArticles, setDbArticles] = useState<DBArticle[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("muses-expanded-folders");
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch (_) { return new Set<string>(); }
  });
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [activeDbArticle, setActiveDbArticle] = useState<DBArticle | null>(null);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [markdownContent, setMarkdownContent] = useState("");

  const [selection, setSelection] = useState("");
  const editorRef = useRef<any>(null);
  // Chat panel resizable width
  const [chatWidth, setChatWidth] = useState(CHAT_WIDTH_DEFAULT);
  const isDragging = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(CHAT_WIDTH_KEY);
    if (saved) {
      const w = parseInt(saved, 10);
      if (w >= CHAT_WIDTH_MIN && w <= CHAT_WIDTH_MAX) setChatWidth(w);
    }
  }, []);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = Math.min(CHAT_WIDTH_MAX, Math.max(CHAT_WIDTH_MIN, window.innerWidth - ev.clientX));
      setChatWidth(newWidth);
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      // save to localStorage on release
      setChatWidth(w => { localStorage.setItem(CHAT_WIDTH_KEY, String(w)); return w; });
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const handleSelectionChange = useCallback(async (text: string, from?: number, to?: number) => {
    if (text.trim()) {
      setSelection(text);
    }
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelection("");
    if (editorRef.current) clearPersistedSelection(editorRef.current);
  }, []);

  const [creating, setCreating] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creatingInFolder, setCreatingInFolder] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [fileMenuOpen, setFileMenuOpen] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"article" | "agent" | "skill">("article");

  // ── URL hash <-> sidebarTab 双向同步 ──
  // /dashboard#article / #agent / #skill 直达，浏览器前进/后退也跟着切
  const goToTab = useCallback((tab: "article" | "agent" | "skill") => {
    setSidebarTab(tab);
    if (typeof window !== "undefined" && window.location.hash !== `#${tab}`) {
      history.pushState(null, "", `#${tab}`);
    }
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const valid = ["article", "agent", "skill"] as const;
    const apply = () => {
      const h = window.location.hash.slice(1);
      if ((valid as readonly string[]).includes(h)) {
        setSidebarTab(h as typeof valid[number]);
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const darkMode = true; // Dark-only UI — warm minimalist design
  const [showSettings, setShowSettings] = useState(false);
  const [showPublishHistory, setShowPublishHistory] = useState(false);
  const [showTaskCenter, setShowTaskCenter] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [articleMenuOpen, setArticleMenuOpen] = useState<string | null>(null);
  // Menu anchor — fixed position relative to click point (right-click or ··· button)
  const [articleMenuAnchor, setArticleMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  const [confirmDeleteArticle, setConfirmDeleteArticle] = useState<string | null>(null);
  const [renamingArticleId, setRenamingArticleId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // ⌘K quick switcher state
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const [qsQuery, setQsQuery] = useState("");
  const [qsIndex, setQsIndex] = useState(0);
  const [showTranslate, setShowTranslate] = useState(false);
  const [translateLang, setTranslateLang] = useState("en");
  const [translateMode, setTranslateMode] = useState<"translated" | "bilingual">("translated");
  const [translating, setTranslating] = useState(false);
  const [hasRunningTasks, setHasRunningTasks] = useState(false);
  const [publishingFile, setPublishingFile] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const translatePopoverRef = useRef<HTMLDivElement>(null);
  const runningTaskIdsRef = useRef<Set<string>>(new Set());
  const createInputRef = useRef<HTMLInputElement>(null);

  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef(content);
  const savedContentRef = useRef(savedContent);
  contentRef.current = content;
  savedContentRef.current = savedContent;

  // ===== Theme (dark-only) =====
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // ===== Running tasks indicator + completion notifications =====
  // Note: We dispatch a custom event when articles need reloading instead of
  // calling loadDbArticles directly, because loadDbArticles is defined later
  // (useCallback hoisting / TDZ).
  useEffect(() => {
    const check = () => {
      try {
        const raw = localStorage.getItem("muses_tasks");
        if (!raw) { setHasRunningTasks(false); runningTaskIdsRef.current = new Set(); return; }
        const tasks: any[] = JSON.parse(raw);
        setHasRunningTasks(tasks.some(t => t.status === "pending" || t.status === "running"));

        const currentRunning = new Set<string>(
          tasks.filter(t => t.status === "pending" || t.status === "running").map(t => t.taskId)
        );
        for (const id of runningTaskIdsRef.current) {
          if (currentRunning.has(id)) continue;
          const t = tasks.find(x => x.taskId === id);
          if (!t) continue;
          const isTranslate = t.task_type === "translate_article";
          if (t.status === "completed") {
            const title = t.result?.title || t.article_id || "";
            setPublishStatus({
              type: "success",
              msg: isTranslate ? `翻译完成${title ? `: ${title}` : ""}` : `任务完成${title ? `: ${title}` : ""}`,
            });
            setTimeout(() => setPublishStatus(null), 5000);
            window.dispatchEvent(new Event("muses-articles-changed"));
          } else if (t.status === "failed") {
            setPublishStatus({
              type: "error",
              msg: (isTranslate ? "翻译失败: " : "任务失败: ") + (t.error || "未知错误"),
            });
            setTimeout(() => setPublishStatus(null), 6000);
          }
        }
        runningTaskIdsRef.current = currentRunning;
      } catch { setHasRunningTasks(false); }
    };
    check();
    const interval = setInterval(check, 2000);
    const onUpdate = () => check();
    window.addEventListener("muses-task-update", onUpdate);
    return () => { clearInterval(interval); window.removeEventListener("muses-task-update", onUpdate); };
  }, []);

  // ===== Click outside closes translate popover =====
  useEffect(() => {
    if (!showTranslate) return;
    const handler = (e: MouseEvent) => {
      if (translatePopoverRef.current && !translatePopoverRef.current.contains(e.target as Node)) {
        setShowTranslate(false);
      }
    };
    setTimeout(() => window.addEventListener("click", handler), 0);
    return () => window.removeEventListener("click", handler);
  }, [showTranslate]);

  // ===== Trigger translation =====
  const doTranslate = useCallback(async () => {
    if (!activeDbArticle) return;
    setTranslating(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/articles/${activeDbArticle.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetLanguage: translateLang, mode: translateMode }),
      });
      const result = await res.json();
      if (res.ok && result.taskId) {
        try {
          const raw = localStorage.getItem("muses_tasks");
          const tasks = raw ? JSON.parse(raw) : [];
          const now = new Date().toISOString();
          tasks.unshift({
            taskId: result.taskId,
            status: result.status || "pending",
            progress: 0,
            total: 0,
            createdAt: now,
            updatedAt: now,
            task_type: "translate_article",
            article_id: activeDbArticle.id,
            target_language: translateLang,
            mode: translateMode,
            result: { article_id: activeDbArticle.id, title: activeDbArticle.title },
          });
          localStorage.setItem("muses_tasks", JSON.stringify(tasks));
          window.dispatchEvent(new Event("muses-task-update"));
        } catch (e) { console.warn("Failed to record task:", e); }
        setPublishStatus({ type: "info", msg: "翻译任务已启动 — 在任务中心查看进度" });
        setTimeout(() => setPublishStatus(null), 3500);
        setShowTranslate(false);
      } else {
        setPublishStatus({ type: "error", msg: result.detail || "翻译启动失败" });
        setTimeout(() => setPublishStatus(null), 3500);
      }
    } catch (e: any) {
      setPublishStatus({ type: "error", msg: e.message || "翻译启动失败" });
      setTimeout(() => setPublishStatus(null), 3500);
    } finally {
      setTranslating(false);
    }
  }, [activeDbArticle, translateLang]);

  // ===== File operations =====
  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/studio/files`);
      const data = await res.json();
      setFiles(data.files || []);
      setFolders(data.folders || []);
    } catch (e) { console.error("Load files failed:", e); }
  }, []);

  // ===== DB Articles =====
  const loadDbArticles = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/articles?page_size=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDbArticles(data.articles || []);
    } catch (e) { console.error("Load DB articles failed:", e); }
  }, []);

  useEffect(() => { loadFiles(); loadDbArticles(); }, [loadFiles, loadDbArticles]);

  // Refresh DB article list when a background task completes (translation, import, etc.)
  useEffect(() => {
    const handler = () => loadDbArticles();
    window.addEventListener("muses-articles-changed", handler);
    return () => window.removeEventListener("muses-articles-changed", handler);
  }, [loadDbArticles]);

  // ===== Publish =====
  const publishFile = useCallback(async (filePath: string) => {
    setPublishingFile(filePath);
    setPublishStatus(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) { setPublishStatus({ type: "error", msg: "请先登录" }); return; }

      // Get user settings for default repo
      const profileRes = await fetch(`${API_BASE}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profile = await profileRes.json();
      const repoUrl = profile.defaultRepoUrl;
      if (!repoUrl) { setPublishStatus({ type: "error", msg: "请先在 Settings 中配置默认发布仓库" }); return; }

      // Read file content
      const fileRes = await fetch(`${API_BASE}/api/studio/files/${filePath}`);
      const fileData = await fileRes.json();
      const content = fileData.content || "";

      // Generate file path in repo
      const now = new Date();
      const slug = filePath.replace(/\.md$/, "").replace(/\//g, "-");
      const repoFilePath = `posts/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${slug}.md`;

      const res = await fetch(`${API_BASE}/api/publish/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          repoUrl,
          filePath: repoFilePath,
          commitMessage: `publish: ${filePath}`,
          content,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setPublishStatus({ type: "success", msg: "发布成功" });
        loadDbArticles();
      } else {
        setPublishStatus({ type: "error", msg: result.detail || "发布失败" });
      }
    } catch (e: any) {
      setPublishStatus({ type: "error", msg: e.message || "发布失败" });
    } finally {
      setPublishingFile(null);
      setTimeout(() => setPublishStatus(null), 3000);
    }
  }, [loadDbArticles]);

  const toggleFolder = useCallback((folder: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder); else next.add(folder);
      localStorage.setItem("muses-expanded-folders", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const openFile = useCallback(async (filePath: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/studio/files/${filePath}`);
      const data = await res.json();
      const md = data.content || "";
      const htmlContent = await marked(md);
      setActiveFile(filePath);
      setActiveDbArticle(null);
      setContent(htmlContent);
      setSavedContent(htmlContent);
      setMarkdownContent(md);
      setSelection("");
      setShowSettings(false);
    } catch (e) { console.error("Open file failed:", e); }
  }, []);

  const openDbArticle = useCallback(async (article: DBArticle) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/articles/${article.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const rawContent = data.article?.content || "";
      // DB articles may store HTML or markdown — detect and normalize
      const isHtml = /<[a-z][\s\S]*>/i.test(rawContent);
      let md: string;
      let htmlContent: string;
      if (isHtml) {
        // Content is HTML — convert to markdown for diff, use as-is for editor
        const td = await getTurndownService();
        md = td.turndown(rawContent);
        htmlContent = rawContent;
      } else {
        // Content is markdown
        md = rawContent;
        htmlContent = await marked(md);
      }
      setActiveFile(null);
      setActiveDbArticle(article);
      setContent(htmlContent);
      setSavedContent(htmlContent);
      setMarkdownContent(md);
      setSelection("");
      setShowSettings(false);
    } catch (e) { console.error("Open DB article failed:", e); }
  }, []);

  const saveFile = useCallback(async (htmlContent?: string) => {
    const html = htmlContent ?? contentRef.current;
    try {
      if (activeDbArticle) {
        // Save DB article via API
        const token = localStorage.getItem("token");
        if (!token) return;
        await fetch(`${API_BASE}/api/articles/${activeDbArticle.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ content: html }),
        });
        setSavedContent(html);
      } else if (activeFile) {
        // Save Studio file
        const td = await getTurndownService();
        const markdown = td.turndown(html);
        await fetch(`${API_BASE}/api/studio/files/${activeFile}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: markdown }),
        });
        setSavedContent(html);
      }
    } catch (e) { console.error("Save failed:", e); }
  }, [activeFile, activeDbArticle]);

  const createFile = useCallback(async (name: string) => {
    const filename = name.endsWith(".md") ? name : `${name}.md`;
    // If creating inside a folder context, prefix with folder path
    const fullPath = creatingInFolder ? `${creatingInFolder}/${filename}` : filename;
    try {
      await fetch(`${API_BASE}/api/studio/files/${fullPath}`, { method: "POST" });
      await loadFiles();
      openFile(fullPath);
    } catch (e) { console.error("Create failed:", e); }
  }, [loadFiles, openFile]);

  const createFolder = useCallback(async (name: string) => {
    try {
      await fetch(`${API_BASE}/api/studio/folders/${name}`, { method: "POST" });
      await loadFiles();
      setExpandedFolders(prev => {
        const next = new Set(prev);
        next.add(name);
        localStorage.setItem("muses-expanded-folders", JSON.stringify([...next]));
        return next;
      });
    } catch (e) { console.error("Create folder failed:", e); }
  }, [loadFiles]);

  const deleteFile = useCallback(async (filePath: string) => {
    try {
      await fetch(`${API_BASE}/api/studio/files/${filePath}`, { method: "DELETE" });
      if (activeFile === filePath) {
        setActiveFile(null);
        setContent("");
        setSavedContent("");
      }
      await loadFiles();
      setConfirmDelete(null);
      setFileMenuOpen(null);
    } catch (e) { console.error("Delete failed:", e); }
  }, [activeFile, loadFiles]);

  // ===== Auto-save =====
  useEffect(() => {
    if (!activeFile) return;
    autoSaveRef.current = setInterval(() => {
      if (contentRef.current !== savedContentRef.current) saveFile();
    }, 3000);
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [activeFile, saveFile]);

  // Close file menu on outside click
  useEffect(() => {
    if (!fileMenuOpen) return;
    const handler = () => setFileMenuOpen(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [fileMenuOpen]);

  // Close article menu on outside click
  useEffect(() => {
    if (!articleMenuOpen) return;
    const handler = () => { setArticleMenuOpen(null); setArticleMenuAnchor(null); };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [articleMenuOpen]);

  // ===== Notion-style keyboard shortcuts =====
  // Helper: are we currently editing inside an input or the TipTap editor?
  const isTypingTarget = (el: EventTarget | null): boolean => {
    if (!(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable) return true;
    if (el.closest(".ProseMirror")) return true;
    return false;
  };

  // ===== Article actions: rename / duplicate / delete =====
  const renameArticle = useCallback(async (articleId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) { setRenamingArticleId(null); setRenameValue(""); return; }
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await fetch(`${API_BASE}/api/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: trimmed }),
      });
      loadDbArticles();
      // Refresh active article if it was the one renamed
      if (activeDbArticle?.id === articleId) {
        setActiveDbArticle({ ...activeDbArticle, title: trimmed });
      }
    } catch (e) { console.error("Rename article failed:", e); }
    finally { setRenamingArticleId(null); setRenameValue(""); }
  }, [activeDbArticle, loadDbArticles]);

  const duplicateArticle = useCallback(async (article: DBArticle) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      // Get full article content
      const detailRes = await fetch(`${API_BASE}/api/articles/${article.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const detail = await detailRes.json();
      const src = detail.article || {};
      const cloneRes = await fetch(`${API_BASE}/api/articles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: `${article.title} (副本)`,
          content: src.content || "",
          summary: src.summary || "",
          agentId: src.agentId,
        }),
      });
      if (cloneRes.ok) {
        setPublishStatus({ type: "success", msg: "已创建副本" });
        setTimeout(() => setPublishStatus(null), 2500);
        loadDbArticles();
      } else {
        const data = await cloneRes.json().catch(() => ({}));
        setPublishStatus({ type: "error", msg: data.detail || "复制失败" });
        setTimeout(() => setPublishStatus(null), 3000);
      }
    } catch (e: any) {
      setPublishStatus({ type: "error", msg: e.message || "复制失败" });
      setTimeout(() => setPublishStatus(null), 3000);
    }
  }, [loadDbArticles]);

  const deleteArticle = useCallback(async (articleId: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/articles/${articleId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        if (activeDbArticle?.id === articleId) {
          setActiveDbArticle(null);
          setContent(""); setSavedContent(""); setMarkdownContent("");
        }
        setPublishStatus({ type: "success", msg: "文章已删除" });
        setTimeout(() => setPublishStatus(null), 2500);
        loadDbArticles();
      } else {
        const data = await res.json().catch(() => ({}));
        setPublishStatus({ type: "error", msg: data.detail || "删除失败" });
        setTimeout(() => setPublishStatus(null), 3000);
      }
    } catch (e: any) {
      setPublishStatus({ type: "error", msg: e.message || "删除失败" });
      setTimeout(() => setPublishStatus(null), 3000);
    } finally {
      setConfirmDeleteArticle(null);
      setArticleMenuOpen(null);
    }
  }, [activeDbArticle, loadDbArticles]);

  // ===== Keyboard shortcuts =====
  // ⌘K is owned by the new selection-task system (see capture-phase handler
  // below). The legacy "⌘K → persist selection → focus chat input" behavior
  // was removed in favor of the inline task creator.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); saveFile(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveFile]);

  // ===== Notion-style keyboard shortcuts =====
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inEditor = isTypingTarget(e.target);

      // ⌘P — quick switcher (Notion: Quick Find). Always intercept browser Print.
      if ((e.metaKey || e.ctrlKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setQuickSwitcherOpen(true);
        setQsQuery("");
        setQsIndex(0);
        return;
      }

      // ⌘⇧N — new article.
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        goToTab("article");
        startCreateFile();
        return;
      }

      // Row-level shortcuts only when not typing.
      if (inEditor) return;

      // Esc — close quick switcher / cancel rename / close menus.
      if (e.key === "Escape") {
        if (quickSwitcherOpen) { e.preventDefault(); setQuickSwitcherOpen(false); return; }
        if (renamingArticleId) { e.preventDefault(); setRenamingArticleId(null); setRenameValue(""); return; }
        if (articleMenuOpen) { e.preventDefault(); setArticleMenuOpen(null); setArticleMenuAnchor(null); return; }
      }

      // Per-article actions on the currently-active article.
      if (!activeDbArticle) return;
      if (e.key === "F2") {
        e.preventDefault();
        setRenamingArticleId(activeDbArticle.id);
        setRenameValue(activeDbArticle.title);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        // Only Del (not Backspace) — Backspace too easy to mistrigger
        if (e.key === "Delete") {
          e.preventDefault();
          setConfirmDeleteArticle(activeDbArticle.id);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        duplicateArticle(activeDbArticle);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [quickSwitcherOpen, renamingArticleId, articleMenuOpen, activeDbArticle, duplicateArticle]);

  useEffect(() => { if (creating && createInputRef.current) createInputRef.current.focus(); }, [creating]);

  const handleCreateSubmit = () => {
    const name = newFileName.trim();
    if (name) {
      if (creatingFolder) {
        const folderPath = creatingInFolder ? `${creatingInFolder}/${name}` : name;
        createFolder(folderPath);
      } else {
        createFile(name);
      }
    }
    setNewFileName("");
    setCreating(false);
    setCreatingFolder(false);
    setCreatingInFolder(null);
  };

  const startCreateFile = (inFolder?: string) => {
    setCreating(true);
    setCreatingFolder(false);
    setCreatingInFolder(inFolder || null);
  };

  const startCreateFolder = (inFolder?: string) => {
    setCreating(true);
    setCreatingFolder(true);
    setCreatingInFolder(inFolder || null);
  };

  // Mirror the editor instance into React state so hooks (useSlotEngine, ⌘K) can react.
  const [editorState, setEditorState] = useState<any>(null);
  const handleEditorReady = useCallback((editor: any) => {
    editorRef.current = editor;
    setEditorState(editor);
  }, []);

  // ===== Prompt-driven task system (brackets + ⌘K selection) =====
  // 中文写作场景下默认走 DeepSeek 直连（OpenAI 兼容,环境变量 DEEPSEEK_API_KEY）。
  // 旧的 local:claude / sonnet 仍可在配置中切换，但默认不再启动本地 Claude CLI。
  const slotEngine = useSlotEngine(editorState, {
    provider: "deepseek",
    model: "deepseek-chat",
    autoFireBrackets: true,
  });
  // Stable accessor used by the SlotDecorations plugin to read the map.
  const slotEngineRef = useRef(slotEngine);
  useEffect(() => { slotEngineRef.current = slotEngine; }, [slotEngine]);
  const getSlotState = useCallback(() => slotEngineRef.current.getStateRef(), []);

  // ===== AI edit history (per article) =====
  // Keyed by the live article id; switching articles loads its own log.
  const editHistory = useEditHistory(activeDbArticle?.id ?? activeFile ?? "untitled");

  // Force decoration re-render when slot map changes (dispatch a no-op tx).
  useEffect(() => {
    if (!editorState) return;
    editorState.view.dispatch(editorState.view.state.tr.setMeta("slot-redraw", true));
  }, [slotEngine.slots, editorState]);

  // Open candidate popover.
  const [openSlot, setOpenSlot] = useState<{
    key: string;
    anchor: { top: number; left: number };
    headerText: string;
    isSelectionTask: boolean;
  } | null>(null);

  // Selection-task menu state.
  const [selMenu, setSelMenu] = useState<{
    anchor: { top: number; left: number };
    selectedText: string;
    range: { from: number; to: number };
  } | null>(null);

  // Click handler on slot status dots — open candidate popover.
  useEffect(() => {
    if (!editorState) return;
    const root = editorState.view.dom;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const dot = t.closest("[data-slot-key]") as HTMLElement | null;
      if (!dot) return;
      const key = dot.getAttribute("data-slot-key") || "";
      const isSelectionTask = !!getSlotRange(editorState.view, key);
      const slot = slotEngineRef.current?.slots.get(key);
      const rect = dot.getBoundingClientRect();
      setOpenSlot({
        key,
        anchor: {
          top: rect.bottom + 6,
          left: Math.min(window.innerWidth - 440, rect.left - 12),
        },
        headerText: isSelectionTask ? (slot?.instruction ?? key) : key,
        isSelectionTask,
      });
      e.stopPropagation();
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [editorState]);

  // ⌘K with a selection → open SelectionTaskMenu. When there's no selection,
  // fall through to the legacy behavior (focus chat with current selection).
  // We intercept at capture phase so we win over the existing keydown listener.
  useEffect(() => {
    if (!editorState) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "k") return;
      const { from, to } = editorState.state.selection;
      if (from === to) return;  // no selection → let existing chat-focus handler win
      const text = editorState.state.doc.textBetween(from, to, " ");
      if (!text.trim()) return;
      e.preventDefault();
      e.stopPropagation();
      const coords = editorState.view.coordsAtPos(to);
      setSelMenu({
        anchor: {
          top: Math.min(window.innerHeight - 360, coords.bottom + 8),
          left: Math.min(window.innerWidth - 380, coords.left),
        },
        selectedText: text,
        range: { from, to },
      });
    };
    // Capture phase ensures this fires before the existing dashboard ⌘K listener.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [editorState]);

  // Submit a selection task: stash range + instruction on the slot, fire backend.
  // Submit a selection task: register the range with the plugin (so the
  // inline decoration tracks it through later edits) and fire the backend.
  // The popover does NOT auto-open — user clicks the green dot when ready.
  const submitSelectionTask = useCallback(async (input: { instruction: string; selectedText: string }) => {
    if (!editorState || !selMenu) return;
    const key = `sel:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { range } = selMenu;
    const fullText = editorState.getText();
    const occIdx = fullText.indexOf(input.selectedText);
    const CTX = 400;
    const ctxFrom = occIdx >= 0 ? occIdx : 0;
    const ctxTo = occIdx >= 0 ? occIdx + input.selectedText.length : 0;
    const before = fullText.slice(Math.max(0, ctxFrom - CTX), ctxFrom);
    const after = fullText.slice(ctxTo, Math.min(fullText.length, ctxTo + CTX));

    registerSlotRange(editorState.view, key, range.from, range.to);
    slotEngine.updateSlot(key, {
      status: "pending",
      range,
      originalText: input.selectedText,
      instruction: input.instruction,
    });
    setSelMenu(null);

    const prompt = `${input.instruction}\n\n原文：\n${input.selectedText}`;
    await slotEngine.fireSlot(key, { prompt, contextBefore: before, contextAfter: after });
  }, [editorState, selMenu, slotEngine]);

  // Accept handler — replace bracket / selection with chosen text (with AiSource mark
  // carrying a fresh editId), and log a history record for revert.
  const acceptForSlot = useCallback((key: string, text: string, mode: AcceptMode) => {
    if (!editorState) return;
    const editId = newEditId();
    const slot = slotEngine.slots.get(key);
    const cand = slot?.candidates?.find(c => c.text === text);
    const tracked = getSlotRange(editorState.view, key);

    if (tracked) {
      // Selection task.
      const { from, to } = tracked;
      const originalText = mode === "replace"
        ? editorState.state.doc.textBetween(from, to, " ")
        : "";
      if (mode === "replace") {
        editorState.chain().focus()
          .insertContentAt({ from, to }, [
            { type: "text", text, marks: [{ type: "aiSource", attrs: { editId } }] },
          ])
          .run();
      } else {
        // Mark BOTH the leading space and the AI text so revert removes them together.
        editorState.chain().focus()
          .insertContentAt(to, [
            { type: "text", text: " ", marks: [{ type: "aiSource", attrs: { editId } }] },
            { type: "text", text, marks: [{ type: "aiSource", attrs: { editId } }] },
          ])
          .run();
      }
      unregisterSlotRange(editorState.view, key);
      editHistory.addRecord({
        source: "selection",
        instruction: slot?.instruction,
        originalText: originalText || (slot?.originalText ?? ""),
        newText: text,
        mode,
        model: cand?.model,
        costUsd: cand?.cost_usd ?? undefined,
      });
    } else {
      // Bracket slot — find 【key】 by content + replace.
      let from = -1, to = -1;
      editorState.state.doc.descendants((node: any, pos: number, parent: any) => {
        if (!node.isText || !node.text) return;
        if (isCodeContext(node, parent)) return;
        const idx = node.text.indexOf(`【${key}】`);
        if (idx !== -1 && from === -1) {
          from = pos + idx;
          to = from + key.length + 2;
          return false;
        }
      });
      if (from === -1) return;
      editorState.chain().focus()
        .insertContentAt({ from, to }, [
          { type: "text", text, marks: [{ type: "aiSource", attrs: { editId } }] },
        ])
        .run();
      editHistory.addRecord({
        source: "bracket",
        promptKey: key,
        originalText: `【${key}】`,
        newText: text,
        mode: "replace",
        model: cand?.model,
        costUsd: cand?.cost_usd ?? undefined,
      });
    }
    slotEngine.clearSlot(key);
    setOpenSlot(null);
  }, [editorState, slotEngine, editHistory]);

  // Revert a logged AI edit by finding the matching AiSource span (by editId
  // attribute) and either restoring the original text or deleting the span.
  const revertEdit = useCallback((id: string) => {
    if (!editorState) return;
    const rec = editHistory.records.find(r => r.id === id);
    if (!rec || rec.reverted) return;

    // Collect contiguous runs whose aiSource mark carries this editId.
    const ranges: { from: number; to: number }[] = [];
    let curStart = -1, curEnd = -1;
    editorState.state.doc.descendants((node: any, pos: number) => {
      if (!node.isText || !node.text) return;
      const m = node.marks?.find((mk: any) => mk.type.name === "aiSource" && mk.attrs.editId === id);
      const nodeFrom = pos;
      const nodeTo = pos + node.nodeSize;
      if (m) {
        if (curStart === -1) { curStart = nodeFrom; curEnd = nodeTo; }
        else if (nodeFrom === curEnd) { curEnd = nodeTo; }
        else { ranges.push({ from: curStart, to: curEnd }); curStart = nodeFrom; curEnd = nodeTo; }
      } else if (curStart !== -1) {
        ranges.push({ from: curStart, to: curEnd });
        curStart = -1; curEnd = -1;
      }
    });
    if (curStart !== -1) ranges.push({ from: curStart, to: curEnd });

    if (ranges.length === 0) {
      // Span already gone (user manually deleted). Mark as reverted in the log
      // anyway since there's nothing left to undo.
      editHistory.markReverted(id);
      return;
    }

    if (rec.mode === "replace") {
      // Replace the bounding extent with original text — single chain step.
      const from = ranges[0].from;
      const to = ranges[ranges.length - 1].to;
      editorState.chain().focus()
        .insertContentAt({ from, to }, [{ type: "text", text: rec.originalText, marks: [] }])
        .run();
    } else {
      // Append — delete the marked spans, in reverse order so positions stay valid.
      let chain = editorState.chain().focus();
      for (let i = ranges.length - 1; i >= 0; i--) {
        chain = chain.deleteRange(ranges[i]);
      }
      chain.run();
    }
    editHistory.markReverted(id);
  }, [editorState, editHistory]);

  const regenerateForSlot = useCallback(async (key: string) => {
    const st = slotEngine.slots.get(key);
    if (!editorState || !st) return;
    const fullText = editorState.getText();
    const CTX = 500;
    if (st.instruction && st.originalText) {
      const occIdx = fullText.indexOf(st.originalText);
      const ctxFrom = occIdx >= 0 ? occIdx : 0;
      const ctxTo = occIdx >= 0 ? occIdx + st.originalText.length : 0;
      const before = fullText.slice(Math.max(0, ctxFrom - CTX), ctxFrom);
      const after = fullText.slice(ctxTo, Math.min(fullText.length, ctxTo + CTX));
      const prompt = `${st.instruction}\n\n原文：\n${st.originalText}`;
      await slotEngine.fireSlot(key, { prompt, contextBefore: before, contextAfter: after });
    } else {
      const occIdx = fullText.indexOf(`【${key}】`);
      const ctxFrom = occIdx >= 0 ? occIdx : 0;
      const ctxTo = occIdx >= 0 ? occIdx + key.length + 2 : 0;
      const before = fullText.slice(Math.max(0, ctxFrom - CTX), ctxFrom);
      const after = fullText.slice(ctxTo, Math.min(fullText.length, ctxTo + CTX));
      await slotEngine.fireSlot(key, { prompt: key, contextBefore: before, contextAfter: after });
    }
  }, [editorState, slotEngine]);

  const discardSlot = useCallback((key: string) => {
    if (editorState && getSlotRange(editorState.view, key)) {
      unregisterSlotRange(editorState.view, key);
    }
    slotEngine.clearSlot(key);
    setOpenSlot(null);
  }, [editorState, slotEngine]);

  const openSlotState = openSlot ? slotEngine.slots.get(openSlot.key) : undefined;

  // Show nothing while checking auth (prevents flash before redirect)
  if (isLoading || !isAuthenticated) {
    return <div className={s.shell} />;
  }

  // Filtered articles for quick switcher (case-insensitive substring on title)
  const qsResults = (() => {
    const q = qsQuery.trim().toLowerCase();
    if (!q) return dbArticles.slice(0, 20);
    return dbArticles.filter(a => a.title.toLowerCase().includes(q)).slice(0, 20);
  })();

  return (
    <div className={s.shell}>
      {/* Selection task menu (⌘K) */}
      {selMenu && typeof window !== "undefined" && createPortal(
        <SelectionTaskMenu
          anchor={selMenu.anchor}
          selectedText={selMenu.selectedText}
          onSubmit={submitSelectionTask}
          onClose={() => setSelMenu(null)}
        />,
        document.body,
      )}
      {/* Candidate popover (bracket + selection tasks share this) */}
      {openSlot && openSlotState && typeof window !== "undefined" && createPortal(
        <CandidatePopover
          slotKey={openSlot.key}
          state={openSlotState}
          anchor={openSlot.anchor}
          headerText={openSlot.headerText}
          hasAppendMode={openSlot.isSelectionTask}
          onAccept={(text, mode) => acceptForSlot(openSlot.key, text, mode)}
          onRegenerate={() => regenerateForSlot(openSlot.key)}
          onDiscard={() => discardSlot(openSlot.key)}
          onClose={() => setOpenSlot(null)}
        />,
        document.body,
      )}
      {/* Quick switcher (⌘P) — Notion-style article finder */}
      {quickSwitcherOpen && (
        <div className={s.qsBackdrop} onClick={() => setQuickSwitcherOpen(false)}>
          <div className={s.qsPanel} onClick={e => e.stopPropagation()}>
            <div className={s.qsSearchRow}>
              <svg className={s.qsSearchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                autoFocus
                className={s.qsSearchInput}
                placeholder="Find an article…"
                value={qsQuery}
                onChange={e => { setQsQuery(e.target.value); setQsIndex(0); }}
                onKeyDown={e => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setQsIndex(i => Math.min(qsResults.length - 1, i + 1)); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setQsIndex(i => Math.max(0, i - 1)); }
                  else if (e.key === "Enter") {
                    e.preventDefault();
                    const target = qsResults[qsIndex];
                    if (target) {
                      openDbArticle(target);
                      setQuickSwitcherOpen(false);
                    }
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setQuickSwitcherOpen(false);
                  }
                }}
              />
            </div>
            <div className={s.qsList}>
              {qsResults.length === 0 ? (
                <div className={s.qsEmpty}>无匹配文章</div>
              ) : qsResults.map((a, i) => (
                <div
                  key={a.id}
                  className={i === qsIndex ? s.qsItemActive : s.qsItem}
                  onMouseEnter={() => setQsIndex(i)}
                  onClick={() => { openDbArticle(a); setQuickSwitcherOpen(false); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span className={s.qsItemTitle}>{a.title}</span>
                  <span className={s.qsItemBadge}>{a.publishStatus === "published" ? "已发布" : "草稿"}</span>
                </div>
              ))}
            </div>
            <div className={s.qsFooter}>
              <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
              <span><kbd>↵</kbd> open</span>
              <span><kbd>esc</kbd> close</span>
            </div>
          </div>
        </div>
      )}

      {/* Publish history modal */}
      {showPublishHistory && activeDbArticle && (
        <PublishHistoryPanel
          articleId={activeDbArticle.id}
          articleTitle={activeDbArticle.title}
          onClose={() => setShowPublishHistory(false)}
          onChanged={async () => {
            // Re-fetch list; if the active article no longer appears (deleted or unpublished), clear the editor
            try {
              const token = localStorage.getItem("token");
              if (!token) return;
              const res = await fetch(`${API_BASE}/api/articles?page_size=50`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const data = await res.json();
              const articles: DBArticle[] = data.articles || [];
              setDbArticles(articles);
              const stillThere = articles.find(a => a.id === activeDbArticle.id);
              if (!stillThere) {
                setActiveDbArticle(null);
                setContent("");
                setSavedContent("");
                setMarkdownContent("");
              } else {
                setActiveDbArticle(stillThere);
              }
            } catch (e) { console.error("Refresh after publish action failed:", e); }
          }}
        />
      )}
      {/* Task Center */}
      <TaskCenter
        isOpen={showTaskCenter}
        onClose={() => setShowTaskCenter(false)}
        onArticleClick={async (articleId) => {
          setShowTaskCenter(false);
          // Load articles, find by id, open it
          const token = localStorage.getItem("token");
          if (!token) return;
          try {
            const res = await fetch(`${API_BASE}/api/articles/${articleId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.article) openDbArticle(data.article);
          } catch (e) { console.error("Open from task center failed:", e); }
        }}
      />

      {/* File import modal */}
      {showImport && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0, 0, 0, 0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "2rem",
          }}
          onClick={() => setShowImport(false)}
        >
          <div
            style={{
              width: "520px", maxWidth: "100%", maxHeight: "92vh", overflow: "auto",
              background: "#1C1917", border: "1px solid #3F3A36", borderRadius: 12,
              boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <FileImport
              onClose={() => setShowImport(false)}
              onImportComplete={() => loadDbArticles()}
            />
          </div>
        </div>
      )}

      {/* Toast: success / error / info */}
      {publishStatus && (
        <div
          className={publishStatus.type === "success" ? s.toastSuccess : publishStatus.type === "error" ? s.toastError : s.toastSuccess}
          style={publishStatus.type === "info" ? {
            background: "rgba(165, 180, 252, 0.12)",
            border: "1px solid rgba(165, 180, 252, 0.3)",
            color: "#a5b4fc",
          } : undefined}
        >
          {publishStatus.type === "success" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : publishStatus.type === "error" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          )}
          {publishStatus.msg}
        </div>
      )}
      {/* Top bar */}
      <div className={s.topbar}>
        <div className={s.topbarLeft}>
          <img src="/materials/images/icons/logo-muses.svg" alt="Muses" className={s.logoIcon} />
          <span className={s.logo}>Muses</span>
          {sidebarTab === "article" && (
            <>
              <span className={s.breadcrumbSep}>/</span>
              <span className={s.breadcrumbFile}>{activeFile || activeDbArticle?.title || "Studio"}</span>
              {content !== savedContent && <span className={s.unsavedDot}>*</span>}
            </>
          )}
        </div>
        {/* Centered tabs (Claude Cowork style) */}
        <div className={s.topbarCenter}>
          <div className={s.topTabGroup}>
            {(["article", "agent", "skill"] as const).map(tab => (
              <button key={tab} onClick={() => goToTab(tab)} className={sidebarTab === tab ? s.topTabActive : s.topTab}>
                {tab === "article" ? "Article" : tab === "agent" ? "Agent" : "Skill"}
              </button>
            ))}
          </div>
        </div>
        <div className={s.topbarActions}>
          {sidebarTab === "article" && (
            <>
              <button onClick={() => saveFile()} className={s.btnGhost}>Save</button>

              {/* Translate — only enabled for DB articles */}
              <div style={{ position: "relative" }} ref={translatePopoverRef}>
                <button
                  onClick={(e) => { e.stopPropagation(); activeDbArticle && setShowTranslate(v => !v); }}
                  disabled={!activeDbArticle}
                  className={s.iconBtn}
                  title={activeDbArticle ? "翻译这篇文章(异步,任务中心查进度)" : "选中文章后可翻译"}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 8l6 6"/>
                    <path d="M4 14l6-6 2-3"/>
                    <path d="M2 5h12"/>
                    <path d="M7 2h1"/>
                    <path d="M22 22l-5-10-5 10"/>
                    <path d="M14 18h6"/>
                  </svg>
                </button>
                {showTranslate && activeDbArticle && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 100,
                      width: 280, padding: "0.875rem",
                      background: "#1C1917", border: "1px solid #3F3A36", borderRadius: 10,
                      boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                    }}
                  >
                    <div style={{ fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#78716C", marginBottom: "0.5rem", fontWeight: 500 }}>
                      Translate this article
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#A8A29E", marginBottom: "0.75rem", lineHeight: 1.5 }}>
                      异步生成新文章,可在任务中心查看进度。
                    </div>

                    <label style={{ display: "block", fontSize: "0.625rem", letterSpacing: "0.02em", color: "#78716C", marginBottom: "0.375rem" }}>
                      翻译模式
                    </label>
                    <div style={{ display: "flex", gap: 0, background: "#292524", border: "1px solid #3F3A36", borderRadius: 6, padding: 3, marginBottom: "0.75rem" }}>
                      {([
                        { v: "translated", label: "整篇翻译", hint: "纯译文" },
                        { v: "bilingual", label: "双语对照", hint: "原文 + 译文" },
                      ] as const).map(opt => (
                        <button
                          key={opt.v}
                          onClick={() => setTranslateMode(opt.v)}
                          style={{
                            flex: 1,
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                            padding: "0.375rem 0.5rem",
                            borderRadius: 4,
                            border: "none",
                            background: translateMode === opt.v ? "#3F3A36" : "transparent",
                            color: translateMode === opt.v ? "#FAFAF9" : "#78716C",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <span style={{ fontSize: "0.6875rem", fontWeight: 500 }}>{opt.label}</span>
                          <span style={{ fontSize: "0.5625rem", color: translateMode === opt.v ? "#A8A29E" : "#57534E" }}>{opt.hint}</span>
                        </button>
                      ))}
                    </div>

                    <label style={{ display: "block", fontSize: "0.625rem", letterSpacing: "0.02em", color: "#78716C", marginBottom: "0.375rem" }}>
                      目标语言
                    </label>
                    <select
                      value={translateLang}
                      onChange={(e) => setTranslateLang(e.target.value)}
                      style={{
                        width: "100%", background: "#292524", border: "1px solid #3F3A36", borderRadius: 6,
                        padding: "0.4375rem 0.5rem", color: "#FAFAF9", fontSize: "0.75rem",
                        fontFamily: "inherit", outline: "none", marginBottom: "0.75rem",
                      }}
                    >
                      <option value="en">English</option>
                      <option value="zh-CN">简体中文</option>
                      <option value="zh-TW">繁體中文</option>
                      <option value="ja">日本語</option>
                      <option value="ko">한국어</option>
                      <option value="fr">Français</option>
                      <option value="de">Deutsch</option>
                      <option value="es">Español</option>
                    </select>
                    <div style={{ display: "flex", gap: "0.4375rem" }}>
                      <button
                        onClick={doTranslate}
                        disabled={translating}
                        style={{
                          flex: 1, fontSize: "0.6875rem", padding: "0.4375rem 0.75rem", borderRadius: 6,
                          border: "1px solid #D97149", background: "#D97149", color: "white",
                          cursor: translating ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: 500,
                          opacity: translating ? 0.6 : 1,
                        }}
                      >
                        {translating ? "启动中…" : "开始翻译"}
                      </button>
                      <button
                        onClick={() => setShowTranslate(false)}
                        style={{
                          fontSize: "0.6875rem", padding: "0.4375rem 0.75rem", borderRadius: 6,
                          border: "1px solid #3F3A36", background: "transparent", color: "#A8A29E",
                          cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowTaskCenter(true)}
                className={s.iconBtn}
                title="任务中心(翻译等后台任务)"
                style={{ position: "relative" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="8" y="3" width="8" height="4" rx="1"/>
                  <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/>
                  <line x1="9" y1="12" x2="15" y2="12"/>
                  <line x1="9" y1="16" x2="13" y2="16"/>
                </svg>
                {hasRunningTasks && (
                  <span style={{
                    position: "absolute", top: 3, right: 3,
                    width: 6, height: 6, borderRadius: 999,
                    background: "#3b82f6", boxShadow: "0 0 6px rgba(59, 130, 246, 0.6)",
                  }} />
                )}
              </button>
              <button
                onClick={() => activeDbArticle && setShowPublishHistory(true)}
                disabled={!activeDbArticle}
                className={s.btnPrimary}
                title={activeDbArticle ? "发布、同步、下架、删除、翻译" : "选中文章后可发布"}
              >
                Publish
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main */}
      <div className={s.main}>
        {sidebarTab === "agent" ? (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <ContextConfigPanel />
          </div>
        ) : sidebarTab === "skill" ? (
          <SkillLibrary />
        ) : (
        <>
        {/* Sidebar */}
        <div className={sidebarCollapsed ? s.sidebarCollapsed : s.sidebar}>
          {sidebarCollapsed ? (
            /* Collapsed: single expand button */
            <div className={s.collapsedIcons}>
              <button onClick={() => setSidebarCollapsed(false)} className={s.collapsedIconBtn} title="Expand">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          ) : (
            <>
              {/* Sidebar header with collapse + actions */}
              <div className={s.sidebarContent}>
                  <>
                    <div className={s.sidebarSubHeader}>
                      <button onClick={() => setSidebarCollapsed(true)} className={s.sidebarAddBtn} title="Collapse sidebar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                      </button>
                      <span className={s.sidebarLabel}>Explorer</span>
                      <div className={s.sidebarActions}>
                        <button onClick={() => startCreateFile()} className={s.sidebarAddBtn} title="New file">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                        </button>
                        <button onClick={() => startCreateFolder()} className={s.sidebarAddBtn} title="New folder">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
                        </button>
                        <button onClick={() => setShowImport(true)} className={s.sidebarAddBtn} title="Import files (Markdown / Notion zip / URL)">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        </button>
                      </div>
                    </div>
                    <div className={s.sidebarList}>
                      {creating && !creatingInFolder && (
                        <div style={{ padding: "0.25rem 0.5rem" }}>
                          <input
                            ref={createInputRef}
                            value={newFileName}
                            onChange={e => setNewFileName(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleCreateSubmit(); if (e.key === "Escape") { setCreating(false); setCreatingFolder(false); setNewFileName(""); } }}
                            onBlur={handleCreateSubmit}
                            placeholder={creatingFolder ? "folder name" : "filename.md"}
                            className={s.createInput}
                          />
                        </div>
                      )}
                      {folders.filter(f => !f.includes("/")).map(folder => {
                        const isExpanded = expandedFolders.has(folder);
                        const folderFiles = files.filter(f => f.path.startsWith(folder + "/") && !f.path.slice(folder.length + 1).includes("/"));
                        return (
                          <div key={folder}>
                            <button onClick={() => toggleFolder(folder)} className={s.folderItem}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.15s ease", flexShrink: 0 }}>
                                <polyline points="9 18 15 12 9 6"/>
                              </svg>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill={isExpanded ? "#D97149" : "none"} stroke={isExpanded ? "#D97149" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                              </svg>
                              <span className={s.folderName}>{folder}</span>
                              <span className={s.folderCount}>{folderFiles.length}</span>
                            </button>
                            {isExpanded && (
                              <div className={s.folderChildren}>
                                {creating && creatingInFolder === folder && (
                                  <div style={{ padding: "0.25rem 0.5rem 0.25rem 2.25rem" }}>
                                    <input
                                      ref={createInputRef}
                                      value={newFileName}
                                      onChange={e => setNewFileName(e.target.value)}
                                      onKeyDown={e => { if (e.key === "Enter") handleCreateSubmit(); if (e.key === "Escape") { setCreating(false); setCreatingFolder(false); setCreatingInFolder(null); setNewFileName(""); } }}
                                      onBlur={handleCreateSubmit}
                                      placeholder={creatingFolder ? "folder name" : "filename.md"}
                                      className={s.createInput}
                                    />
                                  </div>
                                )}
                                {folderFiles.map(f => (
                                  <div key={f.path} className={s.fileRow} style={{ paddingLeft: "2.25rem" }}>
                                    <button onClick={() => openFile(f.path)} className={activeFile === f.path ? s.fileItemActive : s.fileItem}>
                                      <svg className={s.fileIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                                      <span className={s.fileInfo}>
                                        <span className={s.fileTitle}>{f.name.replace(/\.md$/, "")}</span>
                                        <span className={s.badgeDraft}>草稿</span>
                                      </span>
                                    </button>
                                    <div className={s.fileActions}>
                                      <button onClick={(e) => { e.stopPropagation(); setFileMenuOpen(fileMenuOpen === f.path ? null : f.path); }} className={s.fileActionBtn} title="More">⋯</button>
                                    </div>
                                    {fileMenuOpen === f.path && (
                                      <div className={s.fileMenu}>
                                        <button className={s.fileMenuItem} onClick={() => { openFile(f.path); setFileMenuOpen(null); }}>
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                          Edit
                                        </button>
                                        <button className={s.fileMenuItem} onClick={() => { publishFile(f.path); setFileMenuOpen(null); }} disabled={publishingFile === f.path}>
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                                          {publishingFile === f.path ? "Publishing..." : "Publish"}
                                        </button>
                                        <div className={s.fileMenuDivider} />
                                        <button className={s.fileMenuItemDanger} onClick={() => { setConfirmDelete(f.path); setFileMenuOpen(null); }}>
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                    {confirmDelete === f.path && (
                                      <div className={s.confirmOverlay}>
                                        <span>Delete?</span>
                                        <button className={s.confirmYes} onClick={() => deleteFile(f.path)}>Yes</button>
                                        <button className={s.confirmNo} onClick={() => setConfirmDelete(null)}>No</button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {files.filter(f => !f.path.includes("/")).map(f => (
                        <div key={f.path} className={s.fileRow}>
                          <button onClick={() => openFile(f.path)} className={activeFile === f.path ? s.fileItemActive : s.fileItem}>
                            <svg className={s.fileIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                            <span className={s.fileInfo}>
                              <span className={s.fileTitle}>{f.name.replace(/\.md$/, "")}</span>
                              <span className={s.badgeDraft}>草稿</span>
                            </span>
                          </button>
                          <div className={s.fileActions}>
                            <button onClick={(e) => { e.stopPropagation(); setFileMenuOpen(fileMenuOpen === f.path ? null : f.path); }} className={s.fileActionBtn} title="More">⋯</button>
                          </div>
                          {fileMenuOpen === f.path && (
                            <div className={s.fileMenu}>
                              <button className={s.fileMenuItem} onClick={() => { openFile(f.path); setFileMenuOpen(null); }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Edit
                              </button>
                              <button className={s.fileMenuItem} onClick={() => setFileMenuOpen(null)}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                                Publish
                              </button>
                              <div className={s.fileMenuDivider} />
                              <button className={s.fileMenuItemDanger} onClick={() => { setConfirmDelete(f.path); setFileMenuOpen(null); }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                Delete
                              </button>
                            </div>
                          )}
                          {confirmDelete === f.path && (
                            <div className={s.confirmOverlay}>
                              <span>Delete?</span>
                              <button className={s.confirmYes} onClick={() => deleteFile(f.path)}>Yes</button>
                              <button className={s.confirmNo} onClick={() => setConfirmDelete(null)}>No</button>
                            </div>
                          )}
                        </div>
                      ))}
                      {files.length === 0 && folders.length === 0 && dbArticles.length === 0 && !creating && (
                        <div className={s.emptyState}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3F3A36" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: "0.5rem" }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                            <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                          </svg>
                          <p className={s.emptyTitle}>No articles yet</p>
                          <p className={s.emptyDesc}>Create a file to start writing</p>
                          <button onClick={() => startCreateFile()} className={s.emptyLink}>+ New File</button>
                        </div>
                      )}
                      {files.length === 0 && folders.length === 0 && dbArticles.length > 0 && !creating && (
                        <div className={s.emptyState}>
                          <p className={s.emptyDesc}>No workspace files</p>
                          <button onClick={() => startCreateFile()} className={s.emptyLink}>+ New File</button>
                        </div>
                      )}
                      {/* DB Articles */}
                      {dbArticles.length > 0 && (
                        <>
                          <div className={s.sidebarSubHeader} style={{ marginTop: "0.25rem" }}>
                            <span className={s.sidebarLabel}>Articles</span>
                            <span className={s.folderCount}>{dbArticles.length}</span>
                          </div>
                          {dbArticles.map(a => {
                            const isActive = activeDbArticle?.id === a.id;
                            const openMenuAt = (clientX: number, clientY: number) => {
                              // Clamp so menu stays in viewport
                              const top = Math.min(window.innerHeight - 380, clientY);
                              const left = Math.min(window.innerWidth - 240, clientX);
                              setArticleMenuOpen(a.id);
                              setArticleMenuAnchor({ top, left });
                            };
                            return (
                            <div
                              key={a.id}
                              className={isActive ? s.fileRowActive : s.fileRow}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                openMenuAt(e.clientX, e.clientY);
                              }}
                            >
                              <span className={s.fileBullet}>·</span>
                              {renamingArticleId === a.id ? (
                                <div style={{ flex: 1, padding: "0.25rem 0.4rem" }}>
                                  <input
                                    autoFocus
                                    value={renameValue}
                                    onChange={e => setRenameValue(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === "Enter") renameArticle(a.id, renameValue);
                                      if (e.key === "Escape") { setRenamingArticleId(null); setRenameValue(""); }
                                    }}
                                    onBlur={() => renameArticle(a.id, renameValue)}
                                    className={s.createInput}
                                  />
                                </div>
                              ) : (
                                <button onClick={() => openDbArticle(a)} className={isActive ? s.fileItemActive : s.fileItem}>
                                  <svg className={s.fileIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                                  <span className={s.fileInfo}>
                                    <span className={s.fileTitle}>{a.title}</span>
                                    <span className={a.publishStatus === "published" ? s.badgePublished : s.badgeDraft}>
                                      {a.publishStatus === "published" ? "已发布" : "草稿"}
                                    </span>
                                  </span>
                                </button>
                              )}
                              <div className={s.fileActions}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    openMenuAt(rect.right, rect.bottom + 4);
                                  }}
                                  className={s.fileActionBtn}
                                  title="More (right-click)"
                                >⋯</button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); startCreateFile(); }}
                                  className={s.fileActionBtn}
                                  title="New article (⌘⇧N)"
                                >+</button>
                              </div>
                              {articleMenuOpen === a.id && articleMenuAnchor && (
                                <div
                                  className={s.fileMenu}
                                  style={{ top: articleMenuAnchor.top, left: articleMenuAnchor.left }}
                                  onClick={e => e.stopPropagation()}
                                  onMouseDown={e => e.stopPropagation()}
                                >
                                  <button className={s.fileMenuItem} onClick={() => { openDbArticle(a); setArticleMenuOpen(null); setArticleMenuAnchor(null); }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    <span className={s.fileMenuItemLabel}>打开编辑</span>
                                    <span className={s.fileMenuItemKbd}>↵</span>
                                  </button>
                                  <button className={s.fileMenuItem} onClick={() => { setRenamingArticleId(a.id); setRenameValue(a.title); setArticleMenuOpen(null); setArticleMenuAnchor(null); }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                    <span className={s.fileMenuItemLabel}>重命名</span>
                                    <span className={s.fileMenuItemKbd}>F2</span>
                                  </button>
                                  <button className={s.fileMenuItem} onClick={() => { duplicateArticle(a); setArticleMenuOpen(null); setArticleMenuAnchor(null); }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                    <span className={s.fileMenuItemLabel}>复制副本</span>
                                    <span className={s.fileMenuItemKbd}>⌘D</span>
                                  </button>
                                  <div className={s.fileMenuDivider} />
                                  <button className={s.fileMenuItem} onClick={() => { navigator.clipboard.writeText(a.id); setPublishStatus({ type: "info", msg: "已复制页面 ID" }); setTimeout(() => setPublishStatus(null), 2000); setArticleMenuOpen(null); setArticleMenuAnchor(null); }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h6M6 14h4"/></svg>
                                    <span className={s.fileMenuItemLabel}>复制页面 ID</span>
                                  </button>
                                  <button
                                    className={a.githubUrl ? s.fileMenuItem : s.fileMenuItemDisabled}
                                    onClick={() => {
                                      if (!a.githubUrl) return;
                                      navigator.clipboard.writeText(a.githubUrl);
                                      setPublishStatus({ type: "info", msg: "已复制访问链接" });
                                      setTimeout(() => setPublishStatus(null), 2000);
                                      setArticleMenuOpen(null); setArticleMenuAnchor(null);
                                    }}
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                    <span className={s.fileMenuItemLabel}>复制访问链接</span>
                                    {!a.githubUrl && <span className={s.fileMenuItemKbd}>未发布</span>}
                                  </button>
                                  {a.githubUrl && (
                                    <a href={a.githubUrl} target="_blank" rel="noopener noreferrer" className={s.fileMenuItem} onClick={() => { setArticleMenuOpen(null); setArticleMenuAnchor(null); }}>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                      <span className={s.fileMenuItemLabel}>在 GitHub 查看</span>
                                    </a>
                                  )}
                                  <div className={s.fileMenuDivider} />
                                  <button className={s.fileMenuItemDanger} onClick={() => { setConfirmDeleteArticle(a.id); setArticleMenuOpen(null); setArticleMenuAnchor(null); }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                    <span className={s.fileMenuItemLabel}>删除</span>
                                    <span className={s.fileMenuItemKbd}>Del</span>
                                  </button>
                                </div>
                              )}
                              {confirmDeleteArticle === a.id && (
                                <div className={s.confirmOverlay}>
                                  <span>删除该文章?</span>
                                  <button className={s.confirmYes} onClick={() => deleteArticle(a.id)}>确认</button>
                                  <button className={s.confirmNo} onClick={() => setConfirmDeleteArticle(null)}>取消</button>
                                </div>
                              )}
                            </div>
                          );
                          })}
                        </>
                      )}
                    </div>
                  </>
              </div>

              {/* Bottom: avatar + settings + theme */}
              <div className={s.sidebarFooter}>
                <div className={s.userBlock}>
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className={s.avatarImg} />
                  ) : (
                    <div className={s.avatar}>{user?.username?.[0]?.toUpperCase() || "?"}</div>
                  )}
                  <span className={s.userName}>{user?.username || "Guest"}</span>
                </div>
                <div className={s.footerActions}>
                  <button onClick={() => setShowSettings(true)} className={s.themeBtn} title="Settings">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Editor */}
        <div className={s.editorArea}>
          {showSettings ? (
            <SettingsPanel onClose={() => setShowSettings(false)} />
          ) : (activeFile || activeDbArticle) ? (
            <div className={s.editorScroll}>
              <div className={s.editorInner}>
                <NotionEditor
                  key={activeFile || activeDbArticle?.id || "empty"}
                  initialContent={content}
                  onChange={setContent}
                  onSelectionChange={handleSelectionChange}
                  onEditorReady={handleEditorReady}
                  getSlotState={getSlotState}
                  articleTitle={activeDbArticle?.title || activeFile || undefined}
                  editHistory={editHistory.records
                    .filter(r => !r.reverted)
                    .slice(0, 10)
                    .map(r => ({
                      action: r.source === "bracket" ? "bracket-fill" : `selection-${r.mode}`,
                      summary: (r.instruction || r.promptKey || r.newText.slice(0, 40)).slice(0, 100),
                      accepted: !r.reverted,
                    }))}
                />
              </div>
            </div>
          ) : (
            <div className={s.welcomeScreen}>
              <div style={{ textAlign: "center" }}>
                <p className={s.welcomeTitle}>Muses Studio</p>
                <p className={s.welcomeSubtitle}>Select or create a file to begin writing</p>
              </div>
            </div>
          )}
        </div>

        {/* Resize handle */}
        <div className={s.resizeHandle} onMouseDown={onDragStart}>
          <div className={s.resizeHandleLine} />
        </div>

        {/* AI Edit History — replaces the legacy ChatPanel */}
        <div className={s.chatPanel} style={{ width: chatWidth }}>
          <EditHistoryPanel
            records={editHistory.records}
            onRevert={revertEdit}
            onClear={editHistory.clear}
          />
        </div>
        </>
        )}
      </div>

      {/* Status bar */}
      <div className={s.statusbar}>
        <div className={s.statusLeft}>
          <span>Select + <kbd className={s.statusKbd}>&#8984;K</kbd> for AI</span>
          {selection && (
            <span className={s.statusSelection}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {selection.split("\n").length} lines selected
              <button onClick={handleClearSelection} className={s.statusSelectionClear}>&#10005;</button>
            </span>
          )}
        </div>
        <div className={s.statusRight}>
          <span className={s.modelLabel}>Sonnet 4</span>
        </div>
      </div>
    </div>
  );
}

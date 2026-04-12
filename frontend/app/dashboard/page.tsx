"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { marked } from "marked";
import { useUserStore } from "@/store/user";
import { NotionEditor } from "@/components/NotionEditor";
import ChatPanel, { ChatPanelHandle } from "@/components/studio/ChatPanel";
import DiffView from "@/components/studio/DiffView";
import SettingsPanel from "@/components/studio/SettingsPanel";
import { persistSelection, clearPersistedSelection } from "@/lib/tiptap-extensions/SelectionPersistence";
import { getLineContent } from "@/lib/tiptap-extensions/LineNumbers";
import s from "./dashboard.module.css";

// HTML → Markdown converter (lazy loaded)
const getTurndownService = async () => {
  const TurndownService = (await import("turndown")).default;
  const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  return td;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const CHAT_WIDTH_KEY = "muses-chat-panel-width";
const CHAT_WIDTH_DEFAULT = 360;
const CHAT_WIDTH_MIN = 280;
const CHAT_WIDTH_MAX = 600;

interface FileItem { name: string; path: string; size: number; modified: number; }
interface DBArticle { id: string; title: string; summary?: string; publishStatus: string; publishedAt?: string; githubUrl?: string; createdAt: string; updatedAt: string; }
interface EditRecord { desc: string; added: number; removed: number; time: Date; }
interface FolderNode { name: string; path: string; files: FileItem[]; folders: FolderNode[]; expanded: boolean; }

export default function Dashboard() {
  const { user, checkAuth } = useUserStore();
  useEffect(() => { checkAuth(); }, [checkAuth]);

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
  // Track selection range and markdown for partial edits
  const selectionRangeRef = useRef<{ from: number; to: number } | null>(null);
  const selectionMdRef = useRef<string>("");
  // Partial edit state: when AI edits only the selection
  const [partialEdit, setPartialEdit] = useState<{ oldMd: string; newMd: string } | null>(null);

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
      if (from !== undefined && to !== undefined) {
        selectionRangeRef.current = { from, to };
        // Capture selection as markdown for merge
        const editor = editorRef.current;
        if (editor) {
          try {
            const { DOMSerializer } = await import("@tiptap/pm/model");
            const slice = editor.state.doc.slice(from, to);
            const serializer = DOMSerializer.fromSchema(editor.schema);
            const fragment = serializer.serializeFragment(slice.content);
            const div = document.createElement("div");
            div.appendChild(fragment);
            const td = await getTurndownService();
            selectionMdRef.current = td.turndown(div.innerHTML);
          } catch {
            selectionMdRef.current = text;
          }
        }
      }
    } else {
      selectionRangeRef.current = null;
      selectionMdRef.current = "";
    }
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelection("");
    if (editorRef.current) clearPersistedSelection(editorRef.current);
  }, []);

  const handleGetLineContent = useCallback((start: number, end?: number) => {
    return getLineContent(editorRef.current, start, end);
  }, []);

  const [pendingChange, setPendingChange] = useState<string | null>(null);

  const [editStats, setEditStats] = useState({ added: 0, removed: 0 });
  const [editRecords, setEditRecords] = useState<EditRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [creating, setCreating] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creatingInFolder, setCreatingInFolder] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [fileMenuOpen, setFileMenuOpen] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"article" | "agent" | "skill">("article");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const darkMode = true; // Dark-only UI — warm minimalist design
  const [showSettings, setShowSettings] = useState(false);
  const [publishingFile, setPublishingFile] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const chatRef = useRef<ChatPanelHandle>(null);
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
      setPendingChange(null);
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
      setPendingChange(null);
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

  // ===== Accept / Reject =====
  const acceptChange = useCallback(async () => {
    if (!pendingChange) return;

    let finalMd: string;
    if (partialEdit) {
      // Partial edit: merge AI's edit into the full article markdown
      const td = await getTurndownService();
      const currentMd = contentRef.current ? td.turndown(contentRef.current) : markdownContent;
      const idx = currentMd.indexOf(partialEdit.oldMd);
      if (idx !== -1) {
        finalMd = currentMd.slice(0, idx) + pendingChange + currentMd.slice(idx + partialEdit.oldMd.length);
      } else {
        // Fallback: replace full content
        finalMd = pendingChange;
      }
    } else {
      // Full edit: pendingChange is the complete article
      finalMd = pendingChange;
    }

    const oldLines = markdownContent.split("\n").length;
    const newLines = finalMd.split("\n").length;
    const added = Math.max(0, newLines - oldLines);
    const removed = Math.max(0, oldLines - newLines);

    const htmlContent = await marked(finalMd);
    setContent(htmlContent);
    setMarkdownContent(finalMd);
    saveFile(htmlContent);
    setEditStats(prev => ({ added: prev.added + added, removed: prev.removed + removed }));
    setEditRecords(prev => [{ desc: "Claude edit", added, removed, time: new Date() }, ...prev]);
    setPendingChange(null);
    setPartialEdit(null);
  }, [pendingChange, partialEdit, markdownContent, saveFile]);

  const rejectChange = useCallback(() => { setPendingChange(null); setPartialEdit(null); }, []);

  const handleArticleEdit = useCallback(async (newContent: string) => {
    const hasSelection = !!selectionMdRef.current;
    if (hasSelection) {
      // Partial edit: diff only the selection vs AI's edit
      setPartialEdit({ oldMd: selectionMdRef.current, newMd: newContent });
      setPendingChange(newContent);
    } else {
      // Full edit: sync markdownContent and show full diff
      if (contentRef.current) {
        const td = await getTurndownService();
        setMarkdownContent(td.turndown(contentRef.current));
      }
      setPartialEdit(null);
      setPendingChange(newContent);
    }
  }, []);

  // Close file menu on outside click
  useEffect(() => {
    if (!fileMenuOpen) return;
    const handler = () => setFileMenuOpen(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [fileMenuOpen]);

  // ===== Keyboard shortcuts =====
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); saveFile(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (editorRef.current) {
          const info = persistSelection(editorRef.current);
          if (info) handleSelectionChange(info.text, info.from, info.to);
        }
        chatRef.current?.focusInput();
      }
      if (pendingChange) {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); acceptChange(); }
        if (e.key === "Escape") { e.preventDefault(); rejectChange(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveFile, pendingChange, acceptChange, rejectChange]);

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

  const handleEditorReady = useCallback((editor: any) => { editorRef.current = editor; }, []);

  return (
    <div className={s.shell}>
      {/* Publish toast */}
      {publishStatus && (
        <div className={publishStatus.type === "success" ? s.toastSuccess : s.toastError}>
          {publishStatus.type === "success" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
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
              <button key={tab} onClick={() => setSidebarTab(tab)} className={sidebarTab === tab ? s.topTabActive : s.topTab}>
                {tab === "article" ? "Article" : tab === "agent" ? "Agent" : "Skill"}
              </button>
            ))}
          </div>
        </div>
        <div className={s.topbarActions}>
          {sidebarTab === "article" && (
            <>
              <button onClick={() => saveFile()} className={s.btnGhost}>Save</button>
              <button className={s.btnPrimary}>Publish</button>
            </>
          )}
        </div>
      </div>

      {/* Main */}
      <div className={s.main}>
        {sidebarTab === "agent" ? (
          <div className={s.fullPlaceholder}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3F3A36" strokeWidth="1.5"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>
            <p className={s.fullPlaceholderTitle}>Agent Management</p>
            <p className={s.fullPlaceholderDesc}>Create and manage AI writing agents with custom tones, styles, and prompts.</p>
            <p className={s.fullPlaceholderSub}>Coming soon</p>
          </div>
        ) : sidebarTab === "skill" ? (
          <div className={s.fullPlaceholder}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3F3A36" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            <p className={s.fullPlaceholderTitle}>Skill Library</p>
            <p className={s.fullPlaceholderDesc}>Browse and install writing skills — templates, workflows, and automation tools.</p>
            <p className={s.fullPlaceholderSub}>Coming soon</p>
          </div>
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
                          {dbArticles.map(a => (
                            <div key={a.id} className={s.fileRow}>
                              <button onClick={() => openDbArticle(a)} className={activeDbArticle?.id === a.id ? s.fileItemActive : s.fileItem}>
                                <svg className={s.fileIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                                <span className={s.fileInfo}>
                                  <span className={s.fileTitle}>{a.title}</span>
                                  <span className={a.publishStatus === "published" ? s.badgePublished : s.badgeDraft}>
                                    {a.publishStatus === "published" ? "已发布" : "草稿"}
                                  </span>
                                </span>
                              </button>
                              {a.githubUrl && (
                                <div className={s.fileActions} style={{ opacity: 1 }}>
                                  <a href={a.githubUrl} target="_blank" rel="noopener noreferrer" className={s.fileActionBtn} title="View on GitHub">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
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
          {pendingChange && (
            <div className={s.acceptBanner}>
              <div className={s.acceptBannerLabel}>
                <span className={s.acceptPulse} />
                <span>Claude suggested changes</span>
              </div>
              <div className={s.acceptActions}>
                <button onClick={rejectChange} className={s.btnReject}>Reject <kbd className={s.kbd}>esc</kbd></button>
                <button onClick={acceptChange} className={s.btnAccept}>Accept <kbd className={s.kbd}>&#8984;&#9166;</kbd></button>
              </div>
            </div>
          )}

          {showSettings ? (
            <SettingsPanel onClose={() => setShowSettings(false)} />
          ) : (activeFile || activeDbArticle) ? (
            pendingChange ? (
              <div className={s.editorScroll}>
                <DiffView
                  oldContent={partialEdit ? partialEdit.oldMd : markdownContent}
                  newContent={partialEdit ? partialEdit.newMd : pendingChange}
                />
              </div>
            ) : (
              <div className={s.editorScroll}>
                <div className={s.editorInner}>
                  <NotionEditor
                    key={activeFile || activeDbArticle?.id || "empty"}
                    initialContent={content}
                    onChange={setContent}
                    onSelectionChange={handleSelectionChange}
                    onEditorReady={handleEditorReady}
                  />
                </div>
              </div>
            )
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

        {/* Chat */}
        <div className={s.chatPanel} style={{ width: chatWidth }}>
          <ChatPanel
            ref={chatRef}
            activeFile={activeFile || (activeDbArticle ? `${activeDbArticle.title}.md` : null)}
            editorSelection={selection}
            onClearSelection={handleClearSelection}
            onArticleEdit={handleArticleEdit}
            getLineContent={handleGetLineContent}
          />
        </div>
        </>
        )}
      </div>

      {/* Status bar */}
      <div className={s.statusbar}>
        <div className={s.statusLeft}>
          <span>Chat <kbd className={s.statusKbd}>&#8984;K</kbd></span>
          {selection && (
            <span className={s.statusSelection}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {selection.split("\n").length} lines selected
              <button onClick={handleClearSelection} className={s.statusSelectionClear}>&#10005;</button>
            </span>
          )}
        </div>
        <div className={s.statusRight}>
          {(editStats.added > 0 || editStats.removed > 0) && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowHistory(!showHistory)} className={s.editStatsBtn}>
                <span className={s.editStatsAdded}>+{editStats.added}</span>
                <span className={s.editStatsRemoved}>-{editStats.removed}</span>
              </button>
              {showHistory && editRecords.length > 0 && (
                <div className={s.historyDropdown}>
                  <div className={s.historyHeader}>Edit history ({editRecords.length})</div>
                  <div className={s.historyList}>
                    {editRecords.map((r, i) => (
                      <div key={i} className={s.historyItem}>
                        <span className={s.historyItemLabel}>{r.desc}</span>
                        <span>
                          <span className={s.editStatsAdded}>+{r.added}</span>{" "}
                          <span className={s.editStatsRemoved}>-{r.removed}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <span className={s.modelLabel}>Sonnet 4</span>
        </div>
      </div>
    </div>
  );
}

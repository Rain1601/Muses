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
interface EditRecord { desc: string; added: number; removed: number; time: Date; }
interface FolderNode { name: string; path: string; files: FileItem[]; folders: FolderNode[]; expanded: boolean; }

export default function DashboardV2() {
  const { user, checkAuth } = useUserStore();
  useEffect(() => { checkAuth(); }, [checkAuth]);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("muses-expanded-folders");
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");

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

  const handleSelectionChange = useCallback((text: string) => {
    if (text.trim()) setSelection(text);
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
  const [darkMode, setDarkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const chatRef = useRef<ChatPanelHandle>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef(content);
  const savedContentRef = useRef(savedContent);
  contentRef.current = content;
  savedContentRef.current = savedContent;

  // ===== File operations =====
  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/studio/files`);
      const data = await res.json();
      setFiles(data.files || []);
      setFolders(data.folders || []);
    } catch (e) { console.error("Load files failed:", e); }
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

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
      const htmlContent = await marked(data.content || "");
      setActiveFile(filePath);
      setContent(htmlContent);
      setSavedContent(htmlContent); // track HTML version for dirty checking
      setPendingChange(null);
      setSelection("");
      setShowSettings(false);
    } catch (e) { console.error("Open file failed:", e); }
  }, []);

  const saveFile = useCallback(async (htmlContent?: string) => {
    if (!activeFile) return;
    const html = htmlContent ?? contentRef.current;
    try {
      // Convert HTML back to markdown for file storage
      const td = await getTurndownService();
      const markdown = td.turndown(html);
      await fetch(`${API_BASE}/api/studio/files/${activeFile}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: markdown }),
      });
      setSavedContent(html); // track HTML for dirty checking
    } catch (e) { console.error("Save failed:", e); }
  }, [activeFile]);

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
    const oldLines = content.split("\n").length;
    const newLines = pendingChange.split("\n").length;
    const added = Math.max(0, newLines - oldLines);
    const removed = Math.max(0, oldLines - newLines);
    // pendingChange is raw markdown from AI — convert to HTML for editor
    const htmlContent = await marked(pendingChange);
    setContent(htmlContent);
    saveFile(htmlContent);
    setEditStats(prev => ({ added: prev.added + added, removed: prev.removed + removed }));
    setEditRecords(prev => [{ desc: "Claude edit", added, removed, time: new Date() }, ...prev]);
    setPendingChange(null);
  }, [pendingChange, content, saveFile]);

  const rejectChange = useCallback(() => { setPendingChange(null); }, []);

  const handleArticleEdit = useCallback((newContent: string) => {
    setPendingChange(newContent);
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
          if (info) setSelection(info.text);
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
    <div className={`${s.shell} dark`}>
      {/* Top bar */}
      <div className={s.topbar}>
        <div className={s.topbarLeft}>
          <img src="/materials/images/icons/muses-mic.svg" alt="Muses" className={s.logoIcon} />
          <span className={s.logo}>Muses</span>
          <span className={s.breadcrumbSep}>/</span>
          <span className={s.breadcrumbFile}>{activeFile || "Studio"}</span>
          {content !== savedContent && <span className={s.unsavedDot}>*</span>}
        </div>
        <div className={s.topbarActions}>
          <button onClick={() => saveFile()} className={s.btnGhost}>Save</button>
          <button className={s.btnPrimary}>Publish</button>
        </div>
      </div>

      {/* Main */}
      <div className={s.main}>
        {/* Sidebar */}
        <div className={sidebarCollapsed ? s.sidebarCollapsed : s.sidebar}>
          {sidebarCollapsed ? (
            /* Collapsed: vertical icon strip */
            <div className={s.collapsedIcons}>
              <button onClick={() => setSidebarCollapsed(false)} className={s.collapsedIconBtn} title="Expand">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <button onClick={() => { setSidebarCollapsed(false); setSidebarTab("article"); }} className={sidebarTab === "article" ? s.collapsedIconBtnActive : s.collapsedIconBtn} title="Articles">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </button>
              <button onClick={() => { setSidebarCollapsed(false); setSidebarTab("agent"); }} className={sidebarTab === "agent" ? s.collapsedIconBtnActive : s.collapsedIconBtn} title="Agents">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>
              </button>
              <button onClick={() => { setSidebarCollapsed(false); setSidebarTab("skill"); }} className={sidebarTab === "skill" ? s.collapsedIconBtnActive : s.collapsedIconBtn} title="Skills">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </button>
            </div>
          ) : (
            <>
              {/* Tab bar */}
              <div className={s.sidebarTabs}>
                <div className={s.tabGroup}>
                  {(["article", "agent", "skill"] as const).map(tab => (
                    <button key={tab} onClick={() => setSidebarTab(tab)} className={sidebarTab === tab ? s.tabActive : s.tab}>
                      {tab === "article" ? "Article" : tab === "agent" ? "Agent" : "Skill"}
                    </button>
                  ))}
                </div>
                <button onClick={() => setSidebarCollapsed(true)} className={s.sidebarAddBtn} title="Collapse sidebar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
              </div>

              {/* Tab content */}
              <div className={s.sidebarContent}>
                {sidebarTab === "article" && (
                  <>
                    <div className={s.sidebarSubHeader}>
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
                      {files.length === 0 && folders.length === 0 && !creating && (
                        <div className={s.emptyState}>
                          No files yet<br />
                          <button onClick={() => startCreateFile()} className={s.emptyLink}>Create one</button>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {sidebarTab === "agent" && (
                  <div className={s.tabPlaceholder}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#57534E" strokeWidth="1.5"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>
                    <span>Agent management</span>
                    <span className={s.tabPlaceholderSub}>Coming soon</span>
                  </div>
                )}

                {sidebarTab === "skill" && (
                  <div className={s.tabPlaceholder}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#57534E" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    <span>Skill library</span>
                    <span className={s.tabPlaceholderSub}>Coming soon</span>
                  </div>
                )}
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
                  <button onClick={() => setDarkMode(!darkMode)} className={s.themeBtn} title={darkMode ? "Light mode" : "Dark mode"}>
                    {darkMode ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                    )}
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
          ) : activeFile ? (
            pendingChange ? (
              <div className={s.editorScroll}>
                <DiffView oldContent={content} newContent={pendingChange} />
              </div>
            ) : (
              <div className={s.editorScroll}>
                <div className={s.editorInner}>
                  <NotionEditor
                    key={activeFile}
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
            activeFile={activeFile}
            editorSelection={selection}
            onClearSelection={handleClearSelection}
            onArticleEdit={handleArticleEdit}
            getLineContent={handleGetLineContent}
          />
        </div>
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

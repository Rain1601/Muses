"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface PublishInfo {
  publishStatus: string;
  publishedAt: string | null;
  githubUrl: string | null;
  repoPath: string | null;
  firstSyncAt: string | null;
  lastSyncAt: string | null;
  syncCount: string | null;
}

interface HistoryRecord {
  id: string;
  syncType: string;
  syncDirection: string;
  syncStatus: string;
  hasChanges: string;
  githubUrl: string | null;
  repoPath: string | null;
  errorMessage: string | null;
  syncDuration: number | null;
  createdAt: string | null;
}

interface PublishHistoryPanelProps {
  articleId: string;
  articleTitle: string;
  onClose: () => void;
  onChanged: () => void;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", { hour12: false });
}

function syncTypeLabel(t: string): string {
  if (t === "publish_to_github") return "发布到 GitHub";
  if (t === "unpublish_from_github") return "从 GitHub 下架";
  if (t === "pull_from_github") return "从 GitHub 拉取";
  if (t === "push_to_github") return "推送到 GitHub";
  return t;
}

function statusBadge(status: string): { text: string; color: string; bg: string } {
  if (status === "published") return { text: "已发布", color: "#86efac", bg: "rgba(34, 197, 94, 0.12)" };
  if (status === "unpublished") return { text: "已下架", color: "#fbbf24", bg: "rgba(245, 158, 11, 0.12)" };
  if (status === "scheduled") return { text: "已排期", color: "#a5b4fc", bg: "rgba(99, 102, 241, 0.12)" };
  return { text: "草稿", color: "var(--m-n300)", bg: "rgba(120, 113, 108, 0.12)" };
}

export default function PublishHistoryPanel({ articleId, articleTitle, onClose, onChanged }: PublishHistoryPanelProps) {
  const [info, setInfo] = useState<PublishInfo | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<"unpublish" | "delete" | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/publish/history/${articleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setInfo(data.publishInfo || null);
      setHistory(data.history || []);
    } catch (e) {
      console.error("Load publish history failed:", e);
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const doPublish = useCallback(async () => {
    setActionLoading("publish");
    try {
      const token = localStorage.getItem("token");
      if (!token) { showToast("error", "请先登录"); return; }

      const profileRes = await fetch(`${API_BASE}/api/user/profile`, { headers: { Authorization: `Bearer ${token}` } });
      const profile = await profileRes.json();
      const repoUrl = profile.defaultRepoUrl;
      if (!repoUrl) { showToast("error", "请先在 Settings 中配置默认发布仓库"); return; }

      let filePath = info?.repoPath;
      if (!filePath) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const slug = articleTitle.toLowerCase().replace(/[^a-z0-9一-龥]+/g, "-").replace(/^-|-$/g, "") || "untitled";
        filePath = `posts/${year}/${month}/${year}-${month}-${day}-${slug}.md`;
      }

      const res = await fetch(`${API_BASE}/api/publish/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          articleId,
          repoUrl,
          filePath,
          commitMessage: info?.repoPath ? `Update: ${articleTitle}` : `Publish: ${articleTitle}`,
        }),
      });
      const result = await res.json();
      if (result.success) {
        showToast("success", info?.repoPath ? "同步成功" : "发布成功");
        loadHistory();
        onChanged();
      } else {
        showToast("error", result.detail || "发布失败");
      }
    } catch (e: any) {
      showToast("error", e.message || "发布失败");
    } finally {
      setActionLoading(null);
    }
  }, [articleId, articleTitle, info, loadHistory, onChanged]);

  const doUnpublish = useCallback(async () => {
    setActionLoading("unpublish");
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/publish/github/${articleId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (result.success) {
        showToast("success", "已下架（隐藏）");
        loadHistory();
        onChanged();
      } else {
        showToast("error", result.detail || "下架失败");
      }
    } catch (e: any) {
      showToast("error", e.message || "下架失败");
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  }, [articleId, loadHistory, onChanged]);

  const doDelete = useCallback(async () => {
    setActionLoading("delete");
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/articles/${articleId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast("success", "已删除");
        onChanged();
        setTimeout(onClose, 800);
      } else {
        const result = await res.json();
        showToast("error", result.detail || "删除失败");
      }
    } catch (e: any) {
      showToast("error", e.message || "删除失败");
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  }, [articleId, onClose, onChanged]);

  const status = info?.publishStatus || "draft";
  const isPublished = status === "published";
  const isUnpublished = status === "unpublished";
  const badge = statusBadge(status);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: "0.6875rem", color: "var(--m-n400)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "0.25rem" }}>Publish History</div>
            <div style={{ fontSize: "0.9375rem", color: "var(--m-n50)", fontWeight: 500, lineHeight: 1.3 }}>{articleTitle}</div>
          </div>
          <button onClick={onClose} style={closeBtnStyle} title="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Status + Info */}
        <div style={statusSectionStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <span style={{ ...badgeStyle, color: badge.color, background: badge.bg }}>{badge.text}</span>
            {info?.syncCount && parseInt(info.syncCount, 10) > 0 && (
              <span style={{ fontSize: "0.6875rem", color: "var(--m-n400)" }}>同步 {info.syncCount} 次</span>
            )}
          </div>
          {info?.githubUrl && (
            <a href={info.githubUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              {info.githubUrl.replace("https://github.com/", "")}
            </a>
          )}
          {info?.lastSyncAt && (
            <div style={{ fontSize: "0.6875rem", color: "var(--m-n400)", marginTop: "0.375rem" }}>
              上次同步: {formatTime(info.lastSyncAt)}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={actionsStyle}>
          {!isPublished && (
            <button onClick={doPublish} disabled={actionLoading !== null} style={primaryActionStyle}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              {actionLoading === "publish" ? "发布中..." : (isUnpublished ? "重新发布" : "发布")}
            </button>
          )}
          {isPublished && (
            <button onClick={doPublish} disabled={actionLoading !== null} style={primaryActionStyle}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              {actionLoading === "publish" ? "同步中..." : "同步更新"}
            </button>
          )}
          {isPublished && (
            <button onClick={() => setConfirmAction("unpublish")} disabled={actionLoading !== null} style={secondaryActionStyle}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              下架（隐藏）
            </button>
          )}
          <button onClick={() => setConfirmAction("delete")} disabled={actionLoading !== null} style={dangerActionStyle}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            删除
          </button>
        </div>

        {/* Confirm */}
        {confirmAction && (
          <div style={confirmBoxStyle}>
            <span style={{ fontSize: "0.75rem", color: "var(--m-n50)" }}>
              {confirmAction === "unpublish" ? "下架后文章将从 GitHub 移除并隐藏。确认？" : "删除后无法恢复，且会从 GitHub 删除（如已发布）。确认？"}
            </span>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                onClick={confirmAction === "unpublish" ? doUnpublish : doDelete}
                disabled={actionLoading !== null}
                style={{ ...secondaryActionStyle, borderColor: "#D97149", color: "#D97149" }}
              >
                确认{confirmAction === "unpublish" ? "下架" : "删除"}
              </button>
              <button onClick={() => setConfirmAction(null)} style={secondaryActionStyle}>取消</button>
            </div>
          </div>
        )}

        {/* History timeline */}
        <div style={timelineHeaderStyle}>
          <span style={{ fontSize: "0.6875rem", color: "var(--m-n400)", letterSpacing: "0.05em", textTransform: "uppercase" }}>History · {history.length}</span>
        </div>
        <div style={timelineStyle}>
          {loading ? (
            <div style={{ padding: "1rem", textAlign: "center", color: "var(--m-n400)", fontSize: "0.75rem" }}>加载中...</div>
          ) : history.length === 0 ? (
            <div style={{ padding: "1rem", textAlign: "center", color: "var(--m-n450)", fontSize: "0.75rem" }}>暂无历史记录</div>
          ) : (
            history.map(h => (
              <div key={h.id} style={historyItemStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                  <span style={{
                    fontSize: "0.625rem",
                    padding: "0.125rem 0.4rem",
                    borderRadius: "3px",
                    background: h.syncStatus === "success" ? "rgba(34, 197, 94, 0.12)" : h.syncStatus === "failed" ? "rgba(239, 68, 68, 0.12)" : "rgba(245, 158, 11, 0.12)",
                    color: h.syncStatus === "success" ? "#86efac" : h.syncStatus === "failed" ? "#fca5a5" : "#fbbf24",
                  }}>{h.syncStatus}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--m-n200)" }}>{syncTypeLabel(h.syncType)}</span>
                </div>
                <div style={{ fontSize: "0.6875rem", color: "var(--m-n400)" }}>
                  {formatTime(h.createdAt)}
                  {h.syncDuration ? ` · ${h.syncDuration}ms` : ""}
                </div>
                {h.errorMessage && (
                  <div style={{ fontSize: "0.6875rem", color: "#fca5a5", marginTop: "0.25rem" }}>{h.errorMessage}</div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: "absolute",
            bottom: "1rem",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "0.5rem 0.875rem",
            borderRadius: "6px",
            fontSize: "0.75rem",
            background: toast.type === "success" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
            color: toast.type === "success" ? "#86efac" : "#fca5a5",
            border: `1px solid ${toast.type === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            whiteSpace: "nowrap",
          }}>{toast.msg}</div>
        )}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.55)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  animation: "fadeIn 0.15s ease",
};

const panelStyle: React.CSSProperties = {
  width: "440px",
  maxHeight: "82vh",
  background: "var(--m-n925)",
  border: "1px solid var(--m-n750)",
  borderRadius: "10px",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
  position: "relative",
};

const headerStyle: React.CSSProperties = {
  padding: "1rem 1.25rem",
  borderBottom: "1px solid var(--m-n880)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
};

const closeBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--m-n400)",
  cursor: "pointer",
  padding: "0.25rem",
  borderRadius: "4px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const statusSectionStyle: React.CSSProperties = {
  padding: "1rem 1.25rem",
  borderBottom: "1px solid var(--m-n880)",
};

const badgeStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  padding: "0.25rem 0.5rem",
  borderRadius: "4px",
  fontWeight: 500,
};

const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  fontSize: "0.6875rem",
  color: "var(--m-n300)",
  textDecoration: "none",
  fontFamily: "monospace",
};

const actionsStyle: React.CSSProperties = {
  padding: "0.875rem 1.25rem",
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
  borderBottom: "1px solid var(--m-n880)",
};

const primaryActionStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  fontSize: "0.6875rem",
  padding: "0.375rem 0.75rem",
  borderRadius: "6px",
  border: "1px solid #D97149",
  background: "#D97149",
  color: "white",
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 500,
  transition: "all 0.15s ease",
};

const secondaryActionStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  fontSize: "0.6875rem",
  padding: "0.375rem 0.75rem",
  borderRadius: "6px",
  border: "1px solid var(--m-n750)",
  background: "transparent",
  color: "var(--m-n300)",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 0.15s ease",
};

const dangerActionStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  fontSize: "0.6875rem",
  padding: "0.375rem 0.75rem",
  borderRadius: "6px",
  border: "1px solid rgba(239, 68, 68, 0.3)",
  background: "transparent",
  color: "#fca5a5",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 0.15s ease",
  marginLeft: "auto",
};

const confirmBoxStyle: React.CSSProperties = {
  margin: "0 1.25rem 0.875rem",
  padding: "0.625rem 0.75rem",
  background: "rgba(217, 113, 73, 0.08)",
  border: "1px solid rgba(217, 113, 73, 0.25)",
  borderRadius: "6px",
};

const timelineHeaderStyle: React.CSSProperties = {
  padding: "0.625rem 1.25rem 0.5rem",
};

const timelineStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "0 1.25rem 1rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const historyItemStyle: React.CSSProperties = {
  padding: "0.625rem 0.75rem",
  background: "var(--m-n880)",
  border: "1px solid var(--m-n750)",
  borderRadius: "6px",
};

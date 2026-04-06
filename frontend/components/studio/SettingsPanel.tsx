"use client";

import { useState, useEffect } from "react";
import { useUserStore } from "@/store/user";
import { api } from "@/lib/api";
import s from "./SettingsPanel.module.css";

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const { user } = useUserStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("account");
  const [saveMsg, setSaveMsg] = useState("");

  const [formData, setFormData] = useState({
    openaiKey: "",
    claudeKey: "",
    geminiKey: "",
    githubToken: "",
    defaultRepoUrl: "",
    language: "zh-CN",
    theme: "light",
  });

  const [stats, setStats] = useState({
    totalArticles: 0,
    totalAgents: 0,
    storageUsed: "0 MB",
  });

  const [testStates, setTestStates] = useState({
    openai: { loading: false, result: null as boolean | null },
    claude: { loading: false, result: null as boolean | null },
    gemini: { loading: false, result: null as boolean | null },
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUserData();
      fetchStats();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const fetchUserData = async () => {
    try {
      setIsDataLoading(true);
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await api.get("/api/user/profile");
      const userData = response.data;

      const newFormData = {
        openaiKey: "",
        claudeKey: "",
        geminiKey: "",
        githubToken: "",
        defaultRepoUrl: userData.defaultRepoUrl || "",
        language: userData.settings?.language || "zh-CN",
        theme: userData.settings?.theme || "light",
      };

      const keyTypes: { type: string; field: string }[] = [];
      if (userData.hasOpenAIKey) keyTypes.push({ type: "openai", field: "openaiKey" });
      if (userData.hasClaudeKey) keyTypes.push({ type: "claude", field: "claudeKey" });
      if (userData.hasGeminiKey) keyTypes.push({ type: "gemini", field: "geminiKey" });
      if (userData.hasGitHubToken) keyTypes.push({ type: "github", field: "githubToken" });

      const keyPromises = keyTypes.map(async ({ type, field }) => {
        try {
          const res = await api.post("/api/user/get-api-key", { keyType: type });
          if (res.data?.key) return { field, value: res.data.key };
        } catch {}
        return null;
      });

      const fetchedKeys = await Promise.all(keyPromises);
      fetchedKeys.forEach((result) => {
        if (result?.value) {
          newFormData[result.field as keyof typeof newFormData] = result.value;
        }
      });

      setFormData(newFormData);
    } catch (error: any) {
      console.error("Failed to fetch user data:", error);
    } finally {
      setIsDataLoading(false);
    }
  };

  const fetchStats = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const [articlesRes, agentsRes] = await Promise.all([
        api.get("/api/articles"),
        api.get("/api/agents"),
      ]);
      setStats({
        totalArticles: articlesRes.data.articles.length,
        totalAgents: agentsRes.data.agents.length,
        storageUsed: "12.5 MB",
      });
    } catch {}
  };

  const showSaved = () => {
    setSaveMsg("Saved");
    setTimeout(() => setSaveMsg(""), 2000);
  };

  const handleSaveGitHub = async () => {
    setIsLoading(true);
    try {
      const updateData: any = { defaultRepoUrl: formData.defaultRepoUrl };
      if (
        formData.githubToken &&
        formData.githubToken.trim() !== "" &&
        (formData.githubToken.startsWith("ghp_") ||
          formData.githubToken.startsWith("gho_") ||
          formData.githubToken.startsWith("github_pat_"))
      ) {
        updateData.githubToken = formData.githubToken.trim();
      }
      await api.post("/api/user/settings", updateData);
      showSaved();
      await fetchUserData();
    } catch {
      alert("GitHub配置保存失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveModels = async () => {
    setIsLoading(true);
    try {
      const updateData: any = {};
      if (formData.openaiKey && !formData.openaiKey.includes("•") && (formData.openaiKey.startsWith("sk-") || formData.openaiKey.startsWith("sk-proj-")))
        updateData.openaiKey = formData.openaiKey;
      if (formData.claudeKey && !formData.claudeKey.includes("•") && formData.claudeKey.startsWith("sk-ant-"))
        updateData.claudeKey = formData.claudeKey;
      if (formData.geminiKey && !formData.geminiKey.includes("•") && formData.geminiKey.startsWith("AI"))
        updateData.geminiKey = formData.geminiKey;

      if (Object.keys(updateData).length === 0) {
        alert("没有检测到有效的API Key");
        return;
      }
      await api.post("/api/user/settings", updateData);
      showSaved();
      await fetchUserData();
    } catch {
      alert("模型配置保存失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setIsLoading(true);
    try {
      await api.post("/api/user/settings", { language: formData.language, theme: formData.theme });
      showSaved();
      await fetchUserData();
    } catch {
      alert("偏好设置保存失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      const response = await api.get("/api/user/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `muses-export-${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch {
      alert("导出失败");
    }
  };

  const testApiKey = async (type: "openai" | "claude" | "gemini") => {
    let keyValue = formData[`${type}Key`];
    if (!keyValue) {
      try {
        const profileRes = await api.get("/api/user/profile");
        const fieldMap = { openai: "hasOpenAIKey", claude: "hasClaudeKey", gemini: "hasGeminiKey" };
        if (!profileRes.data[fieldMap[type]]) { alert(`请先输入 API Key`); return; }
        const keyRes = await api.post("/api/user/get-api-key", { keyType: type });
        keyValue = keyRes.data.key;
      } catch { alert("获取 Key 失败"); return; }
    }

    setTestStates((prev) => ({ ...prev, [type]: { loading: true, result: null } }));
    try {
      const res = await api.post(`/api/user/verify-${type}-key`, { [`${type}Key`]: keyValue });
      setTestStates((prev) => ({ ...prev, [type]: { loading: false, result: res.data.valid } }));
    } catch {
      setTestStates((prev) => ({ ...prev, [type]: { loading: false, result: false } }));
    }
    setTimeout(() => setTestStates((prev) => ({ ...prev, [type]: { loading: false, result: null } })), 3000);
  };

  const tabs = [
    { id: "account", label: "账户" },
    { id: "github", label: "GitHub" },
    { id: "models", label: "模型" },
    { id: "preferences", label: "偏好" },
    { id: "data", label: "数据" },
  ];

  return (
    <div className={s.root}>
      {/* Header */}
      <div className={s.header}>
        <h1 className={s.title}>设置</h1>
        <button onClick={onClose} className={s.closeBtn} title="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Tabs */}
      <div className={s.tabs}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={activeTab === t.id ? s.tabActive : s.tab}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={s.content}>
        {/* Saved indicator */}
        {saveMsg && <div className={s.savedMsg}>{saveMsg}</div>}

        {/* Account */}
        {activeTab === "account" && (
          <div className={s.section}>
            <div className={s.accountHeader}>
              {user?.avatarUrl && <img src={user.avatarUrl} alt="" className={s.avatarLg} />}
              <div>
                <div className={s.accountName}>{user?.username}</div>
                <div className={s.accountEmail}>{user?.email}</div>
              </div>
            </div>
            <div className={s.statsGrid}>
              <div className={s.statCard}>
                <div className={s.statValue}>{stats.totalArticles}</div>
                <div className={s.statLabel}>文章</div>
              </div>
              <div className={s.statCard}>
                <div className={s.statValue}>{stats.totalAgents}</div>
                <div className={s.statLabel}>Agent</div>
              </div>
              <div className={s.statCard}>
                <div className={s.statValue}>{stats.storageUsed}</div>
                <div className={s.statLabel}>存储</div>
              </div>
            </div>
          </div>
        )}

        {/* GitHub */}
        {activeTab === "github" && (
          <div className={s.section}>
            <div className={s.field}>
              <label className={s.label}>GitHub Personal Access Token</label>
              <input
                type="password"
                value={formData.githubToken}
                onChange={(e) => setFormData({ ...formData, githubToken: e.target.value })}
                className={s.input}
                placeholder="ghp_..."
                autoComplete="new-password"
              />
              <p className={s.hint}>
                用于图片上传和文章发布到 GitHub。需要 <code className={s.code}>repo</code> 权限。
                <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className={s.link}> 创建 Token</a>
              </p>
            </div>
            <div className={s.field}>
              <label className={s.label}>
                默认发布仓库 {isDataLoading && <span className={s.hint}>(加载中...)</span>}
              </label>
              <input
                type="text"
                value={formData.defaultRepoUrl}
                onChange={(e) => setFormData({ ...formData, defaultRepoUrl: e.target.value })}
                className={s.input}
                placeholder="https://github.com/username/blog"
                disabled={isDataLoading}
              />
            </div>
            <button onClick={handleSaveGitHub} disabled={isLoading} className={s.saveBtn}>
              {isLoading ? "保存中..." : "保存"}
            </button>
          </div>
        )}

        {/* Models */}
        {activeTab === "models" && (
          <div className={s.section}>
            {(["openai", "claude", "gemini"] as const).map((type) => {
              const labels = { openai: "OpenAI", claude: "Claude", gemini: "Gemini" };
              const placeholders = { openai: "sk-...", claude: "sk-ant-...", gemini: "AI..." };
              const fieldKey = `${type}Key` as "openaiKey" | "claudeKey" | "geminiKey";
              const test = testStates[type];
              return (
                <div key={type} className={s.field}>
                  <label className={s.label}>{labels[type]} API Key</label>
                  <div className={s.inputRow}>
                    <input
                      type="password"
                      value={formData[fieldKey]}
                      onChange={(e) => setFormData({ ...formData, [fieldKey]: e.target.value })}
                      className={s.input}
                      placeholder={placeholders[type]}
                      autoComplete="new-password"
                    />
                    <button onClick={() => testApiKey(type)} disabled={test.loading} className={s.testBtn}>
                      {test.loading ? (
                        <span className={s.spinner} />
                      ) : test.result === true ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : test.result === false ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      ) : (
                        "测试"
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
            <button onClick={handleSaveModels} disabled={isLoading} className={s.saveBtn}>
              {isLoading ? "保存中..." : "保存"}
            </button>
          </div>
        )}

        {/* Preferences */}
        {activeTab === "preferences" && (
          <div className={s.section}>
            <div className={s.field}>
              <label className={s.label}>界面语言</label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className={s.input}
              >
                <option value="zh-CN">简体中文</option>
                <option value="en-US">English</option>
              </select>
            </div>
            <div className={s.field}>
              <label className={s.label}>主题</label>
              <select
                value={formData.theme}
                onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                className={s.input}
              >
                <option value="light">浅色</option>
                <option value="dark">深色</option>
              </select>
            </div>
            <button onClick={handleSavePreferences} disabled={isLoading} className={s.saveBtn}>
              {isLoading ? "保存中..." : "保存"}
            </button>
          </div>
        )}

        {/* Data */}
        {activeTab === "data" && (
          <div className={s.section}>
            <div className={s.dataCard}>
              <div className={s.dataCardTitle}>导出数据</div>
              <p className={s.dataCardDesc}>导出您的所有文章、Agent配置等数据</p>
              <button onClick={handleExportData} className={s.outlineBtn}>导出所有数据</button>
            </div>
            <div className={s.dataCard}>
              <div className={s.dataCardTitle}>清除缓存</div>
              <p className={s.dataCardDesc}>清除本地缓存数据，释放存储空间</p>
              <button onClick={() => { localStorage.clear(); alert("缓存已清除"); }} className={s.outlineBtn}>清除缓存</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

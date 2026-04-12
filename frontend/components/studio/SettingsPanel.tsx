"use client";

import { useState, useEffect } from "react";
import { useUserStore } from "@/store/user";
import { api } from "@/lib/api";
import s from "./SettingsPanel.module.css";

interface Props {
  onClose: () => void;
}

const PROVIDERS = [
  {
    key: "aihubmix",
    name: "AIHubMix",
    desc: "推荐 · 国内直连，支持 Claude / GPT / Gemini 等主流模型",
    placeholder: "sk-...",
    link: "https://aihubmix.com",
  },
  {
    key: "openrouter",
    name: "OpenRouter",
    desc: "国际聚合，模型覆盖最广",
    placeholder: "sk-or-...",
    link: "https://openrouter.ai/keys",
  },
  {
    key: "bailian",
    name: "百炼",
    desc: "阿里云百炼平台，支持通义千问 / DeepSeek 等国产模型",
    placeholder: "sk-...",
    link: "https://bailian.console.aliyun.com",
  },
] as const;

type ProviderKey = typeof PROVIDERS[number]["key"];

export default function SettingsPanel({ onClose }: Props) {
  const { user } = useUserStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("account");
  const [saveMsg, setSaveMsg] = useState("");

  const [formData, setFormData] = useState({
    aihubmixKey: "",
    openrouterKey: "",
    bailianKey: "",
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

  const [testStates, setTestStates] = useState<Record<string, { loading: boolean; result: boolean | null }>>({
    aihubmix: { loading: false, result: null },
    openrouter: { loading: false, result: null },
    bailian: { loading: false, result: null },
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
        aihubmixKey: "",
        openrouterKey: "",
        bailianKey: "",
        githubToken: "",
        defaultRepoUrl: userData.defaultRepoUrl || "",
        language: userData.settings?.language || "zh-CN",
        theme: userData.settings?.theme || "light",
      };

      // Fetch existing keys
      const keyTypes: { type: string; field: string }[] = [];
      if (userData.hasAihubmixKey) keyTypes.push({ type: "aihubmix", field: "aihubmixKey" });
      if (userData.hasOpenrouterKey) keyTypes.push({ type: "openrouter", field: "openrouterKey" });
      if (userData.hasBailianKey) keyTypes.push({ type: "bailian", field: "bailianKey" });
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
      for (const p of PROVIDERS) {
        const fieldKey = `${p.key}Key` as keyof typeof formData;
        const val = formData[fieldKey];
        if (val && val.trim()) {
          updateData[fieldKey] = val.trim();
        }
      }

      if (Object.keys(updateData).length === 0) {
        alert("请输入至少一个 API Key");
        setIsLoading(false);
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

  const testApiKey = async (providerKey: ProviderKey) => {
    const fieldKey = `${providerKey}Key` as keyof typeof formData;
    let keyValue = formData[fieldKey];
    if (!keyValue) {
      alert("请先输入 API Key");
      return;
    }

    setTestStates((prev) => ({ ...prev, [providerKey]: { loading: true, result: null } }));
    try {
      const res = await api.post("/api/user/verify-api-key", null, {
        params: { provider: providerKey, key: keyValue },
      });
      setTestStates((prev) => ({ ...prev, [providerKey]: { loading: false, result: res.data.valid } }));
    } catch {
      setTestStates((prev) => ({ ...prev, [providerKey]: { loading: false, result: false } }));
    }
    setTimeout(() => setTestStates((prev) => ({ ...prev, [providerKey]: { loading: false, result: null } })), 3000);
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

        {/* Models — 聚合 API */}
        {activeTab === "models" && (
          <div className={s.section}>
            <p className={s.hint} style={{ marginBottom: 16 }}>
              配置聚合 API Key，即可调用 Claude / GPT / Gemini / 通义千问等模型。只需配置一个即可。
            </p>
            {PROVIDERS.map((p) => {
              const fieldKey = `${p.key}Key` as keyof typeof formData;
              const test = testStates[p.key];
              return (
                <div key={p.key} className={s.field}>
                  <label className={s.label}>
                    {p.name}
                    <a href={p.link} target="_blank" rel="noopener noreferrer" className={s.link} style={{ marginLeft: 8, fontSize: 12 }}>获取 Key</a>
                  </label>
                  <div className={s.inputRow}>
                    <input
                      type="password"
                      value={formData[fieldKey]}
                      onChange={(e) => setFormData({ ...formData, [fieldKey]: e.target.value })}
                      className={s.input}
                      placeholder={p.placeholder}
                      autoComplete="new-password"
                    />
                    <button onClick={() => testApiKey(p.key)} disabled={test.loading} className={s.testBtn}>
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
                  <p className={s.hint}>{p.desc}</p>
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

"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import Navigation from "@/components/Navigation";
import { useUserStore } from "@/store/user";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const { user } = useUserStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("account");

  const [formData, setFormData] = useState({
    openaiKey: "",
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

  useEffect(() => {
    // Wait a bit for auth to stabilize, then fetch data
    const timer = setTimeout(() => {
      fetchUserData();
      fetchStats();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const fetchUserData = async () => {
    try {
      setIsDataLoading(true);

      // Check if we have a token
      const token = localStorage.getItem('token');
      console.log("Token exists:", !!token);
      if (!token) {
        throw new Error("No authentication token found. Please log in again.");
      }

      const response = await api.get("/api/user/profile");
      // The API returns the user data directly, not wrapped in a 'user' object
      const userData = response.data;
      console.log("Full user data from API:", userData); // Debug log
      console.log("defaultRepoUrl from API:", userData.defaultRepoUrl); // Specific log

      const newFormData = {
        openaiKey: userData.hasOpenAIKey ? "••••••••" : "",
        githubToken: userData.hasGitHubToken ? "••••••••" : "",
        defaultRepoUrl: userData.defaultRepoUrl || "",
        language: userData.settings?.language || "zh-CN",
        theme: userData.settings?.theme || "light",
      };
      console.log("Setting form data to:", newFormData);
      setFormData(newFormData);
    } catch (error: any) {
      console.error("Failed to fetch user data:", error);
      console.error("Error details:", error.response?.data || error.message);
      alert(`Failed to load user data: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsDataLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const [articlesRes, agentsRes] = await Promise.all([
        api.get("/api/articles"),
        api.get("/api/agents"),
      ]);
      
      setStats({
        totalArticles: articlesRes.data.articles.length,
        totalAgents: agentsRes.data.agents.length,
        storageUsed: "12.5 MB", // 示例数据
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const updateData: any = {
        defaultRepoUrl: formData.defaultRepoUrl,
        language: formData.language,
        theme: formData.theme,
      };

      console.log("Saving settings with data:", updateData);

      // 只有当用户输入了新的API Key时才更新
      if (formData.openaiKey && formData.openaiKey !== "••••••••") {
        updateData.openaiKey = formData.openaiKey;
      }

      // 只有当用户输入了新的GitHub Token时才更新
      if (formData.githubToken && formData.githubToken !== "••••••••") {
        updateData.githubToken = formData.githubToken;
      }

      const response = await api.post("/api/user/settings", updateData);
      console.log("Settings saved response:", response.data);

      // 重新获取用户数据以确保显示最新值
      await fetchUserData();

      alert("设置保存成功");

      // 如果更改了主题，应用新主题
      if (formData.theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch (error) {
      alert("保存失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      const response = await api.get("/api/user/export", {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `muses-export-${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();

      // 安全地清理 DOM 和内存
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      alert("导出失败");
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navigation />
        
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <h1 className="text-2xl font-bold mb-8">设置</h1>

          {/* 标签页 */}
          <div className="flex space-x-6 border-b mb-8">
            <button
              onClick={() => setActiveTab("account")}
              className={`pb-3 px-1 border-b-2 transition-colors ${
                activeTab === "account"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              账户信息
            </button>
            <button
              onClick={() => setActiveTab("api")}
              className={`pb-3 px-1 border-b-2 transition-colors ${
                activeTab === "api"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              API配置
            </button>
            <button
              onClick={() => setActiveTab("preferences")}
              className={`pb-3 px-1 border-b-2 transition-colors ${
                activeTab === "preferences"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              偏好设置
            </button>
            <button
              onClick={() => setActiveTab("data")}
              className={`pb-3 px-1 border-b-2 transition-colors ${
                activeTab === "data"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              数据管理
            </button>
          </div>

          {/* 账户信息 */}
          {activeTab === "account" && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                {user?.avatarUrl && (
                  <img
                    src={user.avatarUrl}
                    alt={user.username}
                    className="w-20 h-20 rounded-full"
                  />
                )}
                <div>
                  <h2 className="text-xl font-semibold">{user?.username}</h2>
                  <p className="text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{stats.totalArticles}</div>
                  <div className="text-sm text-muted-foreground">文章总数</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{stats.totalAgents}</div>
                  <div className="text-sm text-muted-foreground">Agent总数</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{stats.storageUsed}</div>
                  <div className="text-sm text-muted-foreground">存储使用</div>
                </div>
              </div>
            </div>
          )}

          {/* API配置 */}
          {activeTab === "api" && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  value={formData.openaiKey}
                  onChange={(e) => setFormData({ ...formData, openaiKey: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="sk-..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  API Key 将被加密存储，仅用于生成文章
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  GitHub Personal Access Token
                </label>
                <input
                  type="password"
                  value={formData.githubToken}
                  onChange={(e) => setFormData({ ...formData, githubToken: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="ghp_..."
                />
                <div className="text-xs text-muted-foreground mt-1 space-y-2">
                  <div>
                    <p className="font-medium text-foreground mb-1">🎯 用途说明：</p>
                    <p>• 编辑器中复制粘贴图片自动上传到 GitHub 仓库</p>
                    <p>• 发布文章时自动提交到指定的 GitHub 仓库</p>
                  </div>

                  <div className="border-l-2 border-amber-400 pl-2">
                    <p className="text-amber-600 dark:text-amber-400 font-medium">
                      ⚠️ 必需权限配置：
                    </p>
                    <p className="text-amber-600 dark:text-amber-400">
                      请选择 <strong>Classic Personal Access Token</strong>，并勾选
                      <code className="bg-amber-50 dark:bg-amber-900/20 px-1 rounded mx-1">repo</code>
                      权限（完整仓库访问权限）
                    </p>
                  </div>

                  <div className="border-l-2 border-red-400 pl-2">
                    <p className="text-red-600 dark:text-red-400 font-medium">
                      🔒 安全提醒：
                    </p>
                    <p className="text-red-600 dark:text-red-400">
                      • Token 将被 AES 加密存储在服务器中
                    </p>
                    <p className="text-red-600 dark:text-red-400">
                      • 请妥善保管，不要分享给他人
                    </p>
                    <p className="text-red-600 dark:text-red-400">
                      • 格式示例：ghp_xxxxxxxxxxxxxxxxxxxx
                    </p>
                  </div>

                  <div className="bg-muted/50 p-2 rounded">
                    <p className="font-medium text-foreground">📋 创建步骤：</p>
                    <p>1. 点击下方链接进入 GitHub 设置</p>
                    <p>2. 选择 "Generate new token (classic)"</p>
                    <p>3. 勾选 "repo" 权限</p>
                    <p>4. 设置过期时间，生成并复制 token</p>
                  </div>

                  <p>
                    <a
                      href="https://github.com/settings/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      🔗 在此创建 Personal Access Token →
                    </a>
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  默认发布仓库 {isDataLoading && <span className="text-xs text-muted-foreground">(加载中...)</span>}
                </label>
                <input
                  type="text"
                  value={formData.defaultRepoUrl}
                  onChange={(e) => setFormData({ ...formData, defaultRepoUrl: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://github.com/username/blog"
                  disabled={isDataLoading}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  设置默认的 GitHub 仓库，发布时自动选择
                  {formData.defaultRepoUrl && (
                    <span className="block text-primary mt-1">
                      当前: {formData.defaultRepoUrl}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* 偏好设置 */}
          {activeTab === "preferences" && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  界面语言
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="zh-CN">简体中文</option>
                  <option value="en-US">English</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  主题
                </label>
                <select
                  value={formData.theme}
                  onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="light">浅色</option>
                  <option value="dark">深色</option>
                </select>
              </div>
            </div>
          )}

          {/* 数据管理 */}
          {activeTab === "data" && (
            <div className="space-y-6">
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">导出数据</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  导出您的所有文章、Agent配置等数据
                </p>
                <button
                  onClick={handleExportData}
                  className="px-4 py-2 border rounded-lg hover:bg-muted"
                >
                  导出所有数据
                </button>
              </div>

              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">清除缓存</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  清除本地缓存数据，释放存储空间
                </p>
                <button
                  onClick={() => {
                    localStorage.clear();
                    alert("缓存已清除");
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-muted"
                >
                  清除缓存
                </button>
              </div>

              <div className="p-4 border border-destructive rounded-lg">
                <h3 className="font-medium mb-2 text-destructive">危险操作</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  删除账户将永久删除您的所有数据，此操作不可恢复
                </p>
                <button
                  className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90"
                  disabled
                >
                  删除账户
                </button>
              </div>
            </div>
          )}

          {/* 保存按钮 */}
          {(activeTab === "api" || activeTab === "preferences") && (
            <div className="mt-8">
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {isLoading ? "保存中..." : "保存设置"}
              </button>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
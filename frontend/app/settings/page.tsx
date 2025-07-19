"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { Navbar } from "@/components/navbar";
import { useUserStore } from "@/store/user";
import axios from "axios";

export default function SettingsPage() {
  const { user } = useUserStore();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("account");
  
  const [formData, setFormData] = useState({
    openaiKey: "",
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
    fetchUserData();
    fetchStats();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await axios.get("/api/user/profile");
      const userData = response.data.user;
      setFormData({
        openaiKey: userData.hasOpenAIKey ? "••••••••" : "",
        defaultRepoUrl: userData.defaultRepoUrl || "",
        language: userData.settings?.language || "zh-CN",
        theme: userData.settings?.theme || "light",
      });
    } catch (error) {
      console.error("Failed to fetch user data:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const [articlesRes, agentsRes] = await Promise.all([
        axios.get("/api/articles"),
        axios.get("/api/agents"),
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

      // 只有当用户输入了新的API Key时才更新
      if (formData.openaiKey && formData.openaiKey !== "••••••••") {
        updateData.openaiKey = formData.openaiKey;
      }

      await axios.post("/api/user/settings", updateData);
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
      const response = await axios.get("/api/user/export", {
        responseType: "blob",
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `muses-export-${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert("导出失败");
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        
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
                  默认发布仓库
                </label>
                <input
                  type="text"
                  value={formData.defaultRepoUrl}
                  onChange={(e) => setFormData({ ...formData, defaultRepoUrl: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://github.com/username/blog"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  设置默认的 GitHub 仓库，发布时自动选择
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
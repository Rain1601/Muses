"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import Navigation from "@/components/Navigation";
import { useUserStore } from "@/store/user";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function SettingsPage() {
  const { user } = useUserStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("account");

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

  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  // API key test states
  const [testStates, setTestStates] = useState({
    openai: { loading: false, result: null as boolean | null },
    claude: { loading: false, result: null as boolean | null },
    gemini: { loading: false, result: null as boolean | null },
  });

  useEffect(() => {
    // Wait a bit for auth to stabilize, then fetch data
    const timer = setTimeout(() => {
      fetchUserData();
      fetchStats();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Monitor formData changes
  useEffect(() => {
    if (formData.openaiKey && formData.openaiKey !== "••••••••" && formData.openaiKey !== "") {
      console.log("📊 [MONITOR] OpenAI key changed to:", formData.openaiKey.slice(0, 10) + "...");
      if (formData.openaiKey.startsWith("ghp_")) {
        console.error("🚨🚨🚨 [CONTAMINATION DETECTED] GitHub token in OpenAI field!");
        console.error("   Full value:", formData.openaiKey);
        console.error("   This should not happen! Investigating...");

        // Try to trace where this came from
        console.trace("Stack trace for contamination:");
      }
    }
  }, [formData.openaiKey]);

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

      // 🚨 CRITICAL: Check what's in the API response
      console.log("🔍 [API RESPONSE CHECK] Raw API response:", JSON.stringify(response.data, null, 2));
      console.log("🔍 [API RESPONSE CHECK] hasOpenAIKey:", userData.hasOpenAIKey);
      console.log("🔍 [API RESPONSE CHECK] hasGitHubToken:", userData.hasGitHubToken);

      // Check for any unexpected fields
      if ('openaiKey' in userData || 'githubToken' in userData) {
        console.error("🚨🚨🚨 [SECURITY ALERT] Raw keys found in API response!");
        console.error("   openaiKey field:", userData.openaiKey);
        console.error("   githubToken field:", userData.githubToken);
      }

      // 获取实际的key值而不是占位符
      const newFormData = {
        openaiKey: "",
        claudeKey: "",
        geminiKey: "",
        githubToken: "",
        defaultRepoUrl: userData.defaultRepoUrl || "",
        language: userData.settings?.language || "zh-CN",
        theme: userData.settings?.theme || "light",
      };

      // 获取实际的API keys
      const keyTypes = [];
      if (userData.hasOpenAIKey) keyTypes.push({ type: "openai", field: "openaiKey" });
      if (userData.hasClaudeKey) keyTypes.push({ type: "claude", field: "claudeKey" });
      if (userData.hasGeminiKey) keyTypes.push({ type: "gemini", field: "geminiKey" });
      if (userData.hasGitHubToken) keyTypes.push({ type: "github", field: "githubToken" });

      // 并行获取所有存在的keys
      const keyPromises = keyTypes.map(async ({ type, field }) => {
        try {
          console.log(`🔑 [FETCH KEY] Fetching ${type} key...`);
          const response = await api.post("/api/user/get-api-key", { keyType: type });
          if (response.data?.key) {
            console.log(`✅ [FETCH KEY] Retrieved ${type} key: ${response.data.key.slice(0, 10)}...`);
            return { field, value: response.data.key };
          }
        } catch (error) {
          console.error(`❌ [FETCH KEY] Failed to fetch ${type} key:`, error);
        }
        return null;
      });

      const fetchedKeys = await Promise.all(keyPromises);

      // 更新formData中的实际key值
      fetchedKeys.forEach(result => {
        if (result && result.value) {
          newFormData[result.field as keyof typeof newFormData] = result.value;
          console.log(`📝 [SET KEY] Setting ${result.field} to: ${result.value.slice(0, 10)}...`);
        }
      });

      // 显示获取到的实际值
      console.log("✅ [FETCHED] Successfully fetched actual API keys:");
      console.log("   - openaiKey:", newFormData.openaiKey ? `${newFormData.openaiKey.slice(0, 20)}...${newFormData.openaiKey.slice(-10)}` : "empty");
      console.log("   - claudeKey:", newFormData.claudeKey ? `${newFormData.claudeKey.slice(0, 20)}...` : "empty");
      console.log("   - geminiKey:", newFormData.geminiKey ? `${newFormData.geminiKey.slice(0, 20)}...` : "empty");
      console.log("   - githubToken:", newFormData.githubToken ? `${newFormData.githubToken.slice(0, 20)}...${newFormData.githubToken.slice(-10)}` : "empty");

      setFormData(newFormData);

      // 验证状态是否正确设置（使用newFormData而不是formData因为setState是异步的）
      setTimeout(() => {
        console.log("🔍 [VERIFICATION] Values that were set to state:");
        console.log("   - openaiKey was set to:", newFormData.openaiKey);
        console.log("   - githubToken was set to:", newFormData.githubToken);
      }, 100);
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

  // GitHub配置保存
  const handleSaveGitHub = async () => {
    setIsLoading(true);
    try {
      const updateData: any = {
        defaultRepoUrl: formData.defaultRepoUrl,
      };

      // 只有当用户输入了新的GitHub Token时才更新
      if (formData.githubToken &&
          formData.githubToken !== "••••••••" &&
          formData.githubToken.trim() !== "" &&
          (formData.githubToken.startsWith("ghp_") || formData.githubToken.startsWith("gho_") || formData.githubToken.startsWith("github_pat_"))) {
        updateData.githubToken = formData.githubToken.trim();
        console.log("🔑 [GITHUB TOKEN] Will save GitHub token:", formData.githubToken.slice(0, 10) + "...");
      } else if (formData.githubToken && formData.githubToken !== "••••••••") {
        console.warn("⚠️ [GITHUB TOKEN] Invalid GitHub token format. Should start with ghp_, gho_, or github_pat_");
      }

      console.log("🔧 [GITHUB] Saving GitHub settings:", updateData);
      const response = await api.post("/api/user/settings", updateData);
      console.log("🔧 [GITHUB] Settings saved response:", response.data);

      // 显示成功对话框
      setShowSuccessDialog(true);

      // 重新获取用户数据以确保显示最新值
      await fetchUserData();
    } catch (error) {
      console.error("❌ [GITHUB] GitHub settings save failed:", error);
      alert("GitHub配置保存失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  // 模型配置保存
  const handleSaveModels = async () => {
    setIsLoading(true);
    try {
      const updateData: any = {};

      console.log("🤖 [MODELS] Form data before processing:", {
        openaiKey: formData.openaiKey,
        claudeKey: formData.claudeKey,
        geminiKey: formData.geminiKey
      });

      // 只有当用户输入了新的API Key时才更新（排除占位符和空值）
      if (formData.openaiKey &&
          formData.openaiKey.trim() !== "" &&
          !formData.openaiKey.includes("•") &&
          (formData.openaiKey.startsWith("sk-") || formData.openaiKey.startsWith("sk-proj-"))) {
        updateData.openaiKey = formData.openaiKey;
        console.log("🔑 [OPENAI] Will save OpenAI key:", formData.openaiKey.slice(0, 12) + "..." + formData.openaiKey.slice(-4));
      }

      if (formData.claudeKey &&
          formData.claudeKey.trim() !== "" &&
          !formData.claudeKey.includes("•") &&
          formData.claudeKey.startsWith("sk-ant-")) {
        updateData.claudeKey = formData.claudeKey;
        console.log("🔑 [CLAUDE] Will save Claude key:", formData.claudeKey.slice(0, 8) + "..." + formData.claudeKey.slice(-4));
      }

      if (formData.geminiKey &&
          formData.geminiKey.trim() !== "" &&
          !formData.geminiKey.includes("•") &&
          formData.geminiKey.startsWith("AI")) {
        updateData.geminiKey = formData.geminiKey;
        console.log("🔑 [GEMINI] Will save Gemini key:", formData.geminiKey.slice(0, 8) + "..." + formData.geminiKey.slice(-4));
      }

      // 检查是否有任何内容需要保存
      if (Object.keys(updateData).length === 0) {
        alert("没有检测到有效的API Key。请确保:\n• OpenAI key 以 'sk-' 或 'sk-proj-' 开头\n• Claude key 以 'sk-ant-' 开头\n• Gemini key 以 'AI' 开头");
        return;
      }

      console.log("🤖 [MODELS] Saving model settings:", updateData);
      const response = await api.post("/api/user/settings", updateData);
      console.log("🤖 [MODELS] Settings saved response:", response.data);

      // 显示成功对话框
      setShowSuccessDialog(true);

      // 重新获取用户数据以确保显示最新值
      await fetchUserData();
    } catch (error) {
      console.error("❌ [MODELS] Model settings save failed:", error);
      alert("模型配置保存失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  // 偏好设置保存
  const handleSavePreferences = async () => {
    setIsLoading(true);
    try {
      const updateData: any = {
        language: formData.language,
        theme: formData.theme,
      };

      console.log("⚙️ [PREFERENCES] Saving preference settings:", updateData);
      const response = await api.post("/api/user/settings", updateData);
      console.log("⚙️ [PREFERENCES] Settings saved response:", response.data);

      // 显示成功对话框
      setShowSuccessDialog(true);

      // 重新获取用户数据以确保显示最新值
      await fetchUserData();

      // 如果更改了主题，应用新主题
      if (formData.theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch (error) {
      console.error("❌ [PREFERENCES] Preference settings save failed:", error);
      alert("偏好设置保存失败，请重试");
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

  const testApiKey = async (type: 'openai' | 'claude' | 'gemini') => {
    console.log(`🧪 [TEST START] Testing ${type} key`);
    console.log(`📋 [FORM DATA] Current formData[${type}Key]:`, formData[`${type}Key`]);

    let keyValue = formData[`${type}Key`];

    // Check if we have a key to test or need to retrieve saved key
    if (!keyValue || keyValue === "") {
      console.log(`🔍 [EMPTY FIELD] No key in form field, checking if saved key exists...`);

      // Check if we have a saved key by consulting the user profile
      const profileResponse = await api.get('/api/user/profile');

      // Map field names correctly - backend uses specific capitalization
      const fieldMapping = {
        'openai': 'hasOpenAIKey',
        'claude': 'hasClaudeKey',
        'gemini': 'hasGeminiKey'
      };
      const hasKeyField = fieldMapping[type];
      const hasSavedKey = profileResponse.data[hasKeyField];

      console.log(`🔍 [PROFILE CHECK] ${hasKeyField}: ${hasSavedKey}`);

      if (!hasSavedKey) {
        console.log(`❌ [ERROR] No key found in form and no saved key exists`);
        alert(`请先输入${type === 'openai' ? 'OpenAI' : type === 'claude' ? 'Claude' : 'Gemini'} API Key`);
        return;
      }

      // We have a saved key, retrieve it
      console.log(`🔍 [RETRIEVE] Retrieving saved ${type} key...`);
      try {
        const keyResponse = await api.post('/api/user/get-api-key', { keyType: type });
        keyValue = keyResponse.data.key;
        console.log(`✅ [RETRIEVED] Retrieved ${type} key: ${keyValue.slice(0, 8)}...${keyValue.slice(-4)}`);
      } catch (error) {
        console.error(`❌ [ERROR] Failed to retrieve saved ${type} key:`, error);
        alert(`无法获取保存的${type === 'openai' ? 'OpenAI' : type === 'claude' ? 'Claude' : 'Gemini'} API Key`);
        return;
      }
    }

    console.log(`🔑 [KEY TYPE] Key value type: ${typeof keyValue}, length: ${keyValue.length}`);
    console.log(`🔑 [KEY PREVIEW] Key preview: "${keyValue}"`);

    // Update loading state
    setTestStates(prev => ({
      ...prev,
      [type]: { loading: true, result: null }
    }));
    console.log(`⏳ [STATE] Set loading state to true for ${type}`);

    try {
      // If the key is a placeholder (meaning it's saved), retrieve the actual key
      if (keyValue === "••••••••") {
        console.log(`🔍 [PLACEHOLDER] Detected placeholder for ${type}, retrieving saved key`);
        console.log(`📡 [API CALL] Calling /api/user/get-api-key with keyType: ${type}`);

        const keyResponse = await api.post('/api/user/get-api-key', { keyType: type });
        console.log(`📡 [API RESPONSE] get-api-key response status:`, keyResponse.status);
        console.log(`📡 [API RESPONSE] get-api-key response data:`, keyResponse.data);

        keyValue = keyResponse.data.key;
        console.log(`✅ [RETRIEVED] Retrieved ${type} key: ${keyValue.slice(0, 8)}...${keyValue.slice(-4)}`);
        console.log(`✅ [RETRIEVED] Full key length: ${keyValue.length}`);
      } else {
        console.log(`🚀 [DIRECT] Using direct key value (not placeholder) for ${type}`);
      }

      const endpoint = `/api/user/verify-${type}-key`;
      const payload = { [`${type}Key`]: keyValue };

      console.log(`📡 [VERIFY] Calling verification endpoint: ${endpoint}`);
      console.log(`📡 [VERIFY] Payload key preview: ${keyValue.slice(0, 8)}...${keyValue.slice(-4)}`);

      const response = await api.post(endpoint, payload);
      console.log(`📡 [VERIFY RESPONSE] Status: ${response.status}`);
      console.log(`📡 [VERIFY RESPONSE] Data:`, response.data);

      const isValid = response.data.valid;
      console.log(`✅ [RESULT] Verification result for ${type}: ${isValid}`);

      // Update result state
      setTestStates(prev => ({
        ...prev,
        [type]: { loading: false, result: isValid }
      }));
      console.log(`🎯 [STATE] Updated test state for ${type}: loading=false, result=${isValid}`);

      // Auto-clear result after 3 seconds
      setTimeout(() => {
        setTestStates(prev => ({
          ...prev,
          [type]: { loading: false, result: null }
        }));
        console.log(`🕐 [TIMEOUT] Cleared test result for ${type} after 3 seconds`);
      }, 3000);

    } catch (error) {
      console.error(`❌ [ERROR] Failed to test ${type} key:`, error);
      console.error(`❌ [ERROR] Error details:`, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      // Update error state
      setTestStates(prev => ({
        ...prev,
        [type]: { loading: false, result: false }
      }));
      console.log(`🎯 [STATE] Updated test state for ${type} (error): loading=false, result=false`);

      // Auto-clear result after 3 seconds
      setTimeout(() => {
        setTestStates(prev => ({
          ...prev,
          [type]: { loading: false, result: null }
        }));
        console.log(`🕐 [TIMEOUT] Cleared error result for ${type} after 3 seconds`);
      }, 3000);
    }
    console.log(`🏁 [TEST END] Finished testing ${type} key`);
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
              onClick={() => setActiveTab("github")}
              className={`pb-3 px-1 border-b-2 transition-colors ${
                activeTab === "github"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              GitHub配置
            </button>
            <button
              onClick={() => setActiveTab("models")}
              className={`pb-3 px-1 border-b-2 transition-colors ${
                activeTab === "models"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              模型配置
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

          {/* GitHub配置 */}
          {activeTab === "github" && (
            <div className="space-y-6">
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
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-form-type="other"
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

          {/* 模型配置 */}
          {activeTab === "models" && (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  🤖 AI模型配置说明
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                  配置不同的AI模型API Key，在创建Agent时可以选择使用的模型：
                </p>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• <strong>OpenAI</strong>：GPT-4、GPT-3.5等模型</li>
                  <li>• <strong>Claude</strong>：Anthropic的Claude模型系列</li>
                  <li>• <strong>Gemini</strong>：Google的Gemini模型系列</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  OpenAI API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={formData.openaiKey}
                    onChange={(e) => setFormData({ ...formData, openaiKey: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="sk-..."
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-form-type="other"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => testApiKey('openai')}
                    disabled={testStates.openai.loading || !formData.openaiKey || formData.openaiKey === "••••••••"}
                    className="px-3 py-2 min-w-[80px]"
                  >
                    {testStates.openai.loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : testStates.openai.result === true ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : testStates.openai.result === false ? (
                      <XCircle className="w-4 h-4 text-red-600" />
                    ) : (
                      "测试"
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  用于GPT-4、GPT-3.5等OpenAI模型，格式：sk-...
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Claude API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={formData.claudeKey}
                    onChange={(e) => setFormData({ ...formData, claudeKey: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="sk-ant-..."
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => testApiKey('claude')}
                    disabled={testStates.claude.loading || !formData.claudeKey || formData.claudeKey === "••••••••"}
                    className="px-3 py-2 min-w-[80px]"
                  >
                    {testStates.claude.loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : testStates.claude.result === true ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : testStates.claude.result === false ? (
                      <XCircle className="w-4 h-4 text-red-600" />
                    ) : (
                      "测试"
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  用于Claude-3.5-Sonnet、Claude-3等Anthropic模型，格式：sk-ant-...
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Gemini API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={formData.geminiKey}
                    onChange={(e) => setFormData({ ...formData, geminiKey: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="AI..."
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => testApiKey('gemini')}
                    disabled={testStates.gemini.loading || !formData.geminiKey || formData.geminiKey === "••••••••"}
                    className="px-3 py-2 min-w-[80px]"
                  >
                    {testStates.gemini.loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : testStates.gemini.result === true ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : testStates.gemini.result === false ? (
                      <XCircle className="w-4 h-4 text-red-600" />
                    ) : (
                      "测试"
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  用于Gemini Pro、Gemini Ultra等Google模型，格式：AI...
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>💡 提示：</strong>所有API Key都将使用AES加密安全存储。您可以只配置需要使用的模型API Key，未配置的模型将在Agent创建时不可选择。
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

          {/* 保存按钮 - 根据不同标签页调用不同的保存函数 */}
          {activeTab === "github" && (
            <div className="mt-8">
              <button
                onClick={handleSaveGitHub}
                disabled={isLoading}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {isLoading ? "保存中..." : "保存GitHub配置"}
              </button>
            </div>
          )}

          {activeTab === "models" && (
            <div className="mt-8">
              <button
                onClick={handleSaveModels}
                disabled={isLoading}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {isLoading ? "保存中..." : "保存模型配置"}
              </button>
            </div>
          )}

          {activeTab === "preferences" && (
            <div className="mt-8">
              <button
                onClick={handleSavePreferences}
                disabled={isLoading}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {isLoading ? "保存中..." : "保存偏好设置"}
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full dark:bg-green-900">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-center">设置保存成功</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              您的配置已成功更新
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center mt-6">
            <Button
              onClick={() => setShowSuccessDialog(false)}
              className="w-full"
            >
              确定
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import Navigation from "@/components/Navigation";
import axios from "axios";

interface Template {
  id: string;
  name: string;
  description: string;
  config: {
    language: string;
    tone: string;
    lengthPreference: string;
    targetAudience?: string;
    customPrompt?: string;
  };
}

export default function NewAgentPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    avatar: "✨",
    language: "zh-CN",
    tone: "professional",
    lengthPreference: "medium",
    targetAudience: "",
    customPrompt: "",
    outputFormat: "markdown",
    isDefault: false,
  });

  // 获取模板
  useState(() => {
    axios.get("/api/agents/templates/list").then((res) => {
      setTemplates(res.data.templates);
    });
  });

  const handleTemplateSelect = (template: Template) => {
    setFormData({
      ...formData,
      name: template.name,
      description: template.description,
      ...template.config,
    });
    setShowTemplates(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await axios.post("/api/agents", formData);
      router.push("/agents");
    } catch (error: any) {
      alert(error.response?.data?.error || "创建失败");
    } finally {
      setIsLoading(false);
    }
  };

  const avatarOptions = ["✨", "🌟", "💎", "🔮", "⚡", "🎭", "🎨", "🧠", "🚀", "✍️", "📝", "💡"];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navigation />
        
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-8">
            <Link
              href="/agents"
              className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
            >
              ← 返回Agent列表
            </Link>
            <h1 className="text-2xl font-bold">创建新Agent</h1>
          </div>

          {showTemplates && templates.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">选择模板</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="p-4 border rounded-lg hover:border-primary text-left transition-colors"
                  >
                    <h3 className="font-medium mb-2">{template.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  </button>
                ))}
              </div>
              <div className="text-center">
                <button
                  onClick={() => setShowTemplates(false)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  跳过，自定义创建
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 基础信息 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">基础信息</h3>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  选择头像
                </label>
                <div className="flex gap-2">
                  {avatarOptions.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormData({ ...formData, avatar: emoji })}
                      className={`w-12 h-12 rounded-lg border text-xl hover:border-primary transition-colors ${
                        formData.avatar === emoji ? "border-primary bg-primary/10" : ""
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Agent名称 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="例如：技术博主"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={2}
                  placeholder="简单描述这个Agent的特点"
                />
              </div>
            </div>

            {/* 写作风格 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">写作风格</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    语言
                  </label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="zh-CN">中文</option>
                    <option value="en-US">英文</option>
                    <option value="mixed">中英混合</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    语气
                  </label>
                  <select
                    value={formData.tone}
                    onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="professional">专业</option>
                    <option value="casual">轻松</option>
                    <option value="humorous">幽默</option>
                    <option value="serious">严肃</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  篇幅偏好
                </label>
                <select
                  value={formData.lengthPreference}
                  onChange={(e) => setFormData({ ...formData, lengthPreference: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="short">简洁（500字以内）</option>
                  <option value="medium">适中（500-1500字）</option>
                  <option value="long">详细（1500字以上）</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  目标受众
                </label>
                <input
                  type="text"
                  value={formData.targetAudience}
                  onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="例如：技术开发者、普通读者等"
                />
              </div>
            </div>

            {/* 高级设置 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">高级设置</h3>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  自定义提示词
                </label>
                <textarea
                  value={formData.customPrompt}
                  onChange={(e) => setFormData({ ...formData, customPrompt: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="为Agent添加特殊的写作指令..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  输出格式
                </label>
                <select
                  value={formData.outputFormat}
                  onChange={(e) => setFormData({ ...formData, outputFormat: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="markdown">Markdown</option>
                  <option value="mdx">MDX</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="isDefault" className="text-sm">
                  设为默认Agent
                </label>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {isLoading ? "创建中..." : "创建Agent"}
              </button>
              <Link
                href="/agents"
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted text-center"
              >
                取消
              </Link>
            </div>
          </form>
        </main>
      </div>
    </ProtectedRoute>
  );
}
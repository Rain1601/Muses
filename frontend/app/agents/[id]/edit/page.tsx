"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import Navigation from "@/components/Navigation";
import { api } from "@/lib/api";

interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  language: string;
  tone: string;
  lengthPreference: string;
  targetAudience?: string;
  customPrompt?: string;
  outputFormat: string;
  isDefault: boolean;
}

export default function EditAgentPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id as string;
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [styleAnalysisResult, setStyleAnalysisResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<Agent>({
    id: "",
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

  useEffect(() => {
    fetchAgent();
  }, [agentId]);

  const fetchAgent = async () => {
    try {
      const response = await api.get(`/api/agents/${agentId}`);
      setFormData(response.data.agent);
    } catch (error) {
      console.error("Failed to fetch agent:", error);
      alert("获取Agent信息失败");
      router.push("/agents");
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await api.put(`/api/agents/${agentId}`, formData);
      router.push("/agents");
    } catch (error: any) {
      alert(error.response?.data?.error || "更新失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    const allowedTypes = ['.md', '.txt', '.json'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedTypes.includes(fileExt)) {
      alert(`不支持的文件类型。请上传 ${allowedTypes.join(', ')} 格式的文件`);
      return;
    }

    // 验证文件大小 (1MB)
    if (file.size > 1024 * 1024) {
      alert('文件大小不能超过 1MB');
      return;
    }

    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/api/agents/analyze-style-file', formData);
      setStyleAnalysisResult(response.data);
    } catch (error: any) {
      alert(error.response?.data?.error || '分析失败，请重试');
    } finally {
      setIsAnalyzing(false);
      // 清空文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleApplyStyle = () => {
    if (styleAnalysisResult?.styleDescription) {
      setFormData({
        ...formData,
        customPrompt: styleAnalysisResult.styleDescription
      });
      setStyleAnalysisResult(null);
    }
  };

  const handleTextAnalysis = async (text: string) => {
    if (!text.trim()) {
      alert('请输入要分析的文本');
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await api.post('/api/agents/analyze-style', {
        content: text,
        contentType: null // 让AI自动检测
      });
      setStyleAnalysisResult(response.data);
    } catch (error: any) {
      alert(error.response?.data?.error || '分析失败，请重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const avatarOptions = ["✨", "🌟", "💎", "🔮", "⚡", "🎭", "🎨", "🧠", "🚀", "✍️", "📝", "💡"];

  if (isFetching) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background">
          <Navigation />
          <div className="container mx-auto px-4 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

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
            <h1 className="text-2xl font-bold">编辑Agent</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 基础信息 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">基础信息</h3>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  选择头像
                </label>
                <div className="flex gap-2 flex-wrap">
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
                  value={formData.description || ""}
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
                  value={formData.targetAudience || ""}
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
                  value={formData.customPrompt || ""}
                  onChange={(e) => setFormData({ ...formData, customPrompt: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="为Agent添加特殊的写作指令..."
                />
                
                {/* 写作风格分析工具 */}
                <div className="mt-3 p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">AI 风格分析助手</span>
                    <span className="text-xs text-muted-foreground">上传文件或粘贴文本</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".md,.txt,.json"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="style-file-input"
                    />
                    <label
                      htmlFor="style-file-input"
                      className="flex-1 px-3 py-2 text-sm border rounded-lg hover:bg-muted cursor-pointer text-center"
                    >
                      📁 上传文件 (.md, .txt, .json)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const text = prompt('请粘贴要分析的文本内容：');
                        if (text) handleTextAnalysis(text);
                      }}
                      className="flex-1 px-3 py-2 text-sm border rounded-lg hover:bg-muted"
                    >
                      📝 粘贴文本分析
                    </button>
                  </div>
                  
                  {isAnalyzing && (
                    <div className="mt-3 text-center text-sm text-muted-foreground">
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                      正在分析写作风格...
                    </div>
                  )}
                  
                  {styleAnalysisResult && (
                    <div className="mt-3 p-3 bg-background border rounded-lg">
                      <div className="text-sm space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">检测类型：</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            styleAnalysisResult.detectedType === 'conversation' 
                              ? 'bg-accent/20 text-accent-foreground' 
                              : 'bg-primary/20 text-primary-foreground'
                          }`}>
                            {styleAnalysisResult.detectedType === 'conversation' ? '💬 对话记录' : '📄 文章内容'}
                          </span>
                        </div>
                        
                        <div>
                          <span className="font-medium">风格描述：</span>
                          <div className="mt-1 p-2 bg-muted/50 rounded text-xs leading-relaxed">
                            {styleAnalysisResult.styleDescription}
                          </div>
                        </div>
                        
                        {styleAnalysisResult.characteristics && (
                          <details className="cursor-pointer">
                            <summary className="font-medium text-xs hover:text-primary">
                              查看详细特征分析 ▼
                            </summary>
                            <div className="mt-2 pl-4 space-y-1 text-xs text-muted-foreground">
                              {Object.entries(styleAnalysisResult.characteristics).map(([key, value]) => (
                                <div key={key}>
                                  <span className="font-medium">
                                    {key === 'language' ? '语言特点' :
                                     key === 'tone' ? '语气风格' :
                                     key === 'sentenceStyle' ? '句式特点' :
                                     key === 'vocabulary' ? '用词特征' :
                                     key === 'specialTraits' ? '特殊习惯' : key}：
                                  </span>
                                  <span className="ml-1">{value as string}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                        
                        <div className="pt-2 space-y-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleApplyStyle}
                              className="flex-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"
                            >
                              ✅ 应用到提示词
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const refinement = prompt('请输入额外的风格要求或修改建议：');
                                if (refinement) {
                                  setFormData({
                                    ...formData,
                                    customPrompt: styleAnalysisResult.styleDescription + '\n\n额外要求：' + refinement
                                  });
                                  setStyleAnalysisResult(null);
                                }
                              }}
                              className="px-3 py-1.5 text-sm border rounded hover:bg-muted"
                              title="在应用前添加额外要求"
                            >
                              ✏️ 调整
                            </button>
                            <button
                              type="button"
                              onClick={() => setStyleAnalysisResult(null)}
                              className="px-3 py-1.5 text-sm border rounded hover:bg-muted"
                            >
                              ❌
                            </button>
                          </div>
                          <div className="text-xs text-center text-muted-foreground">
                            提示：你可以多次分析不同文本，组合生成更准确的风格描述
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
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
                {isLoading ? "保存中..." : "保存更改"}
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
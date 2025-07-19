"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import { Navbar } from "@/components/navbar";
import axios from "axios";

interface Agent {
  id: string;
  name: string;
  avatar?: string;
}

export default function NewArticlePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"material" | "chat" | "improve">("material");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  
  // 素材模式状态
  const [materials, setMaterials] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [requirements, setRequirements] = useState("");
  
  // 对话模式状态
  const [chatMessages, setChatMessages] = useState<Array<{role: string; content: string}>>([]);
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await axios.get("/api/agents");
      setAgents(response.data.agents);
      // 设置默认Agent
      const defaultAgent = response.data.agents.find((a: Agent) => a.isDefault);
      if (defaultAgent) {
        setSelectedAgent(defaultAgent.id);
      } else if (response.data.agents.length > 0) {
        setSelectedAgent(response.data.agents[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const uploadResponse = await axios.post("/api/upload/file", formData);
      const fileInfo = uploadResponse.data.file;
      
      // 解析文件内容
      const parseResponse = await axios.post("/api/upload/parse", {
        fileId: fileInfo.id,
      });
      
      setUploadedFiles([...uploadedFiles, fileInfo]);
      setMaterials(materials + "\n\n" + parseResponse.data.content);
    } catch (error: any) {
      alert(error.response?.data?.error || "文件上传失败");
    }
  };

  const handleGenerate = async () => {
    if (!selectedAgent) {
      alert("请选择一个Agent");
      return;
    }

    if (mode === "material" && !materials.trim()) {
      alert("请输入素材内容");
      return;
    }

    setIsLoading(true);

    try {
      let response;
      
      if (mode === "material") {
        response = await axios.post("/api/generate/article", {
          agentId: selectedAgent,
          materials,
          title,
          requirements,
          saveAsDraft: true,
        });
      } else if (mode === "chat") {
        response = await axios.post("/api/generate/chat", {
          agentId: selectedAgent,
          messages: chatMessages,
          saveAsDraft: true,
        });
      }

      if (response?.data.article) {
        router.push(`/articles/${response.data.article.id}/edit`);
      }
    } catch (error: any) {
      if (error.response?.data?.code === "OPENAI_KEY_MISSING") {
        if (confirm("您还未配置OpenAI API Key，是否前往设置？")) {
          router.push("/settings");
        }
      } else {
        alert(error.response?.data?.error || "生成失败");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatSend = () => {
    if (!chatInput.trim()) return;
    
    setChatMessages([...chatMessages, { role: "user", content: chatInput }]);
    setChatInput("");
    
    // 这里可以添加AI回复的逻辑
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        
        <main className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="mb-8">
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
            >
              ← 返回工作台
            </Link>
            <h1 className="text-2xl font-bold">创建新文章</h1>
          </div>

          {/* 模式选择 */}
          <div className="mb-8">
            <div className="flex gap-4 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setMode("material")}
                className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                  mode === "material"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                📄 从素材生成
              </button>
              <button
                onClick={() => setMode("chat")}
                className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                  mode === "chat"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                💬 对话式生成
              </button>
              <button
                onClick={() => setMode("improve")}
                className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                  mode === "improve"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                disabled
              >
                ✨ 增量完善
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 左侧：内容输入区 */}
            <div className="lg:col-span-2 space-y-6">
              {mode === "material" ? (
                <>
                  {/* 文件上传 */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      上传素材文件（可选）
                    </label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        accept=".pdf,.md,.txt,.doc,.docx"
                        className="hidden"
                        id="file-upload"
                      />
                      <label
                        htmlFor="file-upload"
                        className="cursor-pointer"
                      >
                        <div className="text-3xl mb-2">📁</div>
                        <p className="text-sm text-muted-foreground">
                          点击或拖拽文件到此处
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          支持 PDF、MD、TXT 等格式
                        </p>
                      </label>
                    </div>
                    {uploadedFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="text-sm text-muted-foreground">
                            ✓ {file.originalName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 素材内容 */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      素材内容 *
                    </label>
                    <textarea
                      value={materials}
                      onChange={(e) => setMaterials(e.target.value)}
                      className="w-full h-64 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      placeholder="粘贴或输入您的素材内容..."
                    />
                  </div>

                  {/* 文章标题 */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      文章标题（可选）
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="如果不填写，AI会自动生成标题"
                    />
                  </div>

                  {/* 额外要求 */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      额外要求（可选）
                    </label>
                    <textarea
                      value={requirements}
                      onChange={(e) => setRequirements(e.target.value)}
                      className="w-full h-24 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      placeholder="例如：重点介绍技术实现、添加代码示例等"
                    />
                  </div>
                </>
              ) : mode === "chat" ? (
                <div className="border rounded-lg h-[600px] flex flex-col">
                  {/* 对话历史 */}
                  <div className="flex-1 p-4 overflow-y-auto">
                    {chatMessages.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <div className="text-3xl mb-2">💬</div>
                        <p>开始对话，让AI帮您生成文章</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {chatMessages.map((msg, index) => (
                          <div
                            key={index}
                            className={`flex ${
                              msg.role === "user" ? "justify-end" : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[80%] px-4 py-2 rounded-lg ${
                                msg.role === "user"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}
                            >
                              {msg.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* 输入区 */}
                  <div className="border-t p-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleChatSend()}
                        className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="输入您的想法..."
                      />
                      <button
                        onClick={handleChatSend}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                      >
                        发送
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* 右侧：Agent选择 */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">选择Agent</h3>
                {agents.length === 0 ? (
                  <div className="text-center py-8 border rounded-lg">
                    <p className="text-muted-foreground mb-4">
                      还没有创建Agent
                    </p>
                    <Link
                      href="/agents/new"
                      className="text-primary hover:underline"
                    >
                      创建Agent
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {agents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => setSelectedAgent(agent.id)}
                        className={`w-full p-4 border rounded-lg text-left transition-colors ${
                          selectedAgent === agent.id
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="text-2xl">{agent.avatar || "🤖"}</div>
                          <div>
                            <div className="font-medium">{agent.name}</div>
                            {agent.isDefault && (
                              <div className="text-xs text-muted-foreground">
                                默认
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 生成按钮 */}
              <button
                onClick={handleGenerate}
                disabled={isLoading || !selectedAgent}
                className="w-full py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 font-medium"
              >
                {isLoading ? "生成中..." : "生成文章"}
              </button>

              {/* 提示 */}
              <div className="text-sm text-muted-foreground space-y-2">
                <p>💡 提示：</p>
                <ul className="space-y-1 ml-4">
                  <li>• 素材越详细，生成效果越好</li>
                  <li>• 不同Agent会产生不同风格</li>
                  <li>• 生成后可以继续编辑优化</li>
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import Navigation from "@/components/Navigation";
import { api } from "@/lib/api";

interface Agent {
  id: string;
  name: string;
  avatar?: string;
  isDefault?: boolean;
}

export default function NewArticlePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"chat">("chat");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  
  // 素材和文件状态
  const [materials, setMaterials] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  
  // 对话模式状态
  const [chatMessages, setChatMessages] = useState<Array<{role: string; content: string}>>([]);
  const [chatInput, setChatInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await api.get("/api/agents");
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
      const uploadResponse = await api.post("/api/upload/file", formData);
      const fileInfo = uploadResponse.data.file;
      
      // 解析文件内容
      const parseResponse = await api.post("/api/upload/parse", {
        fileId: fileInfo.id,
      });
      
      setUploadedFiles([...uploadedFiles, { ...fileInfo, content: parseResponse.data.content }]);
      setMaterials(materials + "\n\n" + parseResponse.data.content);
    } catch (error: any) {
      alert(error.response?.data?.error || "文件上传失败");
    }
  };

  const handleFileDelete = (index: number) => {
    const fileToDelete = uploadedFiles[index];
    
    // 从文件列表中移除
    const newUploadedFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newUploadedFiles);
    
    // 从素材内容中移除该文件的内容
    if (fileToDelete.content) {
      const newMaterials = materials.replace(fileToDelete.content, "").replace(/\n\n+/g, "\n\n").trim();
      setMaterials(newMaterials);
    }
  };

  const handleGenerate = async () => {
    if (!selectedAgent) {
      alert("请选择一个Agent");
      return;
    }

    if (chatMessages.length === 0) {
      alert("请先开始对话");
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post("/api/generate/chat", {
        agentId: selectedAgent,
        messages: chatMessages,
        materials: materials, // 包含上传的素材
        saveAsDraft: true,
      });

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

  const handleChatSend = async () => {
    if (!chatInput.trim() || !selectedAgent || isComposing) return;
    
    const userMessage = { role: "user", content: chatInput };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setChatInput("");
    
    try {
      // 调用AI对话API，包含素材内容作为上下文
      const response = await api.post("/api/generate/chat-stream", {
        agentId: selectedAgent,
        messages: newMessages,
        materials: materials || "", // 包含上传的素材内容
      });
      
      // 添加AI回复
      const aiMessage = { role: "assistant", content: response.data.response };
      setChatMessages([...newMessages, aiMessage]);
    } catch (error: any) {
      console.error("Chat error:", error);
      // 添加错误提示
      const errorMessage = { 
        role: "assistant", 
        content: "抱歉，我遇到了一些问题。请检查网络连接或稍后重试。" 
      };
      setChatMessages([...newMessages, errorMessage]);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navigation />
        
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


          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 左侧：内容输入区 */}
            <div className="lg:col-span-2 space-y-6">
              <div className="space-y-6">
                  {/* 文件上传区 - 整合到对话模式 */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      上传素材文件（可选）
                    </label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary transition-colors">
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        accept=".pdf,.md,.txt,.doc,.docx"
                        className="hidden"
                        id="chat-file-upload"
                      />
                      <label
                        htmlFor="chat-file-upload"
                        className="cursor-pointer"
                      >
                        <div className="text-2xl mb-1">📁</div>
                        <p className="text-sm text-muted-foreground">
                          上传文件后可以在对话中引用
                        </p>
                      </label>
                    </div>
                    {uploadedFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                            <span>✓ {file.originalName}</span>
                            <button
                              onClick={() => handleFileDelete(index)}
                              className="text-red-500 hover:text-red-700 ml-2 p-1"
                              title="删除文件"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 对话区域 */}
                  <div className="border rounded-lg h-[500px] flex flex-col">
                    {/* 对话历史 */}
                    <div className="flex-1 p-4 overflow-y-auto">
                      {chatMessages.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                          <div className="text-3xl mb-2">💬</div>
                          <p>开始对话，让AI帮您生成文章</p>
                          <p className="text-xs mt-2">提示：可以先上传文件，然后在对话中询问相关问题</p>
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
                                className={`max-w-[80%] px-4 py-2 rounded-lg whitespace-pre-wrap ${
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
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && !isComposing) {
                              e.preventDefault();
                              handleChatSend();
                            }
                          }}
                          onCompositionStart={() => setIsComposing(true)}
                          onCompositionEnd={() => setIsComposing(false)}
                          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="输入您的想法... (Enter发送，Shift+Enter换行)"
                          disabled={!selectedAgent}
                        />
                        <button
                          onClick={handleChatSend}
                          disabled={!selectedAgent || !chatInput.trim()}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                        >
                          发送
                        </button>
                      </div>
                      {materials && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          已上传素材内容，AI可以在对话中引用这些信息
                        </div>
                      )}
                    </div>
                  </div>
                </div>
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
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center text-white text-lg font-bold">
                            {agent.avatar || "✨"}
                          </div>
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
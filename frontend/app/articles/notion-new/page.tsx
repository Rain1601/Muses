"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import Navigation from "@/components/Navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Eye } from 'lucide-react';
import AdvancedTiptapWrapper from '@/components/AdvancedTiptapWrapper';
import '@/app/editor-demo/mermaid-styles.css';

// 动态导入 TurndownService
const getTurndownService = async () => {
  const TurndownService = (await import('turndown')).default;
  return new TurndownService();
};

interface Agent {
  id: string;
  name: string;
  avatar?: string;
  isDefault?: boolean;
}

export default function NotionNewPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

  const handleSave = async () => {
    if (!title.trim()) {
      alert("请输入文章标题");
      return;
    }

    if (!content.trim()) {
      alert("请输入文章内容");
      return;
    }

    if (!selectedAgent) {
      alert("请选择一个Agent");
      return;
    }

    setIsLoading(true);

    try {
      // 将HTML转换为Markdown
      const turndownService = await getTurndownService();
      const markdownContent = turndownService.turndown(content);
      
      const response = await api.post("/api/articles", {
        agentId: selectedAgent,
        title: title.trim(),
        content: markdownContent.trim(),
        summary: "", // 可以后续添加自动生成摘要的功能
      });

      if (response?.data.article) {
        router.push(`/articles/${response.data.article.id}`);
      }
    } catch (error: any) {
      console.error("Save error:", error);
      alert(error.response?.data?.error || "保存失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDraft = async () => {
    if (!title.trim() && !content.trim()) {
      alert("请至少输入标题或内容");
      return;
    }

    if (!selectedAgent) {
      alert("请选择一个Agent");
      return;
    }

    setIsLoading(true);

    try {
      // 将HTML转换为Markdown
      const turndownService = await getTurndownService();
      const markdownContent = content ? turndownService.turndown(content) : "";
      
      const response = await api.post("/api/articles", {
        agentId: selectedAgent,
        title: title.trim() || "无标题",
        content: markdownContent.trim(),
        summary: "",
      });

      if (response?.data.article) {
        router.push(`/dashboard`);
      }
    } catch (error: any) {
      console.error("Save draft error:", error);
      alert(error.response?.data?.error || "保存草稿失败");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navigation />
        
        {/* 顶部工具栏 */}
        <div className="border-b bg-background/80 backdrop-blur sticky top-0 z-40">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/dashboard')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  返回
                </Button>
                <div className="h-6 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-sm text-muted-foreground">
                    Notion 风格编辑器
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleDraft}
                  disabled={isLoading}
                  variant="outline"
                >
                  <Save className="w-4 h-4 mr-1" />
                  {isLoading ? '保存中...' : '保存草稿'}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isLoading || !title.trim() || !content.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="w-4 h-4 mr-1" />
                  {isLoading ? '发布中...' : '发布文章'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 编辑器区域 */}
        <div className="container mx-auto py-8 max-w-6xl px-4">
          {/* 标题编辑 */}
          <div className="bg-card rounded-lg shadow-sm mb-6 p-6 border">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入文章标题..."
              className="text-3xl font-bold border-none shadow-none p-0 h-auto resize-none focus-visible:ring-0 bg-transparent text-foreground placeholder:text-muted-foreground"
              style={{ fontSize: '2rem', lineHeight: '2.5rem' }}
            />
            <div className="mt-2 text-sm text-muted-foreground">
              新建文章 • {new Date().toLocaleString()}
            </div>
          </div>

          {/* Notion 编辑器 */}
          <div className="mb-8">
            <AdvancedTiptapWrapper 
              initialContent=""
              onChange={setContent}
            />
          </div>

          {/* 底部状态栏 */}
          <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>字数: {content.length}</span>
              <span>状态: 草稿</span>
              {selectedAgent && (
                <span>Agent: {agents.find(a => a.id === selectedAgent)?.name}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span>就绪</span>
            </div>
          </div>

          {/* Agent选择浮动面板 */}
          {agents.length > 0 && (
            <div className="fixed bottom-6 right-6 max-w-sm">
              <div className="bg-card border rounded-lg shadow-lg p-4">
                <h3 className="font-medium mb-3 text-sm">选择Agent</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent.id)}
                      className={`w-full p-3 border rounded-lg text-left transition-colors text-sm ${
                        selectedAgent === agent.id
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                          {agent.avatar || "✨"}
                        </div>
                        <div>
                          <div className="font-medium">{agent.name}</div>
                          {agent.isDefault && (
                            <div className="text-xs text-muted-foreground">默认</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
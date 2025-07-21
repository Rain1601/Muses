"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import Navigation from "@/components/Navigation";
import axios from "axios";

interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  language: string;
  tone: string;
  lengthPreference: string;
  isDefault: boolean;
  createdAt: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await axios.get("/api/agents");
      setAgents(response.data.agents);
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个Agent吗？")) return;

    try {
      await axios.delete(`/api/agents/${id}`);
      await fetchAgents();
    } catch (error: any) {
      alert(error.response?.data?.error || "删除失败");
    }
  };

  const toneLabels = {
    professional: "专业",
    casual: "轻松",
    humorous: "幽默",
    serious: "严肃",
  };

  const lengthLabels = {
    short: "简洁",
    medium: "适中",
    long: "详细",
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navigation />
        
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">Agent 管理</h1>
              <p className="text-muted-foreground mt-1">
                创建和管理您的AI写作助手
              </p>
            </div>
            <Link
              href="/agents/new"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
            >
              创建新Agent
            </Link>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-12 border rounded-lg">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold mb-4 mx-auto">
                ✨
              </div>
              <p className="text-muted-foreground mb-4">
                还没有创建任何Agent
              </p>
              <Link
                href="/agents/new"
                className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
              >
                创建第一个Agent
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="border rounded-lg p-6 hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center text-white text-lg font-bold">
                        {agent.avatar || "✨"}
                      </div>
                      <div>
                        <h3 className="font-semibold">{agent.name}</h3>
                        {agent.isDefault && (
                          <span className="text-xs text-primary">默认</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {agent.description && (
                    <p className="text-sm text-muted-foreground mb-4">
                      {agent.description}
                    </p>
                  )}

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm">
                      <span className="text-muted-foreground w-20">语言：</span>
                      <span>{agent.language === "zh-CN" ? "中文" : "英文"}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="text-muted-foreground w-20">语气：</span>
                      <span>{toneLabels[agent.tone as keyof typeof toneLabels]}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="text-muted-foreground w-20">篇幅：</span>
                      <span>{lengthLabels[agent.lengthPreference as keyof typeof lengthLabels]}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/agents/${agent.id}/edit`}
                      className="flex-1 text-center px-3 py-1.5 border rounded hover:bg-muted text-sm"
                    >
                      编辑
                    </Link>
                    <button
                      onClick={() => handleDelete(agent.id)}
                      className="flex-1 px-3 py-1.5 border border-destructive text-destructive rounded hover:bg-destructive/10 text-sm"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
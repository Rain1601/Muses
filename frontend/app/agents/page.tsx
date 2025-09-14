"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import Navigation from "@/components/Navigation";
import { AgentListItem } from "@/components/AgentListItem";
import { AgentDetailView } from "@/components/AgentDetailView";
import { AgentEditForm } from "@/components/AgentEditForm";
import { api } from "@/lib/api";
import { Plus, Bot, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await api.get("/api/agents");
      const agentList = response.data.agents || [];
      setAgents(agentList);

      // 如果没有选中的agent，选择第一个或默认的
      if (!selectedAgent && agentList.length > 0) {
        const defaultAgent = agentList.find((a: Agent) => a.isDefault);
        setSelectedAgent(defaultAgent || agentList[0]);
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAgentSelect = (agent: Agent) => {
    setSelectedAgent(agent);
    setIsEditing(false); // 切换agent时退出编辑模式
  };

  const handleAgentDelete = () => {
    setSelectedAgent(null);
    setIsEditing(false);
    fetchAgents();
  };

  const handleStartEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveAgent = (updatedAgent: Agent) => {
    // 更新agents列表中的数据
    setAgents(prev => prev.map(agent =>
      agent.id === updatedAgent.id ? updatedAgent : agent
    ));
    // 更新选中的agent
    setSelectedAgent(updatedAgent);
    // 退出编辑模式
    setIsEditing(false);
  };

  // 过滤agents
  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navigation />

        <main className="flex h-[calc(100vh-80px)]">
          {/* 左侧栏 - Agent列表 */}
          <aside className="w-80 bg-card border-r border-border flex-shrink-0">
            <div className="h-full flex flex-col">
              {/* 头部 */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">AI Agents</h2>
                  <Link href="/agents/new">
                    <Button size="sm" className="h-8">
                      <Plus className="w-4 h-4 mr-1" />
                      新建
                    </Button>
                  </Link>
                </div>

                {/* 搜索框 */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="搜索Agent..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              {/* Agent列表 */}
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : filteredAgents.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    {searchQuery ? (
                      <>
                        <Search className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">
                          没有找到匹配的Agent
                        </p>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground mb-3">
                          还没有创建任何Agent
                        </p>
                        <Link href="/agents/new">
                          <Button size="sm" variant="outline">
                            <Plus className="w-4 h-4 mr-1" />
                            创建第一个Agent
                          </Button>
                        </Link>
                      </>
                    )}
                  </div>
                ) : (
                  <div>
                    {filteredAgents.map((agent) => (
                      <AgentListItem
                        key={agent.id}
                        agent={agent}
                        isSelected={selectedAgent?.id === agent.id}
                        onClick={() => handleAgentSelect(agent)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* 底部统计 */}
              {!isLoading && agents.length > 0 && (
                <div className="p-3 border-t border-border bg-muted/30">
                  <p className="text-xs text-muted-foreground text-center">
                    共 {agents.length} 个Agent
                  </p>
                </div>
              )}
            </div>
          </aside>

          {/* 右侧区域 - Agent详情或编辑 */}
          <section className="flex-1 bg-background">
            {selectedAgent ? (
              isEditing ? (
                <AgentEditForm
                  agent={selectedAgent}
                  onCancel={handleCancelEdit}
                  onSave={handleSaveAgent}
                />
              ) : (
                <AgentDetailView
                  agent={selectedAgent}
                  onDelete={handleAgentDelete}
                  onRefresh={fetchAgents}
                  onEdit={handleStartEdit}
                />
              )
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Bot className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" />
                  <h3 className="text-xl font-medium mb-2">选择一个Agent</h3>
                  <p className="text-sm">
                    从左侧列表选择Agent查看详情，或创建新的AI助手
                  </p>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
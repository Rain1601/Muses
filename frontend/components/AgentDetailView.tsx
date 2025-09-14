"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Bot,
  Globe,
  MessageSquare,
  FileText,
  Calendar,
  Edit3,
  Trash2,
  Star,
  Settings,
  Copy,
  User
} from "lucide-react";
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
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AgentDetailViewProps {
  agent: Agent;
  onDelete: () => void;
  onRefresh: () => void;
}

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

export function AgentDetailView({ agent, onDelete, onRefresh }: AgentDetailViewProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);

  const handleDelete = async () => {
    if (!confirm("确定要删除这个Agent吗？")) return;

    setIsDeleting(true);
    try {
      await api.delete(`/api/agents/${agent.id}`);
      onDelete();
    } catch (error: any) {
      alert(error.response?.data?.error || "删除失败");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetDefault = async () => {
    setIsSettingDefault(true);
    try {
      await api.put(`/api/agents/${agent.id}/set-default`);
      onRefresh();
    } catch (error: any) {
      alert(error.response?.data?.error || "设置默认失败");
    } finally {
      setIsSettingDefault(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      const response = await api.post('/api/agents', {
        name: `${agent.name} (副本)`,
        description: agent.description,
        language: agent.language,
        tone: agent.tone,
        lengthPreference: agent.lengthPreference,
        targetAudience: agent.targetAudience,
        customPrompt: agent.customPrompt,
      });
      onRefresh();
      alert("复制成功！");
    } catch (error: any) {
      alert(error.response?.data?.error || "复制失败");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border p-6 bg-card/50">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              {agent.avatar || <Bot className="w-8 h-8" />}
            </div>

            {/* Basic Info */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold text-foreground">
                  {agent.name}
                </h1>
                {agent.isDefault && (
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    默认
                  </Badge>
                )}
              </div>

              {agent.description && (
                <p className="text-muted-foreground">
                  {agent.description}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {!agent.isDefault && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSetDefault}
                disabled={isSettingDefault}
                className="flex items-center gap-1"
              >
                <Star className="w-4 h-4" />
                设为默认
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={handleDuplicate}
              className="flex items-center gap-1"
            >
              <Copy className="w-4 h-4" />
              复制
            </Button>

            <Button
              size="sm"
              onClick={() => router.push(`/agents/${agent.id}/edit`)}
              className="flex items-center gap-1"
            >
              <Edit3 className="w-4 h-4" />
              编辑
            </Button>

            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              删除
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {/* Configuration Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              配置信息
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">语言</div>
                    <div className="font-medium">
                      {agent.language === "zh-CN" ? "中文" : "英文"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">语气风格</div>
                    <div className="font-medium">
                      {toneLabels[agent.tone as keyof typeof toneLabels]}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">篇幅偏好</div>
                    <div className="font-medium">
                      {lengthLabels[agent.lengthPreference as keyof typeof lengthLabels]}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {agent.targetAudience && (
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">目标受众</div>
                      <div className="font-medium">{agent.targetAudience}</div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">创建时间</div>
                    <div className="font-medium">{formatDate(agent.createdAt)}</div>
                  </div>
                </div>

                {agent.updatedAt !== agent.createdAt && (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">更新时间</div>
                      <div className="font-medium">{formatDate(agent.updatedAt)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Custom Prompt Section */}
          {agent.customPrompt && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                自定义提示词
              </h3>

              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {agent.customPrompt}
                </p>
              </div>
            </div>
          )}

          {/* Usage Tips */}
          <div>
            <h3 className="text-lg font-semibold mb-4">使用提示</h3>
            <div className="bg-muted/30 rounded-lg p-4 border border-border">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>在创建文章时选择此Agent，AI将按照设定的风格生成内容</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>默认Agent会在创建新文章时自动选择</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>可以随时编辑Agent配置以调整生成效果</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
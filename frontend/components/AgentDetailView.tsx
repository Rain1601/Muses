"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Bot,
  Globe,
  MessageSquare,
  Calendar,
  Edit3,
  Trash2,
  Star,
  Settings,
  Copy,
  User,
  Check,
  X
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
  onEdit: () => void;
}



export function AgentDetailView({ agent, onDelete, onRefresh, onEdit }: AgentDetailViewProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);
  const [editingCustomPrompt, setEditingCustomPrompt] = useState(false);
  const [editingUsageTips, setEditingUsageTips] = useState(false);
  const [tempCustomPrompt, setTempCustomPrompt] = useState(agent.customPrompt || "");
  const [tempUsageTips, setTempUsageTips] = useState("在创建文章时选择此Agent，AI将按照设定的风格生成内容\n默认Agent会在创建新文章时自动选择\n可以随时编辑Agent配置以调整生成效果");
  const [isUpdating, setIsUpdating] = useState(false);

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

  const handleFieldChange = async (field: string, value: string) => {
    setIsUpdating(true);
    try {
      await api.put(`/api/agents/${agent.id}`, {
        ...agent,
        [field]: value
      });
      onRefresh();
    } catch (error: any) {
      alert(error.response?.data?.error || "更新失败");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveCustomPrompt = async () => {
    setIsUpdating(true);
    try {
      await api.put(`/api/agents/${agent.id}`, {
        ...agent,
        customPrompt: tempCustomPrompt
      });
      setEditingCustomPrompt(false);
      onRefresh();
    } catch (error: any) {
      alert(error.response?.data?.error || "保存失败");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelCustomPrompt = () => {
    setTempCustomPrompt(agent.customPrompt || "");
    setEditingCustomPrompt(false);
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
              onClick={onEdit}
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
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-1">语言</div>
                    <select
                      value={agent.language}
                      onChange={(e) => handleFieldChange('language', e.target.value)}
                      disabled={isUpdating}
                      className="font-medium bg-transparent border-0 outline-0 cursor-pointer hover:bg-accent/50 rounded px-2 py-1 -mx-2 -my-1 text-foreground"
                    >
                      <option value="zh-CN" className="bg-background text-foreground">中文</option>
                      <option value="en" className="bg-background text-foreground">英文</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-1">语气风格</div>
                    <input
                      type="text"
                      value={agent.tone}
                      onChange={(e) => handleFieldChange('tone', e.target.value)}
                      disabled={isUpdating}
                      className="font-medium bg-transparent border-0 outline-0 hover:bg-accent/50 rounded px-2 py-1 -mx-2 -my-1 text-foreground w-full"
                      placeholder="输入语气风格..."
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-1">目标受众</div>
                    <select
                      value={agent.targetAudience || ""}
                      onChange={(e) => handleFieldChange('targetAudience', e.target.value)}
                      disabled={isUpdating}
                      className="font-medium bg-transparent border-0 outline-0 cursor-pointer hover:bg-accent/50 rounded px-2 py-1 -mx-2 -my-1 text-foreground w-full"
                    >
                      <option value="" className="bg-background text-foreground">请选择...</option>
                      <option value="技术开发者" className="bg-background text-foreground">技术开发者</option>
                      <option value="普通读者" className="bg-background text-foreground">普通读者</option>
                      <option value="学生群体" className="bg-background text-foreground">学生群体</option>
                      <option value="商务人士" className="bg-background text-foreground">商务人士</option>
                      <option value="创作者" className="bg-background text-foreground">创作者</option>
                      <option value="研究人员" className="bg-background text-foreground">研究人员</option>
                    </select>
                  </div>
                </div>

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
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              自定义提示词
            </h3>

            <div className="bg-muted/30 rounded-lg p-4 border border-border group relative">
              {editingCustomPrompt ? (
                <div className="space-y-3">
                  <textarea
                    value={tempCustomPrompt}
                    onChange={(e) => setTempCustomPrompt(e.target.value)}
                    placeholder="输入自定义的AI提示词..."
                    rows={6}
                    className="w-full p-2 text-sm bg-background border border-border rounded resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveCustomPrompt}
                      disabled={isUpdating}
                      className="h-7 px-2"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      保存
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelCustomPrompt}
                      disabled={isUpdating}
                      className="h-7 px-2"
                    >
                      <X className="w-3 h-3 mr-1" />
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="cursor-pointer hover:bg-accent/20 rounded p-1 -m-1 transition-colors"
                  onClick={() => {
                    setTempCustomPrompt(agent.customPrompt || "");
                    setEditingCustomPrompt(true);
                  }}
                >
                  {agent.customPrompt ? (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {agent.customPrompt}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      点击添加自定义提示词
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Usage Tips */}
          <div>
            <h3 className="text-lg font-semibold mb-4">使用提示</h3>
            <div className="bg-muted/30 rounded-lg p-4 border border-border group relative">
              {editingUsageTips ? (
                <div className="space-y-3">
                  <textarea
                    value={tempUsageTips}
                    onChange={(e) => setTempUsageTips(e.target.value)}
                    placeholder="输入使用提示..."
                    rows={4}
                    className="w-full p-2 text-sm bg-background border border-border rounded resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setEditingUsageTips(false)}
                      className="h-7 px-2"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      保存
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingUsageTips(false)}
                      className="h-7 px-2"
                    >
                      <X className="w-3 h-3 mr-1" />
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="cursor-pointer hover:bg-accent/20 rounded p-1 -m-1 transition-colors"
                  onClick={() => setEditingUsageTips(true)}
                >
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
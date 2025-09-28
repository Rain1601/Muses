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
  Copy,
  FileText,
  Wand2
} from "lucide-react";
import { api } from "@/lib/api";

interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  language: string | string[];
  tone: string | string[];
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

const languageOptions = [
  { value: "zh-CN", label: "中文", flag: "🇨🇳" },
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "ja", label: "日本語", flag: "🇯🇵" },
  { value: "ko", label: "한국어", flag: "🇰🇷" },
  { value: "fr", label: "Français", flag: "🇫🇷" },
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
  { value: "es", label: "Español", flag: "🇪🇸" },
  { value: "ru", label: "Русский", flag: "🇷🇺" }
];


export function AgentDetailView({ agent, onDelete, onRefresh, onEdit }: AgentDetailViewProps) {
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

  const getSelectedLanguages = () => {
    if (Array.isArray(agent.language)) {
      return agent.language;
    }
    return agent.language.includes(',')
      ? agent.language.split(',').map(l => l.trim())
      : [agent.language];
  };

  const getSelectedTones = () => {
    if (Array.isArray(agent.tone)) {
      return agent.tone;
    }
    return agent.tone.includes(',')
      ? agent.tone.split(',').map(t => t.trim())
      : [agent.tone];
  };

  const getLanguageDisplay = (languages: string[]) => {
    return languageOptions.filter(option =>
      languages.includes(option.value)
    );
  };

  const selectedLanguages = getSelectedLanguages();
  const selectedTones = getSelectedTones();
  const displayLanguages = getLanguageDisplay(selectedLanguages);

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

      {/* Form Content - Read Only */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Bot className="w-5 h-5" />
              基本信息
            </h3>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Agent名称
                </label>
                <div className="w-full px-3 py-2 border border-border rounded-lg bg-muted/30 text-foreground">
                  {agent.name}
                </div>
              </div>

              {/* Description */}
              {agent.description && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    描述
                  </label>
                  <div className="w-full px-3 py-2 border border-border rounded-lg bg-muted/30 text-foreground min-h-[80px] whitespace-pre-wrap">
                    {agent.description}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Writing Style */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Wand2 className="w-5 h-5" />
              写作风格
            </h3>

            <div className="space-y-6">
              {/* Language Multi-Display */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  语言
                </label>
                <div className="flex flex-wrap gap-2">
                  {displayLanguages.map(option => (
                    <div
                      key={option.value}
                      className="px-3 py-2 rounded-lg border border-primary bg-primary text-primary-foreground shadow-sm flex items-center gap-2 text-sm font-medium"
                    >
                      <span className="text-base">{option.flag}</span>
                      <span>{option.label}</span>
                      <span className="text-xs opacity-75">✓</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tone Multi-Display */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  语气风格
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedTones.map(tone => (
                    <div
                      key={tone}
                      className="px-3 py-2 rounded-lg border border-primary bg-primary text-primary-foreground shadow-sm flex items-center gap-2 text-sm font-medium"
                    >
                      <span>{tone}</span>
                      <span className="text-xs opacity-75">✓</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Custom Prompt */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              自定义提示词
            </h3>

            <div>
              <label className="block text-sm font-medium mb-2">
                自定义提示词
              </label>
              <div className="w-full px-3 py-2 border border-border rounded-lg bg-muted/30 text-foreground min-h-[120px] whitespace-pre-wrap">
                {agent.customPrompt || (
                  <span className="text-muted-foreground italic">未设置自定义提示词</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                自定义提示词将覆盖默认的AI指令
              </p>
            </div>
          </div>

          {/* Metadata */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              创建信息
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  创建时间
                </label>
                <div className="w-full px-3 py-2 border border-border rounded-lg bg-muted/30 text-foreground">
                  {formatDate(agent.createdAt)}
                </div>
              </div>

              {agent.updatedAt !== agent.createdAt && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    更新时间
                  </label>
                  <div className="w-full px-3 py-2 border border-border rounded-lg bg-muted/30 text-foreground">
                    {formatDate(agent.updatedAt)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
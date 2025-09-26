"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Bot,
  Globe,
  MessageSquare,
  Calendar,
  Trash2,
  Star,
  Copy
} from "lucide-react";
import { api } from "@/lib/api";
import { useAutoSave } from "@/hooks/useAutoSave";

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

interface AgentInlineEditProps {
  agent: Agent;
  onDelete: () => void;
  onRefresh: () => void;
  onUpdate: (updatedAgent: Agent) => void;
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

export function AgentInlineEdit({ agent, onDelete, onRefresh, onUpdate }: AgentInlineEditProps) {
  const [localAgent, setLocalAgent] = useState(agent);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);

  const { saveField, saveMultiSelectField, initializeSavedData } = useAutoSave(agent.id, onUpdate);

  useEffect(() => {
    setLocalAgent(agent);
    initializeSavedData(agent);
  }, [agent, initializeSavedData]);

  const getSelectedItems = (value: string | string[] | undefined): string[] => {
    if (Array.isArray(value)) return value;
    if (!value || value === '' || value === null || value === undefined) return [];
    if (typeof value !== 'string') return [];
    try {
      return value.includes(',') ? value.split(',').map(v => v.trim()) : [value];
    } catch (error) {
      console.error('Error processing selected items:', error);
      return [];
    }
  };

  const selectedLanguages = getSelectedItems(localAgent?.language);
  const selectedTones = getSelectedItems(localAgent?.tone);
  const displayLanguages = languageOptions.filter(option =>
    selectedLanguages.includes(option.value)
  );

  const handleInputBlur = (field: string, value: string) => {
    const trimmedValue = value.trim();
    if (trimmedValue !== (localAgent as any)[field]) {
      setLocalAgent(prev => ({ ...prev, [field]: trimmedValue }));
      saveField(field, trimmedValue);
    }
  };

  const handleLanguageToggle = (languageValue: string) => {
    const newSelection = selectedLanguages.includes(languageValue)
      ? selectedLanguages.filter(lang => lang !== languageValue)
      : [...selectedLanguages, languageValue];

    if (newSelection.length > 0) {
      setLocalAgent(prev => ({ ...prev, language: newSelection.join(',') }));
      saveMultiSelectField('language', newSelection);
    }
  };

  const handleToneToggle = (toneValue: string) => {
    const newSelection = selectedTones.includes(toneValue)
      ? selectedTones.filter(tone => tone !== toneValue)
      : [...selectedTones, toneValue];

    if (newSelection.length > 0) {
      setLocalAgent(prev => ({ ...prev, tone: newSelection.join(',') }));
      saveMultiSelectField('tone', newSelection);
    }
  };

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
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={localAgent.name}
                  onChange={(e) => setLocalAgent(prev => ({ ...prev, name: e.target.value }))}
                  onBlur={(e) => handleInputBlur('name', e.target.value)}
                  className="text-2xl font-bold text-foreground bg-transparent border-none outline-none focus:bg-background focus:border focus:border-primary rounded px-2 py-1 -mx-2 -my-1"
                />
                {agent.isDefault && (
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    默认
                  </Badge>
                )}
              </div>

              <textarea
                value={localAgent.description || ""}
                onChange={(e) => setLocalAgent(prev => ({ ...prev, description: e.target.value }))}
                onBlur={(e) => handleInputBlur('description', e.target.value)}
                placeholder="简要描述这个Agent的特色和用途..."
                className="w-full text-muted-foreground bg-transparent border-none outline-none resize-none focus:bg-background focus:border focus:border-primary rounded px-2 py-1 -mx-2 -my-1 min-h-[3em]"
              />
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
          {/* Writing Style */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Bot className="w-5 h-5" />
              写作风格
            </h3>

            <div className="space-y-6">
              {/* Language Multi-Select */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  语言 (点击切换)
                </label>
                <div className="flex flex-wrap gap-2">
                  {languageOptions.map(option => {
                    const isSelected = selectedLanguages.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleLanguageToggle(option.value)}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-background text-foreground border-border hover:border-primary/50 hover:bg-primary/5'
                        }`}
                      >
                        <span className="text-base">{option.flag}</span>
                        <span>{option.label}</span>
                        {isSelected && (
                          <span className="text-xs opacity-75">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tone Multi-Select */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  语气风格 (点击切换)
                </label>
                <div className="flex flex-wrap gap-2">
                  {['专业', '轻松', '幽默', '严肃', '友好', '温和', '权威', '创意'].map(tone => {
                    const isSelected = selectedTones.includes(tone);
                    return (
                      <button
                        key={tone}
                        type="button"
                        onClick={() => handleToneToggle(tone)}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-background text-foreground border-border hover:border-primary/50 hover:bg-primary/5'
                        }`}
                      >
                        <span>{tone}</span>
                        {isSelected && (
                          <span className="text-xs opacity-75">✓</span>
                        )}
                      </button>
                    );
                  })}
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
              <textarea
                value={localAgent.customPrompt || ""}
                onChange={(e) => setLocalAgent(prev => ({ ...prev, customPrompt: e.target.value }))}
                onBlur={(e) => handleInputBlur('customPrompt', e.target.value)}
                placeholder="输入自定义的AI提示词，用于指导内容生成的特定要求..."
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
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
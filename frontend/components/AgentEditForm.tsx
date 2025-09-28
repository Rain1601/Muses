"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Bot,
  Save,
  X,
  Star,
  Globe,
  MessageSquare,
  FileText,
  User,
  Wand2
} from "lucide-react";
import { api } from "@/lib/api";

interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  language: string | string[]; // Support both single and multiple languages
  tone: string | string[]; // Support both single and multiple tones
  customPrompt?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AgentEditFormProps {
  agent: Agent;
  onCancel: () => void;
  onSave: (updatedAgent: Agent) => void;
}

// Tone options for multi-select

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

export function AgentEditForm({ agent, onCancel, onSave }: AgentEditFormProps) {
  const [formData, setFormData] = useState({
    name: agent.name,
    description: agent.description || "",
    language: Array.isArray(agent.language) ? agent.language : [agent.language],
    tone: Array.isArray(agent.tone) ? agent.tone : [agent.tone],
    customPrompt: agent.customPrompt || "",
  });
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(
    Array.isArray(agent.language) ? agent.language : [agent.language]
  );
  const [selectedTones, setSelectedTones] = useState<string[]>(
    Array.isArray(agent.tone) ? agent.tone : [agent.tone]
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = "Agent名称不能为空";
    }

    if (formData.name.length > 50) {
      newErrors.name = "Agent名称不能超过50个字符";
    }

    if (formData.description.length > 200) {
      newErrors.description = "描述不能超过200个字符";
    }

    if (selectedLanguages.length === 0) {
      newErrors.language = "请至少选择一种语言";
    }

    if (selectedTones.length === 0) {
      newErrors.tone = "请至少选择一种语气风格";
    }

    if (formData.customPrompt.length > 2000) {
      newErrors.customPrompt = "自定义提示词不能超过2000个字符";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSaving(true);
    try {
      // Convert arrays to comma-separated strings for API compatibility
      const submitData = {
        ...formData,
        language: selectedLanguages.join(','),
        tone: selectedTones.join(',')
      };

      const response = await api.put(`/api/agents/${agent.id}`, submitData);
      onSave(response.data);
    } catch (error: any) {
      alert(error.response?.data?.error || "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // 清除该字段的错误
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handleLanguageToggle = (languageValue: string) => {
    setSelectedLanguages(prev => {
      const newSelection = prev.includes(languageValue)
        ? prev.filter(lang => lang !== languageValue)
        : [...prev, languageValue];

      // Update formData
      setFormData(prevForm => ({
        ...prevForm,
        language: newSelection
      }));

      return newSelection;
    });
  };

  const handleToneToggle = (toneValue: string) => {
    setSelectedTones(prev => {
      const newSelection = prev.includes(toneValue)
        ? prev.filter(tone => tone !== toneValue)
        : [...prev, toneValue];

      // Update formData
      setFormData(prevForm => ({
        ...prevForm,
        tone: newSelection
      }));

      return newSelection;
    });
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

            {/* Header Info */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold text-foreground">
                  编辑 Agent
                </h1>
                {agent.isDefault && (
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    默认
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                修改Agent配置以调整AI生成内容的风格
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCancel}
              className="flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              取消
            </Button>

            <Button
              type="submit"
              size="sm"
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex items-center gap-1"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
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
                  Agent名称 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="给你的AI助手起个名字..."
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.name ? "border-red-500" : "border-border"
                  }`}
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="简要描述这个Agent的特色和用途..."
                  rows={3}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none ${
                    errors.description ? "border-red-500" : "border-border"
                  }`}
                />
                {errors.description && (
                  <p className="text-red-500 text-sm mt-1">{errors.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Writing Style */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Wand2 className="w-5 h-5" />
              写作风格
            </h3>

            <div className="space-y-6">
              {/* Language Multi-Select */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  语言 (可多选)
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
                {selectedLanguages.length === 0 && (
                  <p className="text-red-500 text-sm mt-1">请至少选择一种语言</p>
                )}
              </div>

              {/* Tone Multi-Select */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  语气风格 (可多选)
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
                {selectedTones.length === 0 && (
                  <p className="text-red-500 text-sm mt-1">请至少选择一种语气风格</p>
                )}
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
                自定义提示词（可选）
              </label>
              <textarea
                value={formData.customPrompt}
                onChange={(e) => handleInputChange("customPrompt", e.target.value)}
                placeholder="输入自定义的AI提示词，用于指导内容生成的特定要求..."
                rows={6}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none ${
                  errors.customPrompt ? "border-red-500" : "border-border"
                }`}
              />
              {errors.customPrompt && (
                <p className="text-red-500 text-sm mt-1">{errors.customPrompt}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                自定义提示词将覆盖默认的AI指令，请谨慎使用
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
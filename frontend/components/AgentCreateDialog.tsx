"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Bot,
  Save,
  X,
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
  language: string;
  tone: string;
  lengthPreference: string;
  targetAudience?: string;
  customPrompt?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AgentCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgentCreated: (agent: Agent) => void;
}

const toneOptions = [
  { value: "professional", label: "专业" },
  { value: "casual", label: "轻松" },
  { value: "humorous", label: "幽默" },
  { value: "serious", label: "严肃" },
];

const lengthOptions = [
  { value: "short", label: "简洁" },
  { value: "medium", label: "适中" },
  { value: "long", label: "详细" },
];

const languageOptions = [
  { value: "zh-CN", label: "中文" },
  { value: "en", label: "英文" },
];

export function AgentCreateDialog({ open, onOpenChange, onAgentCreated }: AgentCreateDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    language: "zh-CN",
    tone: "professional",
    lengthPreference: "medium",
    targetAudience: "",
    customPrompt: "",
  });
  const [isCreating, setIsCreating] = useState(false);
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

    if (formData.customPrompt.length > 2000) {
      newErrors.customPrompt = "自定义提示词不能超过2000个字符";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsCreating(true);
    try {
      const response = await api.post("/api/agents", formData);
      onAgentCreated(response.data);
      onOpenChange(false);
      // 重置表单
      setFormData({
        name: "",
        description: "",
        language: "zh-CN",
        tone: "professional",
        lengthPreference: "medium",
        targetAudience: "",
        customPrompt: "",
      });
      setErrors({});
    } catch (error: any) {
      alert(error.response?.data?.error || "创建失败");
    } finally {
      setIsCreating(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // 清除该字段的错误
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    // 重置表单和错误
    setFormData({
      name: "",
      description: "",
      language: "zh-CN",
      tone: "professional",
      lengthPreference: "medium",
      targetAudience: "",
      customPrompt: "",
    });
    setErrors({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl">创建新 Agent</DialogTitle>
              <DialogDescription>
                配置一个新的AI助手来协助你创作内容
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Basic Information */}
          <div>
            <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
              <Bot className="w-4 h-4" />
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
                  rows={2}
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
            <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              写作风格
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Language */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Globe className="w-3 h-3" />
                  语言
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => handleInputChange("language", e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {languageOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tone */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <MessageSquare className="w-3 h-3" />
                  语气风格
                </label>
                <select
                  value={formData.tone}
                  onChange={(e) => handleInputChange("tone", e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {toneOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Length Preference */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <FileText className="w-3 h-3" />
                  篇幅偏好
                </label>
                <select
                  value={formData.lengthPreference}
                  onChange={(e) => handleInputChange("lengthPreference", e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {lengthOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Audience */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <User className="w-3 h-3" />
                  目标受众
                </label>
                <input
                  type="text"
                  value={formData.targetAudience}
                  onChange={(e) => handleInputChange("targetAudience", e.target.value)}
                  placeholder="如：技术开发者、普通读者..."
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Custom Prompt */}
          <div>
            <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
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
                rows={4}
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

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isCreating}
            >
              <X className="w-4 h-4 mr-1" />
              取消
            </Button>
            <Button
              type="submit"
              disabled={isCreating}
            >
              <Save className="w-4 h-4 mr-1" />
              {isCreating ? "创建中..." : "创建Agent"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
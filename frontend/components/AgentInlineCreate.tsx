"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Bot, Plus, X, Check } from "lucide-react";

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

interface AgentInlineCreateProps {
  onAgentCreated: (agent: Agent) => void;
  onCancel: () => void;
}

export function AgentInlineCreate({ onAgentCreated, onCancel }: AgentInlineCreateProps) {
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      const response = await api.post("/api/agents", {
        name: name.trim(),
        language: "zh-CN",
        tone: "专业",
        description: "",
        customPrompt: "",
      });

      onAgentCreated(response.data);
      setName("");
    } catch (error: any) {
      console.error("Failed to create agent:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="p-3 border-b border-border bg-muted/50">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Agent名称..."
          autoFocus
          className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
        />
        <div className="flex items-center gap-1">
          <button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="p-1 text-primary hover:bg-primary/10 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={onCancel}
            className="p-1 text-muted-foreground hover:bg-muted rounded-sm transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
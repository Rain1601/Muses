"use client";

import { Bot, Settings, Star } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  language: string | string[];
  tone: string | string[];
  isDefault: boolean;
  createdAt: string;
}

interface AgentListItemProps {
  agent: Agent;
  isSelected?: boolean;
  onClick: () => void;
}

const languageLabels: { [key: string]: string } = {
  "zh-CN": "中文",
  "en": "English",
  "ja": "日本語",
  "ko": "한국어",
  "fr": "Français",
  "de": "Deutsch",
  "es": "Español",
  "ru": "Русский"
};

export function AgentListItem({ agent, isSelected, onClick }: AgentListItemProps) {
  // 处理多选语言和语气的显示
  const getDisplayItems = (value: string | string[] | undefined): string[] => {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    return value.includes(',') ? value.split(',').map(v => v.trim()) : [value];
  };

  const getLanguageDisplay = (languages: string[]) => {
    return languages.map(lang => languageLabels[lang] || lang).join(', ');
  };

  const getToneDisplay = (tones: string[]) => {
    return tones.join(', ');
  };

  const displayLanguages = getDisplayItems(agent.language);
  const displayTones = getDisplayItems(agent.tone);
  return (
    <div
      className={`
        group relative px-4 py-3 border-b border-border/40 cursor-pointer transition-all duration-200
        ${isSelected
          ? 'bg-primary/10 border-l-2 border-l-primary'
          : 'hover:bg-accent/50'
        }
      `}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {agent.avatar || <Bot className="w-5 h-5" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`
              font-medium text-sm leading-tight truncate
              ${isSelected ? 'text-primary' : 'text-foreground'}
            `}>
              {agent.name}
            </h3>
            {agent.isDefault && (
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
            )}
          </div>

          {agent.description && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {agent.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs text-muted-foreground">
              {getToneDisplay(displayTones)}
            </span>
            <span className="text-xs text-muted-foreground">
              {getLanguageDisplay(displayLanguages)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
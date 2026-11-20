"use client";

/**
 * Context Injection 配置面板
 *
 * 暂时持久化到 localStorage（key: muses.contextConfig）。
 * 后端注入逻辑尚未接入 —— 这里先把 schema 和 UI 定下来，
 * 后续在 backend/app/agent/context_builder.py 里读取并应用。
 */

import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "muses.contextConfig";

export interface ContextConfig {
  surrounding: {
    beforeParagraphs: number;
    afterParagraphs: number;
    maxCharsPerSide: number;
  };
  fullDocument: {
    enabled: boolean;
    threshold: number; // 全文 <= 多少字时整篇注入
  };
  skeleton: {
    enabled: boolean;
    upperBound: number; // 全文 (threshold, upperBound] 时用骨架
  };
  editHistory: {
    enabled: boolean;
    turns: number;
    maxChars: number;
  };
}

export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  surrounding: {
    beforeParagraphs: 2,
    afterParagraphs: 2,
    maxCharsPerSide: 300,
  },
  fullDocument: {
    enabled: true,
    threshold: 2000,
  },
  skeleton: {
    enabled: true,
    upperBound: 5000,
  },
  editHistory: {
    enabled: true,
    turns: 5,
    maxChars: 200,
  },
};

function loadConfig(): ContextConfig {
  if (typeof window === "undefined") return DEFAULT_CONTEXT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONTEXT_CONFIG;
    const parsed = JSON.parse(raw);
    // 浅合并 — 防止旧版本缺字段
    return {
      surrounding: { ...DEFAULT_CONTEXT_CONFIG.surrounding, ...(parsed.surrounding ?? {}) },
      fullDocument: { ...DEFAULT_CONTEXT_CONFIG.fullDocument, ...(parsed.fullDocument ?? {}) },
      skeleton: { ...DEFAULT_CONTEXT_CONFIG.skeleton, ...(parsed.skeleton ?? {}) },
      editHistory: { ...DEFAULT_CONTEXT_CONFIG.editHistory, ...(parsed.editHistory ?? {}) },
    };
  } catch {
    return DEFAULT_CONTEXT_CONFIG;
  }
}

/**
 * 外部调用: 同步读取当前持久化的配置。
 * useTextActions / NotionEditor 在每次 AI 触发时调用此函数, 把结果作为
 * `contextConfig` 字段塞进 text-action 请求。
 */
export function getContextConfig(): ContextConfig {
  return loadConfig();
}

// 估算单次注入的字数上限（便于用户判断 token 预算）
function estimateMaxChars(c: ContextConfig): number {
  const surrounding = c.surrounding.maxCharsPerSide * 2;
  const docMax = c.fullDocument.enabled
    ? Math.max(c.fullDocument.threshold, c.skeleton.enabled ? 800 : 0)
    : c.skeleton.enabled
      ? 800
      : 0;
  const history = c.editHistory.enabled ? c.editHistory.maxChars : 0;
  return surrounding + docMax + history;
}

interface NumFieldProps {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function NumField({ label, hint, value, min, max, step = 1, suffix, onChange, disabled }: NumFieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, opacity: disabled ? 0.4 : 1 }}>
      <label style={{
        fontSize: "0.6875rem", color: "var(--m-n300)", letterSpacing: "0.02em",
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
      }}>
        <span>{label}</span>
        {hint && <span style={{ color: "var(--m-n450)", fontSize: "0.625rem" }}>{hint}</span>}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isFinite(v)) return;
            onChange(Math.max(min, Math.min(max, v)));
          }}
          style={{
            flex: 1,
            background: "var(--m-n925)",
            border: "1px solid var(--m-n750)",
            borderRadius: 6,
            padding: "0.4375rem 0.5rem",
            color: "var(--m-n50)",
            fontSize: "0.8125rem",
            fontFamily: "inherit",
            outline: "none",
          }}
        />
        {suffix && (
          <span style={{ fontSize: "0.6875rem", color: "var(--m-n400)", minWidth: 24 }}>{suffix}</span>
        )}
      </div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ label, hint, checked, onChange }: ToggleProps) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: "#D97149", width: 14, height: 14, cursor: "pointer" }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontSize: "0.8125rem", color: "var(--m-n50)" }}>{label}</span>
        {hint && <span style={{ fontSize: "0.6875rem", color: "var(--m-n400)" }}>{hint}</span>}
      </div>
    </label>
  );
}

interface SectionProps {
  title: string;
  desc?: string;
  children: React.ReactNode;
}

function Section({ title, desc, children }: SectionProps) {
  return (
    <section style={{
      background: "var(--m-n925)",
      border: "1px solid var(--m-n880)",
      borderRadius: 10,
      padding: "1.25rem 1.5rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.875rem",
    }}>
      <div>
        <h3 style={{
          fontSize: "0.8125rem", color: "var(--m-n50)", margin: 0,
          fontWeight: 500, letterSpacing: "0.01em",
        }}>{title}</h3>
        {desc && (
          <p style={{
            fontSize: "0.6875rem", color: "var(--m-n400)",
            margin: "0.25rem 0 0", lineHeight: 1.5,
          }}>{desc}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export default function ContextConfigPanel() {
  const [config, setConfig] = useState<ContextConfig>(DEFAULT_CONTEXT_CONFIG);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // 首次加载
  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  // 持久化（debounce 实际作用不大，配置面板写入频率低；直接同步写）
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      setSavedAt(Date.now());
    } catch (err) {
      console.error("Failed to save context config:", err);
    }
  }, [config]);

  const reset = useCallback(() => {
    setConfig(DEFAULT_CONTEXT_CONFIG);
  }, []);

  const estimated = useMemo(() => estimateMaxChars(config), [config]);

  return (
    <div style={{
      maxWidth: 720, margin: "0 auto", padding: "2.5rem 2rem 4rem",
      display: "flex", flexDirection: "column", gap: "1.25rem",
    }}>
      {/* Header */}
      <header style={{ marginBottom: "0.5rem" }}>
        <div style={{
          fontSize: "0.625rem", letterSpacing: "0.14em", textTransform: "uppercase",
          color: "var(--m-n400)", marginBottom: "0.5rem",
        }}>
          Agent · Context Injection
        </div>
        <h2 style={{
          fontSize: "1.375rem", color: "var(--m-n50)", margin: 0,
          fontWeight: 500, letterSpacing: "-0.01em",
        }}>
          上下文注入配置
        </h2>
        <p style={{
          fontSize: "0.8125rem", color: "var(--m-n300)",
          margin: "0.5rem 0 0", lineHeight: 1.55, maxWidth: 560,
        }}>
          当你在编辑器选中文本触发 AI 操作时，模型能"看到"多少周围信息。
          配置存在本地（localStorage），后端注入实现接入后会读取这里的设置。
        </p>
      </header>

      {/* Live token budget */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.625rem 1rem",
        background: "var(--m-n880)",
        border: "1px solid var(--m-n750)",
        borderRadius: 8,
        fontSize: "0.75rem",
      }}>
        <span style={{ color: "var(--m-n300)" }}>单次请求注入上限</span>
        <span style={{ color: "#E9A476", fontWeight: 500 }}>
          ≈ {estimated.toLocaleString()} 字 / {Math.round(estimated * 1.3).toLocaleString()} tokens
        </span>
      </div>

      {/* Surrounding paragraphs */}
      <Section
        title="选区前后段落"
        desc="选中文字时，把选区上下的若干段一起喂给模型。处理代词、术语一致性、口吻延续。"
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
          <NumField
            label="前置段落"
            value={config.surrounding.beforeParagraphs}
            min={0} max={10}
            suffix="段"
            onChange={(v) => setConfig({ ...config, surrounding: { ...config.surrounding, beforeParagraphs: v } })}
          />
          <NumField
            label="后置段落"
            value={config.surrounding.afterParagraphs}
            min={0} max={10}
            suffix="段"
            onChange={(v) => setConfig({ ...config, surrounding: { ...config.surrounding, afterParagraphs: v } })}
          />
        </div>
        <NumField
          label="每侧字数上限"
          hint="超过的段从远端开始裁掉"
          value={config.surrounding.maxCharsPerSide}
          min={0} max={2000} step={50}
          suffix="字"
          onChange={(v) => setConfig({ ...config, surrounding: { ...config.surrounding, maxCharsPerSide: v } })}
        />
      </Section>

      {/* Full document */}
      <Section
        title="整篇文章"
        desc="文章短的时候直接全文塞进 prompt。"
      >
        <Toggle
          label="启用全文注入"
          hint={config.fullDocument.enabled ? `当全文 ≤ ${config.fullDocument.threshold} 字时整篇注入` : undefined}
          checked={config.fullDocument.enabled}
          onChange={(v) => setConfig({ ...config, fullDocument: { ...config.fullDocument, enabled: v } })}
        />
        <NumField
          label="全文注入阈值"
          hint="超过则切到骨架模式（如果启用）"
          value={config.fullDocument.threshold}
          min={500} max={10000} step={100}
          suffix="字"
          disabled={!config.fullDocument.enabled}
          onChange={(v) => setConfig({ ...config, fullDocument: { ...config.fullDocument, threshold: v } })}
        />
      </Section>

      {/* Skeleton */}
      <Section
        title="骨架模式（中等长度）"
        desc="文章中等长度时，注入大纲 + 开篇 + 选区前后段，避开整文喂送的注意力分散。"
      >
        <Toggle
          label="启用骨架模式"
          hint={config.skeleton.enabled
            ? `全文在 ${config.fullDocument.threshold}–${config.skeleton.upperBound} 字之间时启用`
            : undefined}
          checked={config.skeleton.enabled}
          onChange={(v) => setConfig({ ...config, skeleton: { ...config.skeleton, enabled: v } })}
        />
        <NumField
          label="骨架模式上限"
          hint="超过则只走前后段落注入"
          value={config.skeleton.upperBound}
          min={config.fullDocument.threshold + 500} max={50000} step={500}
          suffix="字"
          disabled={!config.skeleton.enabled}
          onChange={(v) => setConfig({ ...config, skeleton: { ...config.skeleton, upperBound: v } })}
        />
      </Section>

      {/* Edit history */}
      <Section
        title="编辑历史"
        desc="把本篇文章最近的 AI 编辑（接受/拒绝）作为上下文，帮模型理解你的修改偏好。"
      >
        <Toggle
          label="启用编辑历史"
          checked={config.editHistory.enabled}
          onChange={(v) => setConfig({ ...config, editHistory: { ...config.editHistory, enabled: v } })}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
          <NumField
            label="保留轮次"
            value={config.editHistory.turns}
            min={0} max={20}
            suffix="次"
            disabled={!config.editHistory.enabled}
            onChange={(v) => setConfig({ ...config, editHistory: { ...config.editHistory, turns: v } })}
          />
          <NumField
            label="摘要字数上限"
            value={config.editHistory.maxChars}
            min={0} max={1000} step={50}
            suffix="字"
            disabled={!config.editHistory.enabled}
            onChange={(v) => setConfig({ ...config, editHistory: { ...config.editHistory, maxChars: v } })}
          />
        </div>
      </Section>

      {/* Footer actions */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginTop: "0.5rem", paddingTop: "1rem",
        borderTop: "1px solid var(--m-n880)",
      }}>
        <span style={{ fontSize: "0.6875rem", color: "var(--m-n450)" }}>
          {savedAt ? `已自动保存 · ${new Date(savedAt).toLocaleTimeString()}` : "未保存"}
        </span>
        <button
          onClick={reset}
          style={{
            background: "transparent",
            border: "1px solid var(--m-n750)",
            color: "var(--m-n300)",
            padding: "0.4375rem 0.875rem",
            borderRadius: 6,
            fontSize: "0.75rem",
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          重置为默认
        </button>
      </div>
    </div>
  );
}

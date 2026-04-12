"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUserStore } from "@/store/user";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";

/* ── AI Provider definitions ── */
const AI_PROVIDERS = [
  {
    id: "aihubmix",
    name: "AIHubMix",
    description: "国内可直连，聚合 OpenAI / Claude / Gemini 等主流模型",
    placeholder: "sk-...",
    prefix: "sk-",
    baseUrl: "https://aihubmix.com/v1",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    tag: "推荐",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "International AI gateway — access 200+ models with one key",
    placeholder: "sk-or-v1-...",
    prefix: "sk-or-",
    baseUrl: "https://openrouter.ai/api/v1",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "直接使用 OpenAI 官方 API（GPT-4o / o1 / o3）",
    placeholder: "sk-proj-...",
    prefix: "sk-",
    baseUrl: "https://api.openai.com/v1",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.998 5.998 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
      </svg>
    ),
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude 系列模型（Sonnet / Opus / Haiku）",
    placeholder: "sk-ant-...",
    prefix: "sk-ant-",
    baseUrl: "https://api.anthropic.com",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0h3.767L16.906 20.48h-3.674l-1.476-3.94H5.036l-1.467 3.94H0L6.569 3.52zm1.04 4.15L5.39 13.54h4.437L7.609 7.67z" />
      </svg>
    ),
  },
  {
    id: "google",
    name: "Google AI",
    description: "Gemini 系列模型（Pro / Ultra / Flash）",
    placeholder: "AIza...",
    prefix: "AIza",
    baseUrl: "https://generativelanguage.googleapis.com",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <path d="M12 11h8.533c.044.385.067.78.067 1.184 0 2.734-.98 5.036-2.678 6.6-1.485 1.371-3.518 2.216-5.922 2.216A8.977 8.977 0 0 1 3 12 8.977 8.977 0 0 1 12 3c2.42 0 4.473.89 6.04 2.34L16.075 7.3C14.955 6.24 13.555 5.7 12 5.7a6.3 6.3 0 1 0 0 12.6c3.15 0 5.26-2.26 5.49-4.3H12V11z" fill="currentColor"/>
      </svg>
    ),
  },
];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useUserStore();

  const [step, setStep] = useState(1);
  const [selectedProvider, setSelectedProvider] = useState("aihubmix");
  const [apiKey, setApiKey] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const provider = AI_PROVIDERS.find((p) => p.id === selectedProvider)!;

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      auth.handleCallback(token).then(() => {
        router.replace("/onboarding");
      });
    } else {
      // No token in URL — check if already logged in
      const stored = localStorage.getItem("token");
      if (!stored) {
        router.replace("/");
      }
    }
  }, [searchParams, router]);

  const handleNext = async () => {
    if (step === 1) {
      if (!apiKey.trim()) {
        setError("请输入 API Key");
        return;
      }
      setError("");
      setStep(2);
    } else if (step === 2) {
      await handleComplete();
    }
  };

  const handleSkip = async () => {
    setIsLoading(true);
    try {
      const response = await api.post("/api/user/settings", {
        defaultRepoUrl: repoUrl || undefined,
      });
      setUser(response.data.user);
      router.push("/dashboard");
    } catch (error: any) {
      setError(error.response?.data?.error || "保存失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    setError("");

    try {
      // Map provider to the correct backend field
      const settingsPayload: Record<string, string | undefined> = {
        defaultRepoUrl: repoUrl || undefined,
      };

      // AIHubMix and OpenRouter use openaiKey field (OpenAI-compatible API)
      if (selectedProvider === "aihubmix" || selectedProvider === "openrouter" || selectedProvider === "openai") {
        settingsPayload.openaiKey = apiKey;
      } else if (selectedProvider === "anthropic") {
        settingsPayload.claudeKey = apiKey;
      } else if (selectedProvider === "google") {
        settingsPayload.geminiKey = apiKey;
      }

      const response = await api.post("/api/user/settings", settingsPayload);
      setUser(response.data.user);
      router.push("/dashboard");
    } catch (error: any) {
      setError(error.response?.data?.error || "保存设置失败");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        background: "#FAFAF8",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 600,
              color: "#1a1816",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            欢迎使用 Muses
          </h1>
          <p
            style={{
              color: "#8C877D",
              fontSize: "0.875rem",
              marginTop: 8,
            }}
          >
            配置 AI 服务，开始你的创作之旅
          </p>
        </div>

        {/* ── Steps indicator ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0,
            marginBottom: 36,
          }}
        >
          {[1, 2].map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  background: step >= s ? "#d97757" : "transparent",
                  color: step >= s ? "#fff" : "#B8B3A9",
                  border: step >= s ? "none" : "1.5px solid #DDD9D1",
                  transition: "all 0.3s ease",
                }}
              >
                {step > s ? "✓" : s}
              </div>
              {i < 1 && (
                <div
                  style={{
                    width: 80,
                    height: 1.5,
                    background: step >= 2 ? "#d97757" : "#DDD9D1",
                    transition: "background 0.3s ease",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── Step 1: Provider selection + API Key ── */}
        {step === 1 && (
          <div>
            <h2
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                color: "#1a1816",
                marginBottom: 6,
              }}
            >
              选择 AI 服务商
            </h2>
            <p
              style={{
                fontSize: "0.8125rem",
                color: "#8C877D",
                marginBottom: 16,
              }}
            >
              选择你常用的 AI API 提供商，或使用聚合平台一键接入所有模型
            </p>

            {/* Provider cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 20,
              }}
            >
              {AI_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProvider(p.id);
                    setApiKey("");
                    setError("");
                  }}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border:
                      selectedProvider === p.id
                        ? "1.5px solid #d97757"
                        : "1.5px solid #E8E5DE",
                    background:
                      selectedProvider === p.id
                        ? "rgba(217,119,87,0.04)"
                        : "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                    outline: "none",
                  }}
                >
                  <span
                    style={{
                      color:
                        selectedProvider === p.id ? "#d97757" : "#6B665C",
                      flexShrink: 0,
                    }}
                  >
                    {p.icon}
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color:
                          selectedProvider === p.id ? "#d97757" : "#3F3A36",
                      }}
                    >
                      {p.name}
                    </div>
                  </div>
                  {p.tag && (
                    <span
                      style={{
                        position: "absolute",
                        top: -7,
                        right: 8,
                        fontSize: "0.625rem",
                        fontWeight: 600,
                        color: "#fff",
                        background: "#d97757",
                        padding: "1px 6px",
                        borderRadius: 4,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {p.tag}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Provider description */}
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(217,119,87,0.04)",
                borderRadius: 8,
                marginBottom: 16,
                fontSize: "0.8rem",
                color: "#6B665C",
                lineHeight: 1.5,
              }}
            >
              {provider.description}
            </div>

            {/* API Key input */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "#3F3A36",
                  marginBottom: 6,
                }}
              >
                {provider.name} API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setError("");
                }}
                placeholder={provider.placeholder}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: error ? "1.5px solid #E5564A" : "1.5px solid #E8E5DE",
                  background: "#fff",
                  fontSize: "0.875rem",
                  color: "#1a1816",
                  outline: "none",
                  transition: "border-color 0.15s ease",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  if (!error)
                    e.target.style.borderColor = "#d97757";
                }}
                onBlur={(e) => {
                  if (!error)
                    e.target.style.borderColor = "#E8E5DE";
                }}
              />
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#B8B3A9",
                  marginTop: 6,
                }}
              >
                API Key 将被加密存储，仅用于 AI 文章生成
              </p>
            </div>
          </div>
        )}

        {/* ── Step 2: GitHub repo (optional) ── */}
        {step === 2 && (
          <div>
            <h2
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                color: "#1a1816",
                marginBottom: 6,
              }}
            >
              GitHub 发布仓库
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 400,
                  color: "#B8B3A9",
                  marginLeft: 8,
                }}
              >
                可选
              </span>
            </h2>
            <p
              style={{
                fontSize: "0.8125rem",
                color: "#8C877D",
                marginBottom: 16,
              }}
            >
              绑定 GitHub 仓库，一键发布文章到你的博客
            </p>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/username/blog"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1.5px solid #E8E5DE",
                background: "#fff",
                fontSize: "0.875rem",
                color: "#1a1816",
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#d97757")}
              onBlur={(e) => (e.target.style.borderColor = "#E8E5DE")}
            />
            <p
              style={{
                fontSize: "0.75rem",
                color: "#B8B3A9",
                marginTop: 6,
              }}
            >
              稍后也可以在「设置」中配置
            </p>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              background: "rgba(229,86,74,0.06)",
              borderRadius: 8,
              fontSize: "0.8125rem",
              color: "#C0392B",
            }}
          >
            {error}
          </div>
        )}

        {/* ── Action buttons ── */}
        <div
          style={{
            marginTop: 28,
            display: "flex",
            gap: 10,
          }}
        >
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 8,
                border: "1.5px solid #E8E5DE",
                background: "transparent",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#6B665C",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              上一步
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={isLoading}
            style={{
              flex: step > 1 ? 1 : undefined,
              width: step === 1 ? "100%" : undefined,
              padding: "10px 0",
              borderRadius: 8,
              border: "none",
              background: "#d97757",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#fff",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
              transition: "all 0.15s ease",
            }}
          >
            {isLoading
              ? "保存中..."
              : step === 2
              ? "完成设置"
              : "下一步"}
          </button>
        </div>

        {/* Skip link */}
        {step === 1 && (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button
              onClick={handleSkip}
              style={{
                background: "none",
                border: "none",
                fontSize: "0.8rem",
                color: "#B8B3A9",
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              跳过，稍后配置
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#FAFAF8",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              border: "2px solid #E8E5DE",
              borderTopColor: "#d97757",
              borderRadius: "50%",
              animation: "spin 0.6s linear infinite",
            }}
          />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}

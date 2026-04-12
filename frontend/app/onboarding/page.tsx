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
    id: "bailian",
    name: "百炼",
    description: "阿里云百炼平台，支持通义千问 / DeepSeek 等国产模型",
    placeholder: "sk-...",
    prefix: "sk-",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

      const providerKeyMap: Record<string, string> = {
        aihubmix: "aihubmixKey",
        openrouter: "openrouterKey",
        bailian: "bailianKey",
      };
      const keyField = providerKeyMap[selectedProvider];
      if (keyField) {
        settingsPayload[keyField] = apiKey;
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

"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUserStore } from "@/store/user";
import { auth } from "@/lib/auth";
import axios from "axios";

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useUserStore();
  
  const [step, setStep] = useState(1);
  const [openaiKey, setOpenaiKey] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // 处理OAuth回调
    const token = searchParams.get("token");
    if (token) {
      auth.handleCallback(token).then(() => {
        // 清除URL中的token
        router.replace("/onboarding");
      });
    }
  }, [searchParams, router]);

  const handleNext = async () => {
    if (step === 1) {
      if (!openaiKey.trim()) {
        setError("请输入OpenAI API Key");
        return;
      }
      setError("");
      setStep(2);
    } else if (step === 2) {
      await handleComplete();
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    setError("");

    try {
      // 保存用户设置
      const response = await axios.post("/api/user/settings", {
        openaiKey,
        defaultRepoUrl: repoUrl,
      });

      setUser(response.data.user);
      router.push("/dashboard");
    } catch (error: any) {
      setError(error.response?.data?.error || "保存设置失败");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8">欢迎使用 Muses</h1>
        
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              1
            </div>
            <div className={`flex-1 h-1 mx-2 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`}></div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              2
            </div>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">配置 OpenAI API Key</h2>
              <p className="text-muted-foreground mb-4">
                请输入您的 OpenAI API Key，用于生成文章内容
              </p>
              <input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-sm text-muted-foreground mt-2">
                您的 API Key 将被加密存储，仅用于生成文章
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">配置默认仓库（可选）</h2>
              <p className="text-muted-foreground mb-4">
                设置默认的 GitHub 仓库，用于发布文章
              </p>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/blog"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-sm text-muted-foreground mt-2">
                您也可以稍后在设置中配置
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="mt-8 flex gap-4">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted transition-colors"
              disabled={isLoading}
            >
              上一步
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isLoading ? "保存中..." : step === 2 ? "完成设置" : "下一步"}
          </button>
        </div>
      </div>
    </div>
  );
}
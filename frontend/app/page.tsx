"use client";

import { useUserStore } from "@/store/user";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const { user, isLoading, login, checkAuth } = useUserStore();
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/dashboard');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background transition-colors duration-300">
      <div className="text-center max-w-lg mx-auto px-6">
        <div className="flex justify-center mb-12">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-4xl transition-all duration-300 hover:bg-primary/20 dark:hover:bg-primary/30 hover:scale-110">
            🪶
          </div>
        </div>
        <h1 className="text-6xl font-bold mb-6 text-foreground tracking-tight">
          Muses
        </h1>
        <p className="text-xl text-muted-foreground mb-12 leading-relaxed">
          灵感与智能的完美融合
        </p>
        <div className="space-y-6">
          <Button 
            onClick={login}
            size="lg"
            className="px-8 py-3 text-base font-medium rounded-xl"
          >
            使用 GitHub 登录
          </Button>
          <p className="text-sm text-muted-foreground">
            开始您的创作之旅
          </p>
        </div>
      </div>
    </div>
  );
}
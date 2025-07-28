"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUserStore } from "@/store/user";
import { auth } from "@/lib/auth";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import ArticleManagement from "@/components/ArticleManagement";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, checkAuth, logout } = useUserStore();

  useEffect(() => {
    // 处理OAuth回调
    const token = searchParams.get("token");
    if (token) {
      auth.handleCallback(token).then(() => {
        checkAuth();
        router.replace("/dashboard");
      });
    } else if (!user) {
      checkAuth();
    }
  }, [searchParams, user, checkAuth, router]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* 主内容区 */}
      <main className="container mx-auto px-4 py-8">
        <ArticleManagement showTitle={true} showPagination={true} />
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
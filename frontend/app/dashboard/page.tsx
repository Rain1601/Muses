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
        {/* 快捷操作 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">快捷操作</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/articles/new"
              className="p-4 border rounded-lg hover:border-primary transition-colors text-center"
            >
              <div className="text-2xl mb-2">📝</div>
              <h3 className="font-medium">新建文章</h3>
              <p className="text-sm text-muted-foreground mt-1">
                从素材生成新文章
              </p>
            </Link>
            <Link
              href="/agents"
              className="p-4 border rounded-lg hover:border-primary transition-colors text-center"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center text-white text-lg font-bold mb-2 mx-auto">
                ✨
              </div>
              <h3 className="font-medium">管理Agent</h3>
              <p className="text-sm text-muted-foreground mt-1">
                创建和编辑AI助手
              </p>
            </Link>
            <Link
              href="/settings"
              className="p-4 border rounded-lg hover:border-primary transition-colors text-center"
            >
              <div className="text-2xl mb-2">⚙️</div>
              <h3 className="font-medium">设置</h3>
              <p className="text-sm text-muted-foreground mt-1">
                配置和偏好设置
              </p>
            </Link>
          </div>
        </div>

        {/* 文章管理 */}
        <div>
          <ArticleManagement showTitle={true} showPagination={true} />
        </div>
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
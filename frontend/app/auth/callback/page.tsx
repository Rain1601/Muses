'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const token = searchParams.get('token');

    if (error) {
      console.error('GitHub OAuth error:', error);
      router.push('/');
      return;
    }

    // 如果已经有token，说明是从后端重定向过来的
    if (token) {
      localStorage.setItem('token', token);
      // 根据路径判断是新用户还是老用户
      if (window.location.pathname.includes('onboarding')) {
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
      return;
    }

    if (code) {
      // 重定向到后端处理OAuth
      window.location.href = `http://localhost:8080/api/auth/github/callback?code=${code}`;
    } else {
      router.push('/');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-lg text-gray-600">正在处理登录...</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">正在处理登录...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
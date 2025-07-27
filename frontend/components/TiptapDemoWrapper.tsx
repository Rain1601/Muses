'use client';

import dynamic from 'next/dynamic';

// 动态导入，禁用SSR
const SimpleTiptapDemo = dynamic(
  () => import('./SimpleTiptapDemo').then((mod) => ({ default: mod.SimpleTiptapDemo })),
  { 
    ssr: false,
    loading: () => (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }
);

export default function TiptapDemoWrapper() {
  return <SimpleTiptapDemo />;
}
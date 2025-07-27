'use client';

import dynamic from 'next/dynamic';

// 动态导入，禁用SSR
const EnhancedTiptapDemo = dynamic(
  () => import('./EnhancedTiptapDemo').then((mod) => ({ default: mod.EnhancedTiptapDemo })),
  { 
    ssr: false,
    loading: () => (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }
);

export default function EnhancedTiptapWrapper() {
  return <EnhancedTiptapDemo />;
}
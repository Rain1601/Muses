'use client';

import dynamic from 'next/dynamic';

// 动态导入，禁用SSR
const ImageUploadTiptapDemo = dynamic(
  () => import('./ImageUploadTiptapDemo').then((mod) => ({ default: mod.ImageUploadTiptapDemo })),
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

export default function ImageUploadWrapper() {
  return <ImageUploadTiptapDemo />;
}
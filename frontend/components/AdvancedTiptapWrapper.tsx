'use client';

import dynamic from 'next/dynamic';

interface AdvancedTiptapWrapperProps {
  initialContent?: string;
  onChange?: (content: string) => void;
}

// 动态导入，禁用SSR
const AdvancedTiptapEditor = dynamic(
  () => import('./AdvancedTiptapEditor').then((mod) => ({ default: mod.AdvancedTiptapEditor })),
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

export default function AdvancedTiptapWrapper({ initialContent, onChange }: AdvancedTiptapWrapperProps) {
  return <AdvancedTiptapEditor initialContent={initialContent} onChange={onChange} />;
}
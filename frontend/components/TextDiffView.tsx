"use client";

import React, { useMemo } from 'react';
import { diffWords, diffLines, Change } from 'diff';

interface TextDiffViewProps {
  original: string;
  modified: string;
  mode?: 'inline' | 'side-by-side';
  className?: string;
}

export const TextDiffView: React.FC<TextDiffViewProps> = ({
  original,
  modified,
  mode = 'inline',
  className = ''
}) => {
  const changes = useMemo(() => {
    // 如果文本较长，使用行级别对比，否则使用词级别
    const useLineDiff = original.length > 500 || modified.length > 500;
    return useLineDiff ? diffLines(original, modified) : diffWords(original, modified);
  }, [original, modified]);

  if (mode === 'side-by-side') {
    return (
      <div className={`grid grid-cols-2 gap-4 ${className}`}>
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">原文</h4>
          <div className="p-3 bg-muted/30 rounded-md min-h-[100px] max-h-[400px] overflow-y-auto">
            <p className="text-sm whitespace-pre-wrap">{original}</p>
          </div>
        </div>
        <div>
          <h4 className="text-xs font-medium text-green-600 mb-2">修改后</h4>
          <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-md min-h-[100px] max-h-[400px] overflow-y-auto">
            <p className="text-sm whitespace-pre-wrap">{modified}</p>
          </div>
        </div>
      </div>
    );
  }

  // Inline diff mode
  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="text-xs font-medium text-muted-foreground">修改对比</h4>
      <div className="p-4 bg-muted/10 rounded-md max-h-[400px] overflow-y-auto">
        <div className="text-sm whitespace-pre-wrap">
          {changes.map((change: Change, index: number) => {
            if (change.added) {
              return (
                <span
                  key={index}
                  className="bg-green-500/20 text-green-700 dark:text-green-400 px-0.5 rounded"
                  title="新增"
                >
                  {change.value}
                </span>
              );
            }
            if (change.removed) {
              return (
                <span
                  key={index}
                  className="bg-red-500/20 text-red-700 dark:text-red-400 line-through px-0.5 rounded"
                  title="删除"
                >
                  {change.value}
                </span>
              );
            }
            return <span key={index}>{change.value}</span>;
          })}
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500/20 rounded" />
          <span>新增</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500/20 rounded" />
          <span>删除</span>
        </div>
      </div>
    </div>
  );
};

export default TextDiffView;
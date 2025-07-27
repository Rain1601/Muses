'use client';

import React, { useMemo, useState } from 'react';
import { diffWords, diffLines, Change } from 'diff';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface DiffViewerProps {
  original: string;
  modified: string;
  mode?: 'inline' | 'side-by-side';
  diffType?: 'words' | 'lines';
  className?: string;
}

export function DiffViewer({
  original,
  modified,
  mode = 'inline',
  diffType = 'words',
  className
}: DiffViewerProps) {
  const [viewMode, setViewMode] = useState(mode);
  const [currentDiffType, setCurrentDiffType] = useState(diffType);

  const diffs = useMemo(() => {
    if (currentDiffType === 'lines') {
      return diffLines(original, modified);
    }
    return diffWords(original, modified);
  }, [original, modified, currentDiffType]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    let unchanged = 0;

    diffs.forEach(part => {
      const count = part.value.length;
      if (part.added) added += count;
      else if (part.removed) removed += count;
      else unchanged += count;
    });

    return { added, removed, unchanged };
  }, [diffs]);

  const renderInlineDiff = () => {
    return (
      <div className="diff-viewer font-mono text-sm leading-relaxed p-4 bg-gray-50 dark:bg-gray-900 rounded-md overflow-auto">
        {diffs.map((part, index) => (
          <span
            key={index}
            className={cn(
              'transition-all duration-300',
              part.added && 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-1 rounded',
              part.removed && 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 line-through px-1 rounded'
            )}
          >
            {part.value}
          </span>
        ))}
      </div>
    );
  };

  const renderSideBySideDiff = () => {
    const originalParts: Change[] = [];
    const modifiedParts: Change[] = [];

    diffs.forEach(part => {
      if (part.removed) {
        originalParts.push(part);
        modifiedParts.push({ value: '', added: false, removed: false, count: 0 });
      } else if (part.added) {
        originalParts.push({ value: '', added: false, removed: false, count: 0 });
        modifiedParts.push(part);
      } else {
        originalParts.push(part);
        modifiedParts.push(part);
      }
    });

    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="diff-viewer font-mono text-sm leading-relaxed p-4 bg-gray-50 dark:bg-gray-900 rounded-md overflow-auto">
          <h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">原文</h4>
          {originalParts.map((part, index) => (
            <span
              key={index}
              className={cn(
                part.removed && 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 px-1 rounded'
              )}
            >
              {part.value}
            </span>
          ))}
        </div>
        <div className="diff-viewer font-mono text-sm leading-relaxed p-4 bg-gray-50 dark:bg-gray-900 rounded-md overflow-auto">
          <h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">修改后</h4>
          {modifiedParts.map((part, index) => (
            <span
              key={index}
              className={cn(
                part.added && 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-1 rounded'
              )}
            >
              {part.value}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'inline' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('inline')}
          >
            行内对比
          </Button>
          <Button
            variant={viewMode === 'side-by-side' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('side-by-side')}
          >
            并排对比
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant={currentDiffType === 'words' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCurrentDiffType('words')}
          >
            单词级
          </Button>
          <Button
            variant={currentDiffType === 'lines' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCurrentDiffType('lines')}
          >
            行级
          </Button>
        </div>
      </div>

      <div className="mb-4 flex gap-4 text-sm">
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 bg-green-100 dark:bg-green-900/30 rounded"></span>
          新增: {stats.added} 字符
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 bg-red-100 dark:bg-red-900/30 rounded"></span>
          删除: {stats.removed} 字符
        </span>
        <span className="text-gray-600 dark:text-gray-400">
          未改变: {stats.unchanged} 字符
        </span>
        <span className="text-gray-600 dark:text-gray-400">
          修改比例: {Math.round(((stats.added + stats.removed) / (stats.added + stats.removed + stats.unchanged)) * 100)}%
        </span>
      </div>

      {viewMode === 'inline' ? renderInlineDiff() : renderSideBySideDiff()}
    </Card>
  );
}

// 用于高级场景的hook
export function useDiff(original: string, modified: string, type: 'words' | 'lines' = 'words') {
  return useMemo(() => {
    const diffs = type === 'lines' ? diffLines(original, modified) : diffWords(original, modified);
    const changes = diffs.map((part, index) => ({
      id: index,
      type: part.added ? 'add' : part.removed ? 'delete' : 'unchanged',
      value: part.value,
      count: part.count
    }));
    
    return { diffs, changes };
  }, [original, modified, type]);
}
'use client';

import React, { useState, useCallback } from 'react';
import { Upload, FileText, Image, FolderOpen, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface ImportedArticle {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

interface ImportResult {
  success: boolean;
  imported_count: number;
  articles: ImportedArticle[];
}

interface FileImportProps {
  onImportComplete?: (result: ImportResult) => void;
  onClose?: () => void;
}

export function FileImport({ onImportComplete, onClose }: FileImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const items = Array.from(e.dataTransfer.items);
    const files: File[] = [];

    // 处理拖拽的文件和文件夹
    const processEntry = async (entry: any): Promise<void> => {
      if (entry.isFile) {
        return new Promise((resolve) => {
          entry.file((file: File) => {
            files.push(file);
            resolve();
          });
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        return new Promise((resolve) => {
          const readEntries = () => {
            dirReader.readEntries(async (entries: any[]) => {
              if (entries.length === 0) {
                resolve();
                return;
              }
              for (const childEntry of entries) {
                await processEntry(childEntry);
              }
              readEntries(); // 继续读取更多条目
            });
          };
          readEntries();
        });
      }
    };

    try {
      for (const item of items) {
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            await processEntry(entry);
          }
        }
      }

      console.log('📁 Drag and drop files processed:', files.length);
      if (files.length > 0) {
        handleFileUpload(files);
      }
    } catch (error) {
      console.error('❌ Error processing drag and drop:', error);
      // 回退到简单文件处理
      const fallbackFiles = Array.from(e.dataTransfer.files);
      if (fallbackFiles.length > 0) {
        handleFileUpload(fallbackFiles);
      }
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📂 File input event triggered');
    console.log('📊 Event target files:', e.target.files);
    console.log('📊 Event target files length:', e.target.files?.length || 0);

    const files = Array.from(e.target.files || []);
    console.log('📁 Files array created:', files.length);

    // 打印每个文件的详细信息
    files.forEach((file, index) => {
      console.log(`📄 Raw File ${index + 1}:`, {
        name: file.name,
        size: file.size,
        type: file.type,
        webkitRelativePath: (file as any).webkitRelativePath || 'N/A',
        lastModified: file.lastModified
      });
    });

    if (files.length > 0) {
      handleFileUpload(files);
    } else {
      console.log('⚠️ No files selected from input');
    }
  }, []);

  const handleFileUpload = async (files: File[]) => {
    setIsUploading(true);
    setError(null);
    setImportResult(null);
    setUploadProgress(0);

    try {
      console.log('📁 Starting file upload...');
      console.log('📊 Files received:', files.length);
      files.forEach((file, index) => {
        console.log(`📄 File ${index + 1}:`, {
          name: file.name,
          size: file.size,
          type: file.type,
          webkitRelativePath: (file as any).webkitRelativePath || 'N/A'
        });
      });

      // 过滤掉空文件和文件夹
      const validFiles = files.filter(file => {
        // 检查文件名
        if (!file.name || file.name.trim() === '') {
          console.log(`⚠️ Skipping invalid filename: ${file.name}`);
          return false;
        }

        // 跳过 .DS_Store 文件
        if (file.name === '.DS_Store') {
          console.log(`⚠️ Skipping .DS_Store file`);
          return false;
        }

        // 检查文件大小（允许一些系统文件为0字节）
        if (file.size === 0 && !file.name.toLowerCase().endsWith('.md')) {
          console.log(`⚠️ Skipping empty file: ${file.name} (size: ${file.size})`);
          return false;
        }

        // 检查是否是文件夹本身（这是webkitdirectory的问题）
        if (file.type === '' && !file.name.includes('.')) {
          console.log(`⚠️ Skipping directory: ${file.name}`);
          return false;
        }

        // 对于文件夹上传，文件类型可能为空，但这是正常的
        // 只要文件名是 .md 或图片格式就接受
        const isMarkdown = file.name.toLowerCase().endsWith('.md') || file.name.toLowerCase().endsWith('.markdown');
        const isImage = /\.(png|jpg|jpeg|gif|svg)$/i.test(file.name);

        if (!isMarkdown && !isImage) {
          console.log(`⚠️ Skipping unsupported file type: ${file.name}`);
          return false;
        }

        console.log(`✅ Valid file: ${file.name} (${file.size} bytes, ${isMarkdown ? 'Markdown' : 'Image'})`);
        return true;
      });

      console.log(`✅ Valid files: ${validFiles.length}/${files.length}`);

      if (validFiles.length === 0) {
        throw new Error('没有找到有效的文件。请确保选择了包含 Markdown 文件的文件夹。');
      }

      const formData = new FormData();
      validFiles.forEach((file) => {
        formData.append('files', file);
      });

      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await api.post('/api/import/upload-files', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      console.log('✅ Upload successful:', response.data);

      const result = response.data as ImportResult;
      setImportResult(result);

      // 通知父组件
      if (onImportComplete) {
        onImportComplete(result);
      }

      setTimeout(() => {
        setUploadProgress(0);
      }, 1000);

    } catch (error: any) {
      console.error('❌ Upload failed:', error);
      setError(error.response?.data?.detail || '导入失败，请重试');
    } finally {
      setIsUploading(false);
    }
  };

  const resetComponent = () => {
    setImportResult(null);
    setError(null);
    setUploadProgress(0);
  };

  if (importResult) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 max-w-md mx-auto">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            导入完成！
          </h3>
          <p className="text-muted-foreground mb-4">
            成功导入 {importResult.imported_count} 篇文章
          </p>

          <div className="space-y-2 mb-6">
            {importResult.articles.map((article) => (
              <div key={article.id} className="text-left p-3 bg-muted rounded-md">
                <div className="font-medium text-sm">{article.title}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(article.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={resetComponent}
              className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
            >
              继续导入
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                完成
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 max-w-md mx-auto">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            导入失败
          </h3>
          <p className="text-muted-foreground mb-4">
            {error}
          </p>

          <div className="flex gap-2">
            <button
              onClick={resetComponent}
              className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
            >
              重试
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                取消
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 max-w-md mx-auto">
      {isUploading ? (
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            正在导入文件...
          </h3>
          <div className="w-full bg-secondary rounded-full h-2 mb-4">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            正在处理 Markdown 文件和图片...
          </p>
        </div>
      ) : (
        <>
          <div className="text-center mb-6">
            <Upload className="w-12 h-12 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              导入文件
            </h3>
            <p className="text-sm text-muted-foreground">
              支持 Notion/Wolai 导出的 Markdown 文件和图片
            </p>
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="space-y-4">
              <div className="flex justify-center space-x-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
                <Image className="w-8 h-8 text-muted-foreground" />
                <FolderOpen className="w-8 h-8 text-muted-foreground" />
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-1">
                  拖拽文件到这里
                </p>
                <p className="text-xs text-muted-foreground">
                  或点击下方按钮选择文件
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="block">
              <input
                type="file"
                multiple
                accept=".md,.markdown,.png,.jpg,.jpeg,.gif,.svg"
                onChange={handleFileSelect}
                className="hidden"
                webkitdirectory=""
              />
              <div className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors cursor-pointer text-center">
                选择文件夹内的所有文件
              </div>
            </label>
          </div>

          <div className="mt-2">
            <label className="block">
              <input
                type="file"
                multiple
                accept=".md,.markdown,.png,.jpg,.jpeg,.gif,.svg"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors cursor-pointer text-center">
                选择 Markdown 和图片文件
              </div>
            </label>
          </div>

          <div className="mt-4 text-xs text-muted-foreground">
            <p className="mb-1">支持的格式：</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Markdown 文件 (.md)</li>
              <li>图片文件 (.png, .jpg, .jpeg, .gif, .svg)</li>
              <li>包含上述文件的文件夹</li>
            </ul>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="mt-4 w-full px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
            >
              取消
            </button>
          )}
        </>
      )}
    </div>
  );
}
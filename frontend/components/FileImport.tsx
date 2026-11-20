'use client';

import React, { useState, useCallback } from 'react';
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

// ============================================================
// Component
// ============================================================

export function FileImport({ onImportComplete, onClose }: FileImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'file' | 'url'>('file');
  const [url, setUrl] = useState('');

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

    const processEntry = async (entry: any): Promise<void> => {
      if (entry.isFile) {
        return new Promise((resolve) => {
          entry.file((file: File) => { files.push(file); resolve(); });
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        return new Promise((resolve) => {
          const readEntries = () => {
            dirReader.readEntries(async (entries: any[]) => {
              if (entries.length === 0) { resolve(); return; }
              for (const childEntry of entries) await processEntry(childEntry);
              readEntries();
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
          if (entry) await processEntry(entry);
        }
      }
      if (files.length > 0) handleFileUpload(files);
    } catch (err) {
      const fallbackFiles = Array.from(e.dataTransfer.files);
      if (fallbackFiles.length > 0) handleFileUpload(fallbackFiles);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFileUpload(files);
  }, []);

  const handleFileUpload = async (files: File[]) => {
    setIsUploading(true);
    setError(null);
    setImportResult(null);
    setUploadProgress(0);

    try {
      const validFiles = files.filter(file => {
        if (!file.name || file.name.trim() === '') return false;
        if (file.name === '.DS_Store') return false;
        if (file.size === 0 && !file.name.toLowerCase().endsWith('.md')) return false;
        if (file.type === '' && !file.name.includes('.')) return false;
        const isMarkdown = file.name.toLowerCase().endsWith('.md') || file.name.toLowerCase().endsWith('.markdown');
        const isImage = /\.(png|jpg|jpeg|gif|svg)$/i.test(file.name);
        return isMarkdown || isImage;
      });

      if (validFiles.length === 0) {
        throw new Error('没有找到有效的文件 — 确保选择了 Markdown 或图片文件。');
      }

      const formData = new FormData();
      validFiles.forEach((file) => formData.append('files', file));

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => prev >= 90 ? 90 : prev + 10);
      }, 200);

      const response = await api.post('/api/import/upload-files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result = response.data as ImportResult;
      setImportResult(result);
      onImportComplete?.(result);

      setTimeout(() => setUploadProgress(0), 1000);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || '导入失败,请重试');
    } finally {
      setIsUploading(false);
    }
  };

  const handleURLFetch = async () => {
    if (!url.trim()) { setError('请输入有效的 URL'); return; }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => prev >= 90 ? 90 : prev + 10);
      }, 200);

      const response = await api.post('/api/upload/fetch-url', { url });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const articleData = response.data.article || {
        id: response.data.file?.id,
        title: response.data.title,
        status: 'imported',
        created_at: new Date().toISOString(),
      };
      const result: ImportResult = { success: true, imported_count: 1, articles: [articleData] };
      setImportResult(result);
      onImportComplete?.(result);
    } catch (e: any) {
      setError(e.response?.data?.detail || '无法获取 URL 内容,请检查链接是否有效');
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setImportResult(null);
    setError(null);
    setUploadProgress(0);
    setUrl('');
  };

  // ============================================================
  // States: success / error / uploading
  // ============================================================

  if (importResult) {
    return (
      <Frame onClose={onClose}>
        <Eyebrow>Done</Eyebrow>
        <Heading>{importResult.imported_count} 篇文章已导入</Heading>
        <p style={paragraphStyle}>已加入你的工作区。继续导入或直接关闭面板回到编辑器。</p>

        <div style={articleListStyle}>
          {importResult.articles.map(a => (
            <div key={a.id} style={articleRowStyle}>
              <div style={articleTitleStyle}>{a.title}</div>
              <div style={articleMetaStyle}>{new Date(a.created_at).toLocaleString('zh-CN', { hour12: false })}</div>
            </div>
          ))}
        </div>

        <div style={footerStyle}>
          <button onClick={reset} style={ghostBtnStyle}>继续导入</button>
          {onClose && <button onClick={onClose} style={primaryBtnStyle}>完成</button>}
        </div>
      </Frame>
    );
  }

  if (error) {
    return (
      <Frame onClose={onClose}>
        <Eyebrow style={{ color: '#fca5a5' }}>Failed</Eyebrow>
        <Heading>导入未能完成</Heading>
        <div style={errorBoxStyle}>{error}</div>
        <div style={footerStyle}>
          <button onClick={reset} style={ghostBtnStyle}>重试</button>
          {onClose && <button onClick={onClose} style={primaryBtnStyle}>关闭</button>}
        </div>
      </Frame>
    );
  }

  if (isUploading) {
    return (
      <Frame onClose={onClose}>
        <Eyebrow>Working</Eyebrow>
        <Heading>{importMode === 'url' ? '正在抓取网页' : '正在导入文件'}</Heading>
        <p style={paragraphStyle}>{importMode === 'url' ? '解析 HTML → Markdown,稍候片刻。' : '正在处理 Markdown 与图片。'}</p>

        <div style={progressTrackStyle}>
          <div style={{ ...progressBarStyle, width: `${uploadProgress}%` }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--m-n450)', marginTop: '0.5rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
          {uploadProgress}%
        </div>
      </Frame>
    );
  }

  // ============================================================
  // Default state — picker
  // ============================================================

  return (
    <Frame onClose={onClose}>
      <Eyebrow>Add to workspace</Eyebrow>
      <Heading>导入内容</Heading>
      <p style={paragraphStyle}>从本地拖入文件 / 文件夹,或粘贴一个网页链接,自动转成 Markdown 加入工作区。</p>

      {/* Mode tabs — quiet pill group */}
      <div style={tabGroupStyle}>
        <button
          onClick={() => setImportMode('file')}
          style={importMode === 'file' ? tabActiveStyle : tabStyle}
        >
          File
        </button>
        <button
          onClick={() => setImportMode('url')}
          style={importMode === 'url' ? tabActiveStyle : tabStyle}
        >
          URL
        </button>
      </div>

      {importMode === 'file' ? (
        <>
          {/* Drop zone — the visual center */}
          <div
            style={isDragging ? dropZoneActiveStyle : dropZoneStyle}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isDragging ? '#D97149' : 'var(--m-n500)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.18s ease', marginBottom: '0.875rem' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div style={dropTitleStyle}>{isDragging ? '松开导入' : '拖入此处'}</div>
            <div style={dropHintStyle}>或在下方选择文件 / 文件夹</div>
          </div>

          {/* Two-button row — folder is primary, individual files is secondary */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem' }}>
            <label style={{ flex: 1, display: 'block' }}>
              <input
                type="file"
                multiple
                accept=".md,.markdown,.png,.jpg,.jpeg,.gif,.svg"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                {...({ webkitdirectory: '' } as any)}
              />
              <div style={primaryBtnFullStyle}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                选择文件夹
              </div>
            </label>
            <label style={{ flex: 1, display: 'block' }}>
              <input
                type="file"
                multiple
                accept=".md,.markdown,.png,.jpg,.jpeg,.gif,.svg"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <div style={ghostBtnFullStyle}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                选择文件
              </div>
            </label>
          </div>

          {/* Supported formats — quiet single-line monospace */}
          <div style={formatLineStyle}>
            <span style={formatLabelStyle}>Supported</span>
            <span style={formatValueStyle}>.md  ·  .png .jpg .jpeg .gif .svg  ·  folders</span>
          </div>
        </>
      ) : (
        <>
          {/* URL input — input with inline submit affordance */}
          <div style={urlInputWrapStyle}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ ...urlIconStyle, color: "var(--m-n450)" }}>
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              style={urlInputStyle}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleURLFetch(); }}
            />
          </div>

          <button onClick={handleURLFetch} disabled={!url.trim()} style={url.trim() ? primaryBtnFullStyle : primaryBtnDisabledStyle}>
            抓取并导入
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>

          <div style={formatLineStyle}>
            <span style={formatLabelStyle}>Works on</span>
            <span style={formatValueStyle}>blogs · news · docs · public pages</span>
          </div>
        </>
      )}
    </Frame>
  );
}

// ============================================================
// Frame — provides eyebrow → heading → body → close affordance
// ============================================================

function Frame({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div style={frameStyle}>
      {onClose && (
        <button onClick={onClose} style={closeBtnStyle} title="Close" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      )}
      {children}
    </div>
  );
}

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ ...eyebrowStyle, ...(style || {}) }}>
      <span style={eyebrowDotStyle} />
      <span>{children}</span>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 style={headingStyle}>{children}</h2>;
}

// ============================================================
// Styles — Stone palette matched to dashboard.module.css
// ============================================================

const frameStyle: React.CSSProperties = {
  position: 'relative',
  padding: '2rem 2.25rem 1.875rem',
  background: 'transparent',
  color: 'var(--m-n50)',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  WebkitFontSmoothing: 'antialiased',
};

const closeBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: '0.875rem',
  right: '0.875rem',
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: 'var(--m-n400)',
  cursor: 'pointer',
  borderRadius: 6,
  transition: 'color 0.15s ease, background 0.15s ease',
};

const eyebrowStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4375rem',
  fontSize: '0.625rem',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  fontWeight: 500,
  color: 'var(--m-n400)',
  marginBottom: '0.625rem',
};

const eyebrowDotStyle: React.CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: '999px',
  background: '#D97149',
  display: 'inline-block',
};

const headingStyle: React.CSSProperties = {
  fontFamily: '"Times New Roman", Georgia, serif',
  fontSize: '1.625rem',
  fontWeight: 600,
  color: 'var(--m-n50)',
  letterSpacing: '-0.025em',
  lineHeight: 1.15,
  margin: 0,
  marginBottom: '0.5rem',
};

const paragraphStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: 'var(--m-n300)',
  lineHeight: 1.6,
  margin: 0,
  marginBottom: '1.5rem',
  maxWidth: '38ch',
};

// Tabs
const tabGroupStyle: React.CSSProperties = {
  display: 'inline-flex',
  gap: 0,
  background: 'var(--m-n880)',
  border: '1px solid var(--m-n750)',
  borderRadius: 8,
  padding: 3,
  marginBottom: '1.25rem',
};

const tabStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  letterSpacing: '0.04em',
  padding: '0.3125rem 0.9375rem',
  borderRadius: 5,
  border: 'none',
  background: 'transparent',
  color: 'var(--m-n400)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 500,
  transition: 'color 0.15s ease, background 0.15s ease',
};

const tabActiveStyle: React.CSSProperties = {
  ...tabStyle,
  background: 'var(--m-n750)',
  color: 'var(--m-n50)',
};

// Drop zone
const dropZoneStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2.5rem 1.5rem',
  border: '1px dashed var(--m-n750)',
  borderRadius: 10,
  background: 'rgba(41, 37, 36, 0.25)',
  transition: 'border-color 0.18s ease, background 0.18s ease',
  cursor: 'default',
};

const dropZoneActiveStyle: React.CSSProperties = {
  ...dropZoneStyle,
  borderColor: '#D97149',
  background: 'rgba(217, 113, 73, 0.06)',
};

const dropTitleStyle: React.CSSProperties = {
  fontFamily: '"Times New Roman", Georgia, serif',
  fontSize: '1.0625rem',
  fontWeight: 600,
  color: 'var(--m-n200)',
  marginBottom: '0.25rem',
  letterSpacing: '-0.01em',
};

const dropHintStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--m-n400)',
  letterSpacing: '0.005em',
};

// Buttons
const primaryBtnFullStyle: React.CSSProperties = {
  width: '100%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.4375rem',
  fontSize: '0.75rem',
  padding: '0.5rem 0.875rem',
  borderRadius: 7,
  border: '1px solid #D97149',
  background: '#D97149',
  color: 'white',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 500,
  letterSpacing: '0.005em',
  transition: 'background 0.15s ease, transform 0.15s ease',
};

const primaryBtnDisabledStyle: React.CSSProperties = {
  ...primaryBtnFullStyle,
  opacity: 0.4,
  cursor: 'not-allowed',
};

const ghostBtnFullStyle: React.CSSProperties = {
  width: '100%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.4375rem',
  fontSize: '0.75rem',
  padding: '0.5rem 0.875rem',
  borderRadius: 7,
  border: '1px solid var(--m-n750)',
  background: 'transparent',
  color: 'var(--m-n300)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 500,
  transition: 'all 0.15s ease',
};

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  fontSize: '0.75rem',
  padding: '0.5rem 1rem',
  borderRadius: 6,
  border: '1px solid #D97149',
  background: '#D97149',
  color: 'white',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 500,
};

const ghostBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  fontSize: '0.75rem',
  padding: '0.5rem 1rem',
  borderRadius: 6,
  border: '1px solid var(--m-n750)',
  background: 'transparent',
  color: 'var(--m-n300)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

// URL input
const urlInputWrapStyle: React.CSSProperties = {
  position: 'relative',
  marginBottom: '0.75rem',
};

const urlIconStyle: React.CSSProperties = {
  position: 'absolute',
  left: '0.75rem',
  top: '50%',
  transform: 'translateY(-50%)',
};

const urlInputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--m-n925)',
  border: '1px solid var(--m-n750)',
  borderRadius: 7,
  padding: '0.5625rem 0.75rem 0.5625rem 2rem',
  color: 'var(--m-n50)',
  fontSize: '0.8125rem',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  letterSpacing: '0.005em',
  outline: 'none',
  transition: 'border-color 0.15s ease',
};

// Format hint
const formatLineStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '0.75rem',
  marginTop: '1.25rem',
  paddingTop: '1rem',
  borderTop: '1px solid var(--m-n880)',
};

const formatLabelStyle: React.CSSProperties = {
  fontSize: '0.625rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--m-n450)',
  fontWeight: 500,
  flexShrink: 0,
};

const formatValueStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  color: 'var(--m-n400)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  letterSpacing: '0.01em',
};

// Article list (success state)
const articleListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4375rem',
  marginBottom: '1.5rem',
  maxHeight: 220,
  overflowY: 'auto',
};

const articleRowStyle: React.CSSProperties = {
  padding: '0.625rem 0.75rem',
  background: 'rgba(41, 37, 36, 0.5)',
  border: '1px solid var(--m-n880)',
  borderRadius: 7,
};

const articleTitleStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: 'var(--m-n200)',
  fontWeight: 500,
  marginBottom: '0.1875rem',
  lineHeight: 1.35,
};

const articleMetaStyle: React.CSSProperties = {
  fontSize: '0.625rem',
  color: 'var(--m-n450)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  justifyContent: 'flex-end',
  marginTop: '0.5rem',
};

// Progress (uploading)
const progressTrackStyle: React.CSSProperties = {
  width: '100%',
  height: 2,
  background: 'var(--m-n880)',
  borderRadius: 999,
  overflow: 'hidden',
  marginTop: '1.5rem',
};

const progressBarStyle: React.CSSProperties = {
  height: '100%',
  background: 'linear-gradient(90deg, #D97149, #E9A476)',
  borderRadius: 999,
  transition: 'width 0.3s ease',
};

// Error
const errorBoxStyle: React.CSSProperties = {
  padding: '0.75rem 0.875rem',
  background: 'rgba(239, 68, 68, 0.08)',
  border: '1px solid rgba(239, 68, 68, 0.25)',
  borderRadius: 7,
  color: '#fca5a5',
  fontSize: '0.8125rem',
  lineHeight: 1.5,
  marginBottom: '1.25rem',
};

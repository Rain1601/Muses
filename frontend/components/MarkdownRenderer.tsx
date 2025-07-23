'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // 自定义代码块渲染
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            return !isInline ? (
              <pre className="bg-gray-900 text-yellow-200 p-4 rounded-lg overflow-x-auto my-4 border border-gray-700">
                <code className={`language-${match[1]}`} {...props}>
                  {children}
                </code>
              </pre>
            ) : (
              <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-yellow-200 px-1 py-0.5 rounded text-sm" {...props}>
                {children}
              </code>
            );
          },
          // 自定义标题渲染
          h1: ({ children }) => (
            <h1 className="text-3xl font-bold mt-8 mb-4 pb-2 border-b border-gray-200">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-bold mt-6 mb-3">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-bold mt-4 mb-2">
              {children}
            </h3>
          ),
          // 自定义段落渲染
          p: ({ children }) => (
            <p className="my-4 leading-relaxed text-gray-900 dark:text-gray-100">
              {children}
            </p>
          ),
          // 自定义链接渲染
          a: ({ href, children }) => (
            <a 
              href={href} 
              className="text-blue-600 underline hover:text-blue-800"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          // 自定义引用块渲染
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-50 dark:bg-blue-900/20 italic text-gray-900 dark:text-gray-100">
              {children}
            </blockquote>
          ),
          // 自定义列表渲染
          ul: ({ children }) => (
            <ul className="list-disc pl-6 my-4 text-gray-900 dark:text-gray-100">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 my-4 text-gray-900 dark:text-gray-100">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="my-2 text-gray-900 dark:text-gray-100">
              {children}
            </li>
          ),
          // 自定义表格渲染
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 bg-gray-50 dark:bg-gray-800 font-medium text-left text-gray-900 dark:text-gray-100">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100">
              {children}
            </td>
          ),
          // 自定义图片渲染
          img: ({ src, alt }) => (
            <img 
              src={src} 
              alt={alt} 
              className="max-w-full h-auto rounded-lg shadow-sm my-4"
            />
          ),
          // 自定义水平线渲染
          hr: () => (
            <hr className="my-8 border-gray-300 dark:border-gray-600" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
} 
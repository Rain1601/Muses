'use client';

import EnhancedTiptapWrapper from '@/components/EnhancedTiptapWrapper';
import './mermaid-styles.css';

export default function EditorDemoPage() {
  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">增强版 Tiptap 编辑器演示</h1>
      <EnhancedTiptapWrapper />
      
      <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">技术实现说明</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <strong>Markdown语法：</strong>MarkdownHeadings扩展监听空格键，自动转换 # 为标题
          </li>
          <li>
            <strong>代码高亮：</strong>集成 CodeBlockLowlight 扩展，支持多种编程语言
          </li>
          <li>
            <strong>斜杠命令：</strong>SlashCommands扩展实现Notion风格的快速插入
          </li>
          <li>
            <strong>Mermaid图表：</strong>自定义扩展支持流程图渲染
          </li>
          <li>
            <strong>丰富工具栏：</strong>完整的格式化选项和快捷操作
          </li>
          <li>
            <strong>扩展架构：</strong>所有功能都是独立Extension，易于定制和扩展
          </li>
        </ul>
      </div>
    </div>
  );
}
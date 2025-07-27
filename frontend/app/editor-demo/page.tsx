'use client';

import EnhancedTiptapWrapper from '@/components/EnhancedTiptapWrapper';
import ImageUploadWrapper from '@/components/ImageUploadWrapper';
import AdvancedTiptapWrapper from '@/components/AdvancedTiptapWrapper';
import './mermaid-styles.css';

export default function EditorDemoPage() {
  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">🚀 Notion 风格全功能编辑器</h1>
      
      {/* 全功能编辑器 */}
      <div className="mb-8">
        <AdvancedTiptapWrapper />
      </div>

      {/* 功能对比区 */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* 支持图片的编辑器 */}
        <div>
          <h2 className="text-xl font-semibold mb-4">🖼️ 图片专用编辑器</h2>
          <ImageUploadWrapper />
        </div>

        {/* 基础编辑器 */}
        <div>
          <h2 className="text-xl font-semibold mb-4">📝 基础增强版编辑器</h2>
          <EnhancedTiptapWrapper />
        </div>
      </div>
      
      <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">🎯 AI 交互功能说明</h2>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white dark:bg-gray-700 p-3 rounded">
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <kbd className="text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">⌘K</kbd>
              Command+K 智能助手
            </h3>
            <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
              <li>• 在任意位置按下快捷键触发</li>
              <li>• 预设常用写作指令</li>
              <li>• 智能排序，常用指令优先</li>
              <li>• 支持自定义指令输入</li>
            </ul>
          </div>
          <div className="bg-white dark:bg-gray-700 p-3 rounded">
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <span className="text-lg">✨</span>
              选中文字 AI 工具栏
            </h3>
            <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
              <li>• 选中文字自动显示</li>
              <li>• AI改写、续写、优化、解释</li>
              <li>• 传统格式化功能</li>
              <li>• 美观的渐变色设计</li>
            </ul>
          </div>
        </div>
        
        <h2 className="text-lg font-semibold mb-2">技术实现说明</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <strong>图片功能：</strong>支持复制粘贴、拖拽上传、URL插入，自动上传到GitHub
          </li>
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
            <strong>AI快捷键：</strong>CommandKExtension扩展实现⌘K快捷键触发
          </li>
          <li>
            <strong>拖拽支持：</strong>Dropcursor扩展提供可视化拖拽指示
          </li>
          <li>
            <strong>粘贴处理：</strong>ImagePasteHandler扩展处理图片粘贴事件
          </li>
          <li>
            <strong>扩展架构：</strong>所有功能都是独立Extension，易于定制和扩展
          </li>
        </ul>
      </div>
    </div>
  );
}
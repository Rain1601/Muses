import React, { useState, useEffect, useRef } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { textblockTypeInputRule } from '@tiptap/core';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import markdown from 'highlight.js/lib/languages/markdown';
import { ChevronDown, ChevronRight, Code2, Copy, Check } from 'lucide-react';

// 创建并注册语言
const lowlight = createLowlight();
lowlight.register('javascript', javascript);
lowlight.register('typescript', typescript);
lowlight.register('python', python);
lowlight.register('json', json);
lowlight.register('html', xml);
lowlight.register('xml', xml);
lowlight.register('css', css);
lowlight.register('markdown', markdown);

interface CodeBlockComponentProps {
  node: any;
  updateAttributes: (attrs: any) => void;
  extension: any;
}

const CodeBlockComponent: React.FC<CodeBlockComponentProps> = ({
  node,
  updateAttributes,
  extension
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const language = node.attrs.language || 'plaintext';
  const content = node.textContent;

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowLanguageMenu(false);
      }
    };

    if (showLanguageMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLanguageMenu]);

  // 判断是否应该显示折叠按钮（对于较长的代码块）
  const lines = content.split('\n');
  const shouldShowToggle = lines.length > 10;
  const previewLines = 5; // 折叠时显示的行数

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // 支持的语言列表
  const supportedLanguages = [
    { id: 'plaintext', label: 'Plain Text' },
    { id: 'javascript', label: 'JavaScript' },
    { id: 'typescript', label: 'TypeScript' },
    { id: 'python', label: 'Python' },
    { id: 'json', label: 'JSON' },
    { id: 'html', label: 'HTML' },
    { id: 'xml', label: 'XML' },
    { id: 'css', label: 'CSS' },
    { id: 'markdown', label: 'Markdown' },
  ];

  // 获取语言显示名称
  const getLanguageLabel = (lang: string) => {
    const found = supportedLanguages.find(l => l.id === lang);
    return found ? found.label : lang.toUpperCase();
  };

  // 切换语言
  const changeLanguage = (newLang: string) => {
    updateAttributes({ language: newLang });
    setShowLanguageMenu(false);
  };

  return (
    <NodeViewWrapper className="relative my-4 group">
      {/* 代码块头部 */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-800 dark:bg-zinc-900 border-b border-zinc-700 dark:border-zinc-800 rounded-t-md">
        <div className="flex items-center gap-2">
          {shouldShowToggle && (
            <button
              onClick={toggleCollapse}
              className="p-1 hover:bg-zinc-700 dark:hover:bg-zinc-800 rounded transition-colors"
              title={isCollapsed ? '展开代码' : '收起代码'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              )}
            </button>
          )}
          <div ref={menuRef} className="relative flex items-center gap-2">
            <Code2 className="w-4 h-4 text-zinc-500" />
            <button
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              className="text-xs font-mono text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-700 dark:hover:bg-zinc-800 transition-colors"
              title="切换语言"
            >
              {getLanguageLabel(language)}
            </button>

            {/* 语言选择下拉菜单 */}
            {showLanguageMenu && (
              <div className="absolute top-full left-0 mt-1 bg-zinc-800 dark:bg-zinc-900 border border-zinc-700 dark:border-zinc-800 rounded-md shadow-lg z-10 min-w-[140px]">
                <div className="py-1 max-h-60 overflow-y-auto">
                  {supportedLanguages.map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => changeLanguage(lang.id)}
                      className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors ${
                        language === lang.id
                          ? 'bg-zinc-700 dark:bg-zinc-800 text-zinc-200'
                          : 'text-zinc-400 hover:bg-zinc-700 dark:hover:bg-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {isCollapsed && (
            <span className="text-xs text-zinc-500">
              {lines.length} 行代码
            </span>
          )}
        </div>

        {/* 复制按钮 */}
        <button
          onClick={handleCopy}
          className="p-1.5 hover:bg-zinc-700 dark:hover:bg-zinc-800 rounded transition-colors opacity-0 group-hover:opacity-100"
          title="复制代码"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4 text-zinc-400" />
          )}
        </button>
      </div>

      {/* 代码内容 */}
      <div className={`relative ${isCollapsed ? 'max-h-32 overflow-hidden' : ''}`}>
        <pre className="!mt-0 !rounded-t-none">
          <NodeViewContent
            as="code"
            className={`hljs language-${language}`}
            style={{
              display: 'block',
              overflowX: 'auto',
              padding: '1em',
            }}
          />
        </pre>

        {/* 折叠时的渐变遮罩 */}
        {isCollapsed && (
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none" />
        )}
      </div>

      {/* 折叠时的展开提示 */}
      {isCollapsed && (
        <button
          onClick={toggleCollapse}
          className="w-full py-2 bg-zinc-800 dark:bg-zinc-900 border-t border-zinc-700 dark:border-zinc-800 text-xs text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700 dark:hover:bg-zinc-800 transition-colors rounded-b-md flex items-center justify-center gap-1"
        >
          <ChevronDown className="w-3 h-3" />
          展开查看全部代码
        </button>
      )}
    </NodeViewWrapper>
  );
};

export const CollapsibleCodeBlock = Node.create({
  name: 'codeBlock',

  addOptions() {
    return {
      languageClassPrefix: 'language-',
      exitOnTripleEnter: true,
      exitOnArrowDown: true,
      HTMLAttributes: {},
    };
  },

  content: 'text*',

  marks: '',

  group: 'block',

  code: true,

  defining: true,

  addAttributes() {
    return {
      language: {
        default: null,
        parseHTML: element => {
          const { languageClassPrefix } = this.options;
          const classNames = [...(element.firstElementChild?.classList || [])];
          const languages = classNames
            .filter(className => className.startsWith(languageClassPrefix))
            .map(className => className.replace(languageClassPrefix, ''));
          const language = languages[0];

          if (!language) {
            return null;
          }

          return language;
        },
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'pre',
        preserveWhitespace: 'full',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'pre',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      [
        'code',
        {
          class: node.attrs.language
            ? this.options.languageClassPrefix + node.attrs.language
            : null,
        },
        0,
      ],
    ];
  },

  addCommands() {
    return {
      setCodeBlock: attributes => ({ commands }) => {
        return commands.setNode(this.name, attributes);
      },
      toggleCodeBlock: attributes => ({ commands }) => {
        return commands.toggleNode(this.name, 'paragraph', attributes);
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-c': () => this.editor.commands.toggleCodeBlock(),

      // 退出代码块
      'Backspace': () => {
        const { empty, $anchor } = this.editor.state.selection;
        const isAtStart = $anchor.pos === 1;

        if (!empty || $anchor.parent.type.name !== this.name) {
          return false;
        }

        if (isAtStart || !$anchor.parent.textContent.length) {
          return this.editor.commands.clearNodes();
        }

        return false;
      },

      // 三个回车退出
      Enter: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $from, empty } = selection;

        if (!empty || $from.parent.type.name !== this.name) {
          return false;
        }

        const isAtEnd = $from.parentOffset === $from.parent.nodeSize - 2;

        if (!isAtEnd) {
          return false;
        }

        const endsWithDoubleNewline = $from.parent.textContent.endsWith('\n\n');

        if (!endsWithDoubleNewline) {
          return false;
        }

        return editor
          .chain()
          .command(({ tr }) => {
            tr.delete($from.pos - 2, $from.pos);
            return true;
          })
          .exitCode()
          .run();
      },

      // 方向键下退出
      ArrowDown: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $from, empty } = selection;

        if (!empty || $from.parent.type.name !== this.name) {
          return false;
        }

        const isAtEnd = $from.parentOffset === $from.parent.nodeSize - 2;

        if (!isAtEnd) {
          return false;
        }

        return this.editor.commands.exitCode();
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent);
  },

  addInputRules() {
    return [
      textblockTypeInputRule({
        find: /^```([a-z]+)?[\s\n]$/,
        type: this.type,
        getAttributes: match => ({
          language: match[1],
        }),
      }),
    ];
  },
});

export default CollapsibleCodeBlock;
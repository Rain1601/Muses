"use client";

import { useState, useRef, useEffect } from 'react';
import { NotionEditor } from '@/components/NotionEditor';
import { Send, Check, MessageSquarePlus, ArrowLeftRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface CoCreateModeProps {
  articleId?: string;
  agentId?: string;
  initialContent?: string;
  onContentChange?: (content: string) => void;
}

export function CoCreateMode({
  articleId,
  agentId,
  initialContent = '',
  onContentChange
}: CoCreateModeProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editorContent, setEditorContent] = useState(initialContent);
  const [selectedText, setSelectedText] = useState<{ text: string; messageId: string } | null>(null);
  const [isSwapped, setIsSwapped] = useState(false); // 是否交换左右位置
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { showToast } = useToast();

  // 自动滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 加载对话历史
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!articleId) return;

      try {
        const response = await api.get(`/api/chat-history/${articleId}`);
        if (response.data.messages && response.data.messages.length > 0) {
          const loadedMessages: Message[] = response.data.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.createdAt)
          }));
          setMessages(loadedMessages);
        }
      } catch (error) {
        console.error('加载对话历史失败:', error);
        // 如果是404错误，说明没有历史记录，不需要提示
      }
    };

    loadChatHistory();
  }, [articleId]);

  // 自动保存对话历史
  useEffect(() => {
    const saveChatHistory = async () => {
      if (!articleId || !agentId || messages.length === 0) return;

      try {
        await api.post('/api/chat-history/save', {
          articleId,
          agentId,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        });
      } catch (error) {
        console.error('保存对话历史失败:', error);
      }
    };

    // 延迟保存，避免频繁请求
    const timer = setTimeout(saveChatHistory, 2000);
    return () => clearTimeout(timer);
  }, [messages, articleId, agentId]);

  // 处理发送消息
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    if (!agentId) {
      showToast('请先选择一个 Agent', 'warning');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // 调用 AI 生成回复
      const response = await api.post('/api/agents/chat', {
        agentId,
        messages: [...messages, userMessage].map(m => ({
          role: m.role,
          content: m.content
        })),
        context: editorContent // 提供当前编辑器内容作为上下文
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.message || response.data.content,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('AI 回复失败:', error);
      showToast(
        error.response?.data?.detail || 'AI 回复失败，请重试',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 处理文本选择
  const handleTextSelection = (messageId: string) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length > 0) {
      setSelectedText({ text, messageId });
    } else {
      setSelectedText(null);
    }
  };

  // 处理采纳文本
  const handleAdoptText = () => {
    if (!selectedText) return;

    // 将选中的文本插入到编辑器末尾
    const newContent = editorContent
      ? `${editorContent}\n\n${selectedText.text}`
      : selectedText.text;

    setEditorContent(newContent);
    if (onContentChange) {
      onContentChange(newContent);
    }

    showToast('文本已采纳到编辑器', 'success');
    setSelectedText(null);

    // 清除选择
    window.getSelection()?.removeAllRanges();
  };

  // 处理输入框键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 处理编辑器内容变化
  const handleEditorChange = (content: string) => {
    setEditorContent(content);
    if (onContentChange) {
      onContentChange(content);
    }
  };

  // 对话区组件
  const ChatSection = () => (
    <div className={`w-1/2 ${isSwapped ? 'border-l' : 'border-r'} border-border flex flex-col bg-card relative`}>
        {/* 对话标题 */}
        <div className="border-b border-border p-4 bg-muted/30">
          <h3 className="text-lg font-semibold text-foreground">与 AI 共创</h3>
          <p className="text-sm text-muted-foreground mt-1">
            与 AI 对话创作，选中文字点击采纳添加到右侧编辑器
          </p>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-start justify-center pt-32">
              <div className="text-center bg-background border-2 border-border rounded-xl px-8 py-10 shadow-lg max-w-sm animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                  <MessageSquarePlus className="w-8 h-8 text-primary" />
                </div>
                <p className="text-base font-medium text-foreground mb-2">开始与 AI 对话创作</p>
                <p className="text-sm text-muted-foreground">输入你的想法，AI 会帮你拓展</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                    onMouseUp={() => handleTextSelection(message.id)}
                  >
                    <div className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                    <div className={`text-xs mt-2 opacity-70 ${
                      message.role === 'user' ? 'text-primary-foreground' : 'text-muted-foreground'
                    }`}>
                      {message.timestamp.toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted text-foreground rounded-lg px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* 采纳按钮（浮动显示） */}
        {selectedText && (
          <div className="absolute bottom-28 left-1/2 transform -translate-x-1/2 z-10">
            <button
              onClick={handleAdoptText}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-lg hover:bg-primary/90 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
            >
              <Check className="w-4 h-4" />
              <span className="text-sm font-medium">采纳到编辑器</span>
            </button>
          </div>
        )}

        {/* 输入区域 */}
        <div className="border-t border-border p-4 bg-background">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的想法... (Enter 发送，Shift+Enter 换行)"
              className="flex-1 resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[60px] max-h-[120px]"
              rows={2}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
  );

  // 编辑器区组件
  const EditorSection = () => (
    <div className="w-1/2 flex flex-col bg-background">
      <div className="border-b border-border p-4 bg-muted/30">
        <h3 className="text-lg font-semibold text-foreground">文章编辑</h3>
        <p className="text-sm text-muted-foreground mt-1">
          采纳的内容会出现在这里
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto py-8 max-w-4xl px-8">
          <NotionEditor
            key={`co-create-${articleId || 'new'}-${agentId}`}
            initialContent={editorContent}
            onChange={handleEditorChange}
            agentId={agentId}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-full relative">
      {/* 左右布局，根据 isSwapped 决定顺序 */}
      {isSwapped ? (
        <>
          <EditorSection />
          <ChatSection />
        </>
      ) : (
        <>
          <ChatSection />
          <EditorSection />
        </>
      )}

      {/* 切换左右位置的按钮 */}
      <button
        onClick={() => setIsSwapped(!isSwapped)}
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-card border-2 border-border rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary group"
        title="切换左右位置"
      >
        <ArrowLeftRight className="w-5 h-5 group-hover:scale-110 transition-transform" />
      </button>
    </div>
  );
}

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export type TextActionType = 'improve' | 'explain' | 'expand' | 'summarize' | 'translate' | 'rewrite';

// 编辑历史条目 — 与后端 EditRecord schema 对齐
export interface TextActionEditRecord {
  action: string;
  summary: string;
  accepted?: boolean;
}

interface TextActionRequest {
  agentId: string;
  text: string;
  actionType: TextActionType;
  context?: string;
  language?: string;
  provider?: string;
  model?: string;

  // ── Context Injection (可选, 全 undefined 时后端不注入文档上下文) ──
  articleTitle?: string;
  articleContent?: string;
  selectionStart?: number;
  selectionEnd?: number;
  editHistory?: TextActionEditRecord[];
  contextConfig?: Record<string, unknown>;
}

interface TextActionResponse {
  actionType: string;
  originalText: string;
  processedText: string;
  explanation?: string;
}

const performTextAction = async (request: TextActionRequest): Promise<TextActionResponse> => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch('/api/agents/text-action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
};

export const useTextActions = () => {
  const mutation = useMutation({
    mutationFn: performTextAction,
    onError: (error: Error) => {
      console.error('Text action failed:', error);
      toast.error(`操作失败: ${error.message}`);
    },
    onSuccess: (data: TextActionResponse) => {
      const actionNames = {
        improve: '改进',
        explain: '解释',
        expand: '扩展',
        summarize: '总结',
        translate: '翻译',
        rewrite: '重写'
      };

      const actionName = actionNames[data.actionType as TextActionType] || data.actionType;
      toast.success(`文本${actionName}完成`);
    },
  });

  const executeAction = async (
    agentId: string,
    text: string,
    actionType: TextActionType,
    options?: {
      context?: string;
      language?: string;
      provider?: string;
      model?: string;
      // Context Injection
      articleTitle?: string;
      articleContent?: string;
      selectionStart?: number;
      selectionEnd?: number;
      editHistory?: TextActionEditRecord[];
      contextConfig?: Record<string, unknown>;
    }
  ): Promise<TextActionResponse> => {
    return mutation.mutateAsync({
      agentId,
      text: text.trim(),
      actionType,
      context: options?.context,
      language: options?.language,
      provider: options?.provider,
      model: options?.model,
      articleTitle: options?.articleTitle,
      articleContent: options?.articleContent,
      selectionStart: options?.selectionStart,
      selectionEnd: options?.selectionEnd,
      editHistory: options?.editHistory,
      contextConfig: options?.contextConfig,
    });
  };

  return {
    executeAction,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
};

export default useTextActions;
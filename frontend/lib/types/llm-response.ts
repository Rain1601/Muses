export type TaskType = 'rewrite' | 'continue' | 'custom';

export interface ChangeDetail {
  type: 'add' | 'delete' | 'modify';
  original: string;
  modified: string;
  position: {
    start: number;
    end: number;
  };
  reason?: string;
}

export interface LLMResponseMetadata {
  original?: string;          // 原文（仅rewrite类型）
  changes?: ChangeDetail[];   // 修改详情（仅rewrite类型）
  context?: string;           // 上下文信息
  confidence?: number;        // 任务类型判断置信度
  suggestions?: string[];     // 额外建议
}

export interface LLMResponseDebug {
  reasoning?: string;         // 任务类型判断理由
  alternatives?: string[];    // 其他可能的处理方式
}

export interface LLMResponse {
  type: TaskType;
  result: string;
  metadata?: LLMResponseMetadata;
  debug?: LLMResponseDebug;
}

// 用于API请求的接口
export interface ProcessTextRequest {
  input: string;
  context?: string;
  agentId: string;
  options?: {
    model?: string;
    temperature?: number;
    taskType?: TaskType;  // 可选，如果不提供则自动识别
  };
}

// 用于文章改进的特定接口
export interface ArticleImproveRequest {
  articleId: string;
  agentId: string;
  instructions: string;
  taskType?: 'rewrite' | 'continue';
}

// 用于聊天的接口
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  agentId: string;
  messages: ChatMessage[];
  materials?: string;
  enableStructuredResponse?: boolean; // 是否启用结构化响应
}
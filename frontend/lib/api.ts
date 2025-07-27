import axios from 'axios';
import { ProcessTextRequest, LLMResponse, ArticleImproveRequest, ChatRequest } from './types/llm-response';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// 创建axios实例
export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// 请求拦截器 - 自动添加认证头
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理认证错误
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // 认证失败，清除token并跳转到首页
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

// 新的结构化文本处理API
export const processApi = {
  // 处理文本并返回结构化响应
  processText: async (request: ProcessTextRequest): Promise<LLMResponse> => {
    const response = await api.post('/api/process/process-text', request);
    return response.data;
  },

  // 改进文章并返回差异信息
  improveArticle: async (request: ArticleImproveRequest): Promise<LLMResponse> => {
    const response = await api.post('/api/process/improve-article', request);
    return response.data;
  },

  // 结构化聊天
  chatStructured: async (request: ChatRequest): Promise<LLMResponse | { response: string }> => {
    const response = await api.post('/api/process/chat-structured', request);
    return response.data;
  }
};

export default api;
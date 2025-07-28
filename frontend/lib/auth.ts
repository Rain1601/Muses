import axios from 'axios';

// 自动检测环境：如果是 muses.ink 域名，使用生产 API，否则使用开发环境
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'muses.ink' || hostname.endsWith('.muses.ink')) {
      return 'https://api.muses.ink';
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
};

const API_URL = getApiUrl();

export interface User {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  hasOpenAIKey: boolean;
}

export const auth = {
  // 从URL中获取token并存储
  handleCallback: async (token: string) => {
    if (typeof window === 'undefined') return false;
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return true;
  },

  // 验证token并获取用户信息
  verifyToken: async (): Promise<User | null> => {
    // 检查是否在浏览器环境
    if (typeof window === 'undefined') return null;
    
    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const response = await axios.get(`${API_URL}/api/auth/verify`);
      return response.data.user;
    } catch (error) {
      console.log('Token verification failed:', error);
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      return null;
    }
  },

  // 登出
  logout: async () => {
    await axios.post(`${API_URL}/api/auth/logout`);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    delete axios.defaults.headers.common['Authorization'];
  },

  // 获取GitHub登录URL
  getGitHubLoginUrl: () => {
    return `${API_URL}/api/auth/github`;
  },
};
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

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
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return true;
  },

  // 验证token并获取用户信息
  verifyToken: async (): Promise<User | null> => {
    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const response = await axios.get(`${API_URL}/api/auth/verify`);
      return response.data.user;
    } catch (error) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      return null;
    }
  },

  // 登出
  logout: async () => {
    await axios.post(`${API_URL}/api/auth/logout`);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    window.location.href = '/';
  },

  // 获取GitHub登录URL
  getGitHubLoginUrl: () => {
    return `${API_URL}/api/auth/github`;
  },
};
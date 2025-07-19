import NodeCache from 'node-cache';

// 创建缓存实例
// stdTTL: 默认缓存时间（秒）
// checkperiod: 检查过期键的时间间隔（秒）
export const cache = new NodeCache({
  stdTTL: 600, // 10分钟
  checkperiod: 120, // 2分钟检查一次
});

// 缓存键的前缀
export const CacheKeys = {
  USER: (id: string) => `user:${id}`,
  AGENT: (id: string) => `agent:${id}`,
  ARTICLE: (id: string) => `article:${id}`,
  USER_AGENTS: (userId: string) => `user_agents:${userId}`,
  USER_ARTICLES: (userId: string) => `user_articles:${userId}`,
} as const;
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // 优化开发体验
  experimental: {
    turbo: {
      rules: {
        // 优化CSS加载
        '*.css': ['css-loader'],
      },
    },
  },
  // 减少编译时间
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // 开发模式优化
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://localhost:8080';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  // 增加服务器端超时时间
  serverRuntimeConfig: {
    apiTimeout: 60000, // 60 seconds
  },
};

module.exports = nextConfig;
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
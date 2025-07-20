# 多阶段构建 Dockerfile

# 阶段1: 构建后端
FROM node:18-alpine AS backend-builder

WORKDIR /app/backend

# 安装 pnpm
RUN npm install -g pnpm

# 复制后端依赖文件
COPY backend/package.json backend/pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY backend .

# 构建
RUN pnpm build

# 阶段2: 构建前端
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# 安装 pnpm
RUN npm install -g pnpm

# 复制前端依赖文件
COPY frontend/package.json frontend/pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY frontend .

# 设置构建时环境变量
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# 构建
RUN pnpm build

# 阶段3: 运行时镜像
FROM node:18-alpine

WORKDIR /app

# 安装 pnpm 和必要工具
RUN npm install -g pnpm pm2 && \
    apk add --no-cache sqlite

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 复制后端构建结果
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/dist ./backend/dist
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/package.json ./backend/
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/prisma ./backend/prisma

# 复制前端构建结果
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/public ./frontend/public
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/package.json ./frontend/
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/next.config.js ./frontend/

# 安装生产依赖
WORKDIR /app/backend
RUN pnpm install --prod --frozen-lockfile

WORKDIR /app/frontend
RUN pnpm install --prod --frozen-lockfile

# 创建必要的目录
RUN mkdir -p /app/backend/uploads /app/backend/logs && \
    chown -R nodejs:nodejs /app

# 切换到非 root 用户
USER nodejs

# 复制 PM2 配置
COPY --chown=nodejs:nodejs ecosystem.config.js /app/

# 暴露端口
EXPOSE 3000 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# 启动应用
WORKDIR /app
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
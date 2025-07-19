# 部署指南

## 🚀 部署概览

Muses支持多种部署方式，从简单的本地部署到生产环境的完整部署。本文档提供了详细的部署指南和最佳实践。

## 📋 部署前准备

### 环境要求

**基础环境**:
- Node.js >= 18.0.0
- pnpm >= 8.0.0
- SQLite3支持
- 至少2GB内存
- 5GB可用磁盘空间

**外部服务**:
- GitHub OAuth App
- OpenAI API访问权限
- (可选) 域名和SSL证书

### 环境变量配置

创建并配置`backend/.env`文件：

```env
# 应用配置
NODE_ENV=production
PORT=8080
FRONTEND_URL=http://localhost:3000

# 数据库配置
DATABASE_URL="file:./muses.db"

# JWT配置
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

# GitHub OAuth配置
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:8080/api/auth/github/callback

# 文件上传配置
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# 安全配置
ENCRYPTION_KEY=your_32_character_encryption_key
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# 可选：数据库备份
BACKUP_ENABLED=true
BACKUP_INTERVAL=24h
BACKUP_RETENTION=7d
```

## 🏗️ 本地开发部署

### 快速启动

```bash
# 1. 克隆项目
git clone <repository-url>
cd Muses

# 2. 项目初始化
./scripts/setup.sh

# 3. 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env 文件

# 4. 启动开发环境
./scripts/start.sh
```

### 开发模式启动

```bash
# 在不同终端窗口启动
./scripts/dev.sh

# 或手动启动
# 终端1: 后端
cd backend && pnpm dev

# 终端2: 前端  
cd frontend && pnpm dev
```

## 🏭 生产环境部署

### 1. 构建生产版本

```bash
# 构建前后端
./scripts/build.sh

# 构建产物在 dist/ 目录
```

### 2. 传统服务器部署

#### 步骤1: 服务器准备

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装pnpm
npm install -g pnpm

# 安装PM2
npm install -g pm2

# 创建应用用户
sudo useradd -m -s /bin/bash muses
sudo mkdir -p /opt/muses
sudo chown muses:muses /opt/muses
```

#### 步骤2: 部署应用

```bash
# 上传构建产物
scp -r dist/* user@server:/opt/muses/

# 登录服务器
ssh user@server

# 切换到应用目录
cd /opt/muses

# 安装生产依赖
cd backend && pnpm install --prod
cd ../frontend && pnpm install --prod

# 生成数据库
cd ../backend
pnpm db:generate
pnpm db:push
```

#### 步骤3: 配置PM2

```bash
# 使用项目提供的PM2配置
cp ecosystem.config.js /opt/muses/
pm2 start ecosystem.config.js

# 设置开机自启
pm2 startup
pm2 save
```

#### 步骤4: 配置Nginx

```nginx
# /etc/nginx/sites-available/muses
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API代理
    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 文件上传大小限制
        client_max_body_size 10M;
    }

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/muses /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Docker部署

#### Dockerfile配置

```dockerfile
# backend/Dockerfile
FROM node:18-alpine AS base
WORKDIR /app

# 安装依赖
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# 构建应用
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm install -g pnpm && pnpm build

# 生产运行
FROM base AS runner
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

USER nextjs
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

#### Docker Compose配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:./data/muses.db
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=http://localhost:8080
    depends_on:
      - backend
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
    restart: unless-stopped
```

```bash
# 部署命令
docker-compose up -d
```

### 4. 云平台部署

#### Vercel部署 (仅前端)

```bash
# 安装Vercel CLI
npm install -g vercel

# 登录并部署
cd frontend
vercel

# 配置环境变量
vercel env add NEXT_PUBLIC_API_URL
```

#### Railway部署

```yaml
# railway.yml
version: 2

services:
  backend:
    source: ./backend
    build:
      commands:
        - pnpm install
        - pnpm build
        - pnpm db:generate
        - pnpm db:push
    start: node dist/index.js
    variables:
      NODE_ENV: production

  frontend:
    source: ./frontend
    build:
      commands:
        - pnpm install
        - pnpm build
    start: pnpm start
    variables:
      NODE_ENV: production
```

## 🔐 SSL证书配置

### Let's Encrypt证书

```bash
# 安装certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo crontab -e
# 添加: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Nginx SSL配置

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # 其他配置...
}

# HTTP重定向到HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

## 📊 监控和日志

### PM2监控

```bash
# 查看应用状态
pm2 status

# 查看日志
pm2 logs

# 监控资源使用
pm2 monit

# 重启应用
pm2 restart all
```

### Nginx日志

```bash
# 访问日志
tail -f /var/log/nginx/access.log

# 错误日志
tail -f /var/log/nginx/error.log
```

### 应用日志

```bash
# 应用日志目录
/opt/muses/backend/logs/

# 实时查看
tail -f /opt/muses/backend/logs/app.log
```

## 🔄 数据备份

### 自动备份脚本

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/opt/backups/muses"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
cp /opt/muses/backend/muses.db $BACKUP_DIR/muses_$TIMESTAMP.db

# 备份上传文件
tar -czf $BACKUP_DIR/uploads_$TIMESTAMP.tar.gz /opt/muses/backend/uploads

# 清理7天前的备份
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $TIMESTAMP"
```

```bash
# 设置定时备份
crontab -e
# 添加: 0 2 * * * /opt/scripts/backup.sh
```

## ⚡ 性能优化

### 服务器优化

```bash
# 增加文件描述符限制
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# 优化TCP参数
echo "net.core.somaxconn = 65536" >> /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 65536" >> /etc/sysctl.conf
sysctl -p
```

### 应用优化

```javascript
// PM2配置优化
module.exports = {
  apps: [
    {
      name: 'muses-backend',
      script: './backend/dist/index.js',
      instances: 'max',  // 使用所有CPU核心
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      env: {
        NODE_ENV: 'production',
      }
    }
  ]
};
```

## 🚨 故障排查

### 常见问题

1. **数据库连接失败**
   ```bash
   # 检查数据库文件权限
   ls -la /opt/muses/backend/muses.db
   
   # 重新生成数据库
   cd /opt/muses/backend
   pnpm db:push
   ```

2. **文件上传失败**
   ```bash
   # 检查上传目录权限
   chmod 755 /opt/muses/backend/uploads
   chown muses:muses /opt/muses/backend/uploads
   ```

3. **内存不足**
   ```bash
   # 添加swap空间
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

### 日志分析

```bash
# 查看错误日志
grep "ERROR" /opt/muses/backend/logs/app.log

# 查看慢查询
grep "slow" /opt/muses/backend/logs/app.log

# 监控资源使用
htop
iostat -x 1
```

## 📈 扩展和升级

### 水平扩展

```yaml
# docker-compose.scale.yml
version: '3.8'

services:
  backend:
    build: ./backend
    environment:
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
    deploy:
      replicas: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx-lb.conf:/etc/nginx/nginx.conf
    depends_on:
      - backend
```

### 版本升级

```bash
# 备份当前版本
./scripts/backup.sh

# 下载新版本
git pull origin main

# 停止服务
pm2 stop all

# 重新构建
./scripts/build.sh

# 更新数据库
cd backend && pnpm db:push

# 重启服务
pm2 restart all
```

## 📋 部署清单

### 部署前检查
- [ ] 环境变量配置完成
- [ ] GitHub OAuth App创建并配置
- [ ] SSL证书申请和配置
- [ ] 数据库备份策略
- [ ] 监控和日志配置
- [ ] 防火墙规则设置

### 部署后验证
- [ ] 前端页面正常访问
- [ ] API接口响应正常
- [ ] 用户登录功能正常
- [ ] 文件上传功能正常
- [ ] 文章生成功能正常
- [ ] GitHub发布功能正常

### 运维检查
- [ ] 系统资源监控
- [ ] 应用日志监控
- [ ] 数据备份验证
- [ ] 安全扫描
- [ ] 性能测试 
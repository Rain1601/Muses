# Muses 部署指南

## 部署方式

### 1. 使用 Docker（推荐）

```bash
# 构建镜像
docker build -t muses .

# 运行容器
docker run -d \
  -p 3000:3000 \
  -p 8080:8080 \
  -v $(pwd)/data:/app/backend/data \
  --env-file .env \
  muses
```

### 2. 使用 PM2

```bash
# 安装 PM2
npm install -g pm2

# 构建项目
./scripts/build.sh

# 启动服务
cd dist
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save
pm2 startup
```

### 3. 使用 Vercel + Railway

#### 前端部署到 Vercel
1. Fork 项目到你的 GitHub
2. 在 Vercel 导入项目
3. 设置环境变量：
   - `NEXT_PUBLIC_API_URL`: 你的后端 URL

#### 后端部署到 Railway
1. 创建新项目
2. 连接 GitHub 仓库
3. 设置启动命令：`cd backend && pnpm start`
4. 添加环境变量

### 4. 使用服务器直接部署

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/muses.git
cd muses

# 2. 运行设置脚本
./scripts/setup.sh

# 3. 配置环境变量
nano backend/.env

# 4. 构建项目
./scripts/build.sh

# 5. 使用 systemd 管理服务
sudo nano /etc/systemd/system/muses-backend.service
```

#### systemd 服务文件示例：

```ini
[Unit]
Description=Muses Backend Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/muses/backend
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 环境变量配置

### 必需的环境变量

```bash
# JWT 密钥（使用随机字符串）
JWT_SECRET=your_random_secret_key_here_at_least_32_chars

# GitHub OAuth（在 GitHub 创建 OAuth App）
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# 数据库（生产环境建议使用 PostgreSQL）
DATABASE_URL=postgresql://user:password@localhost:5432/muses

# 加密密钥（必须是32个字符）
ENCRYPTION_KEY=your_32_character_encryption_key
```

### 可选的环境变量

```bash
# 前端 URL
FRONTEND_URL=https://your-domain.com

# 限流设置
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# 日志设置
LOG_LEVEL=info
LOG_FILE=/var/log/muses/app.log
```

## 反向代理配置

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 后端 API
    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 性能优化

### 1. 启用 Redis 缓存

```javascript
// backend/src/utils/redis.ts
import Redis from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});
```

### 2. 使用 CDN

- 静态资源上传到 CDN
- 配置 Next.js 的 assetPrefix

### 3. 数据库优化

- 添加索引
- 使用连接池
- 定期清理过期数据

## 监控和日志

### 1. 使用 Winston 记录日志

```javascript
// backend/src/utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

### 2. 使用 Sentry 监控错误

```javascript
// 前端和后端都可以集成
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

## 备份策略

### 自动备份脚本

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/var/backups/muses"
DB_FILE="/var/www/muses/backend/muses.db"
UPLOADS_DIR="/var/www/muses/backend/uploads"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
cp $DB_FILE "$BACKUP_DIR/muses-$(date +%Y%m%d-%H%M%S).db"

# 备份上传文件
tar -czf "$BACKUP_DIR/uploads-$(date +%Y%m%d-%H%M%S).tar.gz" $UPLOADS_DIR

# 删除30天前的备份
find $BACKUP_DIR -type f -mtime +30 -delete
```

### 设置定时任务

```bash
# 添加到 crontab
0 2 * * * /path/to/backup.sh
```

## 安全建议

1. **使用 HTTPS**
   - 使用 Let's Encrypt 免费证书
   - 配置 SSL/TLS

2. **环境变量安全**
   - 不要将 .env 文件提交到仓库
   - 使用密钥管理服务

3. **更新依赖**
   - 定期运行 `npm audit`
   - 及时更新依赖包

4. **限制上传**
   - 验证文件类型
   - 限制文件大小
   - 使用病毒扫描

5. **数据库安全**
   - 使用强密码
   - 限制访问权限
   - 定期备份

## 故障排查

### 常见问题

1. **数据库连接失败**
   - 检查 DATABASE_URL
   - 确认数据库服务运行
   - 检查防火墙设置

2. **GitHub OAuth 失败**
   - 检查回调 URL 配置
   - 确认 Client ID 和 Secret
   - 检查应用权限

3. **文件上传失败**
   - 检查目录权限
   - 确认磁盘空间
   - 查看文件大小限制

### 日志位置

- 前端日志：浏览器控制台
- 后端日志：`backend/logs/`
- PM2 日志：`~/.pm2/logs/`
- 系统日志：`/var/log/`

## 扩展部署

### 使用 Kubernetes

创建部署文件：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: muses
spec:
  replicas: 3
  selector:
    matchLabels:
      app: muses
  template:
    metadata:
      labels:
        app: muses
    spec:
      containers:
      - name: backend
        image: muses-backend:latest
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: "production"
      - name: frontend
        image: muses-frontend:latest
        ports:
        - containerPort: 3000
```

### 使用 Docker Compose

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8080:8080"
    volumes:
      - ./data:/app/data
    env_file:
      - .env
    depends_on:
      - postgres

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8080
    depends_on:
      - backend

  postgres:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=muses
      - POSTGRES_USER=muses
      - POSTGRES_PASSWORD=your_password

volumes:
  postgres_data:
```
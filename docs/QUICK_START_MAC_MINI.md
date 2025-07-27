# Mac Mini 快速部署指南

> 这是一个简化版的部署指南，适合快速上手。详细说明请参考 [MAC_MINI_DEPLOYMENT.md](./MAC_MINI_DEPLOYMENT.md)

## 🚀 一键部署

### 1. 克隆项目
```bash
cd ~/Projects
git clone git@github.com:your-username/Muses.git
cd Muses
```

### 2. 运行安装脚本
```bash
chmod +x scripts/install-mac-mini.sh
./scripts/install-mac-mini.sh
```

### 3. 配置环境变量
```bash
# 后端环境配置
cat > backend/.env << 'EOF'
DATABASE_URL="file:./muses.db"
JWT_SECRET="your-super-secret-jwt-key"
GITHUB_CLIENT_ID="your-github-oauth-id"
GITHUB_CLIENT_SECRET="your-github-oauth-secret"
ENCRYPTION_KEY="your-32-character-encryption-key"
EOF
```

### 4. 初始化数据库
```bash
cd backend && npm run db:generate && npm run db:push && cd ..
```

### 5. 测试部署
```bash
./scripts/mac-mini-deploy.sh
```

## ✅ 验证部署

访问 `http://localhost:3004` 检查前端是否正常运行。

## 📊 监控状态

```bash
# 查看自动同步日志
tail -f ~/Library/Logs/muses-auto-sync.log

# 检查服务状态
launchctl list | grep muses
```

## 🔧 常用命令

```bash
# 手动同步代码
git pull origin main && ./scripts/mac-mini-deploy.sh

# 重启服务
./scripts/mac-mini-deploy.sh restart

# 停止服务
./scripts/mac-mini-deploy.sh stop

# 启动服务
./scripts/mac-mini-deploy.sh start
```

## 🌐 配置外网访问 (可选)

### Cloudflare Tunnel
```bash
# 安装 cloudflared
brew install cloudflared

# 登录并创建隧道
cloudflared tunnel login
cloudflared tunnel create muses-tunnel

# 配置隧道 (~/.cloudflared/config.yml)
tunnel: muses-tunnel
credentials-file: ~/.cloudflared/[tunnel-id].json
ingress:
  - hostname: your-domain.com
    service: http://localhost:3004
  - service: http_status:404

# 设置 DNS 并启动
cloudflared tunnel route dns muses-tunnel your-domain.com
cloudflared tunnel run muses-tunnel
```

## 🆘 故障排除

| 问题 | 解决方案 |
|------|----------|
| 端口被占用 | `lsof -ti:3004 \| xargs kill -9` |
| 依赖安装失败 | `rm -rf node_modules && npm install` |
| 构建失败 | 查看构建日志，检查 TypeScript 错误 |
| 自动同步不工作 | 检查 LaunchAgent 状态和日志 |

**完成！🎉 现在 MacBook Pro 上的每次推送都会自动部署到 Mac Mini。**
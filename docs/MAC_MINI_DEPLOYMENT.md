# Mac Mini 自动部署指南

本文档详细说明如何在 Mac Mini 上设置 Muses 项目的自动部署系统。

## 系统概述

- **开发环境**: MacBook Pro
- **生产环境**: Mac Mini
- **部署流程**: MacBook Pro 开发 → 推送到 GitHub → Mac Mini 自动拉取并部署
- **外网访问**: 通过 Cloudflare Tunnel

## 前置要求

### Mac Mini 环境准备
```bash
# 1. 安装 Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. 安装 Node.js
brew install node

# 3. 安装 Python
brew install python

# 4. 安装 Git
brew install git

# 5. 验证安装
node --version
npm --version
python3 --version
git --version
```

### GitHub 配置
```bash
# 1. 配置 Git 用户信息
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# 2. 生成 SSH 密钥（如果没有）
ssh-keygen -t ed25519 -C "your.email@example.com"

# 3. 添加 SSH 密钥到 GitHub
cat ~/.ssh/id_ed25519.pub
# 复制输出内容，添加到 GitHub Settings > SSH and GPG keys
```

## 部署步骤

### 第一步：克隆项目
```bash
# 创建项目目录
mkdir -p ~/Projects
cd ~/Projects

# 克隆项目
git clone git@github.com:your-username/Muses.git
cd Muses

# 验证克隆成功
ls -la
```

### 第二步：运行自动安装脚本
```bash
# 给脚本执行权限
chmod +x scripts/install-mac-mini.sh

# 运行安装脚本
./scripts/install-mac-mini.sh
```

**安装脚本会自动完成：**
- 安装项目依赖（前端和后端）
- 设置自动同步脚本
- 配置 LaunchAgent 服务
- 启动自动监控服务

### 第三步：配置环境变量

#### 后端环境配置
```bash
# 创建后端环境文件
cat > backend/.env << 'EOF'
DATABASE_URL="file:./muses.db"
JWT_SECRET="your-super-secret-jwt-key-change-this"
GITHUB_CLIENT_ID="your-github-oauth-app-id"
GITHUB_CLIENT_SECRET="your-github-oauth-app-secret"
ENCRYPTION_KEY="your-32-character-encryption-key-here"
EOF
```

#### Python 后端环境配置
```bash
# 创建 Python 后端环境文件
cat > backend-python/.env << 'EOF'
# 添加必要的环境变量
EOF
```

### 第四步：初始化数据库
```bash
# 进入后端目录
cd backend

# 生成 Prisma 客户端
npm run db:generate

# 推送数据库结构
npm run db:push

# 返回项目根目录
cd ..
```

### 第五步：测试手动部署
```bash
# 运行手动部署脚本测试
./scripts/mac-mini-deploy.sh
```

如果成功，你会看到：
- ✅ 依赖安装完成
- ✅ 前端构建成功
- ✅ 服务启动成功
- ✅ 健康检查通过

### 第六步：验证自动监控服务
```bash
# 检查服务状态
launchctl list | grep muses

# 查看服务日志
tail -f ~/Library/Logs/muses-auto-sync.log

# 手动触发同步测试
touch .git/refs/heads/main
```

## Cloudflare Tunnel 配置

### 安装 Cloudflared
```bash
# 安装 cloudflared
brew install cloudflared

# 登录 Cloudflare
cloudflared tunnel login
```

### 创建隧道
```bash
# 创建隧道
cloudflared tunnel create muses-tunnel

# 配置隧道
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: muses-tunnel
credentials-file: ~/.cloudflared/[tunnel-id].json

ingress:
  - hostname: your-domain.com
    service: http://localhost:3004
  - service: http_status:404
EOF

# 设置 DNS 记录
cloudflared tunnel route dns muses-tunnel your-domain.com

# 启动隧道
cloudflared tunnel run muses-tunnel
```

### 设置隧道自动启动
```bash
# 安装为系统服务
sudo cloudflared service install

# 启动服务
sudo launchctl start com.cloudflare.cloudflared
```

## 监控和维护

### 查看日志
```bash
# 自动同步日志
tail -f ~/Library/Logs/muses-auto-sync.log

# 应用日志
tail -f logs/app.log
```

### 手动操作
```bash
# 手动停止服务
./scripts/mac-mini-deploy.sh stop

# 手动启动服务
./scripts/mac-mini-deploy.sh start

# 手动重启服务
./scripts/mac-mini-deploy.sh restart

# 查看服务状态
./scripts/mac-mini-deploy.sh status
```

### 故障排除
```bash
# 如果自动同步失败，查看日志
cat ~/Library/Logs/muses-auto-sync.log

# 手动拉取最新代码
git pull origin main

# 重新安装依赖
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# 重新构建前端
cd frontend && npm run build && cd ..
```

## 服务管理

### 启动/停止自动监控
```bash
# 停止自动监控
launchctl unload ~/Library/LaunchAgents/com.muses.autosync.plist

# 启动自动监控
launchctl load ~/Library/LaunchAgents/com.muses.autosync.plist

# 重启自动监控
launchctl unload ~/Library/LaunchAgents/com.muses.autosync.plist
launchctl load ~/Library/LaunchAgents/com.muses.autosync.plist
```

### 更新部署脚本
如果修改了部署脚本，需要重新加载服务：
```bash
# 重新加载服务配置
launchctl unload ~/Library/LaunchAgents/com.muses.autosync.plist
launchctl load ~/Library/LaunchAgents/com.muses.autosync.plist
```

## 安全注意事项

1. **环境变量保护**：确保 `.env` 文件权限为 600
   ```bash
   chmod 600 backend/.env
   chmod 600 backend-python/.env
   ```

2. **SSH 密钥保护**：确保 SSH 私钥权限正确
   ```bash
   chmod 600 ~/.ssh/id_ed25519
   chmod 644 ~/.ssh/id_ed25519.pub
   ```

3. **定期更新**：保持系统和依赖包的更新
   ```bash
   brew update && brew upgrade
   npm update
   ```

## 性能优化

1. **定期清理日志**：
   ```bash
   # 清理超过 7 天的日志
   find ~/Library/Logs -name "muses-*.log" -mtime +7 -delete
   ```

2. **监控磁盘空间**：
   ```bash
   df -h
   ```

3. **监控内存使用**：
   ```bash
   top -pid $(pgrep -f "node.*frontend\|node.*backend")
   ```

## 常见问题

### Q: 自动同步不工作？
**A**: 检查以下几点：
1. LaunchAgent 是否正确加载
2. Git 仓库状态是否正常
3. 网络连接是否正常
4. 查看日志文件确定具体错误

### Q: 构建失败？
**A**: 可能的原因：
1. 依赖包版本冲突
2. 环境变量缺失
3. 磁盘空间不足
4. 重新运行 `npm install` 解决

### Q: 服务启动失败？
**A**: 检查：
1. 端口是否被占用
2. 环境变量是否正确设置
3. 数据库是否正确初始化
4. 查看具体错误日志

## 联系支持

如果遇到问题：
1. 查看日志文件
2. 检查 GitHub Issues
3. 联系开发团队

---

**部署完成后，享受自动化的开发体验！** 🚀
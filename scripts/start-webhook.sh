#!/bin/bash

# 启动 Webhook 服务器

cd "$(dirname "$0")/.."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install express
fi

# 设置环境变量
export WEBHOOK_PORT=9000
export WEBHOOK_SECRET="your-secret-key-here"  # 修改为实际密钥
export PROJECT_DIR="$(pwd)"

echo "🚀 启动 Webhook 服务器..."
echo "📡 端口: $WEBHOOK_PORT"
echo "📂 项目目录: $PROJECT_DIR"

# 启动服务器
node scripts/webhook-server.js
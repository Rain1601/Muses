#!/bin/bash

# Muses Backend 清理启动脚本
echo "🧹 清理端口占用..."

# 杀死占用8080端口的进程
PORT_PID=$(lsof -t -i:8080)
if [ ! -z "$PORT_PID" ]; then
    echo "发现端口8080被进程$PORT_PID占用，正在清理..."
    kill -9 $PORT_PID
    sleep 2
fi

# 清理可能的node进程
pkill -f "ts-node src/index.ts" 2>/dev/null || true
pkill -f "nodemon" 2>/dev/null || true

echo "✅ 端口清理完成"

# 检查环境变量
if [ ! -f .env ]; then
    echo "⚠️  警告: .env 文件不存在"
    echo "请确保配置了以下环境变量："
    echo "  - JWT_SECRET"
    echo "  - GITHUB_CLIENT_ID" 
    echo "  - GITHUB_CLIENT_SECRET"
    echo ""
fi

# 启动服务
echo "🚀 启动后端服务..."
npm run dev
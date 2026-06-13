#!/bin/bash

# Muses 项目启动脚本
# 同时启动前端和后端服务

set -e  # 遇到错误立即退出

echo "🚀 启动 Muses 项目..."
echo ""

# 检查是否已经初始化
if [ ! -d "frontend/node_modules" ] || [ ! -f "backend/requirements.txt" ]; then
    echo "⚠️  检测到项目未初始化"
    echo "正在运行初始化脚本..."
    ./scripts/setup.sh
fi

# 检查环境变量文件
if [ ! -f "backend/.env" ]; then
    echo "❌ 错误: backend/.env 文件不存在"
    echo "请先运行 ./scripts/setup.sh 并配置环境变量"
    exit 1
fi

# 检查必要的环境变量
source backend/.env
if [ -z "$JWT_SECRET" ] || [ -z "$GITHUB_CLIENT_ID" ] || [ -z "$GITHUB_CLIENT_SECRET" ]; then
    echo "❌ 错误: 环境变量配置不完整"
    echo "请编辑 backend/.env 文件，确保以下变量已设置："
    echo "  - JWT_SECRET"
    echo "  - GITHUB_CLIENT_ID"
    echo "  - GITHUB_CLIENT_SECRET"
    echo "  - ENCRYPTION_KEY"
    exit 1
fi

# 清理之前的进程
echo "🧹 清理之前的进程..."
pkill -f "python.*start.py" || true
pkill -f "npm.*dev" || true
sleep 2

# 启动Python后端
echo "🔧 启动Python后端服务 (端口 8080)..."
cd backend
python start.py &
BACKEND_PID=$!
cd ..

# 等待后端启动
echo "⏳ 等待后端服务启动..."
sleep 5

# 检查后端是否启动成功
if ! curl -s http://localhost:8080/health > /dev/null; then
    echo "❌ 后端服务启动失败"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo "✅ 后端服务启动成功"

# 启动前端
echo "🎨 启动前端服务 (端口 3004)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# 等待前端启动
echo "⏳ 等待前端服务启动..."
sleep 5

echo ""
echo "✨ Muses 启动成功！"
echo ""
echo "🌐 访问地址:"
echo "   前端: http://localhost:3004"
echo "   后端: http://localhost:8080"
echo ""
echo "📝 使用说明:"
echo "   1. 访问 http://localhost:3004"
echo "   2. 使用 GitHub 账号登录"
echo "   3. 配置 OpenAI API Key"
echo "   4. 创建 Agent 并开始生成文章"
echo ""
echo "⚠️  按 Ctrl+C 停止所有服务"

# 等待用户中断
trap 'echo ""; echo "🛑 停止所有服务..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; exit' INT

# 保持脚本运行
wait
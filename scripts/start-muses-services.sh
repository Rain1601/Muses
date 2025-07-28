#!/bin/bash

# Muses 服务启动脚本
# 确保所有服务（前端、后端、Tunnel）都在运行

echo "🚀 启动 Muses 全套服务..."

# 项目目录
PROJECT_DIR="/Users/xiaogugu/PycharmProjects/Muses"

# 1. 启动后端服务
echo "📦 启动后端服务..."
cd "$PROJECT_DIR/backend-python"
if ! pgrep -f "uvicorn.*app.main:app" > /dev/null; then
    source venv_deploy/bin/activate
    nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8080 > ~/muses-backend.log 2>&1 &
    deactivate
    echo "✅ 后端服务已启动"
else
    echo "✅ 后端服务已在运行"
fi

# 2. 启动前端服务
echo "🌐 启动前端服务..."
cd "$PROJECT_DIR/frontend"
if ! pgrep -f "next start.*3004" > /dev/null; then
    nohup npm start > ~/muses-frontend.log 2>&1 &
    echo "✅ 前端服务已启动"
else
    echo "✅ 前端服务已在运行"
fi

# 3. 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 4. 启动 Cloudflare Tunnel
echo "🌍 启动 Cloudflare Tunnel..."
~/muses-tunnel.sh start

echo ""
echo "🎉 所有服务启动完成！"
echo ""
echo "🌐 访问地址："
echo "   主站: https://muses.ink"
echo "   API:  https://api.muses.ink"
echo ""
echo "📝 管理命令："
echo "   检查状态: ~/muses-tunnel.sh status"
echo "   查看日志: ~/muses-tunnel.sh logs"
echo "   停止服务: ~/muses-tunnel.sh stop"
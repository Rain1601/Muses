#!/bin/bash

# Muses Python版本启动脚本
echo "🚀 启动 Muses (Python Backend)..."
echo ""

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: Python 3 未安装"
    exit 1
fi

# 清理可能的端口占用
echo "🧹 清理端口..."
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
lsof -ti:3004 | xargs kill -9 2>/dev/null || true
sleep 2

# 根据操作系统选择终端
OS="$(uname -s)"

case "$OS" in
    Darwin*)  # macOS
        # 启动Python后端
        osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"'/backend-python && python3 start.py"'
        
        # 等待后端启动
        echo "⏳ 等待后端启动..."
        sleep 5
        
        # 启动前端
        osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"'/frontend && npm run dev"'
        ;;
        
    Linux*)   # Linux
        # 启动Python后端
        gnome-terminal -- bash -c "cd backend-python && python3 start.py; exec bash" 2>/dev/null || \
        xterm -e "cd backend-python && python3 start.py; bash" &
        
        # 等待后端启动
        echo "⏳ 等待后端启动..."
        sleep 5
        
        # 启动前端
        gnome-terminal -- bash -c "cd frontend && npm run dev; exec bash" 2>/dev/null || \
        xterm -e "cd frontend && npm run dev; bash" &
        ;;
        
    *)
        echo "⚠️  请手动在两个终端中运行："
        echo "  终端1: cd backend-python && python3 start.py"
        echo "  终端2: cd frontend && npm run dev"
        ;;
esac

echo ""
echo "✨ Muses 正在启动..."
echo ""
echo "🌐 访问地址:"
echo "   前端: http://localhost:3004"
echo "   后端: http://localhost:8080"
echo "   API文档: http://localhost:8080/docs"
echo ""
echo "📝 使用说明:"
echo "   1. 访问 http://localhost:3004"
echo "   2. 使用 GitHub 账号登录"
echo "   3. 配置 OpenAI API Key"
echo "   4. 创建 Agent 并开始生成文章"
echo ""
echo "⚠️  按 Ctrl+C 停止所有服务"
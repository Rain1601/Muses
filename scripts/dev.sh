#!/bin/bash

# Muses 开发模式启动脚本
# 在两个独立的终端窗口中启动前端和后端

set -e

echo "🚀 启动 Muses 开发环境..."
echo ""

# 检查操作系统
OS="$(uname -s)"

# 根据操作系统选择终端命令
case "$OS" in
    Darwin*)  # macOS
        if command -v osascript &> /dev/null; then
            # 启动后端
            osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"'/backend && pnpm dev"'
            
            # 启动前端
            osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"'/frontend && pnpm dev"'
            
            echo "✅ 已在新的终端窗口中启动前端和后端"
        else
            echo "⚠️  无法自动打开终端窗口"
            echo "请手动在两个终端中运行："
            echo "  终端1: cd backend && pnpm dev"
            echo "  终端2: cd frontend && pnpm dev"
        fi
        ;;
    Linux*)   # Linux
        if command -v gnome-terminal &> /dev/null; then
            # GNOME Terminal
            gnome-terminal -- bash -c "cd backend && pnpm dev; exec bash"
            gnome-terminal -- bash -c "cd frontend && pnpm dev; exec bash"
        elif command -v konsole &> /dev/null; then
            # KDE Konsole
            konsole -e bash -c "cd backend && pnpm dev; exec bash" &
            konsole -e bash -c "cd frontend && pnpm dev; exec bash" &
        elif command -v xterm &> /dev/null; then
            # XTerm
            xterm -e "cd backend && pnpm dev; bash" &
            xterm -e "cd frontend && pnpm dev; bash" &
        else
            echo "⚠️  无法自动打开终端窗口"
            echo "请手动在两个终端中运行："
            echo "  终端1: cd backend && pnpm dev"
            echo "  终端2: cd frontend && pnpm dev"
        fi
        ;;
    *)
        echo "⚠️  不支持的操作系统: $OS"
        echo "请手动在两个终端中运行："
        echo "  终端1: cd backend && pnpm dev"
        echo "  终端2: cd frontend && pnpm dev"
        ;;
esac

echo ""
echo "📝 开发环境说明:"
echo "   前端: http://localhost:3000 (支持热重载)"
echo "   后端: http://localhost:8080 (支持热重载)"
echo ""
echo "🔧 开发工具:"
echo "   Prisma Studio: cd backend && pnpm db:studio"
echo "   类型检查: cd frontend && pnpm type-check"
echo ""
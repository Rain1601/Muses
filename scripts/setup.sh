#!/bin/bash

# Muses 项目初始化脚本
# 用于首次设置项目环境

set -e  # 遇到错误立即退出

echo "🚀 Muses 项目初始化开始..."
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: Node.js 未安装"
    echo "请先安装 Node.js (推荐版本 18+)"
    echo "访问: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"

# 检查 pnpm 是否安装
if ! command -v pnpm &> /dev/null; then
    echo "📦 正在安装 pnpm..."
    npm install -g pnpm
fi

echo "✅ pnpm 版本: $(pnpm -v)"
echo ""

# 安装前端依赖
echo "📦 安装前端依赖..."
cd frontend
pnpm install
cd ..
echo "✅ 前端依赖安装完成"
echo ""

# 安装后端依赖
echo "📦 安装后端依赖..."
cd backend
pnpm install

# 生成 Prisma 客户端
echo "🔧 生成 Prisma 客户端..."
pnpm db:generate

# 创建数据库
echo "🗄️  初始化数据库..."
pnpm db:push

# 创建环境变量文件
if [ ! -f .env ]; then
    echo "📄 创建环境变量文件..."
    cp .env.example .env
    echo "⚠️  请编辑 backend/.env 文件，配置以下内容："
    echo "   - JWT_SECRET (随机字符串)"
    echo "   - GITHUB_CLIENT_ID (GitHub OAuth App ID)"
    echo "   - GITHUB_CLIENT_SECRET (GitHub OAuth App Secret)"
    echo ""
else
    echo "✅ 环境变量文件已存在"
fi

cd ..

# 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p backend/uploads
mkdir -p backend/logs

echo ""
echo "✨ 初始化完成！"
echo ""
echo "📝 下一步："
echo "1. 编辑 backend/.env 文件，填写必要的配置"
echo "2. 在 GitHub 创建 OAuth App："
echo "   - 访问: https://github.com/settings/developers"
echo "   - Authorization callback URL: http://localhost:8080/api/auth/github/callback"
echo "3. 运行 ./scripts/start.sh 启动项目"
echo ""
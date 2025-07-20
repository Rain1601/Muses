#!/bin/bash

# Muses 测试脚本
# 运行各种检查和测试

set -e

echo "🧪 运行 Muses 测试..."
echo ""

# 类型检查
echo "📝 TypeScript 类型检查..."
echo "检查后端..."
cd backend
npx tsc --noEmit
cd ..
echo "✅ 后端类型检查通过"

echo "检查前端..."
cd frontend
npx tsc --noEmit
cd ..
echo "✅ 前端类型检查通过"
echo ""

# ESLint 检查
echo "🔍 ESLint 代码检查..."
cd frontend
npm run lint
cd ..
echo "✅ 代码规范检查通过"
echo ""

# 检查环境变量
echo "🔧 环境变量检查..."
if [ -f "backend/.env" ]; then
    source backend/.env
    MISSING_VARS=()
    
    [ -z "$JWT_SECRET" ] && MISSING_VARS+=("JWT_SECRET")
    [ -z "$DATABASE_URL" ] && MISSING_VARS+=("DATABASE_URL")
    [ -z "$GITHUB_CLIENT_ID" ] && MISSING_VARS+=("GITHUB_CLIENT_ID")
    [ -z "$GITHUB_CLIENT_SECRET" ] && MISSING_VARS+=("GITHUB_CLIENT_SECRET")
    
    if [ ${#MISSING_VARS[@]} -eq 0 ]; then
        echo "✅ 所有必要的环境变量已配置"
    else
        echo "⚠️  缺少以下环境变量:"
        printf '%s\n' "${MISSING_VARS[@]}"
    fi
else
    echo "⚠️  backend/.env 文件不存在"
fi
echo ""

# API 健康检查
echo "🏥 API 健康检查..."
if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
    echo "✅ 后端 API 运行正常"
    HEALTH=$(curl -s http://localhost:8080/api/health)
    echo "   响应: $HEALTH"
else
    echo "⚠️  后端 API 未运行或无法访问"
fi
echo ""

# 数据库连接测试
echo "🗄️  数据库连接测试..."
cd backend
if npm run db:push -- --skip-generate > /dev/null 2>&1; then
    echo "✅ 数据库连接正常"
else
    echo "❌ 数据库连接失败"
fi
cd ..
echo ""

echo "✨ 测试完成！"
echo ""
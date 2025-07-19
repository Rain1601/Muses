#!/bin/bash

# Muses 停止脚本
# 停止所有相关服务

echo "🛑 停止 Muses 服务..."
echo ""

# 停止前端服务
echo "停止前端服务..."
pkill -f "next dev" || true

# 停止后端服务
echo "停止后端服务..."
pkill -f "ts-node src/index.ts" || true
pkill -f "nodemon" || true

# 停止 Prisma Studio
echo "停止 Prisma Studio..."
pkill -f "prisma studio" || true

# 额外确保停止所有 Node 进程（谨慎使用）
# pkill -f "node" || true

echo ""
echo "✅ 所有服务已停止"
echo ""
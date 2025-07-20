#!/bin/bash

# Muses 生产构建脚本
# 构建用于生产环境的版本

set -e

echo "🏗️  开始构建 Muses 生产版本..."
echo ""

# 检查环境变量
if [ ! -f "backend/.env" ]; then
    echo "❌ 错误: backend/.env 文件不存在"
    exit 1
fi

# 清理之前的构建
echo "🧹 清理之前的构建..."
rm -rf frontend/.next
rm -rf frontend/out
rm -rf backend/dist

# 构建后端
echo "🔧 构建后端..."
cd backend
npm run build
cd ..
echo "✅ 后端构建完成"
echo ""

# 构建前端
echo "🎨 构建前端..."
cd frontend
npm run build
cd ..
echo "✅ 前端构建完成"
echo ""

# 创建部署目录
echo "📦 准备部署文件..."
mkdir -p dist
mkdir -p dist/backend
mkdir -p dist/frontend

# 复制后端文件
cp -r backend/dist/* dist/backend/
cp backend/package.json dist/backend/
cp backend/.env.example dist/backend/
cp -r backend/prisma dist/backend/

# 复制前端文件
cp -r frontend/.next dist/frontend/
cp -r frontend/public dist/frontend/ 2>/dev/null || true
cp frontend/package.json dist/frontend/
cp frontend/next.config.js dist/frontend/

# 创建启动脚本
cat > dist/start.sh << 'EOF'
#!/bin/bash
cd backend
NODE_ENV=production node dist/index.js &
cd ../frontend
NODE_ENV=production npm start &
wait
EOF

chmod +x dist/start.sh

# 创建 PM2 配置文件
cat > dist/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'muses-backend',
      script: './backend/dist/index.js',
      cwd: './backend',
      env: {
        NODE_ENV: 'production',
        PORT: 8080
      }
    },
    {
      name: 'muses-frontend',
      script: 'npm',
      args: 'start',
      cwd: './frontend',
      env: {
        NODE_ENV: 'production',
        PORT: 3004
      }
    }
  ]
};
EOF

echo ""
echo "✨ 构建完成！"
echo ""
echo "📦 构建输出目录: ./dist"
echo ""
echo "🚀 部署说明:"
echo "1. 将 dist 目录上传到服务器"
echo "2. 在服务器上安装依赖:"
echo "   cd dist/backend && pnpm install --production"
echo "   cd ../frontend && pnpm install --production"
echo "3. 配置环境变量:"
echo "   编辑 backend/.env"
echo "4. 初始化数据库:"
echo "   cd backend && pnpm db:push"
echo "5. 启动服务:"
echo "   使用 PM2: pm2 start ecosystem.config.js"
echo "   或直接: ./start.sh"
echo ""
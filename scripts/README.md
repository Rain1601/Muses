# Muses 脚本说明

本目录包含了用于管理 Muses 项目的各种脚本。

## 快速开始

```bash
# 1. 首次设置项目
./scripts/setup.sh

# 2. 启动开发环境
./scripts/start.sh
# 或使用开发模式（在独立终端窗口中启动）
./scripts/dev.sh

# 3. 停止所有服务
./scripts/stop.sh
```

## 脚本详细说明

### setup.sh - 项目初始化
首次使用时运行，自动完成：
- 检查 Node.js 和 pnpm
- 安装所有依赖
- 初始化数据库
- 创建环境变量文件
- 创建必要的目录

### start.sh - 启动项目
在同一个终端中启动前端和后端：
- 检查环境配置
- 启动后端服务 (端口 8080)
- 启动前端服务 (端口 3000)
- Ctrl+C 停止所有服务

### dev.sh - 开发模式
在独立的终端窗口中启动服务：
- 自动打开两个终端窗口
- 支持热重载
- 适合开发调试

### stop.sh - 停止服务
停止所有 Muses 相关进程：
- 停止前端服务
- 停止后端服务
- 停止 Prisma Studio

### build.sh - 生产构建
构建用于部署的生产版本：
- 编译 TypeScript
- 构建 Next.js
- 准备部署文件
- 生成 PM2 配置

### test.sh - 运行测试
执行各种检查：
- TypeScript 类型检查
- ESLint 代码检查
- 环境变量检查
- API 健康检查
- 数据库连接测试

## 环境要求

- Node.js 18+
- pnpm
- SQLite3

## 常见问题

### 端口被占用
如果启动时提示端口被占用，可以：
1. 运行 `./scripts/stop.sh` 停止之前的服务
2. 手动修改端口：
   - 前端: 编辑 `frontend/package.json` 中的 dev 命令
   - 后端: 编辑 `backend/.env` 中的 PORT

### 权限问题
如果脚本无法执行，运行：
```bash
chmod +x scripts/*.sh
```

### 数据库问题
如果数据库出现问题，可以重置：
```bash
cd backend
rm -f muses.db
pnpm db:push
```
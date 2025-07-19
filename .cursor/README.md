# Muses 项目文档

> 智能文档生成平台 - 将各种素材转换为个性化博客文章

## 📋 项目概览

Muses是一个基于AI的智能文档生成平台，能够将多种格式的素材（Markdown、PDF、文本、对话记录）转换为个性化的博客文章。系统支持自定义AI Agent人格，提供不同的写作风格，并可一键发布到GitHub仓库。

## 🚀 核心功能

- **🤖 智能Agent系统**: 自定义AI写作助手的人格、语气、篇幅偏好
- **📄 多格式输入**: 支持MD、PDF、TXT等文件上传和文本输入
- **💬 对话式生成**: 通过对话交互生成文章内容
- **📝 Markdown输出**: 生成标准Markdown或MDX格式文章
- **🔐 GitHub集成**: OAuth登录和一键发布到GitHub仓库
- **💾 本地存储**: 基于SQLite的轻量级数据存储
- **⚡ 热重载**: 前后端代码动态加载，开发体验优秀

## 🏗️ 技术架构

### 前端技术栈
- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS + Shadcn/ui组件库
- **状态管理**: Zustand
- **HTTP客户端**: Axios
- **表单处理**: React Hook Form
- **Markdown渲染**: React Markdown

### 后端技术栈  
- **运行时**: Node.js
- **框架**: Express.js
- **语言**: TypeScript
- **数据库**: SQLite3
- **ORM**: Prisma
- **认证**: JWT + GitHub OAuth
- **AI服务**: OpenAI API
- **文件处理**: Multer, PDF-parse
- **安全**: Helmet, CORS, 数据加密

## 📁 项目结构

```
Muses/
├── .cursor/                 # 项目文档
├── frontend/               # Next.js前端应用
│   ├── app/               # App Router页面
│   │   ├── agents/        # Agent管理页面
│   │   ├── articles/      # 文章管理页面
│   │   ├── dashboard/     # 工作台
│   │   ├── onboarding/    # 用户引导
│   │   └── settings/      # 设置页面
│   ├── components/        # 可复用组件
│   ├── lib/              # 工具库
│   └── store/            # 状态管理
├── backend/               # Express后端API
│   ├── src/
│   │   ├── routes/        # API路由
│   │   ├── services/      # 业务服务
│   │   ├── middleware/    # 中间件
│   │   └── utils/         # 工具函数
│   └── prisma/           # 数据库Schema
└── scripts/              # 项目管理脚本
```

## 🗄️ 数据模型

### 核心实体
- **User**: 用户信息，包含GitHub OAuth数据和加密的API密钥
- **UserSettings**: 用户个性化设置（语言、主题等）
- **Agent**: AI写作助手配置（人格、风格、提示词等）
- **Article**: 文章数据（内容、状态、发布信息等）

### 关键特性
- 用户数据隔离和权限控制
- API密钥加密存储
- 灵活的Agent配置系统
- 完整的文章生命周期管理

## 🔧 开发环境

### 环境要求
- Node.js >= 18
- pnpm (推荐)
- SQLite3

### 快速开始
```bash
# 初始化项目
./scripts/setup.sh

# 启动开发环境
./scripts/start.sh

# 或使用开发模式（独立终端）
./scripts/dev.sh
```

### 环境配置
在`backend/.env`中配置以下变量：
```env
JWT_SECRET=your_random_secret
GITHUB_CLIENT_ID=your_github_app_id
GITHUB_CLIENT_SECRET=your_github_app_secret
DATABASE_URL="file:./muses.db"
PORT=8080
```

## 📊 服务端口

- **前端**: http://localhost:3000
- **后端**: http://localhost:8080
- **数据库管理**: `pnpm db:studio` (Prisma Studio)

## 🔗 相关文档

- [API接口文档](.cursor/api.md)
- [数据库设计](.cursor/database.md)
- [前端架构](.cursor/frontend.md)
- [部署指南](.cursor/deployment.md)
- [开发指南](.cursor/development.md) 
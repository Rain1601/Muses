# Muses - 智能文档生成Agent

一个基于AI的智能文档生成平台，支持将多种格式的素材转换为个性化的博客文章。

## 功能特点

- 🤖 自定义AI Agent人格和写作风格
- 📄 支持多种输入格式（MD、PDF、对话、文本）
- 📝 生成Markdown/MDX格式文章
- 🔐 GitHub OAuth登录和用户隔离
- 🚀 一键发布到GitHub仓库
- 💾 本地SQLite存储，轻量高效

## 技术栈

### 前端
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS + Shadcn/ui
- TanStack Query
- Zustand

### 后端
- Node.js + Express
- TypeScript
- SQLite3 + Prisma
- JWT认证
- OpenAI API

## 项目结构

```
Muses/
├── frontend/          # 前端应用
│   ├── src/
│   │   ├── app/      # Next.js App Router
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── styles/
│   └── package.json
├── backend/           # 后端API
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── middleware/
│   │   └── utils/
│   └── package.json
└── README.md
```

## 开发指南

### 环境要求
- Node.js >= 18
- pnpm (推荐)

### 安装依赖

```bash
# 前端
cd frontend
pnpm install

# 后端
cd backend
pnpm install
```

### 开发模式

```bash
# 前端 (端口3000)
cd frontend
pnpm dev

# 后端 (端口8080)
cd backend
pnpm dev
```

## License

MIT
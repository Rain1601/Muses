# Muses - 智能文档生成Agent

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-5.0-2D3748" alt="Prisma" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</div>

<div align="center">
  <h3>🤖 AI驱动的个性化博客文章生成平台</h3>
  <p>将PDF、Markdown、文本等素材智能转换为高质量的博客文章</p>
</div>

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

## 🚀 快速开始

### 使用脚本启动（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/muses.git
cd muses

# 2. 首次设置（自动安装依赖、初始化数据库）
./scripts/setup.sh

# 3. 配置环境变量
# 编辑 backend/.env 文件，填入必要的配置

# 4. 启动项目
./scripts/start.sh
```

访问 http://localhost:3000 开始使用！

## 📸 功能预览

### 工作台
快速访问所有功能，查看最近的文章

### Agent管理
创建个性化的AI写作助手，每个Agent都有独特的写作风格

### 文章生成
- 📄 **素材上传**：支持PDF、Markdown、TXT等格式
- 💬 **对话生成**：通过对话方式生成文章
- ✨ **AI优化**：智能改进已有文章

### GitHub发布
一键发布到GitHub仓库，支持自定义路径和提交信息

## 🛠️ 开发指南

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

## 🤝 贡献

欢迎贡献代码！请查看 [贡献指南](CONTRIBUTING.md)。

## 📄 License

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- OpenAI - 提供强大的AI能力
- Next.js - 优秀的React框架
- Prisma - 现代化的ORM工具
- 所有贡献者和使用者

---

<div align="center">
  <p>如果觉得有帮助，请给个 ⭐️ Star！</p>
</div>
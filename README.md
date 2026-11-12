# Muses

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/FastAPI-0.110-009688" alt="FastAPI" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB" alt="Python" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</div>

<div align="center">
  <h3>AI 驱动的写作工作台</h3>
  <p>以 <code>/dashboard</code> 为中心的三栏式工作台 — 文章列表、Notion 风格编辑器、AI 对话面板，一处完成起草、AI 协作改稿、发布到 GitHub。</p>
</div>

## 功能

- 单一工作台，三栏式：文章/文件侧栏 · Notion 编辑器 · AI 对话面板
- 多素材输入：PDF、Markdown、文本、对话
- 文本级 AI 操作：改写、扩写、摘要、翻译、润色、纠错、自定义 prompt
- 自定义 Agent 人格 + 模型切换（Claude / GPT / Gemini / Qwen / DeepSeek）
- 写作 Skill 库：预设 + 自定义 prompt 模板
- 一键发布到 GitHub 仓库，发布历史持久化
- GitHub / Google OAuth 登录

## 技术栈

| 层 | 用 |
|---|---|
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind · Shadcn/ui · TanStack Query · Zustand · TipTap |
| Backend | FastAPI · SQLAlchemy + Alembic · JWT |
| AI | 聚合 provider：AIHubMix / OpenRouter / 百炼（统一走 OpenAI 兼容 SDK） |
| DB | 本地 SQLite；生产可换 Cloud SQL Postgres |

## 项目结构

```
Muses/
├── backend/           # FastAPI 应用（app/、start.py、Dockerfile、requirements.txt）
├── frontend/          # Next.js 应用（app/、components/、lib/、Dockerfile）
├── scripts/           # 安装、启动、迁移脚本
├── docs/              # 项目文档（API、ARCHITECTURE、DEPLOYMENT、USER_GUIDE 等）
├── deploy.sh          # 手动部署到 Google Cloud Run
├── start-python.sh    # macOS 双终端启动（推荐）
├── CLAUDE.md          # Claude Code 使用本仓库时的导览
└── README.md          # 你正在看的这份
```

> 关键代码层级见 `CLAUDE.md`（开发者向架构指南）。

## 快速开始

### 环境要求
- Node.js 18+（建议 npm，不要求 pnpm）
- Python 3.10+
- SQLite 自带

### 首次设置
```bash
git clone <repo-url> Muses && cd Muses

# 前端依赖
cd frontend && npm install --legacy-peer-deps && cd ..

# 后端依赖（推荐用 venv）
cd backend && python3 -m venv venv && source venv/bin/activate \
  && pip install -r requirements.txt && cd ..

# 配置后端环境变量
cp backend/.env.example backend/.env   # 然后编辑填入下方变量
```

### 启动

```bash
# 推荐：在 macOS 中各开一个 Terminal 窗口启动前后端
./start-python.sh
```

或手动分窗口：

```bash
# 终端 1：后端 (http://localhost:8080)
cd backend && python3 start.py

# 终端 2：前端 (http://localhost:3004)
cd frontend && npm run dev
```

访问 http://localhost:3004 → GitHub/Google 登录 → 进入 `/dashboard`。

API Swagger 文档：http://localhost:8080/docs。

### 必需的环境变量（backend/.env）

```bash
DATABASE_URL="sqlite:///./muses.db"
JWT_SECRET="<random-string>"
GITHUB_CLIENT_ID="<from github oauth app>"
GITHUB_CLIENT_SECRET="<from github oauth app>"
ENCRYPTION_KEY="<32-char string>"
```

> AI provider key（DeepSeek / AIHubMix / OpenRouter / 百炼）在「Settings → 模型」中逐用户配置，加密存储。DeepSeek 官方 Key 填入「DeepSeek 官方」一栏；整篇翻译可选择 `deepseek-flash` 或 `deepseek-v4-pro`。只配置 DeepSeek 时，自动模式使用 Flash；已有其他服务商时保留原优先级。
> 本地已有的 `DEEPSEEK_API_KEY` 环境变量仍可使用，用户设置的 DeepSeek Key 优先。

GitHub OAuth callback URL：`http://localhost:8080/api/auth/github/callback`。

## 开发

```bash
# 类型检查
cd frontend && npx tsc --noEmit

# 数据库迁移
cd backend
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

项目目前没有正式测试套件 — UI 改动请在浏览器实际跑一遍。

## 部署

走 GitHub Actions + Google Cloud Run。详见 `docs/DEPLOYMENT.md`：

- `backend/Dockerfile` → Cloud Run 后端镜像
- `frontend/Dockerfile` → Cloud Run 前端镜像
- `./deploy.sh` — 手动触发部署（需配置 `GCP_PROJECT_ID`）
- `./scripts/gcp-setup.sh` — 首次创建 Cloud SQL / 服务账号

## 贡献

PR 欢迎，请先看 [CONTRIBUTING.md](CONTRIBUTING.md)。

## License

MIT — 见 [LICENSE](LICENSE)。

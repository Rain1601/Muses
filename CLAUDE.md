# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Muses** is an AI-powered blog article generation platform that converts various source materials (PDF, Markdown, text, conversations) into high-quality blog articles. Next.js frontend + FastAPI backend + SQLite.

## Development Commands

### Quick Start
```bash
./start-python.sh          # Start both frontend (port 3004) and backend (port 8080)
./scripts/setup.sh         # Initial setup (installs deps, creates DB)
```

### Frontend (port 3004)
```bash
cd frontend
npm run dev                # Dev server on port 3004
npm run dev:turbo          # Dev server with Turbo
npm run build              # Production build
npm run lint               # ESLint
npx tsc --noEmit           # Type checking (no test suite yet)
```

### Backend (port 8080)
```bash
cd backend-python
python3 start.py           # Start FastAPI (auto-kills existing process on same port)
# Swagger docs at http://localhost:8080/docs
```

### Database
```bash
cd backend-python
alembic revision --autogenerate -m "description"   # Create migration
alembic upgrade head                                # Apply migrations
```

### Testing
```bash
cd backend-python && python -m pytest                        # All tests
cd backend-python && python -m pytest test_unified_ai.py     # Single test file
```

## Architecture

### Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn/ui, TanStack Query, Zustand, TipTap Editor
- **Backend**: FastAPI, SQLAlchemy ORM, JWT auth, multi-model AI (OpenAI/Anthropic/Google)
- **Database**: SQLite with SQLAlchemy + Alembic migrations
- **Auth**: GitHub OAuth → JWT tokens

### Frontend Architecture

**API Client** (`lib/api.ts`): Axios instance with auto JWT injection from localStorage. Environment-aware — uses prod API for `muses.ink`, dev API otherwise. 30s timeout, auto-logout on 401.

**State Management**:
- Server state: TanStack Query (`staleTime: 60s`, `refetchOnWindowFocus: false`)
- Client state: Zustand stores in `store/` (`user.ts`, `viewMode.ts`, `aiAssistant.ts`)
- Forms: React Hook Form + Zod validation

**TipTap Editor** (`components/NotionEditor.tsx`, ~52KB): Heavy component with extensions for tables, task lists, code blocks with syntax highlighting, math (KaTeX), videos (YouTube/Bilibili), resizable images, and collapsible code blocks.

**Text Actions System**: `useTextActions` hook provides unified interface for AI text operations (improve, expand, summarize, translate, fix-grammar, brainstorm, custom-prompt). Gated by AI Assistant toggle state.

### Backend Architecture

**Router registration** in `app/main.py`: auth, users, agents, agents_actions, articles, generate, upload, publish, process, proxy, image_upload, sync, import_files, knowledge, muses_config, chat_history, studio.

**Startup**: `start.py` uses `psutil` to kill existing processes on the port before starting uvicorn. Settings from `app/config.py` (env vars).

**CORS**: Configured to allow only `settings.frontend_url`. TrustedHost middleware enabled.

### Three Writing Modes

1. **Normal Mode**: 3-column layout — article list sidebar + article view
2. **Co-Create Mode** (`components/CoCreateMode.tsx`): Split-screen chat + NotionEditor. Chat history persists per article via `/api/chat-history/`. Auto-save with 500ms debounce. Responses containing `<article_edit>...</article_edit>` tags replace full editor content.
3. **Co-Read Mode**: Split-screen article reader + notes editor with text quoting.

### Studio Mode (newest feature)

File-based writing workspace at `~/muses-workspace` with Claude AI assistance.

**Backend** (`app/api/studio.py`):
- `POST /api/studio/chat` — Stream chat via AIHubMix (aihubmix.com/v1), supports file context injection
- `WS /api/studio/filewatcher` — WebSocket for real-time file diffs
- File CRUD: `GET/POST/PUT/DELETE /api/studio/files/{filename}`

**Frontend** (`components/studio/`): ChatPanel, MarkdownEditor, DiffView, DiffOverlay, FileExplorer, HistoryPanel, FloatingTOC. Implements differential sync — tracks file snapshots and computes diffs with accept/reject UI.

### AI Agent System

**Agent Service** (`app/agent/service.py`): `AgentService` with `generate_content()` and `stream_generate_content()`. Uses `ModelFactory` to instantiate models from agent config. Builds system messages from agent config (tone, audience, custom prompts).

**Prompt System** (`app/agent/prompts/`): `builder.py` for dynamic prompt construction, `registry.py` for action registry, `action_prompts/` subdirectory with 16 action types.

**Multi-Model Support** (`app/services/unified_ai.py`): Unified client abstracting OpenAI, Anthropic, and Google APIs. Model definitions in `app/models_config.py`. Per-agent model selection.

### Knowledge Base / RAG

Located in `app/agent/knowledge/`: chunker → embedder → retriever → storage pipeline. Per-user collections (`user_{user_id}_knowledge`). API at `/api/knowledge/` with endpoints: `/add`, `/search`, `/build`, `/stats`.

### Key Data Flows

**Article Generation**: Upload materials → `/api/upload/` → text extraction → `/api/generate/article` with AgentId → AIService + unified_ai → returns title/content/summary → saves as draft.

**Co-Create Chat**: Open article → chat via `/api/agents/chat` → responses persist to `/api/chat-history/save` → user can select AI text to adopt into editor.

## Database Schema

Key entities: User (GitHub OAuth, encrypted API keys), Agent (AI writing assistants), Article (content + metadata + publishing info), ChatHistory (per-article conversations), UserSettings, SyncHistory, MusesConfig.

All sensitive data (API keys, tokens) encrypted before storage.

## Environment Variables (backend-python/.env)

```bash
DATABASE_URL="sqlite:///./muses.db"
JWT_SECRET="your-jwt-secret"
GITHUB_CLIENT_ID="your-github-oauth-app-id"
GITHUB_CLIENT_SECRET="your-github-oauth-app-secret"
ENCRYPTION_KEY="your-32-char-encryption-key"
OPENAI_API_KEY="your-openai-api-key"
```

GitHub OAuth callback URL: `http://localhost:8080/api/auth/github/callback`

## Key API Endpoints

- `/api/auth/github/callback` — GitHub OAuth
- `/api/agents/` — Agent CRUD; `/api/agents/chat` — AI chat; `/api/agents/text-action` — text operations
- `/api/articles/` — Article CRUD
- `/api/generate/` — AI article generation
- `/api/upload/` — File upload processing
- `/api/chat-history/{article_id}` — Chat history per article
- `/api/knowledge/` — RAG knowledge base operations
- `/api/studio/` — Studio mode (chat, files, filewatcher)
- `/api/image-upload/upload-image` — GitHub-based image hosting
- `/api/publish/` — Publish to GitHub repos
- `/api/users/settings` — User settings

## Git Commit Guidelines

Use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `style:`, `test:`, `chore:`). Always include attribution footer:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Deployment

- **Mac Mini CI/CD**: Push to main → GitHub webhook → Mac Mini auto-deploys. See `docs/MAC_MINI_DEPLOYMENT.md`.
- **Traditional**: Docker + PM2. See `docs/DEPLOYMENT.md`.

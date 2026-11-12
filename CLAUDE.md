# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Muses** is an AI-powered writing platform centered on a single `/dashboard` workspace: three-panel layout combining an article/file sidebar, a Notion-style editor, and an AI chat panel. Articles can be drafted, AI-edited, published to GitHub, and managed from one place. Next.js frontend + FastAPI backend + SQLite.

## Development Commands

### Quick Start
```bash
./start-python.sh          # Start both frontend (3004) and backend (8080) in new Terminals
./scripts/setup.sh         # Initial setup (installs deps, creates DB)
```

### Frontend (port 3004)
```bash
cd frontend
npm run dev                # Dev server
npm run build              # Production build
npm run lint               # ESLint
npx tsc --noEmit           # Type checking
```

### Backend (port 8080)
```bash
cd backend
python3 start.py           # Start FastAPI (auto-kills existing process on same port)
# Swagger docs at http://localhost:8080/docs
```

### Tests
```bash
cd backend
venv/bin/python -m pytest tests -q                                  # Backend suite (pytest + pytest-asyncio)
venv/bin/python -m pytest tests/test_url_import.py::<test_name> -q  # Single test
cd frontend && node scripts/verify-crypto-parity.mjs                # Python↔TS AES-GCM ciphertext parity (needs backend/.env + venv)
```

Backend tests build a throwaway SQLite DB in `tmp_path` via `Base.metadata.create_all` and monkeypatch each router module's `SessionLocal`; fixtures are shared by plain import between test files (e.g. `from test_translation import translation_db`), there is no `conftest.py`. No frontend test runner — after a UI change, drive the app in a browser and confirm the path manually.

### Database / schema changes
There is **no Alembic** setup. Tables are created by `create_tables()` (`Base.metadata.create_all`) and new columns on existing tables are added by the hand-written `run_migrations()` in `app/database.py` (`ALTER TABLE ... ADD COLUMN`). When adding a column to an existing model, also add it to that list or existing DBs will break.

## Architecture

### Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn/ui, TanStack Query, Zustand, TipTap editor
- **Backend**: FastAPI, SQLAlchemy ORM, JWT auth, aggregated AI providers (AIHubMix / OpenRouter / 百炼) via OpenAI-compatible SDK
- **Database**: SQLite with SQLAlchemy + Alembic migrations
- **Auth**: GitHub / Google OAuth → JWT tokens

### Frontend Architecture

The app intentionally has only two user-facing pages:

- `app/page.tsx` — landing + GitHub/Google login (also: "browse as guest" → /dashboard)
- `app/dashboard/page.tsx` — the entire product (~1800 lines, three-panel workspace)
- `app/auth/callback/` — OAuth callback

Two dev-only prototype routes also exist and are not part of the shipped UX:
- `app/dashboard-cc/` — Claude Code subprocess prototype (backed by `/api/claude-code`, gated by `enable_studio`)
- `app/dashboard-pw/` — Prompt Writing / Slot prototype (backed by `/api/slot-fill`)

**API Client** (`lib/api.ts`): Axios instance with auto JWT injection from localStorage. Environment-aware — uses prod API for `muses.ink`, dev API otherwise. 30s timeout, auto-logout on 401. Next.js rewrites `/api/*` to the backend (`next.config.js`), so the frontend uses relative URLs.

**State**:
- Server state: TanStack Query (`staleTime: 60s`, `refetchOnWindowFocus: false`)
- Client state: Zustand stores in `store/` — `user.ts` (auth), `aiAssistant.ts` (AI toggle)

**TipTap Editor** (`components/NotionEditor.tsx`, ~1500 lines): tables, task lists, syntax-highlighted code blocks, KaTeX math, YouTube/Bilibili embeds, resizable images, collapsible code blocks. Custom extensions in `lib/tiptap-extensions/` — notably `PromptSlot/` (typed slot tokens used by the Prompt Writing prototype + `useSlotEngine`/`CandidatePopover`).

**Text Actions System**: `useTextActions` hook (`lib/hooks/`) provides unified AI text operations (improve, expand, summarize, translate, fix-grammar, brainstorm, custom-prompt). Posts to `/api/agents/text-action`. Gated by AI Assistant toggle.

**Dashboard-embedded components** (everything routes through `app/dashboard/page.tsx`):
- `studio/SettingsPanel` — model + provider picker (`studio/ChatPanel.tsx` still exists on disk but is no longer mounted; the right rail is now history-focused)
- `studio/DiffView` — accept/reject pane for AI-proposed edits
- `EditHistoryPanel` + `useEditHistory` hook — in-session AI edit log on the right rail
- `PublishHistoryPanel` — publish-to-GitHub history (reads `SyncHistory`)
- `SkillLibrary` — writing skill picker (CRUD against `/api/skills`)
- `TaskCenter` — background task tracker
- `FileImport` — drag-drop import for PDF/Markdown/text

### Backend Architecture

**Router registration** (`app/main.py`): always-on — `auth`, `users`, `agents`, `agents_actions`, `articles`, `upload`, `publish`, `image_upload`, `import_files`, `skills`. Gated behind `settings.enable_studio=True` (off in production, all share the local-filesystem requirement): `studio`, `claude_code` (subprocess-driven), `slot_fill` (prompt-slot prototype backend).

**Startup**: `start.py` uses `psutil` to kill existing processes on the port before launching uvicorn. Settings come from `app/config.py` (env vars).

**CORS**: Allows only `settings.frontend_url` (comma-separated origins supported). TrustedHost middleware enabled.

### Studio Mode (powers the dashboard chat panel)

File-based writing workspace at `~/muses-workspace`. The endpoints back the right-side chat in the dashboard.

**Backend** (`app/api/studio.py`):
- `POST /api/studio/chat` — Stream chat through the user's configured aggregated provider, with optional file context
- `WS /api/studio/filewatcher` — WebSocket for real-time file diffs
- File CRUD: `GET/POST/PUT/DELETE /api/studio/files/{filename}`

**Frontend**: `components/studio/{ChatPanel,DiffView,SettingsPanel}`. Differential sync — tracks file snapshots and computes diffs with accept/reject UI.

### Skill Library (`app/api/skills.py`, `Skill` model)

User-owned library of writing-prompt templates. Each Skill is `{name, description, icon (emoji), category, prompt, isPreset}`. Categories: `general`, `opening`, `structure`, `polish`, `style`, `meta`. `PRESET_SKILLS` are seeded on first access for each user and marked `isPreset=True` (read-only). Frontend: `components/SkillLibrary.tsx`.

### AI Agent System

**Agent Service** (`app/agent/service.py`): `AgentService` with `generate_content()` and `stream_generate_content()`. Uses `ModelFactory` to instantiate models from agent config. Builds system messages from agent config (tone, audience, custom prompts).

**Prompt System** (`app/agent/prompts/`): `builder.py` for dynamic prompt construction, `registry.py` for action registry, `action_prompts/` subdirectory with the action templates used by `/api/agents/text-action`.

**Multi-Model Support** (`app/services/unified_ai.py`): Single OpenAI-compatible SDK path against 3 aggregated provider base URLs — AIHubMix (`aihubmix.com/v1`), OpenRouter (`openrouter.ai/api/v1`), 百炼 (`dashscope.aliyuncs.com/compatible-mode/v1`). User stores per-provider keys (`aihubmixKey`, `openrouterKey`, `bailianKey`) on the User model, encrypted. Model registry in `app/models_config.py` is shared across providers (Claude, GPT, Gemini, Qwen, DeepSeek). Per-agent model + provider selection. A direct `deepseek` provider (`deepseekKey`, with fallback to a server-side `settings.deepseek_api_key`) is being added alongside the three aggregators. Legacy `openaiKey`/`claudeKey`/`geminiKey` columns are kept only for migration.

### Key Data Flows

**Article in dashboard**: Sidebar shows DB-stored articles + local workspace files → user selects one → loaded into TipTap → autosaved with debounce → AI chat/diff applies edits → publish to GitHub via `/api/publish`.

**Text action**: User selects text in editor → `useTextActions` → `POST /api/agents/text-action` → response inserted via diff or directly.

## Database Schema

Active models: `User` (OAuth + encrypted API keys), `UserSettings`, `Agent` (AI writing assistants), `Article` (content + publish state), `Skill` (prompt templates), `SyncHistory` (publish log).

All sensitive data (API keys, tokens) encrypted before storage via `backend/app/utils/security.py` (AES-GCM, Scrypt KDF from `ENCRYPTION_KEY`/`ENCRYPTION_SALT`, format `nonce[12] || ciphertext || tag[16]`). `frontend/lib/crypto.ts` is a byte-compatible TS port (Phase 0 of a planned TS backend migration) — change both together and re-run the parity script.

> Legacy tables `ChatHistory`, `MusesConfig`, `ConfigHistory`, `ConfigTemplate`, `AgentMusesConfig` still exist in the SQLite file but no longer have ORM models (Phase 6 of slimming kept the data, dropped the code). New migrations should not depend on them.

## Environment Variables (backend/.env)

```bash
DATABASE_URL="sqlite:///./muses.db"
JWT_SECRET="your-jwt-secret"
GITHUB_CLIENT_ID="your-github-oauth-app-id"
GITHUB_CLIENT_SECRET="your-github-oauth-app-secret"
ENCRYPTION_KEY="your-32-char-encryption-key"
```

AI provider keys (AIHubMix / OpenRouter / 百炼) are configured **per-user** via the Settings panel and stored encrypted on the User model — they are not loaded from env vars at startup.

GitHub OAuth callback URL: `http://localhost:8080/api/auth/github/callback`

## Key API Endpoints

- `/api/auth/github/callback` — GitHub OAuth
- `/api/user/settings` — User settings (note: singular `user`, not `users`)
- `/api/user/verify-api-key`, `/api/user/get-api-key` — Per-provider key management
- `/api/agents/` — Agent CRUD; `/api/agents/chat` — streaming AI chat; `/api/agents/text-action` — text operations
- `/api/articles/` — Article CRUD
- `/api/upload/` — File upload processing
- `/api/import/` — Import workspace files (FileImport)
- `/api/publish/` — Publish to GitHub repos (+ `/history` reads `SyncHistory`)
- `/api/upload-image` — GitHub-based image hosting
- `/api/skills/` — Writing skill library (CRUD + preset seeding)
- `/api/studio/*` — Dashboard chat + file workspace (dev only, `enable_studio` gate)
- `/api/claude-code/*`, `/api/slot-fill/*` — Prototype routers, same `enable_studio` gate

## Git Commit Guidelines

Use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `style:`, `test:`, `chore:`). Always include attribution footer:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Deployment (Google Cloud Run)

- **CI/CD**: Push to main → GitHub Actions → Build Docker images → Deploy to Cloud Run
- **Backend**: `backend/Dockerfile` → Cloud Run + Cloud SQL PostgreSQL
- **Frontend**: `frontend/Dockerfile` → Cloud Run (Next.js standalone)
- **Manual deploy**: `./deploy.sh` (requires `GCP_PROJECT_ID` env var)
- **Env config**: Copy `.env.production.template` and `backend-env.yaml.template`, fill values, do not commit
- **Studio**: Disabled in production (`ENABLE_STUDIO=false`) — depends on local filesystem

### First-time Setup
```bash
export GCP_PROJECT_ID="your-project" DB_PASSWORD="your-pass"
./scripts/gcp-setup.sh   # Creates Cloud SQL, service account, prints GitHub Secrets to set
```

### Required GitHub Secrets
- `GCP_PROJECT_ID` — Google Cloud project ID
- `GCP_SA_KEY` — Service account JSON key (from gcp-setup.sh)
- `CLOUD_SQL_INSTANCE` — `project:region:muses-db`
- `DATABASE_URL` — `postgresql://user:pass@/muses?host=/cloudsql/...`
- `JWT_SECRET`, `ENCRYPTION_KEY`, `ENCRYPTION_SALT` — Security keys
- `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_GITHUB_CLIENT_SECRET` — GitHub OAuth App
- `OPENAI_API_KEY`, `AIHUBMIX_API_KEY` — AI API keys

## Repository Layout

```
backend/   FastAPI app (app/), Dockerfile, start.py, requirements.txt
frontend/         Next.js app (app/, components/, lib/), Dockerfile
scripts/          setup.sh, start.sh, dev.sh, stop.sh, build.sh, test.sh,
                  gcp-setup.sh, migrate_local_to_remote.py
docs/             All project documentation, including docs/dev/ (design notes)

README.md  LICENSE  CONTRIBUTING.md  CLAUDE.md  AGENTS.md   # project-level docs
deploy.sh                                                    # Cloud Run deploy
start-python.sh                                              # macOS Terminal launcher
.env.production.template  backend-env.yaml.template          # env templates
```

Anything outside that list (`muses.db`, `venv/`, `node_modules/`, `upload-files/`) is local-only and gitignored.

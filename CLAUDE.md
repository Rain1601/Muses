# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Muses** is an AI-powered blog article generation platform that converts various source materials (PDF, Markdown, text, conversations) into high-quality blog articles. It features a Next.js frontend and FastAPI (Python) backend with SQLite database.

## Development Commands

### Quick Start
```bash
# Initial setup (installs dependencies, creates database)
./scripts/setup.sh

# Start with Python backend (recommended)
./start-python.sh

# Traditional dev mode (if Express backend exists)
./scripts/dev.sh

# Start production mode
./scripts/start.sh
```

### Frontend (runs on port 3004)
```bash
cd frontend
npm run dev          # Development server
npm run dev:turbo    # Development server with Turbo
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint checks
```

### Python Backend (runs on port 8080)
```bash
cd backend-python
python3 start.py     # Start FastAPI server
# Access API docs at http://localhost:8080/docs
```

## Architecture Overview

### Technology Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn/ui, TanStack Query, Zustand, TipTap Editor
- **Backend**: FastAPI (Python), SQLAlchemy ORM, JWT authentication, OpenAI integration
- **Database**: SQLite with SQLAlchemy (production-ready, can migrate to PostgreSQL)
- **Authentication**: GitHub OAuth + JWT tokens

### Key Directories
```
├── frontend/                    # Next.js application
│   ├── app/                    # Next.js App Router pages
│   │   ├── dashboard/          # Main dashboard
│   │   ├── agents/            # AI agent management
│   │   ├── articles/          # Article management
│   │   ├── onboarding/        # User onboarding flow
│   │   └── settings/          # User settings
│   ├── components/            # Reusable React components
│   ├── lib/                   # Utility libraries
│   └── store/                 # Zustand state management
├── backend-python/            # FastAPI server
│   ├── app/
│   │   ├── api/              # API endpoints
│   │   ├── services/         # Business logic (AI, GitHub integration)
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   └── utils/           # Utilities (cache, encryption)
│   ├── uploads/             # File upload storage
│   └── requirements.txt     # Python dependencies
```

## Core Features

### AI Agent System
- Customizable AI writing assistants with different personalities and styles
- Agent configuration includes tone, length preference, target audience, custom prompts
- Each user can create multiple agents with different characteristics

### File Processing
- Support for PDF, Markdown, and text file uploads
- Intelligent content extraction and parsing
- Conversation-based article generation

### Article Management
- Full CRUD operations for articles
- Draft/published status tracking
- Markdown content with metadata

### GitHub Integration
- One-click publishing to GitHub repositories
- OAuth-based GitHub authentication
- Configurable repository paths and commit messages
- GitHub-based image hosting: images uploaded to user's repos and accessible via raw.githubusercontent.com URLs

## Database Schema

Key entities:
- **User**: GitHub OAuth users with encrypted API keys
- **Agent**: Customizable AI writing assistants
- **Article**: Generated articles with metadata and publishing info
- **UserSettings**: User preferences and configuration

All sensitive data (OpenAI API keys, GitHub tokens) is encrypted before storage.

## Development Patterns

### API Routes (Python Backend)
- Located in `backend-python/app/api/`
- Use Pydantic for request/response validation
- JWT authentication via FastAPI dependencies
- Proper error handling and logging
- FastAPI automatic OpenAPI/Swagger documentation

### Frontend Components
- Use shadcn/ui components for consistency
- TanStack Query for server state management
- Zustand for client state
- TypeScript interfaces for all props
- TipTap for rich text editing (Notion-style editor)

### State Management
- **Server State**: TanStack Query with proper caching
- **Client State**: Zustand stores (user.ts for user data)
- **Forms**: React Hook Form with Zod validation

## Environment Configuration

### Required Environment Variables (backend-python/.env)
```bash
DATABASE_URL="sqlite:///./muses.db"
JWT_SECRET="your-jwt-secret"
GITHUB_CLIENT_ID="your-github-oauth-app-id"
GITHUB_CLIENT_SECRET="your-github-oauth-app-secret"
ENCRYPTION_KEY="your-32-char-encryption-key"
OPENAI_API_KEY="your-openai-api-key"
```

### GitHub OAuth Setup
- Create OAuth App at https://github.com/settings/developers
- Authorization callback URL: `http://localhost:8080/api/auth/github/callback`

## Testing

```bash
# Python backend - run all tests
cd backend-python && python -m pytest

# Python backend - run specific test file
cd backend-python && python -m pytest test_unified_ai.py

# Frontend - no test script configured yet
# Type checking
cd frontend && npx tsc --noEmit
```


## Key API Endpoints

- `/api/auth/github/callback` - GitHub OAuth callback
- `/api/agents/` - AI agent CRUD operations
- `/api/agents/text-action` - Text processing actions (improve, expand, summarize, etc.)
- `/api/articles/` - Article management
- `/api/generate/` - AI article generation
- `/api/upload/` - File upload processing
- `/api/image-upload/upload-image` - GitHub image hosting
- `/api/publish/` - GitHub repository publishing
- `/api/users/settings` - User settings management

## Multi-Model AI Support

The system supports multiple AI providers through a unified interface:
- **OpenAI**: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus/Sonnet/Haiku
- **Google**: Gemini 1.5 Pro/Flash, Gemini 2.0 Flash

AI configuration is handled through:
- `backend-python/app/models_config.py` - Model definitions and mappings
- `backend-python/app/services/unified_ai.py` - Unified API client with provider-specific formatting
- Each user can configure different models for different agents

## Database Management

```bash
# Create Alembic migration
cd backend-python
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Database backup
cp muses.db muses.db.backup
```

## Deployment

### Mac Mini Auto-Deployment
The project includes a complete CI/CD solution for Mac Mini deployment:
- **Complete Guide**: See `docs/MAC_MINI_DEPLOYMENT.md` for comprehensive setup instructions
- **Auto-sync**: Push to GitHub → Mac Mini automatically pulls and deploys
- **External Access**: Includes Cloudflare Tunnel configuration

### Traditional Deployment
The project also includes Docker configuration and PM2 process management for traditional deployment. See `docs/DEPLOYMENT.md` for detailed deployment instructions.
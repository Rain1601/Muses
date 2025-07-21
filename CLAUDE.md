# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Muses** is an AI-powered blog article generation platform that converts various source materials (PDF, Markdown, text, conversations) into high-quality blog articles. It features a Next.js frontend and Express.js backend with SQLite database.

## Development Commands

### Quick Start
```bash
# Initial setup (installs dependencies, creates database)
./scripts/setup.sh

# Start development environment (opens both frontend/backend in separate terminals)
./scripts/dev.sh

# Start production mode (single script for both services)
./scripts/start.sh
```

### Frontend (runs on port 3004)
```bash
cd frontend
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint checks
```

### Backend (runs on port 8080)
```bash
cd backend
npm run dev          # Development server with nodemon
npm run build        # TypeScript compilation
npm run start        # Production server
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:studio    # Open Prisma Studio
```

### Database Management
```bash
cd backend
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:push      # Apply schema changes to database
npm run db:studio    # Visual database management tool
```

## Architecture Overview

### Technology Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn/ui, TanStack Query, Zustand
- **Backend**: Express.js, TypeScript, Prisma ORM, JWT authentication, OpenAI integration
- **Database**: SQLite with Prisma (production-ready, can migrate to PostgreSQL)
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
├── backend/                   # Express.js API server
│   ├── src/
│   │   ├── routes/           # API endpoints
│   │   ├── services/         # Business logic (AI, GitHub integration)
│   │   ├── middleware/       # Authentication middleware
│   │   └── utils/           # Utilities (cache, encryption)
│   ├── prisma/              # Database schema and migrations
│   └── uploads/             # File upload storage
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

## Database Schema

Key entities:
- **User**: GitHub OAuth users with encrypted API keys
- **Agent**: Customizable AI writing assistants
- **Article**: Generated articles with metadata and publishing info
- **UserSettings**: User preferences and configuration

All sensitive data (OpenAI API keys, GitHub tokens) is encrypted before storage.

## Development Patterns

### API Routes
- Located in `backend/src/routes/`
- Use Zod for request validation
- JWT authentication via middleware
- Proper error handling and logging

### Frontend Components
- Use shadcn/ui components for consistency
- TanStack Query for server state management
- Zustand for client state
- TypeScript interfaces for all props

### State Management
- **Server State**: TanStack Query with proper caching
- **Client State**: Zustand stores (user.ts for user data)
- **Forms**: React Hook Form with Zod validation

## Environment Configuration

### Required Environment Variables (backend/.env)
```bash
DATABASE_URL="file:./muses.db"
JWT_SECRET="your-jwt-secret"
GITHUB_CLIENT_ID="your-github-oauth-app-id"
GITHUB_CLIENT_SECRET="your-github-oauth-app-secret"
ENCRYPTION_KEY="your-32-char-encryption-key"
```

### GitHub OAuth Setup
- Create OAuth App at https://github.com/settings/developers
- Authorization callback URL: `http://localhost:8080/api/auth/github/callback`

## Testing and Quality

### Running Tests
```bash
# Backend tests
cd backend && npm test

# Frontend tests  
cd frontend && npm test

# Type checking
cd frontend && npm run type-check
cd backend && npx tsc --noEmit
```

### Code Quality
- ESLint configuration for both frontend and backend
- TypeScript strict mode enabled
- Prettier for code formatting
- Husky pre-commit hooks (if configured)

## Security Considerations

- All API routes require JWT authentication except auth endpoints
- User data isolation - users can only access their own data
- Sensitive data encryption (API keys, tokens)
- Input validation using Zod schemas
- CORS and security headers configured

## Common Development Tasks

### Adding New API Endpoint
1. Create route handler in `backend/src/routes/`
2. Add Zod validation schema
3. Implement authentication middleware
4. Add error handling
5. Register route in `backend/src/index.ts`

### Adding New Page
1. Create page component in `frontend/app/`
2. Wrap with `<ProtectedRoute>` if authentication required
3. Add navigation to `frontend/components/navbar.tsx`
4. Create corresponding API hooks if needed

### Database Schema Changes
1. Modify `backend/prisma/schema.prisma`
2. Run `npm run db:generate`
3. Run `npm run db:push`
4. Update TypeScript types as needed

### Performance Optimization
- Use React.memo() for expensive components
- Implement proper TanStack Query caching strategies
- Optimize database queries with proper select/include
- Use Next.js Image component for images

## Deployment

The project includes Docker configuration and PM2 process management for production deployment. See `docs/DEPLOYMENT.md` for detailed deployment instructions.
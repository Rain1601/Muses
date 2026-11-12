# Repository Guidelines

## Project Structure & Module Organization

Muses is split into a Next.js frontend and a Python FastAPI backend. Frontend code lives in `frontend/`: routes in `app/`, components in `components/`, helpers in `lib/`, hooks in `lib/hooks/`, TipTap extensions in `lib/tiptap-extensions/`, state in `store/`, and static assets in `public/`. Backend code lives in `backend/app/`: API routers in `api/`, SQLAlchemy models in `models/`, Pydantic schemas in `schemas/`, business logic in `services/`, and agent/prompt logic in `agent/`. Backend tests live in `backend/tests/`. Project docs belong in `docs/`; operational scripts live in `scripts/`.

## Build, Test, and Development Commands

- `./scripts/setup.sh`: install frontend and backend dependencies and create `backend/.env` from the example.
- `./scripts/start.sh`: start the FastAPI backend on `8080` and frontend on `3004`.
- `cd frontend && npm run dev`: run the Next.js app locally.
- `cd frontend && npm run build`: create the production Next.js build.
- `cd frontend && npm run lint`: run Next.js ESLint checks.
- `cd backend && python start.py`: run the backend directly.
- `cd backend && venv/bin/python -m pytest tests -q`: run backend tests.
- `cd frontend && node scripts/verify-crypto-parity.mjs`: check that `frontend/lib/crypto.ts` and `backend/app/utils/security.py` produce interchangeable ciphertext.

## Coding Style & Naming Conventions

Use TypeScript strict mode patterns in the frontend. React components are `PascalCase`, hooks are `useCamelCase`, utilities are `camelCase`, and route folders follow Next.js App Router conventions. Prefer alias imports like `@/lib/api`. Python uses four-space indentation, `snake_case` modules, and routers/services/models separated by responsibility. Keep comments short and useful; new shared docs should default to English.

## Testing Guidelines

Backend tests use `pytest` and follow `test_*.py` naming. Place new tests in `backend/tests/`. There is no `conftest.py`; shared fixtures are imported from other test files (e.g. `from test_translation import translation_db`). For frontend changes, run `npm run lint` and `npm run build`; add manual verification notes for UI flows because no frontend test runner is configured.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit prefixes such as `feat:`, `fix:`, `perf:`, and `docs:`. Keep subjects imperative and scoped to one change. Pull requests should include a summary, test results, linked issues when applicable, and screenshots for visible UI changes.

## Security & Configuration Tips

Do not commit secrets, local databases, uploads, virtual environments, or build output. Keep runtime values in `backend/.env` and `frontend/.env.local`; update `backend/.env.example` or docs when adding required configuration. Schema changes have no Alembic: new columns on existing tables must also be added to `run_migrations()` in `backend/app/database.py`.

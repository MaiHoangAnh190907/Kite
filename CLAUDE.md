# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Kite?

Gamified stealth assessment platform for pediatric waiting rooms. Children (ages 4-7) play mini-games on clinic iPads that passively measure cognitive, motor, and emotional development. Doctors see longitudinal patterns on a web dashboard.

## Commands

```bash
# Install dependencies
pnpm install

# Dev (all apps via Turbo)
pnpm dev

# Individual apps
pnpm --filter @kite/api dev          # tsx watch src/index.ts
pnpm --filter @kite/dashboard dev    # vite
pnpm --filter @kite/mobile dev       # expo start

# Type check (all or individual)
pnpm typecheck
pnpm --filter @kite/dashboard exec tsc --noEmit

# Tests (API only — calculators are the critical tests)
pnpm --filter @kite/api test         # vitest run (all)
pnpm --filter @kite/api test:watch   # vitest (watch mode)

# Lint
pnpm lint

# Database
pnpm --filter @kite/api migrate
pnpm --filter @kite/api migrate:rollback
pnpm --filter @kite/api seed
```

## Monorepo Structure

- **apps/mobile** — React Native Expo (iPad app). Expo Router file-based routing with grouped layouts: `(staff)` → `(consent)` → `(game)` → `(end)`.
- **apps/api** — Express + PostgreSQL (Knex). ES modules (`"type": "module"`).
- **apps/dashboard** — React 19 + Vite + Tailwind CSS 4. React Router + TanStack React Query.
- **packages/shared** — TypeScript types shared across apps. Build with `tsc`, consumed via `@kite/shared`.

Orchestration: Turborepo (`turbo.json`). Package manager: pnpm with workspaces.

## Architecture

### Mobile App (apps/mobile)

**Navigation flow:** PIN login → patient select → consent → game hub → [games in random order] → celebration → auto-reset

**State:** Zustand stores — `auth-store.ts` (tablet JWT, staff info) and `session-store.ts` (full game lifecycle: patient selection, game ordering, event collection, upload).

**Games:** Each game screen (`app/(game)/*.tsx`) runs its own `requestAnimationFrame` loop, collects events in a ref array, then calls `recordEvents()` and `endGame()` from the session store on completion.

**Upload queue** (`src/services/upload-queue.ts`): Failed uploads are persisted to SecureStore and retried with exponential backoff (5s → 15s → 60s → 5min). Session data is never lost.

**Inactivity provider** wraps root layout — 120s no-touch → clears session and auth → returns to PIN screen.

**Mock API toggle:** Set `EXPO_PUBLIC_USE_MOCK_API=true` to use `src/services/mock-api.ts` instead of real API calls.

### API (apps/api)

**Middleware chain:** helmet → CORS → rate-limit (10/min auth, 100/min API) → pino-http → body-parse → routes → error-handler

**Auth model:** Two separate flows:
- Dashboard: email+password → temp JWT → MFA (TOTP) → access+refresh tokens (15min / 7d)
- Tablet: device token + staff PIN → scoped tablet JWT (12h)

**Metrics pipeline** (triggered by `PATCH /sessions/:id/complete`):
1. `computeSessionMetrics()` → runs per-game calculators (`src/services/calculators/`)
2. Each calculator parses `raw_events` JSONB → computes named metrics
3. Age-matched percentiles via `normative.service.ts` lookup tables
4. Results stored in `patient_metrics` table
5. `evaluateFlags()` → threshold (<5th=red, <15th=amber), declining trend, high variability → `flags` table

**Encryption:** Patient PII (name, DOB, guardian) encrypted with AES-256-GCM at application layer (`src/utils/encryption.ts`). Format: `[IV 12B][AuthTag 16B][Ciphertext]`. Stored as binary in PostgreSQL.

**Env config:** All env vars validated with Zod in `src/config/env.ts` (DB_URL, JWT_SECRET, ENCRYPTION_KEY, etc.).

### Dashboard (apps/dashboard)

**Auth context** (`src/contexts/auth-context.tsx`): Manages login → MFA → token storage in memory. Axios interceptor refreshes on 401.

**Route structure:** `/login` → `/mfa` → protected routes (`/patients`, `/patients/:id`, `/admin/*`). `ProtectedRoute` checks auth+MFA. `AdminRoute` checks role.

**Patient detail** has three tabs: Latest Session (metric cards per game domain), Trends (Recharts line charts with percentile bands), Flags (dismissable clinical flags).

**MSW** (`src/mocks/handlers.ts`) available for frontend-only development without API.

## Key Constraints

### Security (NON-NEGOTIABLE)
- All patient PII encrypted with AES-256-GCM at app layer
- No PHI in logs or error messages
- HIPAA audit log for every PHI access (`src/middleware/audit.ts`)
- No third-party analytics SDKs (COPPA)
- Parameterized queries only (Knex) — never concatenate SQL
- JWT auth on every endpoint

### Code Standards
- TypeScript strict mode, no `any` types
- Zod validation on all API inputs
- Named exports only, functional React components only
- Pino for structured logging (never console.log in prod)
- Kebab-case files, PascalCase components, camelCase functions

### Clinical Rules
- Games must have NO failure state — every child earns stars
- NO text in child-facing screens — icons and animations only
- NO scores visible to children
- Dashboard says "developmental patterns" never "diagnosis" or "screening results"
- All flags include "This is not a diagnosis" disclaimer

## Specs

Read the relevant spec in `agent_docs/` before implementing changes:
- `games.md` — Mini-game mechanics, timing, scoring rules
- `api.md` — API endpoint reference
- `database.md` — Schema definitions
- `dashboard.md` — Dashboard UI specification

## When Making Changes

1. Read the relevant spec in `agent_docs/` first
2. Follow existing patterns in the codebase
3. Add audit logging for any new PHI access
4. Add Zod validation for any new API inputs
5. Write tests for metric computation functions (calculators in `src/services/calculators/` — these are critical)
6. Never expose PHI in error messages or logs

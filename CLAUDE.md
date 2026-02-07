# Kite — Claude Code Project Guide

## What is Kite?

Gamified stealth assessment platform for pediatric waiting rooms. Children (ages 4-7 for MVP) play mini-games on clinic iPads. Games passively measure cognitive, motor, and emotional development. Doctors see longitudinal patterns on a web dashboard.

## Project Structure

```
kite/
├── AGENTS.md              # Master build plan (start here)
├── CLAUDE.md              # This file
├── docs/
│   ├── research-kite.txt  # Market research
│   ├── PRD-kite.md        # Product requirements
│   └── TechDesign-kite.md # Technical design
├── agent_docs/
│   ├── games.md           # Mini-game specifications
│   ├── api.md             # API endpoint reference
│   ├── database.md        # Database schema
│   └── dashboard.md       # Dashboard UI specification
├── apps/
│   ├── mobile/            # React Native Expo (iPad app)
│   ├── api/               # Node.js Express backend
│   └── dashboard/         # React Vite web dashboard
└── packages/
    └── shared/            # Shared TypeScript types
```

## How to Build

Follow the phases in `AGENTS.md` sequentially. Each phase has:
- A goal statement
- Docs to read first
- Specific tasks with implementation details
- Acceptance criteria to verify completion

## Key Constraints

### Security (NON-NEGOTIABLE)
- All patient PII (name, DOB, guardian) encrypted with AES-256-GCM at app layer
- No PHI in logs or error messages
- HIPAA audit log for every PHI access
- No third-party analytics SDKs (COPPA)
- Parameterized queries only — never concatenate SQL
- JWT auth on every endpoint

### Code Standards
- TypeScript strict mode everywhere
- Zod validation on all API inputs
- No `any` types
- Named exports only
- Functional React components only
- Pino for structured logging (never console.log in prod)
- Kebab-case files, PascalCase components, camelCase functions

### Clinical Rules
- Games must have NO failure state — every child earns stars
- NO text in child-facing screens — icons and animations only
- NO scores visible to children
- Dashboard says "developmental patterns" never "diagnosis" or "screening results"
- All flags include "This is not a diagnosis" disclaimer

## Common Commands

```bash
# Install all dependencies
pnpm install

# Start all apps in dev mode
pnpm dev

# Start individual apps
pnpm --filter @kite/api dev
pnpm --filter @kite/dashboard dev
pnpm --filter @kite/mobile dev

# Run database migrations
pnpm --filter @kite/api migrate

# Run database seeds
pnpm --filter @kite/api seed

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## When Making Changes

1. Read the relevant spec in `agent_docs/` before implementing
2. Follow existing patterns in the codebase
3. Add audit logging for any new PHI access
4. Add Zod validation for any new API inputs
5. Write tests for metric computation functions (these are critical)
6. Never expose PHI in error messages or logs

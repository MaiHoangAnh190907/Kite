# Kite

Gamified stealth assessment platform for pediatric waiting rooms. Children (ages 4-7) play mini-games on clinic iPads that passively measure cognitive, motor, and emotional development. Clinicians see longitudinal developmental patterns on a web dashboard.

## How It Works

1. **Waiting room** - A child plays fun, colorful mini-games on a clinic iPad while waiting for their appointment
2. **Passive measurement** - Each game silently captures developmental signals (reaction times, gesture accuracy, balance control, memory sequences) without the child ever seeing a score or failing
3. **Clinician dashboard** - Doctors review developmental patterns over time, flagged concerns, and percentile-based metrics on a secure web dashboard

No text on child-facing screens. No failure states. Every child earns stars.

## Mini-Games

| Game | Domain | What It Measures |
|------|--------|-----------------|
| **Cloud Catch** | Attention | Reaction time, accuracy, sustained attention, false positive rate |
| **Star Sequence** | Memory | Sequence length, memory accuracy, learning rate |
| **Sky Balance** | Motor | Balance stability, tilt variability, coordination smoothness |
| **Breeze Spells** | Gesture | Gesture accuracy, cast time, spell completion |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile (iPad) | React Native + Expo |
| API | Express + PostgreSQL (Knex) |
| Dashboard | React 19 + Vite + Tailwind CSS 4 |
| Shared Types | TypeScript package |
| Monorepo | Turborepo + pnpm workspaces |

## Project Structure

```
apps/
  mobile/       React Native Expo iPad app
  api/          Express REST API + PostgreSQL
  dashboard/    React clinician web dashboard
packages/
  shared/       TypeScript types shared across apps
```

## Getting Started

```bash
# Install dependencies
pnpm install

# Run all apps in dev mode
pnpm dev

# Or run individually
pnpm --filter @kite/mobile dev       # Expo (iPad app)
pnpm --filter @kite/api dev          # API server
pnpm --filter @kite/dashboard dev    # Dashboard (Vite)
```

### Database

```bash
pnpm --filter @kite/api migrate      # Run migrations
pnpm --filter @kite/api seed         # Seed demo data
```

### Testing

```bash
pnpm --filter @kite/api test         # Run API tests
pnpm typecheck                       # Type check all packages
```

## Security & Compliance

- **HIPAA** - All patient PII encrypted with AES-256-GCM at the application layer. Audit logging on every PHI access.
- **COPPA** - Zero third-party analytics SDKs. No data leaves the platform.
- **Auth** - Dashboard uses email + MFA (TOTP). Tablets use device token + staff PIN.

## Team

Built at C4C 2026

- Patrick King
- Anh Mai
- Jaime Breitkreutz
- My Pham

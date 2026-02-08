# Kite — Master Build Plan

> **What is Kite?** A gamified stealth assessment mobile app for pediatric waiting rooms.
> Children play mini-games on clinic iPads. Games passively measure cognitive, motor,
> and emotional development. Doctors see longitudinal patterns on a web dashboard.

## Current State
**Last Updated:** 2026-02-07
**Working On:** Integration testing across tracks
**Recently Completed:** Track A — all phases (app shell, games, kiosk, polish)
**Blocked By:** None

### Track A Progress
- [x] Phase A1: App Shell (PIN login, patient selection, consent, navigation, mock API)
- [x] Phase A2: Game Engine + Cloud Catch (tap mechanic, difficulty ramp, distractors, data collection)
- [x] Phase A3: Remaining Games (Star Sequence, Wind Trails, Sky Sort, celebration, full session flow)
- [x] Phase A4: Kiosk Mode & Polish (inactivity timeout, upload retry queue, sync indicator)

### Track B Progress
- [x] Phase 0: Foundation (monorepo, DB, auth, shared types)
- [x] Phase B1: All API endpoints (patients, sessions, admin, metrics, flags)
- [x] Phase B2: Metrics pipeline (4 calculators, normative, flags)
- [x] Phase B3: Unit tests (29 passing), typecheck clean

### Track C Progress
- [x] Phase C1: Setup + Auth (login, MFA, protected routes, auth context)
- [x] Phase C2: Patient List + Detail (search, filter, sort, pagination, tabs, trends, flags)
- [x] Phase C3: Admin Panel (staff management, tablets, patient CSV import, usage analytics)
- [ ] Phase C4: Polish (print styles done, remaining: accessibility pass, performance)

## Quick Reference

| Doc | Location |
|-----|----------|
| Market Research | `docs/research-kite.txt` |
| Product Requirements | `docs/PRD-kite.md` |
| Technical Design | `docs/TechDesign-kite.md` |
| Game Specs | `agent_docs/games.md` |
| API Spec | `agent_docs/api.md` |
| Database Schema | `agent_docs/database.md` |
| Dashboard Spec | `agent_docs/dashboard.md` |

## Tech Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Mobile app:** React Native (Expo SDK 52+) + TypeScript + React Native Skia
- **Backend API:** Node.js + Express + TypeScript + Knex (query builder)
- **Database:** PostgreSQL 16
- **Cache:** Redis
- **Web dashboard:** React 19 + Vite + Tailwind CSS 4 + Recharts
- **Shared types:** `packages/shared` TypeScript package
- **Testing:** Vitest (API + dashboard), Jest (mobile)
- **Linting:** ESLint + Prettier
- **Infrastructure:** AWS (ECS Fargate, RDS, ElastiCache, S3, CloudFront, KMS)
- **CI/CD:** GitHub Actions

## Coding Standards

- TypeScript strict mode everywhere (`"strict": true`)
- Explicit return types on all exported functions
- Zod for runtime validation on all API inputs
- No `any` types — use `unknown` and narrow
- Functional components only (React)
- Named exports only (no default exports)
- Error handling: throw typed errors, catch at route level with error middleware
- File naming: kebab-case for files, PascalCase for components, camelCase for functions
- Imports: group by external → internal → relative, separated by blank line
- No console.log in production code — use structured logger (pino)

## Security Rules (NON-NEGOTIABLE)

- All PHI fields (patient name, DOB, guardian name) encrypted with AES-256-GCM before storage
- No PHI in logs, error messages, or API responses beyond what's necessary
- All API routes require authentication (JWT or device token + PIN)
- All dashboard routes require MFA-verified JWT
- HIPAA audit log entry for every PHI access (read or write)
- No third-party analytics SDKs (no Firebase Analytics, Sentry, Amplitude, etc.)
- HTTPS/TLS only — no HTTP endpoints
- Parameterized queries only — no string concatenation in SQL
- Input validation (Zod) on every API endpoint
- CORS restricted to dashboard domain only
- Rate limiting on auth endpoints (10 req/min) and API endpoints (100 req/min)

---

## Parallel Build Strategy

The build is split into **3 independent tracks** that run on separate terminals/machines.
Each track has its own detailed AGENTS file:

```
                    ┌─────────────────────┐
                    │  Phase 0: Foundation │  ← Track B does this FIRST
                    │  (monorepo, DB, auth)│
                    └─────────┬───────────┘
                              │
                    Push to git, notify A & C
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
   ┌────────▼────────┐ ┌─────▼──────┐ ┌────────▼────────┐
   │  TRACK A         │ │ TRACK B     │ │  TRACK C         │
   │  iPad Mobile App │ │ Backend API │ │  Web Dashboard   │
   │  apps/mobile/    │ │ apps/api/   │ │  apps/dashboard/ │
   ├──────────────────┤ ├─────────────┤ ├──────────────────┤
   │ A1: App Shell    │ │ B1: All API │ │ C1: Setup + Auth │
   │ A2: Game Engine  │ │    endpoints│ │ C2: Patient List │
   │    + Cloud Catch │ │ B2: Metrics │ │    + Detail      │
   │ A3: All 4 Games  │ │    Pipeline │ │ C3: Admin Panel  │
   │ A4: Kiosk+Polish │ │ B3: Security│ │ C4: Polish       │
   └────────┬─────────┘ └─────┬──────┘ └────────┬─────────┘
            │                 │                 │
            └─────────────────┼─────────────────┘
                              │
                    ┌─────────▼───────────┐
                    │   INTEGRATION        │
                    │   Merge all tracks   │
                    │   E2E testing        │
                    └─────────────────────┘
```

| Track | File | Owns | Key Principle |
|-------|------|------|---------------|
| **A: Mobile** | `AGENTS-track-a-mobile.md` | `apps/mobile/` | Develops against mock API |
| **B: API** | `AGENTS-track-b-api.md` | `apps/api/`, `packages/shared/` | Goes first (foundation), defines shared types |
| **C: Dashboard** | `AGENTS-track-c-dashboard.md` | `apps/dashboard/` | Develops against mock API (MSW) |

### How It Works

1. **Track B starts first:** Sets up the monorepo, database, auth, and shared types. Pushes to git.
2. **Tracks A and C pull and start:** Each builds independently using mock APIs that match `agent_docs/api.md`.
3. **All three work in parallel:** Each track owns its own `apps/` directory — no file conflicts.
4. **Integration:** Merge all branches, swap mocks for real API, run end-to-end tests.

### Rules for Avoiding Conflicts

- Each track ONLY modifies files in its own territory (see track files)
- `packages/shared/` is owned by Track B — Tracks A and C read only
- If A or C need a new shared type, add it to a local types file and flag for Track B
- The API contract in `agent_docs/api.md` is the source of truth — all tracks build against it
- Push/pull frequently to stay in sync on shared types

---

## Original Build Phases (single-terminal reference)

### Phase 1: Foundation (Sprint 1-2)

**Goal:** Monorepo structure, database, auth system, basic API running locally.

**Read first:** `docs/TechDesign-kite.md` sections 3, 4, 7-9

#### Tasks:

1. **Initialize monorepo**
   - Create Turborepo workspace with pnpm
   - Three apps: `apps/mobile`, `apps/api`, `apps/dashboard`
   - One shared package: `packages/shared`
   - Shared `tsconfig.base.json` with strict mode
   - `.gitignore`, `.prettierrc`, `.eslintrc`, `turbo.json`

2. **Set up API project** (`apps/api`)
   - Express + TypeScript + ts-node-dev for local dev
   - Project structure per `docs/TechDesign-kite.md` section 3.1
   - Pino logger (structured JSON logging)
   - Zod for request validation
   - Global error handler middleware
   - Health check endpoint: `GET /health`

3. **Database setup**
   - Knex config with PostgreSQL
   - Migration files for ALL tables in `agent_docs/database.md`
   - Run migrations to verify schema
   - Seed file with one test clinic, one admin user, one clinician, one staff, three test patients

4. **Authentication system**
   - `POST /auth/login` — email + password → JWT (15 min) + refresh token (7 day)
   - `POST /auth/mfa/verify` — TOTP code → full access JWT
   - `POST /auth/tablet/verify` — device token + staff PIN → scoped tablet JWT
   - `POST /auth/refresh` — refresh token → new JWT pair
   - Password hashing: bcrypt (12 rounds)
   - JWT signing: RS256 with rotating keys
   - MFA: TOTP (speakeasy library), secret encrypted with KMS key
   - Auth middleware: verify JWT, extract user, attach to `req.user`
   - Role middleware: check `req.user.role` against allowed roles

5. **HIPAA audit middleware**
   - Log every request that touches PHI to `audit_log` table
   - Fields: user_id, clinic_id, action, resource_type, resource_id, ip, user_agent, timestamp
   - Async write (don't block request)

6. **Field-level encryption utility**
   - `encrypt(plaintext: string, key: Buffer): Buffer`
   - `decrypt(ciphertext: Buffer, key: Buffer): string`
   - AES-256-GCM with random IV per encryption
   - For local dev: use a static key from `.env`
   - For production: fetch from AWS KMS (implement later)

**Acceptance criteria:**
- `pnpm install` and `pnpm dev` starts the API on port 3000
- Can create a user, login, get JWT, access a protected endpoint
- Database migrations run cleanly, seed data is present
- Audit log captures PHI access attempts
- All tests pass: auth flow, encryption round-trip, middleware

---

### Phase 2: Tablet App Shell (Sprint 3-4)

**Goal:** Expo app with staff PIN screen, patient selection, consent screen, and navigation skeleton.

**Read first:** `docs/PRD-kite.md` sections 4.1, 5, `docs/TechDesign-kite.md` section 2

#### Tasks:

1. **Initialize Expo project** (`apps/mobile`)
   - Expo SDK 52+ with TypeScript template
   - Expo Router for file-based navigation
   - Target: iPad only (tablet layout)
   - Configure app.json: name "Kite", bundle ID, iPad-only, landscape + portrait

2. **Staff PIN screen** (`app/(staff)/login.tsx`)
   - Numeric keypad UI (large touch targets, 88x88pt buttons)
   - 4-6 digit PIN entry with dot indicators
   - Calls `POST /auth/tablet/verify` with device token + PIN
   - Stores tablet JWT in secure memory (not AsyncStorage — use expo-secure-store)
   - Error state: "Invalid PIN" shake animation
   - No "forgot PIN" — admin resets via dashboard

3. **Patient selection screen** (`app/(staff)/select-patient.tsx`)
   - Fetches today's appointment list: `GET /sessions/patients/today`
   - Scrollable list of patient cards: first name, last initial, age
   - Tap to select → confirm dialog → navigate to consent
   - Search/filter by name
   - If no patients loaded: "No appointments found for today" message

4. **Parent consent screen** (`app/(consent)/consent.tsx`)
   - Clean, friendly design (not legal-looking)
   - Header: "Welcome to Kite!"
   - Body: 3-4 bullet points explaining what Kite does in plain language
   - "Your child will play fun games on this tablet"
   - "The games help your child's doctor understand their development"
   - "No photos, videos, or recordings are taken"
   - "You can ask to delete this data at any time"
   - Two buttons: [Start Playing] (primary, large) and [No Thanks] (secondary, small)
   - [Start Playing] → calls `POST /sessions` to create session → navigates to game hub
   - [No Thanks] → returns to patient selection

5. **Session end screen** (`app/(end)/complete.tsx`)
   - Celebration: "Great flying! Time to see the doctor!"
   - Breeze character animation (placeholder for now)
   - Auto-reset countdown: 30 seconds visible, then returns to staff PIN screen
   - "Hand the iPad back to the front desk" instruction

6. **API client service** (`services/api.ts`)
   - Axios instance with base URL from env config
   - Automatic JWT attachment via interceptor
   - Token refresh interceptor (on 401, refresh and retry)
   - TypeScript types for all API requests/responses (from `packages/shared`)

**Acceptance criteria:**
- App boots on iPad simulator to staff PIN screen
- Valid PIN → patient list → select patient → consent → (placeholder game hub) → end screen → auto-reset to PIN
- Invalid PIN shows error
- "No Thanks" on consent returns to patient selection
- JWT stored securely, API calls authenticated

---

### Phase 3: Game Engine + Cloud Catch (Sprint 5-6)

**Goal:** Skia-based game rendering engine and first complete mini-game with data collection.

**Read first:** `agent_docs/games.md` (Cloud Catch section), `docs/TechDesign-kite.md` section 2.2-2.3

#### Tasks:

1. **Install and configure React Native Skia**
   - `@shopify/react-native-skia` package
   - Verify 60fps rendering on iPad simulator
   - Create `GameCanvas` base component wrapping Skia canvas

2. **Touch tracking system** (`components/game-engine/TouchTracker.tsx`)
   - Wraps game canvas, captures all touch events
   - Records: timestamp, x, y, phase (began/moved/ended), pressure
   - Stores events in Zustand game store
   - Sub-frame precision using `performance.now()`

3. **Game session manager** (`services/session.ts`)
   - Zustand store: current session ID, current game index, events per game
   - Start session → play games in order → end session
   - On session end: batch upload all game events to API
   - Handle interruption: if session ends early, upload partial data

4. **Game Hub screen** (`app/(game)/hub.tsx`)
   - Sky background with clouds
   - Breeze character (animated kite — use Skia path animation)
   - "Ready to fly?" intro animation
   - Auto-advances to first game after 3 seconds

5. **Cloud Catch game** (`app/(game)/cloud-catch.tsx`)
   - **Game spec:** See `agent_docs/games.md` — Cloud Catch section
   - Sky background, clouds spawn at top and drift down
   - Golden clouds = tap targets, grey storm clouds = avoid
   - Duration: 2.5 minutes (configurable)
   - Difficulty ramp: speed increases every 30 seconds, distractors appear at 60s
   - Data collection per tap: timestamp, target type, correct/incorrect, reaction time
   - End state: clouds clear, sun appears, stars earned animation

6. **Transition animation** (`components/game-engine/Transition.tsx`)
   - Breeze flies across screen between games
   - 3-second animation using Skia
   - Reusable between all game transitions

7. **Session upload endpoint** (`apps/api`)
   - `POST /sessions/:id/events` — accepts batch of game events
   - Validate event structure with Zod
   - Store in `game_results.raw_events` (JSONB)
   - `PATCH /sessions/:id/complete` — mark session done, trigger metric computation

**Acceptance criteria:**
- Cloud Catch plays smoothly at 60fps on iPad
- Touch events are captured with correct timestamps and coordinates
- All game events upload to API on session completion
- Game data appears in `game_results` table with correct session linkage
- Difficulty increases over the 2.5-minute duration
- Child sees stars/reward at end (no score)

---

### Phase 4: Remaining Games (Sprint 7-8)

**Goal:** Build Star Sequence, Wind Trails, and Sky Sort. Full 4-game session works end-to-end.

**Read first:** `agent_docs/games.md` (all game sections)

#### Tasks:

1. **Star Sequence** (`app/(game)/star-sequence.tsx`)
   - Grid of stars (3x3 starting, up to 4x4)
   - Stars light up in sequence, child taps to repeat
   - Sequence length increases from 2 to 7+
   - Records: sequence shown, sequence tapped, timestamps, correct/incorrect
   - Duration: ~2.5 minutes (adaptive — ends after 2 consecutive failures at max length)

2. **Wind Trails** (`app/(game)/wind-trails.tsx`)
   - Curved path rendered on screen (Skia Path)
   - Child traces the path with finger
   - Record finger position at 60hz (every frame)
   - Calculate deviation from ideal path in real-time (visual feedback: green = on path, gentle glow when close)
   - 5-6 increasingly complex paths
   - Duration: ~2.5 minutes

3. **Sky Sort** (`app/(game)/sky-sort.tsx`)
   - Objects fall from top: birds, butterflies, airplanes, kites (Skia images/shapes)
   - Two baskets at bottom — swipe objects left or right
   - Initial rule: sort by type (birds left, butterflies right)
   - Rule switch at 60s and 120s (sort by color, then by size)
   - Visual rule indicator at top of screen (icon-based, no text)
   - Records: each sort decision, reaction time, correct/incorrect, rule at time of sort
   - Duration: ~2.5 minutes

4. **Full session flow integration**
   - Game Hub → Cloud Catch → transition → Star Sequence → transition → Wind Trails → transition → Sky Sort → celebration → end screen
   - Session store tracks progress through all 4 games
   - Partial session handling: if ended early, upload completed games only
   - All events uploaded as single batch at session end

5. **Celebration screen update**
   - Show total stars earned (always 4 — one per completed game)
   - Collect stickers: unique sky sticker per game
   - Breeze does a victory loop animation
   - 5-second celebration → end screen

**Acceptance criteria:**
- All 4 games play smoothly at 60fps
- Complete session (all 4 games) takes 10-14 minutes
- All game events are captured and uploaded correctly
- Partial sessions (1-3 games) upload correctly
- No text required — all instructions are visual/animated
- Child always receives positive reinforcement (no failure messaging)

---

### Phase 5: Metrics Pipeline (Sprint 9-10)

**Goal:** Transform raw game events into computed metrics and generate clinical flags.

**Read first:** `docs/TechDesign-kite.md` section 5, `agent_docs/api.md` (metrics endpoints)

#### Tasks:

1. **Metrics computation service** (`apps/api/src/services/metrics.service.ts`)
   - Triggered after `PATCH /sessions/:id/complete`
   - For each game result in the session:
     - Parse `raw_events` JSONB
     - Compute all metrics defined in `docs/TechDesign-kite.md` section 5.2
     - Store each metric as a row in `patient_metrics`
   - Handle edge cases: incomplete games, very short sessions, no events

2. **Per-game metric calculators**
   - `computeCloudCatchMetrics(events)` → attention_accuracy, reaction_time_mean, reaction_time_cv, false_positive_rate, attention_decay
   - `computeStarSequenceMetrics(events)` → max_sequence_length, memory_accuracy, learning_rate, spatial_error_pattern
   - `computeWindTrailsMetrics(events)` → motor_precision, motor_smoothness, completion_rate, speed_accuracy_ratio
   - `computeSkySortMetrics(events)` → processing_speed, sort_accuracy, switch_cost, error_recovery_time
   - Each function is a pure function with comprehensive unit tests

3. **Normative service** (`apps/api/src/services/normative.service.ts`)
   - Calculate age-matched percentiles for each metric
   - Phase 1 approach: use hardcoded percentile lookup tables based on published norms for similar cognitive tasks
   - Store percentile alongside metric value in `patient_metrics`
   - If insufficient normative data: set percentile to NULL, flag as "normative data pending"

4. **Flag generation service** (`apps/api/src/services/flags.service.ts`)
   - Run after metrics are computed
   - Evaluate all flag rules from `docs/TechDesign-kite.md` section 5.3
   - Threshold flags: single metric below 15th (amber) or 5th (red) percentile
   - Trend flags: declining trend across 3+ sessions (linear regression slope)
   - Variability flags: coefficient of variation > 0.4 across sessions
   - Insert new flags into `flags` table
   - Do not duplicate existing open flags for the same metric/patient

5. **Metrics API endpoints**
   - `GET /dashboard/patients/:id/metrics` — all metrics for a patient, optionally filtered by game/metric name, with date range
   - `GET /dashboard/patients/:id/flags` — active (non-dismissed) flags
   - `PATCH /dashboard/flags/:id/dismiss` — clinician dismisses a flag (record who and when)

**Acceptance criteria:**
- After a session completes, metrics appear in `patient_metrics` within 5 seconds
- All metric calculations match expected outputs for test data (unit tests)
- Flags are generated correctly for test cases (below threshold, declining trend)
- Duplicate flags are not created
- Clinician can dismiss a flag via API
- Metrics endpoint returns data in a format ready for chart rendering

---

### Phase 6: Clinician Dashboard (Sprint 11-12)

**Goal:** Working web dashboard where clinicians log in, see patients, view metrics and flags.

**Read first:** `agent_docs/dashboard.md`, `docs/PRD-kite.md` section 6

#### Tasks:

1. **Initialize dashboard project** (`apps/dashboard`)
   - Vite + React 19 + TypeScript
   - Tailwind CSS 4 configuration
   - React Router v7 with route-based code splitting
   - TanStack Query for server state
   - Recharts for data visualization

2. **Authentication flow**
   - Login page: email + password form
   - MFA page: 6-digit TOTP input
   - Auth context: stores JWT, handles refresh, redirects on expiry
   - Protected route wrapper: redirects to login if no valid JWT

3. **Patient list page** (`routes/Dashboard.tsx`)
   - Table with columns: name, age, last visit, total sessions, status (flag badge)
   - Status badge: green (no flags), amber (amber flags), red (red flags)
   - Sort by any column
   - Search by patient name
   - Filter by status (all / flagged only)
   - Click row → navigate to patient detail
   - "Today's patients" section at top (highlighted)

4. **Patient detail page** (`routes/PatientDetail.tsx`)
   - Header: patient name, age, total sessions, date range
   - **Tab 1 — Latest Session:**
     - Card per game played with key metrics as gauges/bars
     - Flagged metrics highlighted with amber/red border
   - **Tab 2 — Trends:**
     - Line chart per metric domain (attention, memory, motor, processing)
     - X-axis: visit dates, Y-axis: metric value
     - Shaded normative bands (when available)
     - Trend arrows (up/down/stable)
   - **Tab 3 — Flags:**
     - List of active flags with severity, metric, description, date
     - Dismiss button per flag (with confirmation)
     - Dismissed flags shown in collapsed section

5. **Responsive layout shell**
   - Collapsible sidebar: Patients, Settings (admin only)
   - Top bar: clinic name, logged-in user, logout
   - Content area: routed pages
   - Print styles: patient detail page prints cleanly (hide nav, expand charts)

6. **API integration**
   - TanStack Query hooks for all data fetching
   - `usePatients()` — patient list with flag status
   - `usePatient(id)` — single patient detail
   - `useMetrics(patientId)` — metric time series
   - `useFlags(patientId)` — active flags
   - Optimistic update for flag dismissal

**Acceptance criteria:**
- Clinician can log in with email + password + MFA
- Patient list loads with correct flag status badges
- Patient detail shows latest session metrics and longitudinal trends
- Charts render correctly with multiple data points
- Flags display with correct severity and can be dismissed
- Page loads in < 2 seconds
- Print view produces a clean, readable page

---

### Phase 7: Admin Panel (Sprint 13)

**Goal:** Clinic admin can manage staff, tablets, patients, and view usage.

**Read first:** `docs/PRD-kite.md` section 7, `agent_docs/dashboard.md`

#### Tasks:

1. **Staff management page**
   - List staff members: name, role, active status
   - Add staff: name, email (clinician/admin) or PIN (staff), role
   - Deactivate/reactivate staff
   - Reset staff PIN

2. **Tablet management page**
   - List registered tablets: device name, model, last seen, status
   - Register new tablet: generates a device token + QR code for pairing
   - Deactivate tablet

3. **Patient import page**
   - CSV upload form (drag-and-drop)
   - Preview parsed data before import
   - Validation: required fields (first name, last name, DOB), format checks
   - Import results: success count, error count, error details
   - Manual add patient form (single patient)

4. **Usage analytics page**
   - Sessions per day/week/month (bar chart)
   - Average play duration (line chart)
   - Completion rate (percentage gauge)
   - Top-line stats cards: total patients, total sessions, active tablets

5. **Admin-only route guard**
   - Admin pages only accessible to users with `admin` role
   - Sidebar shows admin section only for admins

**Acceptance criteria:**
- Admin can add/remove staff and reset PINs
- Admin can register tablets and see their status
- CSV import correctly creates patients with encrypted PHI
- Usage analytics display accurate numbers from real session data
- Non-admin users cannot access admin pages

---

### Phase 8: Kiosk Mode & Polish (Sprint 14)

**Goal:** iPad app locked down in kiosk mode, session lifecycle hardened, UX polished.

#### Tasks:

1. **Kiosk mode implementation**
   - Programmatic Guided Access via `UIAccessibility` (requires Expo native module or config plugin)
   - Prevent: home button, control center, notifications, volume buttons
   - Allow: touch input, screen rotation
   - Fallback: document MDM (Jamf) Single App Mode setup for production

2. **Auto-reset hardening**
   - After session end screen: 30s visible countdown
   - After countdown: clear all session state, navigate to PIN screen
   - Inactivity timeout: if no touch for 120s on any screen, reset to PIN
   - Memory cleanup: clear game events from memory after upload

3. **Upload retry logic**
   - If upload fails: queue events in encrypted local storage
   - Retry with exponential backoff (5s, 15s, 60s, 5min)
   - Visual indicator for staff: "Data syncing..." / "Data uploaded"
   - Never lose session data

4. **Visual polish pass**
   - Consistent color palette across all screens (sky blue theme)
   - Smooth transitions between screens (shared element transitions)
   - Loading states: skeleton screens, not spinners
   - Error states: friendly illustrations, retry buttons
   - Haptic feedback on button taps

5. **Accessibility pass**
   - Touch targets: minimum 44x44pt everywhere
   - Color contrast: WCAG AA for all text
   - No color-only indicators (shape + color)
   - VoiceOver labels on staff/consent screens (game screens exempt — children use visuals)

**Acceptance criteria:**
- iPad stays locked to Kite app (no home button escape)
- Session data survives a failed upload and retries successfully
- App auto-resets after inactivity
- All screens feel polished and consistent
- No accessibility violations on staff/consent screens

---

### Phase 9: Security Hardening & Testing (Sprint 15-16)

**Goal:** HIPAA/COPPA compliance verified, security tested, ready for pilot deployment.

#### Tasks:

1. **Security audit checklist**
   - [ ] All PHI fields encrypted in database (verify with raw SQL query)
   - [ ] No PHI in application logs (grep all log statements)
   - [ ] JWT expiry enforced (test with expired token)
   - [ ] MFA required for dashboard access (test without MFA)
   - [ ] Rate limiting active on auth endpoints (test with burst requests)
   - [ ] CORS blocks unauthorized origins
   - [ ] SQL injection: all queries parameterized (code review)
   - [ ] XSS: all user input sanitized in dashboard (test with script tags)
   - [ ] Audit log captures all PHI access (verify completeness)

2. **COPPA compliance verification**
   - [ ] Consent screen shown before any data collection
   - [ ] No data collected if consent declined
   - [ ] No persistent device identifiers stored
   - [ ] No third-party SDKs sending child data
   - [ ] Data deletion endpoint works (admin can delete a patient's data)

3. **Integration tests**
   - Full flow: register tablet → staff login → select patient → consent → play all games → upload → metrics computed → flags generated → visible on dashboard
   - Edge cases: session interrupted mid-game, upload failure + retry, concurrent sessions on different tablets

4. **Load testing** (lightweight)
   - Simulate 10 concurrent sessions uploading data
   - Dashboard with 500 patients, 2000 sessions
   - Verify query performance (< 2s page loads)

5. **Documentation**
   - API documentation (OpenAPI/Swagger spec)
   - Deployment runbook (how to set up a new clinic)
   - Staff quick-start guide (1-page PDF: how to use the tablet)

**Acceptance criteria:**
- All security checklist items pass
- All COPPA checklist items pass
- Integration test passes end-to-end
- Dashboard loads in < 2s with 500 patients
- Deployment runbook covers local dev, staging, and production

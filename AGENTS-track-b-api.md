# Track B: Backend API + Foundation

> **Terminal 2 of 3** — This track builds the foundation and the entire backend.
> Works primarily in `apps/api/` and `packages/shared/`.
>
> **YOU GO FIRST.** The other two tracks depend on your Phase 0 output.

## What You Own

```
apps/api/                 ← YOUR TERRITORY (full ownership)
packages/shared/          ← YOUR TERRITORY (you define shared types)
package.json              ← YOUR TERRITORY (monorepo root config)
turbo.json                ← YOUR TERRITORY
tsconfig.base.json        ← YOUR TERRITORY
.gitignore                ← YOUR TERRITORY
.prettierrc               ← YOUR TERRITORY
.eslintrc.*               ← YOUR TERRITORY
infrastructure/           ← YOUR TERRITORY (Terraform, Docker, etc.)
```

**Do NOT modify** `apps/mobile/` or `apps/dashboard/` beyond their initial scaffold.

## Reference Docs

| What | Where |
|------|-------|
| API spec (YOUR BIBLE) | `agent_docs/api.md` |
| Database schema | `agent_docs/database.md` |
| Metrics pipeline | `docs/TechDesign-kite.md` section 5 |
| Auth architecture | `docs/TechDesign-kite.md` section 3.2-3.3 |
| Security rules | `AGENTS.md` — Security Rules section |
| Game event data shapes | `agent_docs/games.md` — Data Collection sections |

---

## Phase 0: Foundation (DO THIS FIRST — other tracks are blocked on you)

**Goal:** Monorepo skeleton, database, auth system, shared types. Push to git so Tracks A and C can start.

### Tasks:

1. **Initialize monorepo**
   - Initialize pnpm workspace at repo root
   - Create `pnpm-workspace.yaml`:
     ```yaml
     packages:
       - 'apps/*'
       - 'packages/*'
     ```
   - Create `turbo.json` with pipelines: `build`, `dev`, `test`, `lint`, `typecheck`
   - Create `tsconfig.base.json` with `"strict": true` and shared compiler options
   - Create `.gitignore` (node_modules, .env, dist, .expo, .turbo)
   - Create `.prettierrc` (singleQuote, trailingComma, semi)
   - Create root `package.json` with workspace scripts:
     ```json
     "scripts": {
       "dev": "turbo dev",
       "build": "turbo build",
       "test": "turbo test",
       "lint": "turbo lint",
       "typecheck": "turbo typecheck"
     }
     ```

2. **Scaffold app directories** (empty shells for Tracks A and C)
   - `apps/mobile/package.json` — minimal, just name `@kite/mobile`
   - `apps/dashboard/package.json` — minimal, just name `@kite/dashboard`
   - Both get a `README.md`: "This app is built by Track A/C. See AGENTS-track-a/c.md"

3. **Create shared types package** (`packages/shared`)
   - `package.json` with name `@kite/shared`
   - `tsconfig.json` extending base
   - `src/types/index.ts` — all shared TypeScript types:

   ```typescript
   // ---- Auth ----
   export interface LoginRequest { email: string; password: string; }
   export interface LoginResponse { mfaRequired: boolean; tempToken: string; }
   export interface MfaVerifyRequest { tempToken: string; totpCode: string; }
   export interface AuthTokens { accessToken: string; refreshToken: string; }
   export interface AuthUser { id: string; name: string; role: UserRole; clinicId: string; }
   export type UserRole = 'admin' | 'clinician' | 'staff';
   export interface TabletVerifyRequest { pin: string; }
   export interface TabletVerifyResponse { accessToken: string; staffName: string; clinicName: string; }

   // ---- Patients ----
   export interface PatientSummary {
     id: string; firstName: string; lastInitial: string;
     ageMonths: number; ageDisplay: string; hasSessionToday: boolean;
   }
   export interface PatientDetail {
     id: string; firstName: string; lastName: string;
     dateOfBirth: string; ageMonths: number; guardianName: string | null;
   }
   export interface PatientListItem {
     id: string; firstName: string; lastName: string; dateOfBirth: string;
     ageMonths: number; ageDisplay: string; totalSessions: number;
     lastVisit: string | null; flagStatus: FlagSeverity | 'green'; activeFlagCount: number;
   }

   // ---- Sessions ----
   export interface CreateSessionRequest { patientId: string; tabletId: string; consentGivenAt: string; }
   export interface CreateSessionResponse { sessionId: string; patientAgeMonths: number; gamesConfig: GamesConfig; }
   export interface GamesConfig { games: GameType[]; difficultyPreset: string; }
   export type GameType = 'cloud_catch' | 'star_sequence' | 'wind_trails' | 'sky_sort';

   // ---- Game Events ----
   export interface GameEventsUpload {
     gameType: GameType; startedAt: string; completedAt: string;
     durationMs: number; events: GameEvent[];
   }
   export type GameEvent =
     | StimulusEvent | TapEvent | MissEvent       // Cloud Catch
     | RoundEvent                                   // Star Sequence
     | TraceEvent | PathCompleteEvent               // Wind Trails
     | SortEvent | RuleSwitchEvent;                 // Sky Sort

   export interface StimulusEvent { type: 'stimulus'; stimulusId: string; stimulusType: string; spawnTimestamp: number; spawnPosition: { x: number; y: number }; speed: number; }
   export interface TapEvent { type: 'tap'; timestamp: number; position: { x: number; y: number }; targetId: string | null; correct: boolean; reactionTimeMs: number; }
   export interface MissEvent { type: 'miss'; stimulusId: string; stimulusType: string; timeOnScreen: number; }
   export interface RoundEvent { type: 'round'; roundNumber: number; sequenceLength: number; sequenceShown: number[]; sequenceTapped: number[]; correct: boolean; tapTimestamps: number[]; interTapIntervals: number[]; }
   export interface TraceEvent { type: 'trace'; pathIndex: number; timestamp: number; fingerPosition: { x: number; y: number }; idealPosition: { x: number; y: number }; deviation: number; pressure: number | null; speed: number; }
   export interface PathCompleteEvent { type: 'path_complete'; pathIndex: number; duration: number; meanDeviation: number; maxDeviation: number; completionPercent: number; smoothnessScore: number; }
   export interface SortEvent { type: 'sort'; objectId: string; objectType: string; objectColor: string; objectSize: string; currentRule: string; spawnTimestamp: number; sortTimestamp: number; direction: 'left' | 'right'; correct: boolean; reactionTimeMs: number; }
   export interface RuleSwitchEvent { type: 'rule_switch'; fromRule: string; toRule: string; timestamp: number; firstSortAfterSwitch: { reactionTimeMs: number; correct: boolean }; }

   // ---- Metrics ----
   export interface MetricDataPoint { sessionId: string; date: string; ageMonths: number; value: number; percentile: number | null; }
   export interface MetricSeries { metricName: string; gameType: GameType; dataPoints: MetricDataPoint[]; trend: 'improving' | 'stable' | 'declining'; latestPercentile: number | null; }

   // ---- Flags ----
   export type FlagSeverity = 'amber' | 'red';
   export type FlagType = 'below_threshold' | 'declining_trend' | 'high_variability';
   export interface Flag {
     id: string; severity: FlagSeverity; flagType: FlagType;
     metricName: string; gameType: GameType; description: string;
     currentValue: number | null; thresholdPercentile: number | null;
     actualPercentile: number | null; createdAt: string;
     isDismissed: boolean;
   }

   // ---- Admin ----
   export interface StaffMember { id: string; name: string; email: string | null; role: UserRole; isActive: boolean; createdAt: string; }
   export interface TabletInfo { id: string; deviceName: string | null; model: string | null; lastSeenAt: string | null; isActive: boolean; }
   export interface ImportResult { imported: number; skipped: number; errors: { row: number; error: string }[]; }
   export interface ClinicAnalytics { totalPatients: number; totalSessions: number; activeTablets: number; sessionsPerPeriod: { date: string; count: number }[]; avgPlayDurationMs: number; completionRate: number; }

   // ---- Common ----
   export interface ApiError { error: { code: string; message: string; details?: Record<string, unknown> } }
   export interface PaginatedResponse<T> { data: T[]; total: number; page: number; limit: number; }
   ```

4. **Set up API project** (`apps/api`)
   - Express + TypeScript + tsx (for dev) or ts-node-dev
   - Install: express, cors, helmet, pino, pino-http, zod, knex, pg, bcrypt, jsonwebtoken, speakeasy, qrcode, multer, uuid
   - Project structure per `docs/TechDesign-kite.md` section 3.1
   - Pino logger (structured JSON, no PHI in logs)
   - Global error handler: catches all errors, returns `ApiError` format
   - Zod validation middleware factory
   - Health check: `GET /health` → `{ status: "ok", timestamp: "..." }`
   - CORS: allow dashboard origin only (configurable via env)
   - Helmet for security headers
   - Rate limiting middleware (express-rate-limit + Redis store)

5. **Database setup**
   - Knex config pointing to PostgreSQL (local via Docker or native install)
   - **Create ALL migration files** per `agent_docs/database.md`
   - Run migrations, verify all tables created
   - **Create seed file** per `agent_docs/database.md` — Seed Data section
   - Include realistic historical session data for dashboard testing (3-5 sessions per patient)
   - Seed data must use the encryption utility for PHI fields

6. **Field-level encryption utility** (`src/utils/encryption.ts`)
   - `encrypt(plaintext: string, key: Buffer): Buffer` — AES-256-GCM, random 12-byte IV
   - `decrypt(ciphertext: Buffer, key: Buffer): string` — parse IV + auth tag + ciphertext
   - Key loaded from `ENCRYPTION_KEY` env var (hex string, 32 bytes)
   - For local dev: generate a static key, put in `.env`
   - Unit tests: encrypt/decrypt round-trip, different plaintexts produce different ciphertexts

7. **Authentication system** — implement ALL endpoints from `agent_docs/api.md` Auth section:
   - `POST /auth/login` — email + password → verify bcrypt → return temp token (MFA required)
   - `POST /auth/mfa/verify` — verify TOTP code → return access + refresh JWT
   - `POST /auth/mfa/setup` — generate TOTP secret + QR code (for onboarding)
   - `POST /auth/tablet/verify` — device token + staff PIN → return scoped JWT
   - `POST /auth/refresh` — refresh token → new token pair
   - JWT: RS256, 15-min access, 7-day refresh
   - Refresh tokens stored hashed in `refresh_tokens` table, revokable
   - Auth middleware: verify JWT, attach `req.user` with `{ id, clinicId, role }`
   - Role middleware: `requireRole('admin', 'clinician')` factory

8. **HIPAA audit middleware** (`src/middleware/audit.ts`)
   - Intercept routes tagged with `auditAction` metadata
   - Log to `audit_log` table: user_id, clinic_id, action, resource_type, resource_id, ip, user_agent
   - Async write using `setImmediate` (don't block response)
   - Actions: `patient.view`, `patient.create`, `session.create`, `metrics.view`, `flag.dismiss`, `patient.delete`

### Acceptance Criteria:
- `pnpm install` works from repo root
- `pnpm --filter @kite/api dev` starts Express on port 3000
- Health check returns 200
- All 10 database migrations run cleanly
- Seed data creates clinic, users, patients (with encrypted names), historical sessions
- Auth flow: login → MFA → access token → protected endpoint works
- Tablet auth: device token + PIN → scoped token → session endpoints accessible
- Audit log captures PHI access
- `packages/shared` types importable by any app

### **GIT CHECKPOINT: Push to `main` after this phase. Notify Tracks A and C to pull.**

---

## Phase B1: Session & Patient API Endpoints

**Goal:** All API endpoints that Tracks A and C need to develop against.

### Tasks:

1. **Patient endpoints (for dashboard — Track C)**
   - `GET /dashboard/patients` — paginated list with flag status, search, sort, filter
     - Decrypt patient names in memory for display
     - Join with flags table to compute `flagStatus` (worst active flag severity)
     - Support `?search=`, `?status=`, `?sort=`, `?order=`, `?page=`, `?limit=`
   - `GET /dashboard/patients/:id` — full patient detail + all sessions with game metrics
   - Audit log: `patient.view` on both endpoints

2. **Session endpoints (for tablet — Track A)**
   - `GET /sessions/patients/today` — return today's patients for the requesting clinic
     - Returns first name + last initial only (data minimization)
     - Calculate age from encrypted DOB
   - `POST /sessions` — create session record, return session ID + games config
     - Validate patient belongs to clinic
     - Calculate `patient_age_months` from DOB
     - Return difficulty preset based on age
   - `POST /sessions/:id/events` — accept batch game events
     - Zod validation against `GameEventsUpload` schema
     - Store in `game_results` table (raw_events as JSONB)
   - `PATCH /sessions/:id/complete` — mark complete, trigger metrics pipeline

3. **Admin endpoints (for admin panel — Track C)**
   - Staff CRUD: `GET/POST/DELETE /admin/staff`, `PATCH /admin/staff/:id/reset-pin`
   - Tablet CRUD: `GET/POST /admin/tablets` (POST generates device token + QR code)
   - Patient import: `POST /admin/patients/import` (CSV parsing with multer)
     - Parse CSV, validate rows, encrypt PHI fields, bulk insert
     - Return import results with error details
   - Patient data deletion: `DELETE /admin/patients/:id/data` (COPPA)
     - Delete all sessions, game_results, patient_metrics, flags for patient
     - Anonymize patient record (clear encrypted fields)
   - Analytics: `GET /admin/analytics` — aggregate usage stats

4. **Metrics & flags endpoints (for dashboard — Track C)**
   - `GET /dashboard/patients/:id/metrics` — time series of metrics with optional filters
   - `GET /dashboard/patients/:id/flags` — active flags, optionally include dismissed
   - `PATCH /dashboard/flags/:id/dismiss` — dismiss flag with reason, log who/when

### Acceptance Criteria:
- All endpoints from `agent_docs/api.md` implemented and returning correct response shapes
- Zod validation on every endpoint's request body
- Auth required on every endpoint (correct roles enforced)
- Audit log entries created for all PHI access
- Patient name search works despite encryption (decrypt + filter in memory)
- CSV import handles valid, invalid, and duplicate rows correctly
- COPPA deletion removes all child data and anonymizes the record

---

## Phase B2: Metrics Pipeline

**Goal:** Raw game events → computed metrics → normative percentiles → clinical flags.

### Tasks:

1. **Metrics computation service** (`src/services/metrics.service.ts`)
   - Entry point: `computeSessionMetrics(sessionId: string)`
   - Called after `PATCH /sessions/:id/complete`
   - For each `game_result` in the session:
     - Parse `raw_events` JSONB
     - Route to the correct game-specific calculator
     - Store computed metrics as rows in `patient_metrics`
     - Update `game_results.computed_metrics` with the computed values

2. **Game-specific calculators** (`src/services/calculators/`)
   - **`cloud-catch.calculator.ts`** — `computeCloudCatchMetrics(events: GameEvent[])`
     - `attention_accuracy`: golden_tapped / total_golden_spawned
     - `reaction_time_mean`: mean of reactionTimeMs for correct taps
     - `reaction_time_cv`: std / mean of reaction times
     - `false_positive_rate`: storm_tapped / total_taps
     - `attention_decay`: accuracy_last_30s / accuracy_first_30s
   - **`star-sequence.calculator.ts`** — `computeStarSequenceMetrics(events: RoundEvent[])`
     - `max_sequence_length`: longest correct sequence
     - `memory_accuracy`: correct_rounds / total_rounds
     - `learning_rate`: linear regression slope of accuracy over rounds
     - `spatial_error_pattern`: JSON of position-confusion frequency map
   - **`wind-trails.calculator.ts`** — `computeWindTrailsMetrics(events: (TraceEvent | PathCompleteEvent)[])`
     - `motor_precision`: mean deviation, normalized to path width
     - `motor_smoothness`: mean jerk (d^3/dt^3 of position)
     - `completion_rate`: mean completion percent across paths
     - `speed_accuracy_ratio`: speed_percentile / accuracy_percentile
   - **`sky-sort.calculator.ts`** — `computeSkySortMetrics(events: (SortEvent | RuleSwitchEvent)[])`
     - `processing_speed`: correct_sorts / total_time_minutes
     - `sort_accuracy`: correct_sorts / total_sorts
     - `switch_cost`: accuracy_after_switch (first 5) - accuracy_before_switch (last 5)
     - `error_recovery_time`: mean time from error to next correct sort
   - **ALL calculators must be pure functions (no side effects, no DB calls)**
   - **Comprehensive unit tests for each calculator with realistic test data**

3. **Normative service** (`src/services/normative.service.ts`)
   - `getPercentile(metricName: string, ageMonths: number, value: number): number | null`
   - Phase 1: hardcoded lookup tables based on published norms:
     - Reaction time by age: well-documented in developmental psychology literature
     - Working memory span by age: well-documented (digits forward)
     - Fine motor norms: adapt from Beery VMI or similar
   - Structure: `normativeTables[metricName][ageGroup] = { p5, p15, p25, p50, p75, p85, p95 }`
   - Age groups: 48-53mo, 54-59mo, 60-65mo, 66-71mo, 72-77mo, 78-83mo
   - If metric has no normative data yet: return `null`
   - Unit tests with known values

4. **Flag generation service** (`src/services/flags.service.ts`)
   - `evaluateFlags(patientId: string, sessionId: string): Promise<void>`
   - Called after metrics are computed
   - **Threshold flags** (per-session):
     - Metric percentile < 15 → amber flag
     - Metric percentile < 5 → red flag
   - **Trend flags** (across 3+ sessions):
     - Fetch last N sessions for this patient + metric
     - Compute linear regression slope
     - If slope is negative AND latest value is below 30th percentile → amber flag
   - **Variability flags** (across 3+ sessions):
     - Coefficient of variation > 0.4 across sessions → amber flag
   - **Deduplication**: before inserting a flag, check if an identical active (non-dismissed) flag already exists for this patient + metric + flag_type. If so, skip.
   - Each flag gets a human-readable description (per `agent_docs/api.md` flag response format)
   - Include disclaimer: "This is a developmental pattern observation, not a clinical diagnosis."

5. **Integration: wire metrics into session completion**
   - In `PATCH /sessions/:id/complete` handler:
     ```
     1. Mark session as completed
     2. Await computeSessionMetrics(sessionId)
     3. Await evaluateFlags(patientId, sessionId)
     4. Return { metricsComputed: true }
     ```
   - If metrics computation fails, still mark session complete (don't lose data)
   - Log error, retry metrics computation via a background job (simple setTimeout for MVP)

### Acceptance Criteria:
- All 4 calculators compute correct values for test data (unit tests with known outputs)
- Metrics stored in `patient_metrics` with correct patient/session linkage
- Percentiles computed using normative tables (where available)
- Flags generated for: below-threshold, declining-trend, high-variability
- No duplicate flags created for the same patient/metric/type
- Session completion triggers the full pipeline: store events → compute metrics → evaluate flags
- Metrics pipeline completes within 5 seconds for a full 4-game session
- Pipeline failure doesn't prevent session from being marked complete

---

## Phase B3: Security Hardening & Testing

**Goal:** HIPAA/COPPA compliance verified, API hardened, integration tested.

### Tasks:

1. **Security audit**
   - [ ] PHI encrypted in DB: run raw SQL `SELECT first_name_encrypted FROM patients` — verify it's binary, not plaintext
   - [ ] No PHI in logs: grep all pino.info/warn/error calls for patient data
   - [ ] JWT expiry enforced: test API call with expired token → 401
   - [ ] MFA required: test dashboard endpoints with non-MFA token → 401
   - [ ] Rate limiting: send 20 rapid requests to `/auth/login` → 429 after 10
   - [ ] CORS: send request from unauthorized origin → blocked
   - [ ] SQL injection: send `'; DROP TABLE patients; --` in search → parameterized, no effect
   - [ ] Audit log completeness: check that every PHI endpoint creates an audit entry

2. **COPPA compliance**
   - [ ] No data stored before consent (verify no DB writes before `POST /sessions`)
   - [ ] Data deletion works: `DELETE /admin/patients/:id/data` removes everything
   - [ ] Verify no third-party services receive patient data (review all outbound calls)

3. **Integration tests** (`tests/integration/`)
   - Full flow test: create clinic → create users → register tablet → tablet login → select patient → create session → upload events → complete session → verify metrics computed → verify flags generated → dashboard patient list → patient detail → dismiss flag
   - Edge cases:
     - Session with no events (child didn't play)
     - Session with 1 game (partial)
     - Concurrent sessions on different tablets
     - CSV import with duplicates
     - Data deletion followed by new session for same patient

4. **Load test** (lightweight, use a script)
   - Seed 500 patients with 5 sessions each
   - `GET /dashboard/patients` → < 2 seconds
   - `GET /dashboard/patients/:id` with 20 sessions → < 2 seconds
   - 10 concurrent `POST /sessions/:id/events` → all succeed

5. **API documentation**
   - Generate OpenAPI/Swagger spec from Zod schemas (zod-to-openapi)
   - Serve at `/api-docs` in development mode

### Acceptance Criteria:
- All security checklist items pass
- All COPPA checklist items pass
- Integration test passes the full end-to-end flow
- Dashboard queries return in < 2 seconds with 500 patients
- OpenAPI spec generated and accessible

---

## Integration Checklist (after all tracks merge)

- [ ] Track A's mock API responses match Track B's real API responses exactly
- [ ] Track C's mock API responses match Track B's real API responses exactly
- [ ] Shared types in `packages/shared` are used consistently across all apps
- [ ] CORS config allows dashboard origin
- [ ] Tablet device token auth works end-to-end
- [ ] Session events from real iPad games compute correct metrics
- [ ] Dashboard displays real data from real game sessions

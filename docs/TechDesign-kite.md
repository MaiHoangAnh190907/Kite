# Kite — Technical Design Document

**Version:** 1.0
**Date:** 2026-02-07
**Status:** Draft

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLINIC WAITING ROOM                          │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  iPad Kiosk   │    │  iPad Kiosk   │    │  iPad Kiosk   │         │
│  │  (Kite App)   │    │  (Kite App)   │    │  (Kite App)   │         │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘          │
│         │                   │                   │                   │
│         └───────────────────┼───────────────────┘                   │
│                             │ HTTPS (TLS 1.3)                       │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   AWS CloudFront   │  CDN / WAF
                    │   (+ AWS WAF)      │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  AWS ALB           │  Load Balancer
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────▼──────┐ ┌─────▼──────┐ ┌──────▼─────────┐
    │  API Server     │ │ API Server  │ │  API Server     │
    │  (Node.js/ECS)  │ │ (Node.js)   │ │  (Node.js)      │
    └─────────┬──────┘ └─────┬──────┘ └──────┬─────────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
          ┌───────────────────┼──────────────────┐
          │                   │                  │
┌─────────▼──────┐  ┌────────▼───────┐  ┌───────▼────────┐
│  PostgreSQL     │  │  Redis          │  │  S3             │
│  (RDS)          │  │  (ElastiCache)  │  │  (Encrypted)    │
│  Primary + Read │  │  Sessions/Cache │  │  Backups/Exports│
└────────────────┘  └────────────────┘  └────────────────┘

              ┌──────────────────────────────┐
              │     WEB CLIENTS              │
              │                              │
              │  ┌────────────────────────┐  │
              │  │ Clinician Dashboard    │  │
              │  │ (React SPA)           │  │
              │  └────────────────────────┘  │
              │  ┌────────────────────────┐  │
              │  │ Admin Panel            │  │
              │  │ (React SPA)           │  │
              │  └────────────────────────┘  │
              └──────────────────────────────┘
```

### Technology Choices Summary

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Mobile app | React Native (Expo) + TypeScript | Cross-platform, shared TS codebase, Expo for fast iteration |
| Game rendering | React Native Skia | High-performance 2D canvas for mini-games, 60fps on iPad |
| Backend API | Node.js + Express + TypeScript | Full-stack TS, mature ecosystem, easy to hire |
| Database | PostgreSQL 16 (AWS RDS) | ACID compliance, JSONB for flexible game data, proven at scale |
| Cache/Sessions | Redis (AWS ElastiCache) | Session management, rate limiting, real-time data buffering |
| Web dashboard | React + TypeScript + Vite | Shared TS ecosystem, fast builds, component reuse |
| Charts | Recharts or Victory | React-native-friendly charting with web counterparts |
| Auth | Custom JWT + bcrypt (HIPAA-grade) | Full control over auth flow, no third-party data processing |
| Hosting | AWS (HIPAA BAA) | Most mature HIPAA cloud, broad service catalog |
| CDN/WAF | AWS CloudFront + WAF | Edge caching for dashboard, DDoS protection |
| CI/CD | GitHub Actions | Simple, integrated with the codebase |
| MDM | Apple Configurator + Jamf (or Mosyle) | iPad kiosk lockdown and remote management |

---

## 2. Mobile App Architecture (iPad)

### 2.1 Project Structure

```
kite-app/
├── app/                      # Expo Router screens
│   ├── (staff)/              # Staff-facing screens (PIN-protected)
│   │   ├── login.tsx         # Staff PIN entry
│   │   └── select-patient.tsx # Patient selection from today's list
│   ├── (consent)/
│   │   └── consent.tsx       # Parent consent screen
│   ├── (game)/               # Game screens
│   │   ├── _layout.tsx       # Game session wrapper (timer, data collection)
│   │   ├── hub.tsx           # Sky world hub (Breeze animation)
│   │   ├── cloud-catch.tsx   # Game 1: Attention & Reaction
│   │   ├── star-sequence.tsx # Game 2: Working Memory
│   │   ├── wind-trails.tsx   # Game 3: Fine Motor
│   │   └── sky-sort.tsx      # Game 4: Categorization
│   └── (end)/
│       └── complete.tsx      # Session end screen + auto-reset timer
├── components/
│   ├── game-engine/          # Shared game rendering (Skia canvas)
│   │   ├── GameCanvas.tsx    # Base canvas component
│   │   ├── TouchTracker.tsx  # Unified touch event capture
│   │   └── animations/      # Shared animation utilities
│   ├── ui/                   # Shared UI components
│   └── breeze/               # Breeze character animations
├── services/
│   ├── api.ts                # API client (axios/fetch wrapper)
│   ├── session.ts            # Session state management
│   ├── metrics.ts            # Raw event → computed metric pipeline
│   └── sync.ts               # Background data upload
├── stores/
│   └── gameStore.ts          # Zustand store for session state
├── types/
│   └── index.ts              # Shared TypeScript types
└── utils/
    ├── crypto.ts             # On-device encryption helpers
    └── kiosk.ts              # Kiosk mode / guided access helpers
```

### 2.2 Game Rendering with React Native Skia

Each mini-game renders on a `@shopify/react-native-skia` canvas for 60fps performance. This avoids the React Native bridge bottleneck for animations.

```typescript
// Simplified game loop pattern
interface GameEvent {
  type: 'tap' | 'swipe' | 'trace' | 'drag';
  timestamp: number;       // performance.now() — ms precision
  x: number;
  y: number;
  pressure?: number;       // 3D Touch / Apple Pencil pressure
  targetId?: string;       // Which game object was interacted with
  correct?: boolean;       // Was this the right action?
  reactionTimeMs?: number; // Time since stimulus appeared
}

interface GameMetrics {
  gameId: string;
  duration: number;
  events: GameEvent[];     // Raw event stream
  computed: {              // Calculated at session end
    accuracy: number;
    meanReactionTime: number;
    reactionTimeVariability: number;
    // ... game-specific metrics
  };
}
```

### 2.3 Touch Data Collection

A `TouchTracker` wrapper captures every touch interaction with sub-frame precision:

- Timestamp (ms since session start)
- X/Y coordinates (normalized to canvas size)
- Touch phase (began, moved, ended, cancelled)
- Pressure (if available)
- Target game element (if applicable)

This raw data is the foundation for all computed metrics. It's stored locally during the session and uploaded in batch at session end.

### 2.4 Session Lifecycle

```
APP BOOT → Kiosk Mode Check → Staff PIN Screen
                                    │
                              [Valid PIN]
                                    │
                              Patient Select
                              (fetch today's list from API)
                                    │
                              [Staff selects patient]
                                    │
                              Consent Screen
                              (create session record via API)
                                    │
                              [Parent taps "I Consent"]
                                    │
                              Game Hub (Breeze intro)
                                    │
                    ┌───────────────┐│┌───────────────┐
                    │ Game 1        │││ Game 2        │
                    │ Cloud Catch   ├─┤ Star Sequence │──► ...
                    └───────────────┘│└───────────────┘
                                    │
                              Session Complete
                              (upload all game data via API)
                                    │
                              End Screen
                              (30s auto-reset countdown)
                                    │
                              → Staff PIN Screen (loop)
```

### 2.5 Kiosk Mode

iPad kiosk lockdown via two layers:

1. **Apple Guided Access (programmatic):** `UIAccessibility.requestGuidedAccessSession` locks the device to the Kite app. Prevents home button, control center, notifications.
2. **MDM Policy (Jamf/Mosyle):** Single App Mode profile pushed to managed iPads. Prevents app switching, disables non-essential hardware buttons. Allows remote lock/wipe.

Auto-reset behavior:
- After session ends, 30-second countdown on end screen
- If no staff PIN entry within 60 seconds, app resets to PIN screen
- All local session data is cleared from memory after successful upload
- If upload fails, data is encrypted and queued for retry

---

## 3. Backend API Architecture

### 3.1 Project Structure

```
kite-api/
├── src/
│   ├── server.ts              # Express app entry point
│   ├── config/
│   │   ├── database.ts        # PostgreSQL connection (pg + knex)
│   │   ├── redis.ts           # Redis connection
│   │   └── env.ts             # Environment variable validation
│   ├── middleware/
│   │   ├── auth.ts            # JWT verification + role checking
│   │   ├── audit.ts           # HIPAA audit logging middleware
│   │   ├── rateLimit.ts       # Rate limiting (Redis-backed)
│   │   └── validation.ts      # Request body validation (zod)
│   ├── routes/
│   │   ├── auth.routes.ts     # Login, token refresh, MFA
│   │   ├── clinic.routes.ts   # Clinic management
│   │   ├── patient.routes.ts  # Patient CRUD + CSV import
│   │   ├── session.routes.ts  # Game session lifecycle
│   │   ├── metrics.routes.ts  # Computed metrics & flags
│   │   └── admin.routes.ts    # Tablet management, staff, settings
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── session.service.ts
│   │   ├── metrics.service.ts # Raw events → computed metrics
│   │   ├── flags.service.ts   # Metrics → clinical flags
│   │   └── normative.service.ts # Age-matched percentile calculations
│   ├── models/                # Knex model layer
│   └── utils/
│       ├── encryption.ts      # Field-level encryption for PHI
│       └── audit.ts           # Audit log writer
├── migrations/                # Knex database migrations
├── seeds/                     # Test data seeders
└── tests/
```

### 3.2 API Endpoints

**Authentication:**
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/auth/login` | Email + password login (dashboard) | None |
| POST | `/auth/mfa/verify` | MFA TOTP verification | Partial |
| POST | `/auth/tablet/verify` | Staff PIN verification (tablet) | Device token |
| POST | `/auth/refresh` | Refresh JWT token | Refresh token |

**Sessions (tablet → server):**
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/sessions/patients/today` | Get today's patient list for a clinic | Staff |
| POST | `/sessions` | Create new game session (on consent) | Staff |
| POST | `/sessions/:id/events` | Upload raw game events (batch) | Staff |
| PATCH | `/sessions/:id/complete` | Mark session complete, trigger metric computation | Staff |

**Dashboard (web → server):**
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/dashboard/patients` | Paginated patient list with status flags | Clinician |
| GET | `/dashboard/patients/:id` | Single patient detail + all sessions | Clinician |
| GET | `/dashboard/patients/:id/metrics` | Computed metrics over time | Clinician |
| GET | `/dashboard/patients/:id/flags` | Active flags for patient | Clinician |
| GET | `/dashboard/stats` | Clinic-level usage statistics | Admin |

**Admin:**
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/admin/staff` | Add staff member | Admin |
| DELETE | `/admin/staff/:id` | Remove staff member | Admin |
| POST | `/admin/patients/import` | CSV patient import | Admin |
| GET | `/admin/tablets` | List registered tablets | Admin |
| POST | `/admin/tablets` | Register a tablet | Admin |

### 3.3 Authentication Strategy

**Three auth contexts:**

1. **Tablet (iPad app):**
   - Device is registered with a unique device token (generated during setup)
   - Staff enters a 4-6 digit PIN per session
   - Device token + staff PIN = access to session endpoints only
   - Tokens scoped to a single clinic
   - No access to dashboard or admin endpoints

2. **Clinician (web dashboard):**
   - Email + password with mandatory MFA (TOTP via authenticator app)
   - JWT access token (15-min expiry) + HTTP-only refresh token (7-day expiry)
   - Role: `clinician` — read-only access to patients in their clinic

3. **Admin (web panel):**
   - Same login flow as clinician
   - Role: `admin` — full CRUD on clinic settings, staff, patients, tablets

**JWT Payload:**
```typescript
{
  sub: string;       // User ID
  clinicId: string;  // Clinic scope
  role: 'admin' | 'clinician' | 'staff';
  iat: number;
  exp: number;
}
```

---

## 4. Database Schema

### 4.1 Core Tables

```sql
-- Clinic (one per subscribing practice)
CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'starter',
    subscription_status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users (staff, clinicians, admins — all in one table)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    email VARCHAR(255) UNIQUE, -- NULL for staff-only (PIN-based)
    password_hash VARCHAR(255), -- NULL for staff-only
    mfa_secret_encrypted BYTEA, -- TOTP secret, encrypted at rest
    pin_hash VARCHAR(255), -- For tablet access
    role VARCHAR(50) NOT NULL, -- 'admin', 'clinician', 'staff'
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Patients (children)
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    mrn VARCHAR(100), -- Medical Record Number (optional)
    first_name_encrypted BYTEA NOT NULL, -- Field-level encryption (PHI)
    last_name_encrypted BYTEA NOT NULL,
    date_of_birth_encrypted BYTEA NOT NULL,
    guardian_name_encrypted BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(clinic_id, mrn)
);

-- Tablets (registered clinic iPads)
CREATE TABLE tablets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    device_token_hash VARCHAR(255) NOT NULL UNIQUE,
    device_name VARCHAR(255),
    model VARCHAR(100),
    os_version VARCHAR(50),
    last_seen_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Game Sessions
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    tablet_id UUID NOT NULL REFERENCES tablets(id),
    staff_user_id UUID NOT NULL REFERENCES users(id),
    consent_given_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
    -- 'in_progress', 'completed', 'abandoned'
    patient_age_months INT NOT NULL, -- Snapshot at time of session
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sessions_patient ON sessions(patient_id);
CREATE INDEX idx_sessions_clinic_date ON sessions(clinic_id, started_at);

-- Game Results (one per mini-game per session)
CREATE TABLE game_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id),
    game_type VARCHAR(50) NOT NULL,
    -- 'cloud_catch', 'star_sequence', 'wind_trails', 'sky_sort'
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_ms INT,
    raw_events JSONB NOT NULL DEFAULT '[]',
    -- Array of GameEvent objects (tap, swipe, trace data)
    computed_metrics JSONB NOT NULL DEFAULT '{}',
    -- Calculated after game completion
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_game_results_session ON game_results(session_id);
CREATE INDEX idx_game_results_type ON game_results(game_type);

-- Computed Metrics (denormalized for dashboard queries)
CREATE TABLE patient_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    session_id UUID NOT NULL REFERENCES sessions(id),
    game_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    -- e.g., 'attention_accuracy', 'reaction_time_mean', 'motor_precision'
    metric_value DECIMAL(10,4) NOT NULL,
    age_months INT NOT NULL,
    percentile DECIMAL(5,2), -- Age-matched percentile (NULL until normative data exists)
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_patient_metrics_lookup
    ON patient_metrics(patient_id, metric_name, recorded_at);

-- Flags (clinical pattern flags)
CREATE TABLE flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    session_id UUID REFERENCES sessions(id), -- NULL if trend-based
    flag_type VARCHAR(50) NOT NULL,
    -- 'below_threshold', 'declining_trend', 'high_variability'
    severity VARCHAR(20) NOT NULL, -- 'amber', 'red'
    metric_name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    current_value DECIMAL(10,4),
    threshold_value DECIMAL(10,4),
    is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
    dismissed_by UUID REFERENCES users(id),
    dismissed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_flags_patient ON flags(patient_id, is_dismissed);
CREATE INDEX idx_flags_clinic ON flags(clinic_id, severity);

-- HIPAA Audit Log
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID, -- NULL for system actions
    clinic_id UUID,
    action VARCHAR(100) NOT NULL,
    -- 'patient.view', 'session.create', 'metrics.export', etc.
    resource_type VARCHAR(50),
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at);
CREATE INDEX idx_audit_log_clinic ON audit_log(clinic_id, created_at);
```

### 4.2 Field-Level Encryption

Patient PII (name, DOB, guardian name) is encrypted at the application level before storage using AES-256-GCM:

```typescript
// Encryption approach
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Key stored in AWS KMS, fetched at app start, cached in memory
// Each field gets a unique IV
// Format: [IV (12 bytes)][AUTH_TAG (16 bytes)][CIPHERTEXT]
```

This ensures that even if the database is compromised, PHI is unreadable without the KMS key.

---

## 5. Metrics Computation Pipeline

### 5.1 Flow

```
Raw Touch Events (iPad)
        │
        ▼
Upload to API (batch POST at session end)
        │
        ▼
Store in game_results.raw_events (JSONB)
        │
        ▼
Metrics Service computes per-game metrics
        │
        ▼
Store in patient_metrics table
        │
        ▼
Flags Service evaluates against thresholds
        │
        ▼
Store in flags table (if triggered)
        │
        ▼
Available on clinician dashboard
```

### 5.2 Metric Definitions per Game

**Cloud Catch (Attention & Reaction):**
| Metric | Calculation | Clinical Relevance |
|--------|------------|-------------------|
| `attention_accuracy` | Correct taps / total targets | Sustained attention |
| `reaction_time_mean` | Mean ms from target appear to tap | Processing speed |
| `reaction_time_cv` | Std dev / mean of reaction times | ADHD marker (high variability) |
| `false_positive_rate` | Storm cloud taps / total taps | Impulsivity |
| `attention_decay` | Accuracy in last 30s vs first 30s | Sustained attention fatigue |

**Star Sequence (Working Memory):**
| Metric | Calculation | Clinical Relevance |
|--------|------------|-------------------|
| `max_sequence_length` | Longest correctly recalled sequence | Working memory capacity |
| `memory_accuracy` | Correct sequences / total attempts | Memory reliability |
| `learning_rate` | Improvement slope across rounds | Learning ability |
| `spatial_error_pattern` | Which positions are most confused | Visual-spatial processing |

**Wind Trails (Fine Motor):**
| Metric | Calculation | Clinical Relevance |
|--------|------------|-------------------|
| `motor_precision` | Mean deviation from ideal path (px) | Fine motor control |
| `motor_smoothness` | Jerk metric (rate of acceleration change) | Motor coordination |
| `completion_rate` | % of path successfully traced | Task persistence |
| `speed_accuracy_ratio` | Speed percentile / accuracy percentile | Motor planning |

**Sky Sort (Processing Speed & Flexibility):**
| Metric | Calculation | Clinical Relevance |
|--------|------------|-------------------|
| `processing_speed` | Correct sorts per minute | Cognitive processing speed |
| `sort_accuracy` | Correct sorts / total sorts | Categorization ability |
| `switch_cost` | Accuracy drop after rule change | Cognitive flexibility |
| `error_recovery_time` | Time to next correct after error | Frustration tolerance |

### 5.3 Flag Generation Rules

```typescript
interface FlagRule {
  metric: string;
  type: 'threshold' | 'trend' | 'variability';
  severity: 'amber' | 'red';
  condition: (values: MetricHistory) => boolean;
  description: string;
}

const flagRules: FlagRule[] = [
  // Threshold-based (single session)
  {
    metric: 'attention_accuracy',
    type: 'threshold',
    severity: 'amber',
    condition: (v) => latest(v).percentile < 15,
    description: 'Attention accuracy below 15th percentile for age',
  },
  {
    metric: 'attention_accuracy',
    type: 'threshold',
    severity: 'red',
    condition: (v) => latest(v).percentile < 5,
    description: 'Attention accuracy below 5th percentile for age',
  },
  // Trend-based (across 3+ sessions)
  {
    metric: 'reaction_time_cv',
    type: 'trend',
    severity: 'amber',
    condition: (v) => isIncreasingTrend(v, 3),
    description: 'Reaction time variability increasing across recent visits',
  },
  // Variability-based
  {
    metric: 'motor_precision',
    type: 'variability',
    severity: 'amber',
    condition: (v) => coefficientOfVariation(v) > 0.4,
    description: 'Fine motor precision highly inconsistent across visits',
  },
];
```

### 5.4 Normative Data Bootstrapping

Before Kite has its own normative dataset, percentiles will be estimated using:

1. **Published norms** from validated cognitive tasks that Kite's games are based on (reaction time norms by age, working memory span norms, etc.)
2. **Internal calibration** during pilot: first 100-200 sessions seed the normative distribution
3. **Rolling norms** updated as the dataset grows, stratified by age in 6-month bands

Flag thresholds use conservative cutoffs (15th and 5th percentile) to minimize false positives during the bootstrapping phase.

---

## 6. Web Dashboard Architecture

### 6.1 Project Structure

```
kite-dashboard/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   │   ├── Login.tsx
│   │   ├── MFA.tsx
│   │   ├── Dashboard.tsx        # Patient list with flags
│   │   ├── PatientDetail.tsx    # Individual patient view
│   │   ├── AdminSettings.tsx    # Clinic settings
│   │   ├── AdminStaff.tsx       # Staff management
│   │   ├── AdminTablets.tsx     # Tablet management
│   │   └── AdminImport.tsx      # Patient CSV import
│   ├── components/
│   │   ├── PatientTable.tsx     # Sortable, filterable patient list
│   │   ├── FlagBadge.tsx        # Green/amber/red status indicator
│   │   ├── MetricCard.tsx       # Single metric with gauge
│   │   ├── TrendChart.tsx       # Longitudinal line chart
│   │   ├── SessionSummary.tsx   # Per-visit breakdown
│   │   └── FlagList.tsx         # Active flags with descriptions
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── usePatients.ts
│   │   └── useMetrics.ts
│   ├── services/
│   │   └── api.ts               # API client
│   └── types/
│       └── index.ts
├── public/
└── vite.config.ts
```

### 6.2 Key Libraries

| Library | Purpose |
|---------|---------|
| React 19 | UI framework |
| Vite | Build tool |
| React Router v7 | Client-side routing |
| TanStack Query | Server state management + caching |
| Recharts | Chart visualizations (line, bar, gauge) |
| Tailwind CSS | Utility-first styling |
| Zod | Runtime type validation |
| Axios | HTTP client |

### 6.3 Dashboard Design System

**Color palette:**
- Background: `#FAFBFC` (light grey)
- Cards: `#FFFFFF` with subtle shadow
- Primary: `#3B82F6` (blue — trust, clinical)
- Green flag: `#10B981`
- Amber flag: `#F59E0B`
- Red flag: `#EF4444`
- Text: `#1F2937` (dark grey)

**Typography:**
- Headings: Inter (clean, medical-appropriate)
- Body: Inter
- Monospace (metric values): JetBrains Mono

**Layout:**
- Sidebar navigation (collapsible)
- Main content area with card-based layout
- Responsive but optimized for desktop (clinicians use desktop/laptop)

---

## 7. AWS Infrastructure

### 7.1 Service Map

| Service | Purpose | HIPAA Eligible |
|---------|---------|----------------|
| **ECS Fargate** | Run API containers (serverless compute) | Yes |
| **RDS PostgreSQL** | Primary database | Yes |
| **ElastiCache Redis** | Sessions, caching, rate limiting | Yes |
| **S3** | Patient CSV uploads, backups, static assets | Yes |
| **CloudFront** | CDN for dashboard SPA + API edge caching | Yes |
| **WAF** | Web application firewall | Yes |
| **KMS** | Encryption key management | Yes |
| **Secrets Manager** | Database credentials, API keys | Yes |
| **CloudWatch** | Logging, monitoring, alerting | Yes |
| **ACM** | TLS certificates | Yes |
| **Route 53** | DNS management | Yes |
| **ECR** | Docker container registry | Yes |

### 7.2 Network Architecture

```
┌──────────────────────────────────────────────┐
│ VPC (10.0.0.0/16)                            │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ Public Subnets (10.0.1.0/24, 10.0.2.0/24)│ │
│ │ - ALB                                    │ │
│ │ - NAT Gateway                            │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ Private Subnets (10.0.3.0/24, 10.0.4.0/24)│
│ │ - ECS Fargate tasks                      │ │
│ │ - RDS PostgreSQL                         │ │
│ │ - ElastiCache Redis                      │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ No internet access from private subnets      │
│ (except via NAT Gateway for outbound)        │
└──────────────────────────────────────────────┘
```

### 7.3 Estimated Monthly Cost (MVP Scale)

| Service | Config | Est. Cost |
|---------|--------|-----------|
| ECS Fargate | 2 tasks, 0.5 vCPU, 1GB RAM | $30 |
| RDS PostgreSQL | db.t4g.small, Multi-AZ, 50GB | $70 |
| ElastiCache Redis | cache.t4g.micro | $15 |
| S3 | < 10 GB | $1 |
| CloudFront | < 100 GB transfer | $10 |
| KMS | 1 key + API calls | $5 |
| Secrets Manager | 5 secrets | $3 |
| CloudWatch | Logs + metrics | $15 |
| Route 53 | 1 hosted zone | $1 |
| **Total** | | **~$150/month** |

Scales to ~$500-1,000/month at 50 clinics. Cost-efficient due to Fargate auto-scaling.

---

## 8. Security Architecture

### 8.1 HIPAA Compliance Checklist

| Control | Implementation |
|---------|---------------|
| Encryption at rest | RDS encryption (AES-256), S3 SSE-KMS, field-level encryption for PHI |
| Encryption in transit | TLS 1.3 everywhere (ALB, API, database connections) |
| Access controls | RBAC (admin/clinician/staff), JWT with short expiry, MFA required |
| Audit logging | All PHI access logged to audit_log table + CloudWatch |
| Data backup | RDS automated backups (35-day retention), point-in-time recovery |
| Breach notification | CloudWatch alarms on anomalous access patterns → SNS → PagerDuty |
| BAA | AWS BAA in place, Kite signs BAA with each clinic |
| Minimum necessary | API returns only data for the requesting user's clinic |
| Workforce training | (Operational — not in code) |

### 8.2 COPPA Compliance

| Requirement | Implementation |
|-------------|---------------|
| Parental consent | In-app consent screen before any data collection. Consent timestamp logged. |
| Data minimization | Collect only gameplay metrics. No photos, audio, video, biometrics. |
| No persistent identifiers | No ad IDs, no cross-app tracking. Device token is clinic-scoped. |
| Parental access/deletion | Admin panel supports per-patient data export and deletion. |
| Privacy policy | Accessible from consent screen and clinic admin panel. |
| No third-party data sharing | No analytics SDKs (no Firebase Analytics, no Amplitude). Self-hosted analytics only. |

### 8.3 Data Flow Security

```
iPad App                          API Server                    Database
   │                                  │                            │
   │ ── TLS 1.3 ──────────────────►  │                            │
   │    POST /sessions/:id/events     │                            │
   │    Body: encrypted payload       │                            │
   │                                  │ ── TLS ─────────────────► │
   │                                  │    Store raw_events (JSONB) │
   │                                  │    PHI fields: AES-256-GCM │
   │                                  │                            │
   │                                  │ ── Log to audit_log ────► │
   │                                  │                            │
```

---

## 9. DevOps & CI/CD

### 9.1 Repository Structure (Monorepo)

```
kite/
├── apps/
│   ├── mobile/          # React Native Expo app (iPad)
│   ├── api/             # Node.js backend
│   └── dashboard/       # React web dashboard
├── packages/
│   └── shared/          # Shared TypeScript types & utilities
├── infrastructure/
│   └── terraform/       # AWS infrastructure as code
├── .github/
│   └── workflows/
│       ├── ci.yml       # Lint, type-check, test on PR
│       ├── deploy-api.yml     # Deploy API to ECS
│       └── deploy-dashboard.yml # Deploy dashboard to S3/CloudFront
├── package.json         # pnpm workspace root
├── turbo.json           # Turborepo config
└── tsconfig.base.json   # Shared TypeScript config
```

**Monorepo tool:** Turborepo (pnpm workspaces) — enables shared types between mobile, API, and dashboard.

### 9.2 CI/CD Pipeline

```
PR Created
    │
    ├── Lint (ESLint + Prettier)
    ├── Type Check (tsc --noEmit)
    ├── Unit Tests (Vitest for API + dashboard, Jest for mobile)
    └── Build Check (all three apps compile)
    │
Merge to main
    │
    ├── API: Build Docker image → Push to ECR → Deploy to ECS (blue/green)
    ├── Dashboard: Build → Upload to S3 → Invalidate CloudFront
    └── Mobile: Build via EAS → TestFlight (manual release to App Store)
```

### 9.3 Environment Strategy

| Environment | Purpose | Database |
|-------------|---------|----------|
| `local` | Developer machines | Local PostgreSQL (Docker) |
| `staging` | Pre-production testing | RDS (separate instance, synthetic data) |
| `production` | Live clinics | RDS (Multi-AZ, encrypted, backed up) |

---

## 10. Third-Party Services (Minimal)

| Service | Purpose | HIPAA/COPPA Safe |
|---------|---------|-----------------|
| **AWS** | All infrastructure | Yes (BAA) |
| **GitHub** | Source code + CI/CD | Yes (no PHI in repo) |
| **Apple Developer** | App Store distribution | Yes |
| **Jamf / Mosyle** | MDM for clinic iPads | Yes (HIPAA BAAs available) |
| **PagerDuty** | Incident alerting | Yes (no PHI in alerts) |
| **Stripe** | Subscription billing | Yes (no PHI, billing only) |

**Explicitly excluded:**
- No Firebase / Google Analytics (COPPA risk)
- No Sentry (sends device data to third party — self-host or skip for MVP)
- No Amplitude / Mixpanel (COPPA risk)
- No third-party auth (Auth0, Clerk) — self-hosted to avoid PHI in third-party systems

---

## 11. Development Milestones

### Sprint Plan (2-week sprints)

| Sprint | Focus | Deliverable |
|--------|-------|-------------|
| 1-2 | **Foundation** | Monorepo setup, DB schema, auth system, basic API CRUD |
| 3-4 | **Tablet app shell** | Expo app with navigation, staff PIN, patient selection, consent screen |
| 5-6 | **Game engine + Game 1** | Skia canvas, touch tracking, Cloud Catch game complete |
| 7-8 | **Games 2-4** | Star Sequence, Wind Trails, Sky Sort |
| 9-10 | **Metrics pipeline** | Raw events → computed metrics → flags |
| 11-12 | **Dashboard** | Patient list, patient detail, trend charts, flag display |
| 13 | **Admin panel** | Staff management, tablet registration, CSV import |
| 14 | **Kiosk + polish** | Guided Access, auto-reset, session lifecycle hardening |
| 15-16 | **Security + testing** | Encryption audit, penetration testing, HIPAA checklist |

**Total: ~16 sprints = ~32 weeks = ~8 months** (conservative with security/compliance work)

Accelerated timeline with focused effort: **4-5 months** to pilot-ready.

---

## 12. Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Skia performance on older iPads | Games lag below 60fps | Profile early on iPad 8th gen. Fallback to simpler animations. |
| Touch data volume (thousands of events/session) | API/DB overwhelmed | Batch upload, compress events, archive raw data to S3 after metric computation |
| Kiosk mode bypass | Child exits app, accesses iPad settings | Dual-layer: Guided Access API + MDM Single App Mode |
| WiFi reliability in clinics | Data upload fails | Queue failed uploads, retry with exponential backoff. Show "syncing" indicator to staff. |
| Field-level encryption performance | Slow patient list queries | Encrypt only PII fields. Use indexed non-PII fields (patient ID, clinic ID) for lookups. |
| Normative data chicken-and-egg | No percentiles without data, no value without percentiles | Phase 1: Show raw metric values + session-over-session trends. Percentiles enabled after n=200. |

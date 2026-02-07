# Database Schema Reference

> PostgreSQL 16. All migrations managed via Knex.
> PHI fields use application-level AES-256-GCM encryption.

## Migration Order

Run these migrations in order. Each migration file is named with a timestamp prefix.

1. `001_create_clinics.ts`
2. `002_create_users.ts`
3. `003_create_patients.ts`
4. `004_create_tablets.ts`
5. `005_create_sessions.ts`
6. `006_create_game_results.ts`
7. `007_create_patient_metrics.ts`
8. `008_create_flags.ts`
9. `009_create_audit_log.ts`
10. `010_create_refresh_tokens.ts`

---

## Table Definitions

### clinics

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, default gen_random_uuid() | |
| name | VARCHAR(255) | NOT NULL | Clinic display name |
| address | TEXT | | Clinic address |
| subscription_tier | VARCHAR(50) | NOT NULL, default 'starter' | 'starter', 'growth', 'enterprise' |
| subscription_status | VARCHAR(50) | NOT NULL, default 'active' | 'active', 'paused', 'cancelled' |
| stripe_customer_id | VARCHAR(255) | | For billing integration |
| created_at | TIMESTAMPTZ | NOT NULL, default NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, default NOW() | |

### users

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| clinic_id | UUID | FK → clinics(id), NOT NULL | |
| email | VARCHAR(255) | UNIQUE, nullable | NULL for staff-only (PIN-based) |
| password_hash | VARCHAR(255) | nullable | bcrypt, 12 rounds |
| mfa_secret_encrypted | BYTEA | nullable | AES-256-GCM encrypted TOTP secret |
| mfa_enabled | BOOLEAN | NOT NULL, default FALSE | |
| pin_hash | VARCHAR(255) | nullable | bcrypt hash of staff PIN |
| role | VARCHAR(50) | NOT NULL | 'admin', 'clinician', 'staff' |
| name | VARCHAR(255) | NOT NULL | Display name |
| is_active | BOOLEAN | NOT NULL, default TRUE | Soft delete |
| created_at | TIMESTAMPTZ | NOT NULL, default NOW() | |

**Indexes:**
- `idx_users_clinic` on (clinic_id)
- `idx_users_email` on (email) WHERE email IS NOT NULL

### patients

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| clinic_id | UUID | FK → clinics(id), NOT NULL | |
| mrn | VARCHAR(100) | nullable | Medical Record Number |
| first_name_encrypted | BYTEA | NOT NULL | AES-256-GCM |
| last_name_encrypted | BYTEA | NOT NULL | AES-256-GCM |
| date_of_birth_encrypted | BYTEA | NOT NULL | AES-256-GCM |
| guardian_name_encrypted | BYTEA | nullable | AES-256-GCM |
| is_deleted | BOOLEAN | NOT NULL, default FALSE | COPPA deletion flag |
| created_at | TIMESTAMPTZ | NOT NULL, default NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, default NOW() | |

**Indexes:**
- `idx_patients_clinic` on (clinic_id)
- UNIQUE on (clinic_id, mrn) WHERE mrn IS NOT NULL

**Encryption note:** first_name, last_name, date_of_birth, and guardian_name are encrypted at the application layer before INSERT. To query by name, the API must decrypt all patients for a clinic and filter in memory. For MVP with < 1000 patients per clinic, this is acceptable. For scale, consider a deterministic hash index for exact-match name lookups.

### tablets

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| clinic_id | UUID | FK → clinics(id), NOT NULL | |
| device_token_hash | VARCHAR(255) | NOT NULL, UNIQUE | bcrypt hash of device token |
| device_name | VARCHAR(255) | | "Waiting Room iPad 1" |
| model | VARCHAR(100) | | "iPad 9th Gen" |
| os_version | VARCHAR(50) | | "iPadOS 17.2" |
| last_seen_at | TIMESTAMPTZ | | Updated on each API call |
| is_active | BOOLEAN | NOT NULL, default TRUE | |
| registered_at | TIMESTAMPTZ | NOT NULL, default NOW() | |

**Indexes:**
- `idx_tablets_clinic` on (clinic_id)

### sessions

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| patient_id | UUID | FK → patients(id), NOT NULL | |
| clinic_id | UUID | FK → clinics(id), NOT NULL | |
| tablet_id | UUID | FK → tablets(id), NOT NULL | |
| staff_user_id | UUID | FK → users(id), NOT NULL | Who started the session |
| consent_given_at | TIMESTAMPTZ | NOT NULL | When parent tapped consent |
| started_at | TIMESTAMPTZ | NOT NULL | When first game started |
| completed_at | TIMESTAMPTZ | nullable | When session ended |
| status | VARCHAR(50) | NOT NULL, default 'in_progress' | 'in_progress', 'completed', 'abandoned' |
| patient_age_months | INT | NOT NULL | Snapshot at time of session |
| games_completed | INT | NOT NULL, default 0 | 0-4 |
| total_duration_ms | INT | nullable | Total play time |
| created_at | TIMESTAMPTZ | NOT NULL, default NOW() | |

**Indexes:**
- `idx_sessions_patient` on (patient_id)
- `idx_sessions_clinic_date` on (clinic_id, started_at)
- `idx_sessions_status` on (status) WHERE status = 'in_progress'

### game_results

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| session_id | UUID | FK → sessions(id), NOT NULL | |
| game_type | VARCHAR(50) | NOT NULL | 'cloud_catch', 'star_sequence', 'wind_trails', 'sky_sort' |
| started_at | TIMESTAMPTZ | NOT NULL | |
| completed_at | TIMESTAMPTZ | nullable | |
| duration_ms | INT | nullable | |
| raw_events | JSONB | NOT NULL, default '[]' | Full event stream |
| computed_metrics | JSONB | NOT NULL, default '{}' | Post-processed metrics |
| created_at | TIMESTAMPTZ | NOT NULL, default NOW() | |

**Indexes:**
- `idx_game_results_session` on (session_id)
- `idx_game_results_type` on (game_type)

**Note:** `raw_events` can be large (1000+ events for Wind Trails). Consider archiving to S3 after metric computation in a future optimization phase.

### patient_metrics

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| patient_id | UUID | FK → patients(id), NOT NULL | |
| session_id | UUID | FK → sessions(id), NOT NULL | |
| game_type | VARCHAR(50) | NOT NULL | |
| metric_name | VARCHAR(100) | NOT NULL | e.g., 'attention_accuracy' |
| metric_value | DECIMAL(10,4) | NOT NULL | Raw metric value |
| age_months | INT | NOT NULL | Age at time of measurement |
| percentile | DECIMAL(5,2) | nullable | Age-matched percentile (NULL until normed) |
| recorded_at | TIMESTAMPTZ | NOT NULL | Session date |
| created_at | TIMESTAMPTZ | NOT NULL, default NOW() | |

**Indexes:**
- `idx_patient_metrics_lookup` on (patient_id, metric_name, recorded_at)
- `idx_patient_metrics_normative` on (metric_name, age_months) — for normative calculations

### flags

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| patient_id | UUID | FK → patients(id), NOT NULL | |
| clinic_id | UUID | FK → clinics(id), NOT NULL | |
| session_id | UUID | FK → sessions(id), nullable | NULL for trend-based flags |
| flag_type | VARCHAR(50) | NOT NULL | 'below_threshold', 'declining_trend', 'high_variability' |
| severity | VARCHAR(20) | NOT NULL | 'amber', 'red' |
| metric_name | VARCHAR(100) | NOT NULL | |
| game_type | VARCHAR(50) | NOT NULL | |
| description | TEXT | NOT NULL | Human-readable explanation |
| current_value | DECIMAL(10,4) | nullable | |
| threshold_value | DECIMAL(10,4) | nullable | |
| is_dismissed | BOOLEAN | NOT NULL, default FALSE | |
| dismissed_by | UUID | FK → users(id), nullable | |
| dismissed_at | TIMESTAMPTZ | nullable | |
| dismiss_reason | TEXT | nullable | |
| created_at | TIMESTAMPTZ | NOT NULL, default NOW() | |

**Indexes:**
- `idx_flags_patient_active` on (patient_id) WHERE is_dismissed = FALSE
- `idx_flags_clinic_severity` on (clinic_id, severity) WHERE is_dismissed = FALSE

### audit_log

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | BIGSERIAL | PK | Auto-incrementing for speed |
| user_id | UUID | nullable | NULL for system actions |
| clinic_id | UUID | nullable | |
| action | VARCHAR(100) | NOT NULL | 'patient.view', 'session.create', etc. |
| resource_type | VARCHAR(50) | nullable | 'patient', 'session', 'flag' |
| resource_id | UUID | nullable | |
| ip_address | INET | nullable | |
| user_agent | TEXT | nullable | |
| details | JSONB | nullable | Additional context |
| created_at | TIMESTAMPTZ | NOT NULL, default NOW() | |

**Indexes:**
- `idx_audit_user_time` on (user_id, created_at)
- `idx_audit_clinic_time` on (clinic_id, created_at)
- `idx_audit_action` on (action, created_at)

**Retention:** Audit logs retained for minimum 6 years (HIPAA requirement).

### refresh_tokens

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| user_id | UUID | FK → users(id), NOT NULL | |
| token_hash | VARCHAR(255) | NOT NULL, UNIQUE | SHA-256 hash of refresh token |
| expires_at | TIMESTAMPTZ | NOT NULL | |
| revoked_at | TIMESTAMPTZ | nullable | |
| created_at | TIMESTAMPTZ | NOT NULL, default NOW() | |

**Indexes:**
- `idx_refresh_tokens_user` on (user_id)
- `idx_refresh_tokens_hash` on (token_hash)

---

## Seed Data

The seed file should create:

```
Clinic: "Sunny Pediatrics" (id: fixed UUID for dev)

Users:
  - Admin: admin@sunny.dev / password: "admin123" / role: admin / MFA: disabled for dev
  - Clinician: doctor@sunny.dev / password: "doctor123" / role: clinician
  - Staff: "Sarah" / PIN: 1234 / role: staff

Patients (5 test patients, ages 4-7):
  - Emma S., DOB 2021-01-15 (age 5y 1m)
  - Liam J., DOB 2020-06-20 (age 5y 8m)
  - Olivia M., DOB 2019-11-03 (age 6y 3m)
  - Noah R., DOB 2022-03-10 (age 3y 11m)
  - Ava T., DOB 2019-04-25 (age 6y 10m)

Tablet:
  - "Dev iPad" / device token: "dev-token-123"
```

For dashboard testing, also seed:
- 3-5 historical sessions per patient (spread over 6 months)
- Game results with realistic metrics
- A few flags (amber and red) for Emma and Liam

# API Specification

> Complete endpoint reference for the Kite backend API.
> Base URL: `http://localhost:3000/api/v1` (local), `https://api.kitehealth.io/v1` (prod)

## Authentication

All endpoints require authentication unless marked `Public`.

**Auth Header:** `Authorization: Bearer <jwt_token>`
**Tablet Auth:** `X-Device-Token: <device_token>` + `Authorization: Bearer <tablet_jwt>`

---

## Endpoints

### Auth

#### `POST /auth/login`
**Access:** Public
**Body:**
```json
{
  "email": "doctor@clinic.com",
  "password": "string"
}
```
**Response (200):** Returns partial token (MFA required)
```json
{
  "mfaRequired": true,
  "tempToken": "jwt-temp-token"
}
```
**Response (401):** `{ "error": "Invalid credentials" }`

#### `POST /auth/mfa/verify`
**Access:** Partial auth (temp token)
**Body:**
```json
{
  "tempToken": "jwt-temp-token",
  "totpCode": "123456"
}
```
**Response (200):**
```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "user": {
    "id": "uuid",
    "name": "Dr. Smith",
    "role": "clinician",
    "clinicId": "uuid"
  }
}
```

#### `POST /auth/mfa/setup`
**Access:** Admin (for initial MFA enrollment)
**Response (200):**
```json
{
  "secret": "base32-secret",
  "qrCodeUrl": "otpauth://totp/Kite:user@email?secret=..."
}
```

#### `POST /auth/tablet/verify`
**Access:** Device token required
**Body:**
```json
{
  "pin": "1234"
}
```
**Response (200):**
```json
{
  "accessToken": "jwt-tablet-scoped-token",
  "staffName": "Sarah",
  "clinicName": "Sunny Pediatrics"
}
```

#### `POST /auth/refresh`
**Access:** Refresh token required
**Body:**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```
**Response (200):**
```json
{
  "accessToken": "new-jwt-access-token",
  "refreshToken": "new-jwt-refresh-token"
}
```

---

### Sessions (Tablet → Server)

#### `GET /sessions/patients/today`
**Access:** Staff (tablet)
**Query params:** none (clinic inferred from JWT)
**Response (200):**
```json
{
  "patients": [
    {
      "id": "uuid",
      "firstName": "Emma",
      "lastInitial": "S",
      "ageMonths": 62,
      "ageDisplay": "5 yrs 2 mos",
      "hasSessionToday": false
    }
  ]
}
```
**Note:** Only returns first name + last initial (data minimization). Full name only on dashboard.

#### `POST /sessions`
**Access:** Staff (tablet)
**Body:**
```json
{
  "patientId": "uuid",
  "tabletId": "uuid",
  "consentGivenAt": "2026-02-07T14:30:00Z"
}
```
**Response (201):**
```json
{
  "sessionId": "uuid",
  "patientAgeMonths": 62,
  "gamesConfig": {
    "games": ["cloud_catch", "star_sequence", "wind_trails", "sky_sort"],
    "difficultyPreset": "age_5"
  }
}
```

#### `POST /sessions/:sessionId/events`
**Access:** Staff (tablet)
**Body:**
```json
{
  "gameType": "cloud_catch",
  "startedAt": "2026-02-07T14:31:00Z",
  "completedAt": "2026-02-07T14:33:30Z",
  "durationMs": 150000,
  "events": [
    {
      "type": "stimulus",
      "stimulusId": "cloud-001",
      "stimulusType": "golden",
      "spawnTimestamp": 1200,
      "spawnPosition": { "x": 0.5, "y": 0.1 },
      "speed": 0.3
    },
    {
      "type": "tap",
      "timestamp": 1850,
      "position": { "x": 0.52, "y": 0.35 },
      "targetId": "cloud-001",
      "correct": true,
      "reactionTimeMs": 650
    }
  ]
}
```
**Response (201):** `{ "gameResultId": "uuid" }`
**Note:** Coordinates are normalized 0-1 (fraction of screen size).

#### `PATCH /sessions/:sessionId/complete`
**Access:** Staff (tablet)
**Body:**
```json
{
  "completedAt": "2026-02-07T14:45:00Z",
  "gamesCompleted": 4,
  "totalDurationMs": 840000
}
```
**Response (200):**
```json
{
  "sessionId": "uuid",
  "status": "completed",
  "metricsComputed": true
}
```
**Side effect:** Triggers async metric computation and flag generation.

---

### Dashboard (Web → Server)

#### `GET /dashboard/patients`
**Access:** Clinician
**Query params:**
- `page` (default: 1)
- `limit` (default: 50)
- `search` (name search, optional)
- `status` (filter: `all` | `flagged` | `red`, default: `all`)
- `sort` (field name, default: `lastVisit`)
- `order` (`asc` | `desc`, default: `desc`)

**Response (200):**
```json
{
  "patients": [
    {
      "id": "uuid",
      "firstName": "Emma",
      "lastName": "Smith",
      "dateOfBirth": "2021-01-15",
      "ageMonths": 62,
      "ageDisplay": "5 yrs 2 mos",
      "totalSessions": 4,
      "lastVisit": "2026-02-07",
      "flagStatus": "amber",
      "activeFlagCount": 2
    }
  ],
  "total": 87,
  "page": 1,
  "limit": 50
}
```

#### `GET /dashboard/patients/:patientId`
**Access:** Clinician
**Response (200):**
```json
{
  "patient": {
    "id": "uuid",
    "firstName": "Emma",
    "lastName": "Smith",
    "dateOfBirth": "2021-01-15",
    "ageMonths": 62,
    "guardianName": "Jennifer Smith"
  },
  "sessions": [
    {
      "id": "uuid",
      "date": "2026-02-07",
      "ageMonths": 62,
      "gamesPlayed": 4,
      "durationMs": 840000,
      "games": [
        {
          "gameType": "cloud_catch",
          "metrics": {
            "attention_accuracy": 0.82,
            "reaction_time_mean": 620,
            "reaction_time_cv": 0.24,
            "false_positive_rate": 0.08,
            "attention_decay": 0.91
          }
        }
      ]
    }
  ]
}
```

#### `GET /dashboard/patients/:patientId/metrics`
**Access:** Clinician
**Query params:**
- `metricName` (optional, filter to specific metric)
- `gameType` (optional, filter to specific game)
- `from` (ISO date, optional)
- `to` (ISO date, optional)

**Response (200):**
```json
{
  "metrics": [
    {
      "metricName": "attention_accuracy",
      "gameType": "cloud_catch",
      "dataPoints": [
        {
          "sessionId": "uuid",
          "date": "2025-08-15",
          "ageMonths": 56,
          "value": 0.75,
          "percentile": 42
        },
        {
          "sessionId": "uuid",
          "date": "2025-11-10",
          "ageMonths": 59,
          "value": 0.80,
          "percentile": 51
        },
        {
          "sessionId": "uuid",
          "date": "2026-02-07",
          "ageMonths": 62,
          "value": 0.82,
          "percentile": 55
        }
      ],
      "trend": "improving",
      "latestPercentile": 55
    }
  ]
}
```

#### `GET /dashboard/patients/:patientId/flags`
**Access:** Clinician
**Query params:**
- `includesDismissed` (boolean, default: false)

**Response (200):**
```json
{
  "flags": [
    {
      "id": "uuid",
      "severity": "amber",
      "flagType": "below_threshold",
      "metricName": "reaction_time_cv",
      "gameType": "cloud_catch",
      "description": "Reaction time variability is in the 12th percentile for age. This may indicate inconsistent attention.",
      "currentValue": 0.38,
      "thresholdPercentile": 15,
      "actualPercentile": 12,
      "createdAt": "2026-02-07T15:00:00Z",
      "isDismissed": false
    }
  ]
}
```

#### `PATCH /dashboard/flags/:flagId/dismiss`
**Access:** Clinician
**Body:**
```json
{
  "reason": "Reviewed with family, no concerns at this time"
}
```
**Response (200):** `{ "success": true }`

---

### Admin

#### `GET /admin/staff`
**Access:** Admin
**Response (200):**
```json
{
  "staff": [
    {
      "id": "uuid",
      "name": "Sarah Johnson",
      "email": "sarah@clinic.com",
      "role": "clinician",
      "isActive": true,
      "createdAt": "2025-06-01"
    }
  ]
}
```

#### `POST /admin/staff`
**Access:** Admin
**Body:**
```json
{
  "name": "New Staff Member",
  "email": "new@clinic.com",
  "role": "clinician",
  "pin": "1234"
}
```

#### `DELETE /admin/staff/:staffId`
**Access:** Admin
**Response (200):** `{ "success": true }`
**Note:** Soft delete — sets `is_active = false`.

#### `PATCH /admin/staff/:staffId/reset-pin`
**Access:** Admin
**Body:** `{ "newPin": "5678" }`

#### `GET /admin/tablets`
**Access:** Admin

#### `POST /admin/tablets`
**Access:** Admin
**Body:** `{ "deviceName": "Waiting Room iPad 1" }`
**Response (201):**
```json
{
  "tabletId": "uuid",
  "deviceToken": "generated-device-token",
  "pairingQrCode": "data:image/png;base64,..."
}
```

#### `POST /admin/patients/import`
**Access:** Admin
**Body:** `multipart/form-data` with CSV file
**CSV Format:**
```
first_name,last_name,date_of_birth,mrn,guardian_name
Emma,Smith,2021-01-15,MRN-001,Jennifer Smith
```
**Response (200):**
```json
{
  "imported": 45,
  "skipped": 3,
  "errors": [
    { "row": 12, "error": "Missing date_of_birth" }
  ]
}
```

#### `GET /admin/analytics`
**Access:** Admin
**Query params:**
- `period`: `day` | `week` | `month` (default: `week`)
- `from` (ISO date)
- `to` (ISO date)

**Response (200):**
```json
{
  "totalPatients": 87,
  "totalSessions": 312,
  "activeTablets": 3,
  "sessionsPerPeriod": [
    { "date": "2026-02-03", "count": 12 },
    { "date": "2026-02-04", "count": 15 }
  ],
  "avgPlayDurationMs": 720000,
  "completionRate": 0.86
}
```

#### `DELETE /admin/patients/:patientId/data`
**Access:** Admin
**Description:** COPPA data deletion. Removes all sessions, game results, metrics, and flags for a patient. Patient record is anonymized (encrypted fields cleared, replaced with "[DELETED]").
**Response (200):** `{ "success": true, "sessionsDeleted": 4, "metricsDeleted": 48 }`

---

## Error Response Format

All errors follow a consistent format:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error message",
    "details": { }
  }
}
```

**Error Codes:**
| Code | HTTP Status | Meaning |
|------|------------|---------|
| `VALIDATION_ERROR` | 400 | Request body failed Zod validation |
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `MFA_REQUIRED` | 401 | Valid credentials but MFA not completed |
| `FORBIDDEN` | 403 | Valid auth but insufficient role |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate resource (e.g., patient already exists) |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error (no details exposed) |

import { http, HttpResponse } from 'msw'
import type {
  User,
  LoginResponse,
  MfaVerifyResponse,
  RefreshResponse,
  PatientListItem,
  PatientsResponse,
  PatientDetail,
  PatientDetailResponse,
  SessionSummary,
  MetricSeries,
  MetricsResponse,
  Flag,
  FlagsResponse,
  StaffMember,
  Tablet,
  TabletRegistration,
  ImportResult,
  AnalyticsData,
  ApiError,
  FlagStatus,
  GameType,
} from '@/types/api'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const BASE = '/api/v1'

const uuid = (prefix: string, index: number): string =>
  `${prefix}-${String(index).padStart(3, '0')}`

const randomDate = (daysAgo: number): string => {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Mock Users
// ---------------------------------------------------------------------------

const mockUsers: Record<string, { password: string; user: User }> = {
  'doctor@sunny.dev': {
    password: 'doctor123',
    user: {
      id: 'user-001',
      name: 'Dr. Sarah Chen',
      role: 'clinician',
      clinicId: 'clinic-001',
    },
  },
  'admin@sunny.dev': {
    password: 'admin123',
    user: {
      id: 'user-002',
      name: 'Dr. Admin',
      role: 'admin',
      clinicId: 'clinic-001',
    },
  },
}

const VALID_MFA_CODE = '123456'
const TEMP_TOKEN = 'mock-temp-token-abc'
const ACCESS_TOKEN = 'mock-access-token-xyz'
const REFRESH_TOKEN = 'mock-refresh-token-123'

// ---------------------------------------------------------------------------
// Mock Patients (4 demo patients)
// ---------------------------------------------------------------------------

const firstNames = ['Patrick', 'Anh', 'Matheus', 'My']
const lastNames = ['King', 'Mai', 'Maldaner', 'Pham']
const flagStatuses: FlagStatus[] = ['green', 'green', 'red', 'red']
const activeFlagCounts = [0, 0, 3, 3]
const sessionCounts = [3, 3, 5, 5]
const ageMonthsValues = [66, 72, 60, 54]

const formatAge = (months: number): string => {
  const years = Math.floor(months / 12)
  const remaining = months % 12
  return `${String(years)} yrs ${String(remaining)} mos`
}

const makeDob = (ageMonths: number): string => {
  const d = new Date()
  d.setMonth(d.getMonth() - ageMonths)
  return d.toISOString().slice(0, 10)
}

const mockPatients: PatientListItem[] = firstNames.map((first, i) => ({
  id: uuid('patient', i + 1),
  firstName: first,
  lastName: lastNames[i],
  dateOfBirth: makeDob(ageMonthsValues[i]),
  ageMonths: ageMonthsValues[i],
  ageDisplay: formatAge(ageMonthsValues[i]),
  totalSessions: sessionCounts[i],
  lastVisit: randomDate(i * 3),
  flagStatus: flagStatuses[i],
  activeFlagCount: activeFlagCounts[i],
}))

// ---------------------------------------------------------------------------
// Mock Patient Detail + Sessions
// ---------------------------------------------------------------------------

const gameTypes: GameType[] = ['cloud_catch', 'star_sequence', 'sky_balance', 'breeze_spells']

const gameMetricsForType = (gt: GameType, patientIdx: number, sessionIdx: number): Record<string, number> => {
  const isMatheus = patientIdx === 2
  const isMy = patientIdx === 3

  switch (gt) {
    case 'cloud_catch':
      if (isMatheus) {
        return {
          attention_accuracy: +(0.62 - sessionIdx * 0.01).toFixed(2),
          reaction_time_mean: 850 - sessionIdx * 10,
          reaction_time_cv: +(0.42 + sessionIdx * 0.01).toFixed(2),
          false_positive_rate: +(0.22 - sessionIdx * 0.005).toFixed(3),
          attention_decay: +(0.72 + sessionIdx * 0.01).toFixed(2),
        }
      }
      return {
        attention_accuracy: +(0.78 + sessionIdx * 0.03).toFixed(2),
        reaction_time_mean: 580 - sessionIdx * 20,
        reaction_time_cv: +(0.18 - sessionIdx * 0.01).toFixed(2),
        false_positive_rate: +(0.06 - sessionIdx * 0.005).toFixed(3),
        attention_decay: +(0.92 + sessionIdx * 0.02).toFixed(2),
      }
    case 'star_sequence':
      if (isMatheus) {
        return {
          max_sequence_length: 2,
          memory_accuracy: +(0.38 + sessionIdx * 0.01).toFixed(2),
          learning_rate: +(0.005).toFixed(3),
        }
      }
      return {
        max_sequence_length: 4 + Math.min(sessionIdx, 2),
        memory_accuracy: +(0.65 + sessionIdx * 0.04).toFixed(2),
        learning_rate: +(0.04 + sessionIdx * 0.005).toFixed(3),
      }
    case 'sky_balance':
      if (isMy) {
        return {
          balance_stability: +(0.45 + sessionIdx * 0.005).toFixed(3),
          tilt_variability: +(0.35 + sessionIdx * 0.005).toFixed(3),
          correction_smoothness: +(0.55 + sessionIdx * 0.005).toFixed(3),
          max_balls_balanced: 2,
          avg_balls_balanced: +(1.0 + sessionIdx * 0.1).toFixed(1),
          drop_rate: +(22 - sessionIdx * 0.5).toFixed(1),
          avg_time_on_plank: 4000 + sessionIdx * 200,
        }
      }
      return {
        balance_stability: +(0.15 - sessionIdx * 0.01).toFixed(3),
        tilt_variability: +(0.10 - sessionIdx * 0.005).toFixed(3),
        correction_smoothness: +(0.22 - sessionIdx * 0.01).toFixed(3),
        max_balls_balanced: 5 + Math.min(sessionIdx, 3),
        avg_balls_balanced: +(3.0 + sessionIdx * 0.3).toFixed(1),
        drop_rate: +(6 - sessionIdx * 0.5).toFixed(1),
        avg_time_on_plank: 14000 + sessionIdx * 1000,
      }
    case 'breeze_spells':
      return {
        gesture_accuracy: +(0.72 + sessionIdx * 0.03).toFixed(2),
        avg_cast_time: 1600 - sessionIdx * 80,
        spells_completed: 6 + sessionIdx,
      }
    default:
      return {}
  }
}

const makeSession = (patientIdx: number, sessionIdx: number): SessionSummary => ({
  id: uuid(`session-p${String(patientIdx + 1)}`, sessionIdx + 1),
  date: randomDate(sessionIdx * 30 + 10),
  ageMonths: ageMonthsValues[patientIdx] - sessionIdx * 3,
  gamesPlayed: 4,
  durationMs: 600000 + Math.floor(Math.random() * 300000),
  games: gameTypes.map((gt) => ({
    gameType: gt,
    metrics: gameMetricsForType(gt, patientIdx, sessionIdx),
  })),
})

const guardianNames = ['James King', 'Linh Mai', 'Lucas Maldaner', 'Trang Pham']

const makePatientDetail = (idx: number): PatientDetail => ({
  id: uuid('patient', idx + 1),
  firstName: firstNames[idx],
  lastName: lastNames[idx],
  dateOfBirth: makeDob(ageMonthsValues[idx]),
  ageMonths: ageMonthsValues[idx],
  guardianName: guardianNames[idx] ?? null,
})

const patientSessions: Record<string, SessionSummary[]> = {}
for (let i = 0; i < 4; i++) {
  const count = sessionCounts[i]
  patientSessions[uuid('patient', i + 1)] = Array.from(
    { length: count },
    (_, s) => makeSession(i, s),
  )
}

// ---------------------------------------------------------------------------
// Mock Metrics (time series for all 4 patients)
// ---------------------------------------------------------------------------

const makeMetricSeries = (patientIdx: number): MetricSeries[] => {
  const isMatheus = patientIdx === 2
  const isMy = patientIdx === 3
  const numPoints = sessionCounts[patientIdx]

  if (isMatheus) {
    // Matheus: declining attention, poor sequence metrics
    return [
      {
        metricName: 'attention_accuracy',
        gameType: 'cloud_catch',
        dataPoints: Array.from({ length: numPoints }, (_, i) => ({
          sessionId: uuid(`session-p3`, i + 1),
          date: randomDate((numPoints - 1 - i) * 60),
          ageMonths: ageMonthsValues[patientIdx] - (numPoints - 1 - i) * 3,
          value: +(0.65 - i * 0.015).toFixed(2),
          percentile: 22 - i * 2,
        })),
        trend: 'declining',
        latestPercentile: 12,
      },
      {
        metricName: 'reaction_time_cv',
        gameType: 'cloud_catch',
        dataPoints: Array.from({ length: numPoints }, (_, i) => ({
          sessionId: uuid(`session-p3`, i + 1),
          date: randomDate((numPoints - 1 - i) * 60),
          ageMonths: ageMonthsValues[patientIdx] - (numPoints - 1 - i) * 3,
          value: +(0.38 + i * 0.01).toFixed(2),
          percentile: 14 - i,
        })),
        trend: 'declining',
        latestPercentile: 11,
      },
      {
        metricName: 'max_sequence_length',
        gameType: 'star_sequence',
        dataPoints: Array.from({ length: numPoints }, (_, i) => ({
          sessionId: uuid(`session-p3`, i + 1),
          date: randomDate((numPoints - 1 - i) * 60),
          ageMonths: ageMonthsValues[patientIdx] - (numPoints - 1 - i) * 3,
          value: 2,
          percentile: 3,
        })),
        trend: 'stable',
        latestPercentile: 3,
      },
      {
        metricName: 'memory_accuracy',
        gameType: 'star_sequence',
        dataPoints: Array.from({ length: numPoints }, (_, i) => ({
          sessionId: uuid(`session-p3`, i + 1),
          date: randomDate((numPoints - 1 - i) * 60),
          ageMonths: ageMonthsValues[patientIdx] - (numPoints - 1 - i) * 3,
          value: +(0.38 + i * 0.01).toFixed(2),
          percentile: 8 + i,
        })),
        trend: 'stable',
        latestPercentile: 12,
      },
    ]
  }

  if (isMy) {
    // My: poor balance/motor metrics
    return [
      {
        metricName: 'balance_stability',
        gameType: 'sky_balance',
        dataPoints: Array.from({ length: numPoints }, (_, i) => ({
          sessionId: uuid(`session-p4`, i + 1),
          date: randomDate((numPoints - 1 - i) * 60),
          ageMonths: ageMonthsValues[patientIdx] - (numPoints - 1 - i) * 3,
          value: +(0.45 + i * 0.005).toFixed(3),
          percentile: 4,
        })),
        trend: 'stable',
        latestPercentile: 4,
      },
      {
        metricName: 'drop_rate',
        gameType: 'sky_balance',
        dataPoints: Array.from({ length: numPoints }, (_, i) => ({
          sessionId: uuid(`session-p4`, i + 1),
          date: randomDate((numPoints - 1 - i) * 60),
          ageMonths: ageMonthsValues[patientIdx] - (numPoints - 1 - i) * 3,
          value: +(22 - i * 0.5).toFixed(1),
          percentile: 13,
        })),
        trend: 'stable',
        latestPercentile: 13,
      },
      {
        metricName: 'tilt_variability',
        gameType: 'sky_balance',
        dataPoints: Array.from({ length: numPoints }, (_, i) => ({
          sessionId: uuid(`session-p4`, i + 1),
          date: randomDate((numPoints - 1 - i) * 60),
          ageMonths: ageMonthsValues[patientIdx] - (numPoints - 1 - i) * 3,
          value: +(0.35 + i * 0.005).toFixed(3),
          percentile: 8,
        })),
        trend: 'stable',
        latestPercentile: 8,
      },
      {
        metricName: 'attention_accuracy',
        gameType: 'cloud_catch',
        dataPoints: Array.from({ length: numPoints }, (_, i) => ({
          sessionId: uuid(`session-p4`, i + 1),
          date: randomDate((numPoints - 1 - i) * 60),
          ageMonths: ageMonthsValues[patientIdx] - (numPoints - 1 - i) * 3,
          value: +(0.76 + i * 0.02).toFixed(2),
          percentile: 45 + i * 3,
        })),
        trend: 'improving',
        latestPercentile: 55,
      },
    ]
  }

  // Patrick & Anh: healthy improving trends
  return [
    {
      metricName: 'attention_accuracy',
      gameType: 'cloud_catch',
      dataPoints: Array.from({ length: numPoints }, (_, i) => ({
        sessionId: uuid(`session-p${String(patientIdx + 1)}`, i + 1),
        date: randomDate((numPoints - 1 - i) * 90),
        ageMonths: ageMonthsValues[patientIdx] - (numPoints - 1 - i) * 3,
        value: +(0.78 + i * 0.04).toFixed(2),
        percentile: 50 + i * 8,
      })),
      trend: 'improving',
      latestPercentile: 66,
    },
    {
      metricName: 'reaction_time_mean',
      gameType: 'cloud_catch',
      dataPoints: Array.from({ length: numPoints }, (_, i) => ({
        sessionId: uuid(`session-p${String(patientIdx + 1)}`, i + 1),
        date: randomDate((numPoints - 1 - i) * 90),
        ageMonths: ageMonthsValues[patientIdx] - (numPoints - 1 - i) * 3,
        value: 580 - i * 25,
        percentile: 48 + i * 6,
      })),
      trend: 'improving',
      latestPercentile: 60,
    },
    {
      metricName: 'max_sequence_length',
      gameType: 'star_sequence',
      dataPoints: Array.from({ length: numPoints }, (_, i) => ({
        sessionId: uuid(`session-p${String(patientIdx + 1)}`, i + 1),
        date: randomDate((numPoints - 1 - i) * 90),
        ageMonths: ageMonthsValues[patientIdx] - (numPoints - 1 - i) * 3,
        value: 4 + Math.min(i, 2),
        percentile: 45 + i * 10,
      })),
      trend: 'improving',
      latestPercentile: 62,
    },
    {
      metricName: 'balance_stability',
      gameType: 'sky_balance',
      dataPoints: Array.from({ length: numPoints }, (_, i) => ({
        sessionId: uuid(`session-p${String(patientIdx + 1)}`, i + 1),
        date: randomDate((numPoints - 1 - i) * 90),
        ageMonths: ageMonthsValues[patientIdx] - (numPoints - 1 - i) * 3,
        value: +(0.15 - i * 0.015).toFixed(3),
        percentile: 52 + i * 5,
      })),
      trend: 'improving',
      latestPercentile: 62,
    },
  ]
}

// ---------------------------------------------------------------------------
// Mock Flags
// ---------------------------------------------------------------------------

const patientFlags: Record<string, Flag[]> = {
  // Matheus Maldaner (patient-003) - red + 2 amber flags
  [uuid('patient', 3)]: [
    {
      id: uuid('flag', 1),
      severity: 'red',
      flagType: 'below_threshold',
      metricName: 'max_sequence_length',
      gameType: 'star_sequence',
      description:
        'Maximum sequence length is in the 3rd percentile for age. This is a developmental pattern observation, not a clinical diagnosis.',
      currentValue: 2,
      thresholdPercentile: 5,
      actualPercentile: 3,
      createdAt: '2026-02-05T15:00:00Z',
      isDismissed: false,
      dismissedBy: null,
      dismissedAt: null,
      dismissReason: null,
    },
    {
      id: uuid('flag', 2),
      severity: 'amber',
      flagType: 'below_threshold',
      metricName: 'reaction_time_cv',
      gameType: 'cloud_catch',
      description:
        'Reaction time variability is in the 11th percentile for age. This may indicate inconsistent attention. Note: This is not a diagnosis.',
      currentValue: 0.42,
      thresholdPercentile: 15,
      actualPercentile: 11,
      createdAt: '2026-02-05T15:01:00Z',
      isDismissed: false,
      dismissedBy: null,
      dismissedAt: null,
      dismissReason: null,
    },
    {
      id: uuid('flag', 3),
      severity: 'amber',
      flagType: 'declining_trend',
      metricName: 'attention_accuracy',
      gameType: 'cloud_catch',
      description:
        'Attention accuracy has declined over the last 5 sessions. Current percentile: 12th. Note: This is not a diagnosis.',
      currentValue: 0.58,
      thresholdPercentile: 20,
      actualPercentile: 12,
      createdAt: '2026-02-05T15:02:00Z',
      isDismissed: false,
      dismissedBy: null,
      dismissedAt: null,
      dismissReason: null,
    },
  ],
  // My Pham (patient-004) - red + 2 amber flags
  [uuid('patient', 4)]: [
    {
      id: uuid('flag', 4),
      severity: 'red',
      flagType: 'below_threshold',
      metricName: 'balance_stability',
      gameType: 'sky_balance',
      description:
        'Balance stability is in the 4th percentile for age. This is a developmental pattern observation, not a clinical diagnosis.',
      currentValue: 0.45,
      thresholdPercentile: 5,
      actualPercentile: 4,
      createdAt: '2026-02-06T10:30:00Z',
      isDismissed: false,
      dismissedBy: null,
      dismissedAt: null,
      dismissReason: null,
    },
    {
      id: uuid('flag', 5),
      severity: 'amber',
      flagType: 'below_threshold',
      metricName: 'drop_rate',
      gameType: 'sky_balance',
      description:
        'Drop rate is in the 13th percentile for age. This is a developmental pattern observation, not a clinical diagnosis.',
      currentValue: 22,
      thresholdPercentile: 15,
      actualPercentile: 13,
      createdAt: '2026-02-06T10:31:00Z',
      isDismissed: false,
      dismissedBy: null,
      dismissedAt: null,
      dismissReason: null,
    },
    {
      id: uuid('flag', 6),
      severity: 'amber',
      flagType: 'high_variability',
      metricName: 'tilt_variability',
      gameType: 'sky_balance',
      description:
        'Tilt variability is unusually high for age. This is a developmental pattern observation, not a clinical diagnosis.',
      currentValue: 0.35,
      thresholdPercentile: null,
      actualPercentile: 8,
      createdAt: '2026-02-06T10:32:00Z',
      isDismissed: false,
      dismissedBy: null,
      dismissedAt: null,
      dismissReason: null,
    },
  ],
}

// ---------------------------------------------------------------------------
// Mock Staff (5 members)
// ---------------------------------------------------------------------------

const mockStaff: StaffMember[] = [
  {
    id: 'staff-001',
    name: 'Dr. Sarah Chen',
    email: 'doctor@sunny.dev',
    role: 'clinician',
    isActive: true,
    createdAt: '2025-06-01',
  },
  {
    id: 'staff-002',
    name: 'Dr. Admin',
    email: 'admin@sunny.dev',
    role: 'admin',
    isActive: true,
    createdAt: '2025-05-15',
  },
  {
    id: 'staff-003',
    name: 'Nurse Emily Park',
    email: 'emily@sunny.dev',
    role: 'staff',
    isActive: true,
    createdAt: '2025-07-20',
  },
  {
    id: 'staff-004',
    name: 'Dr. James Morton',
    email: 'james@sunny.dev',
    role: 'clinician',
    isActive: true,
    createdAt: '2025-08-10',
  },
  {
    id: 'staff-005',
    name: 'Receptionist Lily Tran',
    email: 'lily@sunny.dev',
    role: 'staff',
    isActive: false,
    createdAt: '2025-09-01',
  },
]

// ---------------------------------------------------------------------------
// Mock Tablets (3, one inactive)
// ---------------------------------------------------------------------------

const mockTablets: Tablet[] = [
  {
    id: 'tablet-001',
    deviceName: 'Waiting Room iPad 1',
    model: 'iPad Pro 11"',
    lastSeenAt: '2026-02-07T09:15:00Z',
    isActive: true,
    registeredAt: '2025-06-01T08:00:00Z',
  },
  {
    id: 'tablet-002',
    deviceName: 'Waiting Room iPad 2',
    model: 'iPad Air 5',
    lastSeenAt: '2026-02-07T10:30:00Z',
    isActive: true,
    registeredAt: '2025-07-15T08:00:00Z',
  },
  {
    id: 'tablet-003',
    deviceName: 'Storage Closet iPad',
    model: 'iPad 10th Gen',
    lastSeenAt: '2025-12-20T14:00:00Z',
    isActive: false,
    registeredAt: '2025-08-01T08:00:00Z',
  },
]

// ---------------------------------------------------------------------------
// Mock Analytics (30 days of session data)
// ---------------------------------------------------------------------------

const sessionsPerPeriod: Array<{ date: string; count: number }> = Array.from(
  { length: 30 },
  (_, i) => ({
    date: randomDate(29 - i),
    count: Math.floor(2 + Math.random() * 6),
  }),
)

const mockAnalytics: AnalyticsData = {
  totalPatients: 4,
  totalSessions: 16,
  activeTablets: 2,
  sessionsPerPeriod,
  avgPlayDurationMs: 720000,
  completionRate: 0.86,
}

// ---------------------------------------------------------------------------
// Helpers for auth validation in handlers
// ---------------------------------------------------------------------------

let storedUser: User | null = null

const unauthorized = (message = 'Unauthorized'): ReturnType<typeof HttpResponse.json> => {
  const body: ApiError = {
    error: { code: 'UNAUTHORIZED', message },
  }
  return HttpResponse.json(body, { status: 401 })
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const handlers = [
  // -----------------------------------------------------------------------
  // Auth
  // -----------------------------------------------------------------------

  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string }
    const entry = mockUsers[body.email]

    if (!entry || entry.password !== body.password) {
      return unauthorized('Invalid credentials')
    }

    storedUser = entry.user

    const data: LoginResponse = {
      mfaRequired: true,
      tempToken: TEMP_TOKEN,
    }
    return HttpResponse.json(data)
  }),

  http.post(`${BASE}/auth/mfa/verify`, async ({ request }) => {
    const body = (await request.json()) as { tempToken: string; totpCode: string }

    if (body.tempToken !== TEMP_TOKEN || body.totpCode !== VALID_MFA_CODE) {
      return unauthorized('Invalid MFA code')
    }

    if (!storedUser) {
      return unauthorized('No login session found')
    }

    const data: MfaVerifyResponse = {
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      user: storedUser,
    }
    return HttpResponse.json(data)
  }),

  http.post(`${BASE}/auth/refresh`, async ({ request }) => {
    const body = (await request.json()) as { refreshToken: string }

    if (!body.refreshToken) {
      return unauthorized('Invalid refresh token')
    }

    const data: RefreshResponse = {
      accessToken: `${ACCESS_TOKEN}-refreshed-${String(Date.now())}`,
      refreshToken: `${REFRESH_TOKEN}-refreshed-${String(Date.now())}`,
    }
    return HttpResponse.json(data)
  }),

  // -----------------------------------------------------------------------
  // Dashboard - Patients
  // -----------------------------------------------------------------------

  http.get(`${BASE}/dashboard/patients`, ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') ?? '1', 10)
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)
    const search = url.searchParams.get('search')?.toLowerCase() ?? ''
    const status = url.searchParams.get('status') ?? 'all'
    const sort = url.searchParams.get('sort') ?? 'lastVisit'
    const order = url.searchParams.get('order') ?? 'desc'

    let filtered = [...mockPatients]

    // Search filter
    if (search) {
      filtered = filtered.filter(
        (p) =>
          p.firstName.toLowerCase().includes(search) ||
          p.lastName.toLowerCase().includes(search),
      )
    }

    // Status filter
    if (status === 'flagged') {
      filtered = filtered.filter((p) => p.flagStatus !== 'green')
    } else if (status === 'red') {
      filtered = filtered.filter((p) => p.flagStatus === 'red')
    }

    // Sort
    filtered.sort((a, b) => {
      const key = sort as keyof PatientListItem
      const aVal = a[key]
      const bVal = b[key]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return order === 'asc' ? aVal - bVal : bVal - aVal
      }
      return 0
    })

    // Paginate
    const total = filtered.length
    const start = (page - 1) * limit
    const paged = filtered.slice(start, start + limit)

    const data: PatientsResponse = {
      patients: paged,
      total,
      page,
      limit,
    }
    return HttpResponse.json(data)
  }),

  http.get(`${BASE}/dashboard/patients/:patientId`, ({ params }) => {
    const patientId = params.patientId as string
    const idx = mockPatients.findIndex((p) => p.id === patientId)

    if (idx === -1) {
      const body: ApiError = {
        error: { code: 'NOT_FOUND', message: 'Patient not found' },
      }
      return HttpResponse.json(body, { status: 404 })
    }

    const detail = makePatientDetail(idx)
    const sessions = patientSessions[patientId] ?? [makeSession(idx, 0)]

    const data: PatientDetailResponse = {
      patient: detail,
      sessions,
    }
    return HttpResponse.json(data)
  }),

  // -----------------------------------------------------------------------
  // Dashboard - Metrics
  // -----------------------------------------------------------------------

  http.get(`${BASE}/dashboard/patients/:patientId/metrics`, ({ params }) => {
    const patientId = params.patientId as string
    const idx = mockPatients.findIndex((p) => p.id === patientId)

    if (idx === -1) {
      const body: ApiError = {
        error: { code: 'NOT_FOUND', message: 'Patient not found' },
      }
      return HttpResponse.json(body, { status: 404 })
    }

    const data: MetricsResponse = {
      metrics: makeMetricSeries(idx),
    }
    return HttpResponse.json(data)
  }),

  // -----------------------------------------------------------------------
  // Dashboard - Flags
  // -----------------------------------------------------------------------

  http.get(`${BASE}/dashboard/patients/:patientId/flags`, ({ params }) => {
    const patientId = params.patientId as string
    const flags = patientFlags[patientId] ?? []

    const data: FlagsResponse = { flags }
    return HttpResponse.json(data)
  }),

  http.patch(`${BASE}/dashboard/flags/:flagId/dismiss`, async ({ params, request }) => {
    const flagId = params.flagId as string
    const body = (await request.json()) as { reason: string }

    // Find and update the flag in our mock data
    for (const flags of Object.values(patientFlags)) {
      const flag = flags.find((f) => f.id === flagId)
      if (flag) {
        flag.isDismissed = true
        flag.dismissedBy = storedUser?.id ?? 'user-001'
        flag.dismissedAt = new Date().toISOString()
        flag.dismissReason = body.reason
        break
      }
    }

    return HttpResponse.json({ success: true })
  }),

  // -----------------------------------------------------------------------
  // Admin - Staff
  // -----------------------------------------------------------------------

  http.get(`${BASE}/admin/staff`, () => {
    return HttpResponse.json({ staff: mockStaff })
  }),

  http.post(`${BASE}/admin/staff`, async ({ request }) => {
    const body = (await request.json()) as {
      name: string
      email: string
      role: string
      pin: string
    }

    const newStaff: StaffMember = {
      id: `staff-${String(mockStaff.length + 1).padStart(3, '0')}`,
      name: body.name,
      email: body.email,
      role: body.role as StaffMember['role'],
      isActive: true,
      createdAt: new Date().toISOString().slice(0, 10),
    }
    mockStaff.push(newStaff)

    return HttpResponse.json(newStaff, { status: 201 })
  }),

  http.delete(`${BASE}/admin/staff/:staffId`, ({ params }) => {
    const staffId = params.staffId as string
    const member = mockStaff.find((s) => s.id === staffId)
    if (member) {
      member.isActive = false
    }
    return HttpResponse.json({ success: true })
  }),

  http.patch(`${BASE}/admin/staff/:staffId/reset-pin`, () => {
    return HttpResponse.json({ success: true })
  }),

  // -----------------------------------------------------------------------
  // Admin - Tablets
  // -----------------------------------------------------------------------

  http.get(`${BASE}/admin/tablets`, () => {
    return HttpResponse.json({ tablets: mockTablets })
  }),

  http.post(`${BASE}/admin/tablets`, async ({ request }) => {
    const body = (await request.json()) as { deviceName: string }

    const newTablet: Tablet = {
      id: `tablet-${String(mockTablets.length + 1).padStart(3, '0')}`,
      deviceName: body.deviceName,
      model: null,
      lastSeenAt: null,
      isActive: true,
      registeredAt: new Date().toISOString(),
    }
    mockTablets.push(newTablet)

    const registration: TabletRegistration = {
      tabletId: newTablet.id,
      deviceToken: `device-token-${newTablet.id}`,
      pairingQrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    }
    return HttpResponse.json(registration, { status: 201 })
  }),

  // -----------------------------------------------------------------------
  // Admin - Patient Import
  // -----------------------------------------------------------------------

  http.post(`${BASE}/admin/patients/import`, () => {
    const data: ImportResult = {
      imported: 45,
      skipped: 3,
      errors: [
        { row: 12, error: 'Missing date_of_birth' },
        { row: 34, error: 'Duplicate MRN: MRN-034' },
      ],
    }
    return HttpResponse.json(data)
  }),

  // -----------------------------------------------------------------------
  // Admin - Analytics
  // -----------------------------------------------------------------------

  http.get(`${BASE}/admin/analytics`, () => {
    return HttpResponse.json(mockAnalytics)
  }),

  // -----------------------------------------------------------------------
  // Admin - Patient Data Deletion (COPPA)
  // -----------------------------------------------------------------------

  http.delete(`${BASE}/admin/patients/:patientId/data`, () => {
    return HttpResponse.json({
      success: true,
      sessionsDeleted: 4,
      metricsDeleted: 48,
    })
  }),
]

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
// Mock Patients (20)
// ---------------------------------------------------------------------------

const firstNames = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava',
  'Elijah', 'Sophia', 'James', 'Isabella', 'Lucas',
  'Mia', 'Mason', 'Charlotte', 'Ethan', 'Amelia',
  'Logan', 'Harper', 'Aiden', 'Evelyn', 'Jackson',
]

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones',
  'Garcia', 'Miller', 'Davis', 'Martinez', 'Anderson',
  'Taylor', 'Thomas', 'Hernandez', 'Moore', 'Martin',
  'Lee', 'Clark', 'Lewis', 'Robinson', 'Walker',
]

const flagStatuses: FlagStatus[] = [
  'green', 'amber', 'red', 'green', 'green',
  'amber', 'green', 'green', 'green', 'green',
  'green', 'amber', 'green', 'green', 'red',
  'green', 'green', 'green', 'green', 'green',
]

const activeFlagCounts = [
  0, 2, 1, 0, 0,
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 1,
  0, 0, 0, 0, 0,
]

const sessionCounts = [
  4, 6, 3, 2, 5,
  1, 4, 3, 2, 6,
  3, 5, 1, 4, 2,
  3, 6, 1, 5, 4,
]

const ageMonthsValues = [
  62, 48, 72, 55, 84,
  40, 66, 50, 78, 44,
  60, 53, 70, 46, 80,
  58, 42, 75, 64, 52,
]

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
// Mock Patient Detail + Sessions (for first 5 patients)
// ---------------------------------------------------------------------------

const gameTypes: GameType[] = ['cloud_catch', 'star_sequence', 'sky_sigils', 'sky_sort']

const makeSession = (patientIdx: number, sessionIdx: number): SessionSummary => ({
  id: uuid(`session-p${String(patientIdx + 1)}`, sessionIdx + 1),
  date: randomDate(sessionIdx * 30 + 10),
  ageMonths: ageMonthsValues[patientIdx] - sessionIdx * 3,
  gamesPlayed: 4,
  durationMs: 600000 + Math.floor(Math.random() * 300000),
  games: gameTypes.map((gt) => ({
    gameType: gt,
    metrics: {
      attention_accuracy: +(0.65 + Math.random() * 0.3).toFixed(2),
      reaction_time_mean: Math.floor(400 + Math.random() * 400),
      reaction_time_cv: +(0.15 + Math.random() * 0.25).toFixed(2),
      false_positive_rate: +(Math.random() * 0.15).toFixed(2),
      attention_decay: +(0.7 + Math.random() * 0.25).toFixed(2),
    },
  })),
})

const guardianNames = [
  'Jennifer Smith', 'Michael Johnson', 'Maria Williams', 'David Brown', 'Lisa Jones',
]

const makePatientDetail = (idx: number): PatientDetail => ({
  id: uuid('patient', idx + 1),
  firstName: firstNames[idx],
  lastName: lastNames[idx],
  dateOfBirth: makeDob(ageMonthsValues[idx]),
  ageMonths: ageMonthsValues[idx],
  guardianName: idx < guardianNames.length ? guardianNames[idx] : null,
})

const patientSessions: Record<string, SessionSummary[]> = {}
for (let i = 0; i < 5; i++) {
  const count = Math.min(sessionCounts[i], 4)
  patientSessions[uuid('patient', i + 1)] = Array.from(
    { length: count },
    (_, s) => makeSession(i, s),
  )
}

// ---------------------------------------------------------------------------
// Mock Metrics (time series for first 5 patients)
// ---------------------------------------------------------------------------

const makeMetricSeries = (patientIdx: number): MetricSeries[] => {
  const metrics: MetricSeries[] = [
    {
      metricName: 'attention_accuracy',
      gameType: 'cloud_catch',
      dataPoints: Array.from({ length: 4 }, (_, i) => ({
        sessionId: uuid(`session-p${String(patientIdx + 1)}`, i + 1),
        date: randomDate((3 - i) * 90),
        ageMonths: ageMonthsValues[patientIdx] - (3 - i) * 3,
        value: +(0.65 + i * 0.05 + Math.random() * 0.05).toFixed(2),
        percentile: 35 + i * 7 + Math.floor(Math.random() * 5),
      })),
      trend: 'improving',
      latestPercentile: 55,
    },
    {
      metricName: 'reaction_time_mean',
      gameType: 'cloud_catch',
      dataPoints: Array.from({ length: 3 }, (_, i) => ({
        sessionId: uuid(`session-p${String(patientIdx + 1)}`, i + 1),
        date: randomDate((2 - i) * 90),
        ageMonths: ageMonthsValues[patientIdx] - (2 - i) * 3,
        value: 700 - i * 30 + Math.floor(Math.random() * 20),
        percentile: 40 + i * 5,
      })),
      trend: 'improving',
      latestPercentile: 50,
    },
    {
      metricName: 'reaction_time_cv',
      gameType: 'cloud_catch',
      dataPoints: Array.from({ length: 3 }, (_, i) => ({
        sessionId: uuid(`session-p${String(patientIdx + 1)}`, i + 1),
        date: randomDate((2 - i) * 90),
        ageMonths: ageMonthsValues[patientIdx] - (2 - i) * 3,
        value: +(0.35 - i * 0.03 + Math.random() * 0.02).toFixed(2),
        percentile: 15 + i * 5,
      })),
      trend: 'stable',
      latestPercentile: 25,
    },
    {
      metricName: 'sequence_accuracy',
      gameType: 'star_sequence',
      dataPoints: Array.from({ length: 3 }, (_, i) => ({
        sessionId: uuid(`session-p${String(patientIdx + 1)}`, i + 1),
        date: randomDate((2 - i) * 90),
        ageMonths: ageMonthsValues[patientIdx] - (2 - i) * 3,
        value: +(0.6 + i * 0.08 + Math.random() * 0.05).toFixed(2),
        percentile: 30 + i * 10,
      })),
      trend: 'improving',
      latestPercentile: 48,
    },
  ]
  return metrics
}

// ---------------------------------------------------------------------------
// Mock Flags
// ---------------------------------------------------------------------------

const patientFlags: Record<string, Flag[]> = {
  // Patient index 1 (Liam Johnson) - 2 amber flags
  [uuid('patient', 2)]: [
    {
      id: uuid('flag', 1),
      severity: 'amber',
      flagType: 'below_threshold',
      metricName: 'reaction_time_cv',
      gameType: 'cloud_catch',
      description:
        'Reaction time variability is in the 12th percentile for age. This may indicate inconsistent attention. Note: This is not a diagnosis.',
      currentValue: 0.38,
      thresholdPercentile: 15,
      actualPercentile: 12,
      createdAt: '2026-02-05T15:00:00Z',
      isDismissed: false,
      dismissedBy: null,
      dismissedAt: null,
      dismissReason: null,
    },
    {
      id: uuid('flag', 2),
      severity: 'amber',
      flagType: 'declining_trend',
      metricName: 'attention_accuracy',
      gameType: 'cloud_catch',
      description:
        'Attention accuracy has declined over the last 3 sessions. Current percentile: 18th. Note: This is not a diagnosis.',
      currentValue: 0.68,
      thresholdPercentile: 20,
      actualPercentile: 18,
      createdAt: '2026-02-05T15:01:00Z',
      isDismissed: false,
      dismissedBy: null,
      dismissedAt: null,
      dismissReason: null,
    },
  ],
  // Patient index 2 (Olivia Williams) - 1 red flag
  [uuid('patient', 3)]: [
    {
      id: uuid('flag', 3),
      severity: 'red',
      flagType: 'below_threshold',
      metricName: 'reaction_time_mean',
      gameType: 'cloud_catch',
      description:
        'Mean reaction time is in the 5th percentile for age. Consistently slower responses may warrant further evaluation. Note: This is not a diagnosis.',
      currentValue: 920,
      thresholdPercentile: 10,
      actualPercentile: 5,
      createdAt: '2026-02-06T10:30:00Z',
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
    count: Math.floor(5 + Math.random() * 15),
  }),
)

const mockAnalytics: AnalyticsData = {
  totalPatients: 20,
  totalSessions: 68,
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

export type UserRole = 'admin' | 'clinician' | 'staff'

export type FlagSeverity = 'amber' | 'red'
export type FlagStatus = 'green' | 'amber' | 'red'
export type FlagType = 'below_threshold' | 'declining_trend' | 'high_variability'
export type GameType = 'cloud_catch' | 'star_sequence' | 'sky_sigils'
export type TrendDirection = 'improving' | 'stable' | 'declining'

export interface User {
  id: string
  name: string
  role: UserRole
  clinicId: string
}

export interface LoginResponse {
  mfaRequired: boolean
  tempToken: string
}

export interface MfaVerifyResponse {
  accessToken: string
  refreshToken: string
  user: User
}

export interface RefreshResponse {
  accessToken: string
  refreshToken: string
}

export interface PatientListItem {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string
  ageMonths: number
  ageDisplay: string
  totalSessions: number
  lastVisit: string
  flagStatus: FlagStatus
  activeFlagCount: number
}

export interface PatientsResponse {
  patients: PatientListItem[]
  total: number
  page: number
  limit: number
}

export interface GameMetrics {
  gameType: GameType
  metrics: Record<string, number>
}

export interface SessionSummary {
  id: string
  date: string
  ageMonths: number
  gamesPlayed: number
  durationMs: number
  games: GameMetrics[]
}

export interface PatientDetail {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string
  ageMonths: number
  guardianName: string | null
}

export interface PatientDetailResponse {
  patient: PatientDetail
  sessions: SessionSummary[]
}

export interface MetricDataPoint {
  sessionId: string
  date: string
  ageMonths: number
  value: number
  percentile: number | null
}

export interface MetricSeries {
  metricName: string
  gameType: GameType
  dataPoints: MetricDataPoint[]
  trend: TrendDirection
  latestPercentile: number | null
}

export interface MetricsResponse {
  metrics: MetricSeries[]
}

export interface Flag {
  id: string
  severity: FlagSeverity
  flagType: FlagType
  metricName: string
  gameType: GameType
  description: string
  currentValue: number | null
  thresholdPercentile: number | null
  actualPercentile: number | null
  createdAt: string
  isDismissed: boolean
  dismissedBy: string | null
  dismissedAt: string | null
  dismissReason: string | null
}

export interface FlagsResponse {
  flags: Flag[]
}

export interface StaffMember {
  id: string
  name: string
  email: string | null
  role: UserRole
  isActive: boolean
  createdAt: string
}

export interface Tablet {
  id: string
  deviceName: string
  model: string | null
  lastSeenAt: string | null
  isActive: boolean
  registeredAt: string
}

export interface TabletRegistration {
  tabletId: string
  deviceToken: string
  pairingQrCode: string
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: Array<{ row: number; error: string }>
}

export interface AnalyticsData {
  totalPatients: number
  totalSessions: number
  activeTablets: number
  sessionsPerPeriod: Array<{ date: string; count: number }>
  avgPlayDurationMs: number
  completionRate: number
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

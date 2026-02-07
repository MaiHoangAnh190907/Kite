// ---- Auth ----
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  mfaRequired: boolean;
  tempToken: string;
}

export interface MfaVerifyRequest {
  tempToken: string;
  totpCode: string;
}

export interface MfaSetupResponse {
  secret: string;
  qrCodeUrl: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  clinicId: string;
}

export type UserRole = 'admin' | 'clinician' | 'staff';

export interface TabletVerifyRequest {
  pin: string;
}

export interface TabletVerifyResponse {
  accessToken: string;
  staffName: string;
  clinicName: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

// ---- Patients ----
export interface PatientSummary {
  id: string;
  firstName: string;
  lastInitial: string;
  ageMonths: number;
  ageDisplay: string;
  hasSessionToday: boolean;
}

export interface PatientDetail {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ageMonths: number;
  guardianName: string | null;
}

export interface PatientListItem {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ageMonths: number;
  ageDisplay: string;
  totalSessions: number;
  lastVisit: string | null;
  flagStatus: FlagSeverity | 'green';
  activeFlagCount: number;
}

// ---- Sessions ----
export interface CreateSessionRequest {
  patientId: string;
  tabletId: string;
  consentGivenAt: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  patientAgeMonths: number;
  gamesConfig: GamesConfig;
}

export interface GamesConfig {
  games: GameType[];
  difficultyPreset: string;
}

export type GameType = 'cloud_catch' | 'star_sequence' | 'wind_trails' | 'sky_sort';

export interface CompleteSessionRequest {
  completedAt: string;
  gamesCompleted: number;
  totalDurationMs: number;
}

export interface CompleteSessionResponse {
  sessionId: string;
  status: string;
  metricsComputed: boolean;
}

// ---- Game Events ----
export interface GameEventsUpload {
  gameType: GameType;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  events: GameEvent[];
}

export type GameEvent =
  | StimulusEvent
  | TapEvent
  | MissEvent
  | RoundEvent
  | TraceEvent
  | PathCompleteEvent
  | SortEvent
  | RuleSwitchEvent;

export interface StimulusEvent {
  type: 'stimulus';
  stimulusId: string;
  stimulusType: string;
  spawnTimestamp: number;
  spawnPosition: { x: number; y: number };
  speed: number;
}

export interface TapEvent {
  type: 'tap';
  timestamp: number;
  position: { x: number; y: number };
  targetId: string | null;
  correct: boolean;
  reactionTimeMs: number;
}

export interface MissEvent {
  type: 'miss';
  stimulusId: string;
  stimulusType: string;
  timeOnScreen: number;
}

export interface RoundEvent {
  type: 'round';
  roundNumber: number;
  sequenceLength: number;
  sequenceShown: number[];
  sequenceTapped: number[];
  correct: boolean;
  tapTimestamps: number[];
  interTapIntervals: number[];
}

export interface TraceEvent {
  type: 'trace';
  pathIndex: number;
  timestamp: number;
  fingerPosition: { x: number; y: number };
  idealPosition: { x: number; y: number };
  deviation: number;
  pressure: number | null;
  speed: number;
}

export interface PathCompleteEvent {
  type: 'path_complete';
  pathIndex: number;
  duration: number;
  meanDeviation: number;
  maxDeviation: number;
  completionPercent: number;
  smoothnessScore: number;
}

export interface SortEvent {
  type: 'sort';
  objectId: string;
  objectType: string;
  objectColor: string;
  objectSize: string;
  currentRule: string;
  spawnTimestamp: number;
  sortTimestamp: number;
  direction: 'left' | 'right';
  correct: boolean;
  reactionTimeMs: number;
}

export interface RuleSwitchEvent {
  type: 'rule_switch';
  fromRule: string;
  toRule: string;
  timestamp: number;
  firstSortAfterSwitch: { reactionTimeMs: number; correct: boolean };
}

// ---- Metrics ----
export interface MetricDataPoint {
  sessionId: string;
  date: string;
  ageMonths: number;
  value: number;
  percentile: number | null;
}

export interface MetricSeries {
  metricName: string;
  gameType: GameType;
  dataPoints: MetricDataPoint[];
  trend: 'improving' | 'stable' | 'declining';
  latestPercentile: number | null;
}

// ---- Flags ----
export type FlagSeverity = 'amber' | 'red';
export type FlagType = 'below_threshold' | 'declining_trend' | 'high_variability';

export interface Flag {
  id: string;
  severity: FlagSeverity;
  flagType: FlagType;
  metricName: string;
  gameType: GameType;
  description: string;
  currentValue: number | null;
  thresholdPercentile: number | null;
  actualPercentile: number | null;
  createdAt: string;
  isDismissed: boolean;
  dismissedBy: string | null;
  dismissedAt: string | null;
  dismissReason: string | null;
}

export interface DismissFlagRequest {
  reason: string;
}

// ---- Admin ----
export interface StaffMember {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface CreateStaffRequest {
  name: string;
  email?: string;
  role: UserRole;
  pin?: string;
  password?: string;
}

export interface TabletInfo {
  id: string;
  deviceName: string | null;
  model: string | null;
  lastSeenAt: string | null;
  isActive: boolean;
  registeredAt: string | null;
}

export interface CreateTabletRequest {
  deviceName: string;
}

export interface CreateTabletResponse {
  tabletId: string;
  deviceToken: string;
  pairingQrCode: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; error: string }[];
}

export interface ClinicAnalytics {
  totalPatients: number;
  totalSessions: number;
  activeTablets: number;
  sessionsPerPeriod: { date: string; count: number }[];
  avgPlayDurationMs: number;
  completionRate: number;
}

// ---- Common ----
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

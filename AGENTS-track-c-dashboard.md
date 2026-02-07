# Track C: Web Dashboard & Admin Panel

> **Terminal 3 of 3** — This track builds the clinician dashboard and admin panel.
> Works primarily in `apps/dashboard/`.

## Prerequisites

- [ ] Track B has completed **Phase 0 (Foundation)** and pushed to git
- [ ] You have pulled the latest code: `git pull origin main`
- [ ] Run `pnpm install` to install all dependencies

## What You Own

```
apps/dashboard/           ← YOUR TERRITORY (full ownership)
packages/shared/types/    ← READ ONLY (Track B owns, you consume)
```

**Do NOT modify** `apps/api/`, `apps/mobile/`, or `packages/shared/` directly.
If you need a new shared type, add it to `apps/dashboard/src/types/local.ts` and flag it
for Track B to merge into `packages/shared/` later.

## API Mocking Strategy

You will build against a **mock API** so you don't need the real backend running.
Create `apps/dashboard/src/services/mock-api.ts` with hardcoded responses matching
the API spec in `agent_docs/api.md`. Use MSW (Mock Service Worker) for realistic mocking:

```typescript
// apps/dashboard/src/mocks/handlers.ts (MSW handlers)
// Intercept fetch/axios calls and return mock responses
```

Toggle with environment variable:
```
VITE_USE_MOCK_API=true   # Use MSW mocks
VITE_USE_MOCK_API=false  # Use real API
```

## Reference Docs

| What | Where |
|------|-------|
| Dashboard spec (YOUR BIBLE) | `agent_docs/dashboard.md` |
| API contract (mock against this) | `agent_docs/api.md` |
| PRD — dashboard section | `docs/PRD-kite.md` section 6-7 |
| Shared types | `packages/shared/src/types/` |
| Design system | `agent_docs/dashboard.md` — Design System section |

---

## Phase C1: Project Setup & Auth Flow

**Goal:** Dashboard project initialized with auth flow, layout shell, and mock API.

### Tasks:

1. **Initialize Vite project** (`apps/dashboard`)
   - Vite + React 19 + TypeScript
   - Install: react-router-dom v7, @tanstack/react-query, recharts, axios, tailwindcss, @tailwindcss/vite, zod
   - Configure Tailwind CSS 4
   - Configure path aliases: `@/` → `src/`
   - Add `@kite/shared` as workspace dependency

2. **Design system setup**
   - Tailwind config with custom colors from `agent_docs/dashboard.md` — Design System
   - Install Inter font (Google Fonts or local) and JetBrains Mono
   - Create base component primitives:
     - `Button.tsx` — primary, secondary, danger variants
     - `Card.tsx` — white card with shadow and optional border color
     - `Badge.tsx` — colored pill (green/amber/red for flag status)
     - `Input.tsx` — text input with label and error state
     - `Table.tsx` — sortable table with header click sorting
     - `Modal.tsx` — confirmation dialog
     - `Spinner.tsx` — loading spinner
     - `Skeleton.tsx` — content placeholder with pulse animation

3. **Mock API with MSW**
   - Install `msw` (Mock Service Worker)
   - Create handlers for ALL API endpoints from `agent_docs/api.md`
   - Mock data: 87 patients, varied flag statuses, 3-5 sessions each
   - Mock auth: accept `doctor@sunny.dev` / `doctor123`, MFA code `123456`
   - Start MSW in development when `VITE_USE_MOCK_API=true`

4. **Real API client** (`src/services/api.ts`)
   - Axios instance with base URL from `VITE_API_URL`
   - JWT interceptor: attach `Authorization: Bearer <token>` to all requests
   - Refresh interceptor: on 401, try refresh token, retry original request
   - Error interceptor: parse `ApiError` format, throw typed errors

5. **Auth context** (`src/contexts/auth-context.tsx`)
   - React Context storing: `user`, `accessToken`, `refreshToken`, `isAuthenticated`, `isMfaVerified`
   - `login(email, password)` → call API → store temp token → redirect to MFA
   - `verifyMfa(code)` → call API → store tokens + user → redirect to dashboard
   - `logout()` → clear tokens → redirect to login
   - `refreshToken()` → call API → update tokens
   - Tokens stored in memory only (not localStorage — more secure)
   - On page refresh: user must re-login (acceptable for MVP; session persistence in Phase 2)

6. **Login page** (`src/routes/Login.tsx`)
   - Centered card on light grey background
   - Kite logo at top (simple text logo for now: "Kite" in brand blue)
   - Email input + password input
   - "Sign In" button
   - Error message area (invalid credentials)
   - Clean, clinical design — not flashy

7. **MFA page** (`src/routes/Mfa.tsx`)
   - Centered card
   - "Two-Factor Authentication" heading
   - "Enter the 6-digit code from your authenticator app"
   - 6 individual digit input boxes (auto-advance on input)
   - "Verify" button
   - Error message area (invalid code)
   - "Back to login" link

8. **Layout shell** (`src/components/Layout.tsx`)
   - Sidebar (240px, dark slate):
     - Kite logo/name at top
     - Nav items: "Patients" (always), "Admin" section (if role === admin)
     - Admin sub-items: Staff, Tablets, Import, Analytics
     - Collapse button (shrinks to icon-only 64px sidebar)
     - User name + "Log out" at bottom
   - Top bar (optional, or integrate into content area):
     - Clinic name
     - Breadcrumb path
   - Main content area: `<Outlet />` from React Router
   - Protected route wrapper: redirect to `/login` if not authenticated

9. **Route structure**
   ```
   /login              → Login page (public)
   /mfa                → MFA page (partial auth)
   /                   → Redirect to /patients
   /patients           → Patient list
   /patients/:id       → Patient detail (tabs: session, trends, flags)
   /admin/staff        → Staff management
   /admin/tablets      → Tablet management
   /admin/import       → Patient CSV import
   /admin/analytics    → Usage analytics
   ```

### Acceptance Criteria:
- `pnpm --filter @kite/dashboard dev` starts on localhost:5173
- Login with mock credentials → MFA → redirects to patient list
- Invalid credentials show error, invalid MFA shows error
- Layout renders: sidebar, content area, correct routing
- Admin nav items visible only for admin role users
- Logout clears auth state and redirects to login
- All base components created and consistent with design system

---

## Phase C2: Clinician Dashboard (Patient List + Detail)

**Goal:** Patient list with flags, patient detail with session summary, trends, and flags.

### Tasks:

1. **TanStack Query hooks** (`src/hooks/`)
   - `usePatients(options)` — fetches `GET /dashboard/patients` with search, filter, sort, pagination
   - `usePatient(id)` — fetches `GET /dashboard/patients/:id`
   - `useMetrics(patientId, options)` — fetches `GET /dashboard/patients/:id/metrics`
   - `useFlags(patientId)` — fetches `GET /dashboard/patients/:id/flags`
   - `useDismissFlag()` — mutation for `PATCH /dashboard/flags/:id/dismiss`
   - Configure stale times: 30s for patient list, 60s for metrics
   - Refetch on window focus for patient list

2. **Patient list page** (`src/routes/Patients.tsx`)
   - **Today's patients section** (highlighted card at top):
     - Horizontal cards for patients with sessions today
     - Shows: name, age, flag badge
     - Click → patient detail
   - **All patients table**:
     - Columns: Name, Age, Last Visit, Sessions, Status
     - Status column: `<Badge>` component (green/amber/red)
     - Click any column header → sort asc/desc
     - Search bar: filters by patient name (debounced, 300ms)
     - Filter buttons: All | Flagged Only | Red Flags
     - Pagination: 50 per page, prev/next buttons, page indicator
     - Empty state: "No patients found" with illustration
     - Loading state: skeleton table rows

3. **Patient detail page** (`src/routes/PatientDetail.tsx`)
   - **Header section:**
     - Back arrow → returns to patient list
     - Patient name (large), age, DOB
     - Guardian name (if available)
     - Stats: total sessions, date range (first → last session)
   - **Tab navigation:** Latest Session | Trends | Flags (count badge)
   - Tab state stored in URL query param (`?tab=trends`)

4. **Latest Session tab** (`src/components/patient/LatestSession.tsx`)
   - Date of latest session + duration
   - **4 game cards** (one per game played):
     - Game name + icon (cloud, star, wind, sorting arrows)
     - 2-3 key metrics per game as `<MetricCard>` components
     - Each metric shows: name, value, percentile bar, trend arrow
     - Flagged metrics: card border color matches flag severity (amber/red)
   - If no sessions: "No game sessions recorded yet" message

5. **Trends tab** (`src/components/patient/TrendsView.tsx`)
   - **One chart section per domain:** Attention, Memory, Motor, Processing
   - Each section contains 1-2 `<TrendChart>` line charts (Recharts)
   - Chart config:
     - X-axis: visit dates (formatted: "Aug '25", "Nov '25")
     - Y-axis: metric value with appropriate scale
     - Data points as circles (6px radius)
     - Line: 2px, brand blue
     - Area fill below line: light blue, 10% opacity
     - **Normative band:** shaded rectangle from 15th to 85th percentile (light green, 15% opacity)
     - **Below 15th percentile zone:** amber, 10% opacity
     - **Below 5th percentile zone:** red, 10% opacity
     - Tooltip on hover: date, value, percentile, age at session
   - Trend indicator next to chart title: arrow up (green), horizontal (grey), arrow down (amber/red)
   - If < 2 data points: show message "Need more visits to show trends"

6. **Flags tab** (`src/components/patient/FlagsView.tsx`)
   - **Active flags section:**
     - List of flag cards, sorted by severity (red first) then date (newest first)
     - Each flag card shows:
       - Severity badge (amber/red)
       - Metric name + game type
       - Description text
       - Date created
       - "Dismiss" button
     - Dismiss: opens modal → "Add a note (optional)" text input + "Dismiss Flag" button
     - Optimistic update: flag disappears immediately, rolls back on API error
   - **Dismissed flags section** (collapsed by default):
     - "Show dismissed flags" toggle
     - Greyed-out flag cards with dismissal info (who, when, reason)
   - If no flags: green checkmark + "No concerns flagged" message

7. **Print styles** (`src/styles/print.css`)
   - `@media print` rules:
     - Hide sidebar, top bar, navigation, buttons
     - Expand content to full width
     - Add header: "Kite Clinical Report — [Patient Name] — [Date]"
     - Add footer: "CONFIDENTIAL — This report presents developmental patterns, not clinical diagnoses."
     - Charts render at high resolution (Recharts supports this)
     - Page breaks between metric domains

### Acceptance Criteria:
- Patient list loads with correct data and flag badges from mock API
- Search, sort, and filter work correctly
- Patient detail shows all 3 tabs with correct data
- Trend charts render with normative bands and data points
- Flags display with correct severity, dismissal works with optimistic update
- Print view produces a clean clinical report
- All pages load in < 2 seconds (with mock data)
- Empty states and loading states display correctly

---

## Phase C3: Admin Panel

**Goal:** Staff management, tablet management, patient import, usage analytics.

### Tasks:

1. **Admin route guard** (`src/components/AdminRoute.tsx`)
   - Wrapper component that checks `user.role === 'admin'`
   - If not admin: redirect to `/patients` with toast "Admin access required"
   - Wrap all `/admin/*` routes

2. **Staff management page** (`src/routes/admin/Staff.tsx`)
   - **Staff table:** Name, Email, Role, Status, Actions
   - **Add staff modal:**
     - Name input
     - Role select: Admin, Clinician, Staff
     - If Admin/Clinician: email input + "They will set their password on first login"
     - If Staff: PIN input (4-6 digits) with confirmation
   - **Edit actions per row:**
     - Deactivate/Reactivate toggle (confirmation modal)
     - Reset PIN (for staff role — confirmation modal + new PIN input)
   - **Validation:** email format, PIN length, required fields

3. **Tablet management page** (`src/routes/admin/Tablets.tsx`)
   - **Tablet table:** Device Name, Model, Last Seen, Status, Actions
   - **Register tablet:**
     - "Register New Tablet" button → modal
     - Device name input (e.g., "Waiting Room iPad 1")
     - On submit: API returns device token + QR code
     - Display QR code in modal: "Scan this from the Kite app to pair"
     - "Copy Device Token" button as fallback
     - Close modal
   - **Actions:** Deactivate tablet (confirmation modal)
   - **Last seen:** relative time ("2 minutes ago", "3 days ago")

4. **Patient import page** (`src/routes/admin/Import.tsx`)
   - **Upload area:**
     - Drag-and-drop zone (dashed border, cloud icon)
     - "or click to browse files"
     - Accept: `.csv` files only
     - Max file size: 5MB
   - **CSV format helper:**
     - Expandable section: "CSV Format Requirements"
     - Required columns: first_name, last_name, date_of_birth (YYYY-MM-DD)
     - Optional columns: mrn, guardian_name
     - Download sample CSV link
   - **Preview table** (after file selected, before import):
     - Parse CSV client-side (use papaparse)
     - Show first 10 rows with validation status per row
     - Green check for valid rows, red X for invalid (with error message)
     - Row count: "45 valid, 3 errors"
   - **Import button:** "Import 45 Patients"
     - Uploads CSV to `POST /admin/patients/import`
     - Progress indicator during upload
     - Results: "45 imported, 3 skipped" with error details expandable
   - **Manual add** (separate section below):
     - Simple form: first name, last name, DOB (date picker), MRN (optional), guardian (optional)
     - Submit → API call → success toast

5. **Usage analytics page** (`src/routes/admin/Analytics.tsx`)
   - **Stat cards** (top row, 4 cards):
     - Total Patients (number)
     - Total Sessions (number)
     - Active Tablets (number)
     - Completion Rate (percentage with gauge)
   - **Sessions per period** (bar chart — Recharts):
     - Period toggle: Day | Week | Month
     - Date range selector (last 30 days default)
     - Bars colored brand blue
   - **Average play duration** (line chart):
     - Same period/range controls
     - Y-axis: minutes
     - Target line at 12 minutes (dashed grey)
   - All data from `GET /admin/analytics`

6. **Mock data for admin**
   - MSW handlers for all admin endpoints
   - 5 staff members (mix of roles and statuses)
   - 3 tablets (one inactive)
   - Analytics data: 30 days of session counts

### Acceptance Criteria:
- Only admin-role users can access admin pages
- Staff CRUD: add, deactivate, reactivate, reset PIN — all work
- Tablet registration shows QR code and device token
- CSV import: upload → preview with validation → import → results
- Manual patient add works
- Analytics show charts with period toggle
- All forms validate inputs before submission
- Non-admin users redirected away from admin routes

---

## Phase C4: Polish & Testing

**Goal:** Visual polish, edge cases, component tests, accessibility.

### Tasks:

1. **Responsive layout**
   - Sidebar collapses to icons on < 1200px viewport
   - Tables scroll horizontally on narrow viewports
   - Dashboard usable (not perfect) on tablet-sized screens
   - Primary target: 1280px+ desktop

2. **Error handling**
   - API error responses → user-friendly toast notifications
   - Network errors → "Connection lost. Retrying..." banner
   - 403 errors → "You don't have permission" message
   - Token expiry during use → auto-refresh or redirect to login

3. **Loading states**
   - Patient list: skeleton table (8 rows of grey bars)
   - Patient detail: skeleton cards
   - Charts: skeleton rectangle with pulse
   - Never show a blank page while data loads

4. **Accessibility**
   - Keyboard navigation: all interactive elements focusable, tab order logical
   - ARIA labels on icon-only buttons
   - Color contrast: WCAG AA on all text (verify with axe-core)
   - Screen reader: table headers linked to cells, chart descriptions
   - Focus trap in modals

5. **Component tests** (Vitest + Testing Library)
   - `FlagBadge` renders correct color/icon for each severity
   - `PatientTable` sorts correctly on column header click
   - `TrendChart` renders data points and normative bands
   - `Login` form submits on enter, shows error on invalid credentials
   - `CsvImport` parses CSV and shows preview with validation
   - Auth context: login → MFA → authenticated state transitions

6. **Visual consistency audit**
   - Verify all colors match `agent_docs/dashboard.md` design system
   - Verify font usage: Inter for text, JetBrains Mono for metric values
   - Verify spacing: consistent card padding (24px), gaps (16px)
   - Verify all buttons use the `Button` component (no raw `<button>`)

### Acceptance Criteria:
- No layout breakage at 1280px, 1440px, 1920px viewports
- All API errors handled gracefully (no blank screens, no uncaught errors)
- Loading skeletons display on every page transition
- All component tests pass
- No WCAG AA contrast violations
- Keyboard-only navigation works for all core flows

---

## Integration Checklist (after all tracks merge)

- [ ] Replace MSW mocks with real API (`VITE_USE_MOCK_API=false`, set `VITE_API_URL`)
- [ ] Login with real credentials (doctor@sunny.dev from seed data)
- [ ] MFA setup and verification works
- [ ] Patient list shows real patients from database
- [ ] Patient detail shows real session data and metrics
- [ ] Trend charts render real longitudinal data
- [ ] Flags from real game sessions appear correctly
- [ ] Flag dismissal persists in database
- [ ] Admin: staff CRUD works against real API
- [ ] Admin: tablet registration generates real device tokens
- [ ] Admin: CSV import creates real encrypted patient records
- [ ] Admin: analytics show real usage data
- [ ] Print view works with real data

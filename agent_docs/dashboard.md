# Dashboard & Admin Panel Specification

> React 19 + Vite + Tailwind CSS 4 + Recharts + TanStack Query
> Optimized for desktop browsers (clinicians use laptops/desktops)

## Design System

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-primary` | `#FAFBFC` | Page background |
| `--bg-card` | `#FFFFFF` | Card backgrounds |
| `--bg-sidebar` | `#1E293B` | Sidebar background (slate-800) |
| `--text-primary` | `#1F2937` | Main text (gray-800) |
| `--text-secondary` | `#6B7280` | Secondary text (gray-500) |
| `--text-sidebar` | `#E2E8F0` | Sidebar text (slate-200) |
| `--brand-primary` | `#3B82F6` | Primary actions, links (blue-500) |
| `--brand-hover` | `#2563EB` | Hover state (blue-600) |
| `--flag-green` | `#10B981` | No concerns (emerald-500) |
| `--flag-amber` | `#F59E0B` | Pattern noted (amber-500) |
| `--flag-red` | `#EF4444` | Review recommended (red-500) |
| `--border` | `#E5E7EB` | Card borders (gray-200) |

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Page title | Inter | 24px | 700 |
| Section title | Inter | 18px | 600 |
| Card title | Inter | 16px | 600 |
| Body text | Inter | 14px | 400 |
| Label | Inter | 12px | 500 |
| Metric value | JetBrains Mono | 20px | 600 |
| Metric label | Inter | 12px | 400 |

### Spacing

Base unit: 4px. Use Tailwind spacing scale (p-1 = 4px, p-2 = 8px, etc.)
Card padding: 24px (p-6)
Card gap: 16px (gap-4)
Section gap: 32px (gap-8)

### Components

**FlagBadge:**
- Small pill/chip showing status
- Green: `bg-emerald-100 text-emerald-700` + checkmark icon
- Amber: `bg-amber-100 text-amber-700` + alert triangle icon
- Red: `bg-red-100 text-red-700` + alert circle icon

**MetricCard:**
- White card with subtle border
- Metric name (label, top)
- Metric value (large number, center)
- Percentile bar (thin horizontal bar, color-coded)
- Trend arrow (up/down/stable icon, right side)

**TrendChart (Recharts):**
- Line chart with area fill below
- Data points as circles (hoverable)
- Normative band as shaded rectangle (15th-85th percentile)
- Below 15th percentile zone shaded amber
- Below 5th percentile zone shaded red
- Tooltip shows: date, value, percentile, age at session

---

## Page Layouts

### Login Page

```
┌─────────────────────────────────────────────┐
│                                             │
│              [Kite Logo]                    │
│          Kite Clinical Dashboard            │
│                                             │
│         ┌──────────────────────┐            │
│         │ Email                │            │
│         └──────────────────────┘            │
│         ┌──────────────────────┐            │
│         │ Password             │            │
│         └──────────────────────┘            │
│              [Sign In]                      │
│                                             │
└─────────────────────────────────────────────┘
```

### MFA Page

```
┌─────────────────────────────────────────────┐
│                                             │
│          Two-Factor Authentication          │
│    Enter the code from your authenticator   │
│                                             │
│         ┌──────────────────────┐            │
│         │ [  ] [  ] [  ] [  ] [  ] [  ]    │
│         └──────────────────────┘            │
│              [Verify]                       │
│                                             │
└─────────────────────────────────────────────┘
```

### Patient List (Dashboard Home)

```
┌────────┬────────────────────────────────────────────────┐
│        │  Patients                            [Search]  │
│  KITE  │                                                │
│        │  ┌── Today's Patients ──────────────────────┐  │
│ ━━━━━━ │  │ Emma S.    5y 2m   Today    4 sessions ● │  │
│        │  │ Liam J.    5y 8m   Today    3 sessions ● │  │
│ Patients│  └─────────────────────────────────────────┘  │
│        │                                                │
│ ━━━━━━ │  ┌── All Patients ──────────────────────────┐  │
│ Admin  │  │ Name     │ Age  │ Last Visit │ # │Status │  │
│ (if    │  │──────────│──────│────────────│───│───────│  │
│  admin)│  │ Ava T.   │ 6y10m│ 2026-01-15│ 5 │ 🟢    │  │
│        │  │ Emma S.  │ 5y 2m│ 2026-02-07│ 4 │ 🟡    │  │
│ ━━━━━━ │  │ Liam J.  │ 5y 8m│ 2026-02-07│ 3 │ 🔴    │  │
│        │  │ Noah R.  │ 3y11m│ 2025-12-01│ 2 │ 🟢    │  │
│ Log Out│  │ Olivia M.│ 6y 3m│ 2026-01-20│ 6 │ 🟡    │  │
│        │  └──────────────────────────────────────────┘  │
│        │  [< Prev]  Page 1 of 2  [Next >]              │
└────────┴────────────────────────────────────────────────┘
```

### Patient Detail

```
┌────────┬────────────────────────────────────────────────┐
│        │  ← Back to Patients                            │
│  KITE  │                                                │
│        │  Emma Smith              5 yrs 2 mos           │
│        │  DOB: Jan 15, 2021       4 sessions            │
│        │  Guardian: Jennifer S.   Since: Aug 2025       │
│        │                                                │
│        │  [Latest Session]  [Trends]  [Flags (2)]       │
│        │                                                │
│        │  ── Latest Session (Feb 7, 2026) ────────────  │
│        │                                                │
│        │  ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│        │  │Cloud Catch│ │Star Seq  │ │Wind Trail│ ...   │
│        │  │          │ │          │ │          │       │
│        │  │Attention │ │Memory    │ │Motor     │       │
│        │  │  82%     │ │Span: 5   │ │Precision │       │
│        │  │  P55 ↑   │ │P62 →     │ │P44 →     │       │
│        │  │          │ │          │ │          │       │
│        │  │RT: 620ms │ │Acc: 78%  │ │Smooth:85%│       │
│        │  │  P48 →   │ │P51 ↑     │ │P40 →     │       │
│        │  └──────────┘ └──────────┘ └──────────┘       │
│        │                                                │
│        │  ── Flags ───────────────────────────────────  │
│        │  🟡 Reaction time variability at 12th %ile     │
│        │     Cloud Catch · Feb 7, 2026    [Dismiss]     │
│        │  🟡 Motor precision declining over 3 visits    │
│        │     Wind Trails · Feb 7, 2026    [Dismiss]     │
│        │                                                │
└────────┴────────────────────────────────────────────────┘
```

### Patient Detail — Trends Tab

```
│        │  [Latest Session]  [Trends]  [Flags (2)]       │
│        │                                                │
│        │  ── Attention Domain ────────────────────────  │
│        │  ┌────────────────────────────────────────┐    │
│        │  │  Attention Accuracy        P55 ↑       │    │
│        │  │                                        │    │
│        │  │  100%─┐                                │    │
│        │  │       │        ░░░░░░░░░░░░░░░░░░     │    │
│        │  │   75%─┤  ●──────●──────●──────●       │    │
│        │  │       │  ░░░░░░░░░░░░░░░░░░░░░░      │    │
│        │  │   50%─┤                                │    │
│        │  │       │                                │    │
│        │  │    0%─┼────────────────────────────    │    │
│        │  │       Aug    Nov    Jan    Feb         │    │
│        │  └────────────────────────────────────────┘    │
│        │  ░ = normative band (15th-85th percentile)     │
│        │                                                │
│        │  ── Memory Domain ──────────────────────────  │
│        │  ┌────────────────────────────────────────┐    │
│        │  │  (similar chart for memory metrics)     │    │
│        │  └────────────────────────────────────────┘    │
```

### Admin — Staff Management

```
│        │  Staff Members                    [+ Add Staff] │
│        │                                                │
│        │  ┌──────────────────────────────────────────┐  │
│        │  │ Name          │ Role      │ Status │ ···  │  │
│        │  │───────────────│───────────│────────│──────│  │
│        │  │ Dr. Smith     │ Clinician │ Active │ Edit │  │
│        │  │ Sarah J.      │ Staff     │ Active │ Edit │  │
│        │  │ Mike R.       │ Staff     │ Inactive│ Edit│  │
│        │  └──────────────────────────────────────────┘  │
```

### Admin — Patient Import

```
│        │  Import Patients                               │
│        │                                                │
│        │  ┌──────────────────────────────────────────┐  │
│        │  │                                          │  │
│        │  │     Drag & drop a CSV file here           │  │
│        │  │     or [Browse Files]                     │  │
│        │  │                                          │  │
│        │  │     Required: first_name, last_name,     │  │
│        │  │     date_of_birth                         │  │
│        │  │     Optional: mrn, guardian_name          │  │
│        │  │                                          │  │
│        │  └──────────────────────────────────────────┘  │
│        │                                                │
│        │  ── Preview (after upload) ──────────────────  │
│        │  ┌──────────────────────────────────────────┐  │
│        │  │ Emma Smith    │ 2021-01-15 │ MRN-001 ✓  │  │
│        │  │ Liam Jones    │ 2020-06-20 │ MRN-002 ✓  │  │
│        │  │ [Missing DOB] │            │ MRN-003 ✗  │  │
│        │  └──────────────────────────────────────────┘  │
│        │  45 valid, 1 error              [Import 45]    │
```

### Admin — Usage Analytics

```
│        │  Usage Analytics                  [This Month ▾]│
│        │                                                │
│        │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────┐│
│        │  │   87    │ │  312    │ │   3     │ │ 86%  ││
│        │  │Patients │ │Sessions │ │Tablets  │ │Compl.││
│        │  └─────────┘ └─────────┘ └─────────┘ └──────┘│
│        │                                                │
│        │  ── Sessions per Day ───────────────────────  │
│        │  ┌────────────────────────────────────────┐    │
│        │  │  (bar chart)                           │    │
│        │  └────────────────────────────────────────┘    │
│        │                                                │
│        │  ── Average Play Duration ──────────────────  │
│        │  ┌────────────────────────────────────────┐    │
│        │  │  (line chart, minutes)                 │    │
│        │  └────────────────────────────────────────┘    │
```

---

## Route Structure

```
/login                    → Login page (public)
/mfa                      → MFA verification (partial auth)
/                         → Redirect to /patients
/patients                 → Patient list (clinician + admin)
/patients/:id             → Patient detail (clinician + admin)
/patients/:id/trends      → Patient trends tab
/patients/:id/flags       → Patient flags tab
/admin/staff              → Staff management (admin only)
/admin/tablets            → Tablet management (admin only)
/admin/patients/import    → Patient CSV import (admin only)
/admin/analytics          → Usage analytics (admin only)
```

---

## State Management

**Server state (TanStack Query):**
- All API data fetched and cached via TanStack Query
- Stale time: 30 seconds (patient list), 60 seconds (metrics)
- Refetch on window focus for patient list

**Client state (minimal):**
- Auth state: JWT tokens, user info (React Context)
- UI state: sidebar collapsed, active tab (component state / URL params)
- No Redux, no Zustand — keep it simple

---

## Print Styles

When printing the patient detail page:
- Hide sidebar, top bar, and navigation
- Expand all metrics cards to full width
- Show charts at high resolution
- Add "Kite Clinical Report" header with patient name and date
- Add "CONFIDENTIAL — Not a diagnostic document" footer
- Add clinic name and generating clinician's name

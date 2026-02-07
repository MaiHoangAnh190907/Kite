# Kite — Product Requirements Document

**Version:** 1.0
**Date:** 2026-02-07
**Status:** Draft

---

## 1. Product Overview

**Kite** is a gamified stealth assessment mobile app for pediatric waiting rooms. Children play age-adaptive mini-games on clinic-owned iPads while waiting for their appointment. Behind the scenes, each game passively measures cognitive, motor, and emotional development markers. Over months and years of visits, Kite builds a longitudinal profile that surfaces "developmental patterns" to the child's pediatrician via a web dashboard — catching signals that a standard 15-minute physical exam might miss.

**Positioning:** Clinical decision support tool (CDS-exempt). Kite presents developmental gameplay data for clinician review. It does not diagnose, screen for, or identify specific conditions. All clinical judgment remains with the physician.

---

## 2. Target Users

| User | Role | Primary Need |
|------|------|-------------|
| **Child (ages 2-12)** | Player | Fun games that feel like play, not tests |
| **Clinic staff** | Session initiator | Quick, simple way to start a session for a patient |
| **Pediatrician** | Data consumer | At-a-glance developmental patterns before/during a visit |
| **Clinic admin** | Account manager | Manage tablets, view usage, handle billing |
| **Parent/guardian** | Consent provider | Understand what Kite does and consent to their child playing |

---

## 3. MVP Scope

### 3.1 What's IN the MVP

| Component | Description |
|-----------|-------------|
| **Child-facing iPad app** | 4 mini-games in a kite/sky adventure world, ages 4-7 |
| **Staff session launcher** | PIN-protected screen to select a patient and start a game session |
| **Parent consent screen** | Brief explanation + consent tap before child plays |
| **Clinician web dashboard** | Patient list, per-visit summaries, longitudinal trends, flag system |
| **Clinic admin panel** | Tablet management, staff accounts, usage stats |
| **Kiosk mode** | Auto-reset between patients, locked to Kite app |

### 3.2 What's NOT in the MVP

| Excluded | Rationale |
|----------|-----------|
| Ages 2-4 and 8-12 games | Phase 2 — start with 4-7 sweet spot |
| EHR integration (Epic, Cerner) | Phase 2 — requires FHIR/HL7 work and partnerships |
| Parent portal / account | Phase 2 — MVP consent-only to limit scope |
| PDF report generation | Phase 2 — dashboard is sufficient for MVP |
| BYOD / parent phone support | Phase 2 — clinic iPads only for MVP |
| Billing/reimbursement tools | Phase 2 — clinics handle 96110 billing manually |
| Offline mode | Phase 2 — assume clinic WiFi available |
| Multi-language support | Phase 2 — English only for MVP |
| Voice/microphone-based games | Phase 2 — avoids COPPA audio data complexity |

---

## 4. User Flows

### 4.1 Waiting Room Flow (Child + Staff)

```
Child arrives at clinic
        |
        v
Front desk checks child in (standard process)
        |
        v
Staff picks up clinic iPad, enters staff PIN
        |
        v
Staff selects patient from today's appointment list
        |
        v
Staff hands iPad to parent/child
        |
        v
Parent sees consent screen:
  "Kite helps your child's doctor track development
   through fun games. No diagnostic claims. Data is
   private and shared only with your child's doctor."
  [I Consent & Start] [No Thanks]
        |
        v
Child plays games (5-15 min, auto-sizes to wait time)
        |
        v
Session ends: "Great flying! Hand the iPad back to
the front desk." Auto-locks after 30s of inactivity.
        |
        v
Staff retrieves iPad → auto-resets to staff PIN screen
```

### 4.2 Clinician Dashboard Flow

```
Doctor opens Kite dashboard (web browser, before/during visit)
        |
        v
Sees today's patients with Kite sessions flagged
        |
        v
Clicks into a patient → sees:
  - Today's session summary (games played, key metrics)
  - Longitudinal trend charts (metrics over past visits)
  - Any flagged patterns (amber/red indicators)
        |
        v
Doctor uses this context during the visit
(supplements, does not replace, standard assessment)
```

### 4.3 Clinic Admin Flow

```
Admin logs into Kite web portal
        |
        v
Manages:
  - Staff accounts (add/remove, reset PINs)
  - Tablet registry (pair/unpair devices)
  - Patient list sync (manual CSV upload for MVP)
  - Usage dashboard (sessions/day, avg play time, etc.)
```

---

## 5. Child-Facing App — Game Design

### 5.1 World Theme: "Kite Adventures"

The child controls a kite character named **Breeze** who flies through a colorful sky world. Each mini-game is a different "sky zone" that Breeze visits. Between games, short animations show Breeze flying to the next zone. The world uses bright, warm colors (sky blue, sunset orange, cloud white, grass green) with a hand-illustrated storybook art style.

**No text required.** All instructions are conveyed through animation, icons, and optional audio narration. The UI must work for pre-literate children (age 4) through early readers (age 7).

### 5.2 Mini-Games (MVP: 4 Games)

#### Game 1: "Cloud Catch" — Attention & Reaction Time
- **What the child sees:** Breeze flies through clouds. Tap the golden clouds, avoid the grey storm clouds. Speed increases gradually.
- **What Kite measures:**
  - Sustained attention (accuracy over time — does it decay?)
  - Reaction time (tap latency per target)
  - Impulsivity (false positives — tapping storm clouds)
  - Response consistency (reaction time variability)
- **Duration:** 2-3 minutes
- **Difficulty scaling:** Speed and cloud density increase. Distractors (birds, rainbows) appear.

#### Game 2: "Star Sequence" — Working Memory
- **What the child sees:** Stars light up in a sequence on screen. Child taps them in the same order. Sequences get longer.
- **What Kite measures:**
  - Working memory capacity (max sequence length)
  - Visual-spatial memory (accuracy of spatial positions)
  - Learning rate (improvement across rounds)
  - Error patterns (which positions are confused)
- **Duration:** 2-3 minutes
- **Difficulty scaling:** Sequence length increases from 2 to 7+. Grid size increases.

#### Game 3: "Wind Trails" — Fine Motor Control
- **What the child sees:** Trace a path through the sky with your finger to guide Breeze. Paths curve, loop, and narrow.
- **What Kite measures:**
  - Fine motor precision (deviation from ideal path)
  - Motor smoothness (jerk/acceleration of finger movement)
  - Motor planning (anticipation of curves vs. reactive corrections)
  - Completion speed vs. accuracy tradeoff
- **Duration:** 2-3 minutes
- **Difficulty scaling:** Paths become more complex. Width of acceptable tracing zone narrows.

#### Game 4: "Sky Sort" — Categorization & Processing Speed
- **What the child sees:** Objects fall from the sky (birds, butterflies, airplanes, kites). Sort them into the correct baskets by swiping left or right. Rules change mid-game ("now sort by color instead of type!").
- **What Kite measures:**
  - Processing speed (correct sorts per minute)
  - Categorization ability (accuracy across rule types)
  - Cognitive flexibility (performance after rule switch)
  - Frustration tolerance (behavior patterns after errors — pause length, tap intensity)
- **Duration:** 2-3 minutes
- **Difficulty scaling:** Sort speed increases. Rules switch more frequently. Number of categories increases from 2 to 3-4.

### 5.3 Session Structure

```
[Staff selects patient]
  → [Parent consent screen] (10 sec)
  → [Welcome animation — Breeze appears] (5 sec)
  → [Game 1: Cloud Catch] (2-3 min)
  → [Flying transition animation] (3 sec)
  → [Game 2: Star Sequence] (2-3 min)
  → [Flying transition animation] (3 sec)
  → [Game 3: Wind Trails] (2-3 min)
  → [Flying transition animation] (3 sec)
  → [Game 4: Sky Sort] (2-3 min)
  → [Celebration animation — Breeze does a sky dance] (5 sec)
  → [End screen: "Great flying! Time to see the doctor!"]
```

**Total session time:** 10-15 minutes (fits typical wait time)

If the child is called in early, the session can end after any game — partial sessions still produce usable data. Games always complete in full (no mid-game interruption).

### 5.4 Engagement & Reward Design

- **Stars:** Child earns stars for completing each game (always — no failure state)
- **Sky stickers:** Fun visual rewards after each game (a rainbow, a bird friend, etc.)
- **No scores shown.** The child never sees "you got 7 out of 10 correct." Every child gets positive reinforcement regardless of performance. This is critical for stealth assessment — the child must not feel tested.
- **No leaderboards, no competition.** Every session is individual.
- **Returning players:** On subsequent visits, Breeze "remembers" the child with a wave animation. Accumulated stickers are displayed. This builds longitudinal engagement.

---

## 6. Clinician Web Dashboard

### 6.1 Patient List View

| Column | Description |
|--------|-------------|
| Patient name | Child's name |
| Age | Current age |
| Last visit | Date of most recent Kite session |
| Sessions | Total number of Kite sessions |
| Status | Green (no flags), Amber (pattern noted), Red (review recommended) |

- Default sort: today's patients at top, sorted by appointment time
- Search and filter by name, age, status
- Patients without Kite sessions are shown greyed out

### 6.2 Individual Patient View

**Header:** Child's name, DOB, age, total sessions, date range

**Section A — Today's Session Summary**
- Games played and completion status
- Key metrics per game (presented as simple bar/gauge visualizations):
  - Cloud Catch: Attention score, reaction time, impulsivity index
  - Star Sequence: Memory span, accuracy
  - Wind Trails: Motor precision, smoothness
  - Sky Sort: Processing speed, flexibility score
- Any flagged metrics (amber/red highlights with brief explanation)

**Section B — Longitudinal Trends**
- Line charts showing each metric over time (x-axis = visit dates)
- Normative bands shown as shaded regions (based on age-matched averages from Kite's dataset)
- Trend arrows (improving, stable, declining)
- Hover for details on any data point

**Section C — Flags & Patterns**
- Algorithmic flags when a metric:
  - Falls below the 15th percentile for age (amber flag)
  - Falls below the 5th percentile for age (red flag)
  - Shows a declining trend across 3+ visits (amber flag)
  - Shows inconsistency (high variability across visits) (amber flag)
- Each flag includes:
  - Which metric triggered it
  - Current value vs. age-matched average
  - Suggested follow-up (e.g., "Consider formal attention assessment")
  - Explicit disclaimer: "This is a developmental pattern, not a diagnosis"

### 6.3 Design Principles for the Dashboard

- **30-second scan:** A doctor should be able to glance at a patient's dashboard in 30 seconds and know if anything needs attention. Green/amber/red is enough.
- **Drill down optional:** Details are there for doctors who want them, but never required.
- **No jargon:** Use "attention," "memory," "motor control" — not "sustained attention deficit" or "working memory impairment."
- **Print-friendly:** Dashboard views should be printable for chart notes if needed.

---

## 7. Clinic Admin Panel

### 7.1 Features

| Feature | Description |
|---------|-------------|
| **Staff management** | Add/remove staff members, assign PINs for tablet access |
| **Tablet management** | Register tablets by device ID, monitor online/offline status, remote lock |
| **Patient list** | Upload patient list via CSV (name, DOB, MRN). Manual add/edit. |
| **Usage analytics** | Sessions per day/week/month, average play duration, completion rates |
| **Settings** | Clinic name, logo, notification preferences |

### 7.2 Patient Data Sync (MVP)

For MVP, patient data is loaded via CSV upload:
- Required fields: first name, last name, date of birth
- Optional fields: MRN (medical record number), guardian name
- Duplicate detection by name + DOB
- EHR auto-sync is deferred to Phase 2

---

## 8. Data Architecture

### 8.1 Data Collected Per Game Session

**Metadata:**
- Session ID (UUID)
- Patient ID (internal, linked to clinic patient record)
- Clinic ID
- Tablet device ID
- Session start/end timestamps
- Consent timestamp and method

**Per-Game Raw Data:**
- Every tap/swipe event with timestamp and coordinates
- Reaction times per stimulus
- Accuracy per trial
- Path trace coordinates (Wind Trails)
- Rule-switch response data (Sky Sort)

**Per-Game Computed Metrics:**
- Aggregate scores per domain (attention, memory, motor, processing speed, flexibility)
- Percentile ranking vs. age-matched norms (once sufficient data exists)
- Session-over-session delta (trend)

### 8.2 Data NOT Collected

- No photos, video, or audio of the child
- No biometric data (face, fingerprint, voice)
- No device-level tracking (no ad IDs, no cross-app tracking)
- No location data beyond clinic association
- No free-text input from the child

### 8.3 Data Retention

- Game session data retained for the duration of the clinic's subscription + 1 year
- De-identified aggregate data may be retained indefinitely for normative dataset building (with consent)
- Parents may request deletion of their child's data at any time (COPPA requirement)

---

## 9. Non-Functional Requirements

### 9.1 Security & Compliance

| Requirement | Standard |
|-------------|----------|
| Encryption at rest | AES-256 |
| Encryption in transit | TLS 1.3 |
| Authentication (dashboard) | Email + password with MFA (TOTP) |
| Authentication (tablet) | 4-6 digit staff PIN |
| Access control | Role-based (admin, clinician, staff) |
| Audit logging | All data access logged with user, timestamp, action |
| HIPAA | Full compliance; BAA with each clinic |
| COPPA | Parental consent before data collection; no persistent identifiers beyond session; data deletion on request |
| SOC 2 | Target Type II certification within 12 months of launch |

### 9.2 Performance

| Metric | Target |
|--------|--------|
| App launch to first game | < 3 seconds |
| Game frame rate | 60 fps on iPad (8th gen+) |
| Touch input latency | < 16ms (1 frame) |
| Dashboard page load | < 2 seconds |
| Data sync (tablet to server) | Within 30 seconds of session end |

### 9.3 Reliability

| Metric | Target |
|--------|--------|
| App crash rate | < 0.1% of sessions |
| Server uptime | 99.9% |
| Data loss | Zero tolerance — all session data must persist |

### 9.4 Device Support

| Platform | Minimum |
|----------|---------|
| iPad app | iPad 8th gen (2020)+, iPadOS 16+ |
| Dashboard | Chrome, Safari, Edge (latest 2 versions) |
| Admin panel | Same as dashboard |
| Android | Not in MVP |

### 9.5 Accessibility

- All games playable with one hand
- No color-only indicators (use shape + color)
- Audio narration optional (not required for gameplay)
- High contrast mode available
- Touch targets minimum 44x44pt (Apple HIG)

---

## 10. Success Metrics

### 10.1 MVP Launch Criteria (before first clinic deployment)

- [ ] All 4 games functional and tested with 10+ children ages 4-7
- [ ] Kiosk mode prevents exit from app
- [ ] Session data flows from tablet to dashboard within 30 seconds
- [ ] Dashboard displays per-visit summary and longitudinal trends
- [ ] Consent flow meets COPPA requirements (legal review)
- [ ] HIPAA compliance verified (security audit)
- [ ] Staff can start a session in < 30 seconds

### 10.2 Pilot Success Metrics (first 3 months, 3-5 clinics)

| Metric | Target |
|--------|--------|
| Session completion rate | > 80% of started sessions |
| Average play time | 8-12 minutes |
| Child engagement (no forced quits) | > 90% |
| Clinician dashboard views per week | > 3 per provider |
| Clinician satisfaction (survey) | > 4/5 |
| Parent consent rate | > 70% |
| Flagged patterns reviewed by clinician | > 50% |
| Zero data security incidents | 100% |

### 10.3 Growth Metrics (months 4-12)

| Metric | Target |
|--------|--------|
| Clinics onboarded | 20-50 |
| Monthly recurring revenue | $5K-$20K |
| Net promoter score (clinicians) | > 40 |
| Returning players (same child, 2+ sessions) | > 60% |
| Churn rate (monthly) | < 5% |

---

## 11. Phased Roadmap

### Phase 1: MVP (this document) — Months 1-4
- 4 mini-games, ages 4-7
- Clinic iPad kiosk deployment
- Clinician web dashboard
- Staff session management
- Basic admin panel

### Phase 2: Expand & Validate — Months 5-9
- Add ages 2-4 games (simpler interactions: tap, drag, cause-effect)
- Add ages 8-12 games (puzzles, strategy, reaction challenges)
- EHR integration (Epic App Orchard / FHIR)
- Parent portal (view play history, developmental tips)
- PDF visit reports for chart notes
- Begin formal clinical validation study (partner with academic center)
- Multi-language support (Spanish priority)

### Phase 3: Scale & Certify — Months 10-18
- BYOD support (parent phones as secondary option)
- Billing integration (96110 auto-documentation)
- Advanced ML-based pattern detection
- Publish clinical validation study
- Begin FDA Pre-Submission (Q-Sub) dialogue if pursuing SaMD path
- Android tablet support
- Offline mode with background sync

### Phase 4: Market Leadership — Months 18+
- FDA De Novo authorization for specific screening claims
- Payer contracts for reimbursement
- National scale (500+ clinics)
- Research partnerships for new assessment domains
- International expansion

---

## 12. Open Questions

| Question | Impact | Owner |
|----------|--------|-------|
| Which iPad model to standardize on for clinic kits? | Hardware cost, performance baseline | Product |
| MDM solution selection (Jamf, Mosyle, etc.)? | Tablet management capability | Engineering |
| Legal review of CDS-exempt positioning | Regulatory risk | Legal counsel |
| Clinical advisory board recruitment | Credibility, game design validation | Founder |
| Normative data bootstrapping — how to establish age benchmarks before large dataset? | Flag accuracy | Data science |
| Insurance for product liability (E&O)? | Risk mitigation | Legal/Finance |

---

## 13. Assumptions & Dependencies

**Assumptions:**
- Clinics have reliable WiFi in waiting rooms
- Parents will consent to their child playing (>70% consent rate)
- Children ages 4-7 can engage with tablet games for 10-15 minutes
- Pediatricians will check a dashboard if integration into workflow is simple
- Clinic staff can manage tablet handoff without significant burden

**Dependencies:**
- Apple Developer Enterprise account for kiosk deployment
- HIPAA-compliant cloud hosting (AWS/GCP with BAA)
- Legal counsel for COPPA/HIPAA/CDS compliance review
- Child UX testing (minimum 10 children before launch)
- Clinical advisor to validate game-metric mappings

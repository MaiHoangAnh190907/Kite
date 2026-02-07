# Track A: iPad Mobile App

> **Terminal 1 of 3** — This track builds the child-facing iPad app.
> Works primarily in `apps/mobile/`.

## Prerequisites

- [ ] Track B has completed **Phase 0 (Foundation)** and pushed to git
- [ ] You have pulled the latest code: `git pull origin main`
- [ ] Run `pnpm install` to install all dependencies

## What You Own

```
apps/mobile/              ← YOUR TERRITORY (full ownership)
packages/shared/types/    ← READ ONLY (Track B owns, you consume)
```

**Do NOT modify** `apps/api/`, `apps/dashboard/`, or `packages/shared/` directly.
If you need a new shared type, add it to `apps/mobile/src/types/local.ts` and flag it
for Track B to merge into `packages/shared/` later.

## API Mocking Strategy

You will build against a **mock API** so you don't need the real backend running.
Create `apps/mobile/src/services/mock-api.ts` with hardcoded responses matching
the API spec in `agent_docs/api.md`. Use an environment variable to toggle:

```typescript
// apps/mobile/src/services/api.ts
const useMock = process.env.EXPO_PUBLIC_USE_MOCK_API === 'true';
```

This lets you develop the entire app offline and swap to the real API at integration time.

## Reference Docs

| What | Where |
|------|-------|
| Game specs (YOUR BIBLE) | `agent_docs/games.md` |
| API contract (mock against this) | `agent_docs/api.md` |
| App architecture | `docs/TechDesign-kite.md` section 2 |
| User flows | `docs/PRD-kite.md` sections 4.1, 5 |
| Shared types | `packages/shared/src/types/` |

---

## Phase A1: Tablet App Shell

**Goal:** Expo app with navigation, staff PIN, patient selection, consent, end screen.

### Tasks:

1. **Initialize Expo project** (`apps/mobile`)
   - Expo SDK 52+ with TypeScript template
   - Expo Router for file-based navigation
   - Target: iPad only (tablet layout)
   - Configure app.json: name "Kite", bundle ID `com.kitehealth.app`, iPad-only, landscape + portrait
   - Install core deps: expo-secure-store, zustand, axios

2. **Mock API service** (`services/mock-api.ts`)
   - Mock `POST /auth/tablet/verify` → returns JWT for PIN "1234"
   - Mock `GET /sessions/patients/today` → returns 5 test patients
   - Mock `POST /sessions` → returns session ID
   - Mock `POST /sessions/:id/events` → returns success
   - Mock `PATCH /sessions/:id/complete` → returns success
   - All responses match `agent_docs/api.md` schemas exactly

3. **Real API client** (`services/api.ts`)
   - Axios instance with base URL from env config
   - Automatic JWT attachment via interceptor
   - Token refresh interceptor (on 401, refresh and retry)
   - Toggle between mock and real via `EXPO_PUBLIC_USE_MOCK_API`

4. **Staff PIN screen** (`app/(staff)/login.tsx`)
   - Numeric keypad UI (large touch targets, 88x88pt buttons)
   - 4-6 digit PIN entry with dot indicators
   - Calls auth/tablet/verify (mock or real)
   - Stores tablet JWT via expo-secure-store
   - Error state: "Invalid PIN" shake animation
   - Sky blue gradient background, Kite logo at top

5. **Patient selection screen** (`app/(staff)/select-patient.tsx`)
   - Fetches today's appointment list from API
   - Scrollable list of patient cards: first name, last initial, age, avatar placeholder
   - Tap to select → confirm dialog → navigate to consent
   - Search/filter by name
   - Empty state: "No appointments found for today"

6. **Parent consent screen** (`app/(consent)/consent.tsx`)
   - Warm, friendly design (sky background, cloud accents)
   - Header: "Welcome to Kite!" with Breeze character waving
   - 3-4 bullet points with simple icons (no legal jargon):
     - Game controller icon: "Your child will play fun games"
     - Chart icon: "Games help the doctor track development"
     - Camera-off icon: "No photos, videos, or recordings"
     - Trash icon: "You can ask to delete data anytime"
   - [Start Playing] (primary, large, golden) and [No Thanks] (secondary, small, grey)
   - [Start Playing] → POST /sessions → navigate to game hub
   - [No Thanks] → navigate back to patient selection

7. **Session end screen** (`app/(end)/complete.tsx`)
   - "Great flying! Time to see the doctor!" (with icons, minimal text)
   - Placeholder Breeze celebration animation
   - Auto-reset countdown: visible 30-second timer
   - After countdown → clear state → navigate to staff PIN screen
   - "Please hand the iPad back to the front desk" with hand-pointing icon

8. **App navigation structure**
   ```
   app/
   ├── (staff)/
   │   ├── _layout.tsx       # Stack navigator for staff screens
   │   ├── login.tsx          # PIN entry
   │   └── select-patient.tsx # Patient picker
   ├── (consent)/
   │   └── consent.tsx        # Parent consent
   ├── (game)/
   │   ├── _layout.tsx        # Game session wrapper
   │   ├── hub.tsx            # Pre-game lobby (placeholder for now)
   │   └── [placeholder screens for games]
   └── (end)/
       └── complete.tsx       # Session end
   ```

### Acceptance Criteria:
- App boots on iPad simulator to staff PIN screen
- PIN "1234" → patient list → tap patient → consent → game hub placeholder → end screen → auto-reset
- Invalid PIN shows shake animation
- "No Thanks" returns to patient selection
- Mock API responses match `agent_docs/api.md` exactly
- All screens have consistent sky-blue theme

---

## Phase A2: Game Engine + Cloud Catch

**Goal:** Skia-based game rendering engine and first complete mini-game.

### Tasks:

1. **Install React Native Skia**
   - `@shopify/react-native-skia` package
   - Verify 60fps rendering on iPad simulator
   - Create base `GameCanvas` component wrapping Skia canvas with standard sizing

2. **Touch tracking system** (`components/game-engine/TouchTracker.tsx`)
   - Transparent overlay capturing all touch events on the game canvas
   - Records per event: timestamp (`performance.now()`), x, y, phase, pressure
   - Normalizes coordinates to 0-1 range (fraction of canvas size)
   - Stores events in Zustand game store
   - Exports: `useTouchEvents()` hook for games to access recorded data

3. **Game session manager** (`stores/game-store.ts`)
   - Zustand store with:
     - `sessionId: string`
     - `currentGameIndex: number` (0-3)
     - `gameOrder: GameType[]`
     - `eventsByGame: Record<GameType, GameEvent[]>`
     - `stickersEarned: string[]`
   - Actions: `startSession()`, `startGame()`, `recordEvent()`, `endGame()`, `endSession()`
   - On `endSession()`: calls API to upload all game events, then navigates to end screen

4. **Game Hub screen** (`app/(game)/hub.tsx`)
   - Full-screen sky background (gradient: light blue top, warm blue bottom)
   - Animated clouds drifting slowly
   - Breeze kite character bobbing in center (Skia path animation)
   - "Ready to fly?" appears via fade-in (icon + animation, not text-heavy)
   - Auto-advances to Cloud Catch after 3 seconds

5. **Cloud Catch game** (`app/(game)/cloud-catch.tsx`)
   - **FOLLOW `agent_docs/games.md` — Cloud Catch section EXACTLY**
   - Parallax sky background (far clouds slow, near clouds fast)
   - Golden clouds: fluffy, bright, ~80x80pt, slight glow
   - Storm clouds: dark grey, ~80x80pt, tiny lightning icon
   - Spawn from top/sides, drift downward
   - Tap detection: register tap on cloud if finger within 44pt of center
   - Difficulty ramp per the games.md time table
   - Breeze at bottom: bounces on correct tap, small shake on storm tap
   - Data collection: stimulus events, tap events, miss events (per games.md spec)
   - Duration: 150 seconds with visible progress indicator (subtle, non-distracting)
   - End: clouds clear, sun appears, star earned, sticker earned

6. **Transition animation** (`components/game-engine/Transition.tsx`)
   - Breeze flies left-to-right across screen
   - Sky background shifts color slightly for next game zone
   - 3-second animation
   - Reusable — accepts `fromGame` and `toGame` props for theme shifts

7. **Reward components**
   - `StarReward.tsx` — golden star floats down with sparkle particles
   - `StickerReveal.tsx` — sticker appears with a "peel" animation
   - Used at the end of every game (always awarded, never withheld)

### Acceptance Criteria:
- Cloud Catch plays smoothly at 60fps on iPad simulator
- Clouds spawn, drift, and despawn correctly
- Tap on golden cloud → correct, tap on storm cloud → incorrect, both recorded
- Difficulty increases over 2.5 minutes per the schedule
- All events recorded with timestamps in the game store
- Star and sticker awarded at game end
- Hub → Cloud Catch → transition works smoothly

---

## Phase A3: Remaining Games

**Goal:** Star Sequence, Wind Trails, Sky Sort all playable. Full 4-game session works.

### Tasks:

1. **Star Sequence** (`app/(game)/star-sequence.tsx`)
   - **FOLLOW `agent_docs/games.md` — Star Sequence section EXACTLY**
   - Night sky background (dark purple)
   - 3x3 grid of dim stars, expanding to 4x4 at sequence length 5+
   - Stars light up golden in sequence, child taps to replay
   - Correct: star stays golden + "ding" audio cue
   - Incorrect: gentle blue glow (NOT red/negative), round resets
   - Sequence grows from length 2 to 7+
   - Ends after 2 consecutive failures at max reached length, or at 150s
   - Record: sequence shown, sequence tapped, per-tap timestamps

2. **Wind Trails** (`app/(game)/wind-trails.tsx`)
   - **FOLLOW `agent_docs/games.md` — Wind Trails section EXACTLY**
   - Daytime sky with distant mountains
   - Path rendered as dashed Skia Path from green circle to golden star
   - Child traces with finger, golden trail appears
   - On-path: bright golden trail + sparkle particles
   - Off-path: trail fades to light blue (NOT red)
   - 6 paths of increasing complexity (S-curves → spirals → complex)
   - Record finger position every frame (60hz) with deviation from ideal
   - Cloud checkpoint puffs along the path

3. **Sky Sort** (`app/(game)/sky-sort.tsx`)
   - **FOLLOW `agent_docs/games.md` — Sky Sort section EXACTLY**
   - Objects fall from top: birds, butterflies, airplanes, kites
   - Two baskets at bottom with icon labels
   - Swipe left/right to sort
   - Rule switches at 50s and 100s (type → color → size)
   - Rule indicator at top updates with animation during switch
   - Record: each sort with object info, direction, correctness, reaction time

4. **Full session flow**
   - Hub → Cloud Catch → transition → Star Sequence → transition → Wind Trails → transition → Sky Sort → celebration → end screen
   - Game store tracks progress: `currentGameIndex` advances after each game
   - Partial session: if interrupted after any game, upload completed games only
   - Each game's events stored separately in `eventsByGame`

5. **Celebration screen** (`app/(game)/celebration.tsx`)
   - Show 4 stars earned (one per game, always 4)
   - Show 4 stickers: Sun, Constellation, Rainbow, Balloon
   - Breeze does a victory sky-loop animation
   - On repeat visits: show previously earned stickers alongside new ones (from API)
   - 5-second celebration → auto-navigate to end screen

6. **Session data upload**
   - On session end: batch upload all game events via `POST /sessions/:id/events` (one call per game)
   - Then `PATCH /sessions/:id/complete`
   - Show "Saving your adventure..." with animated Breeze during upload
   - On success: navigate to end screen
   - On failure: queue for retry (store in secure local storage, see Phase A4)

### Acceptance Criteria:
- All 4 games play at 60fps, follow specs in `agent_docs/games.md` exactly
- Full session takes 10-14 minutes
- All events recorded with correct data shapes per games.md
- Partial sessions (child called in after 2 games) upload completed games
- No text in game screens — all visual/animated
- No failure messaging — always positive reinforcement
- Stickers and stars always awarded

---

## Phase A4: Kiosk Mode & Polish

**Goal:** iPad locked down, session lifecycle hardened, visual polish.

### Tasks:

1. **Kiosk mode**
   - Programmatic Guided Access via `UIAccessibility` native module
   - If native module not feasible in Expo: document MDM (Jamf) Single App Mode config
   - Prevent: home button, control center, notifications, volume buttons
   - Test: verify child cannot escape app

2. **Auto-reset hardening**
   - End screen: 30-second visible countdown → resets to PIN screen
   - Global inactivity timeout: 120 seconds of no touch on ANY screen → reset to PIN
   - On reset: clear Zustand store, clear secure storage session data, reset navigation stack
   - Memory cleanup: after successful upload, purge game events from memory

3. **Upload retry with offline queue**
   - If upload fails (network error, server error): encrypt events with device key, store in expo-secure-store
   - Background retry: exponential backoff (5s, 15s, 60s, 5min)
   - On next successful API call: check queue and flush pending uploads
   - Staff-visible indicator on PIN screen: "1 session pending sync" (amber dot)
   - Never lose session data — this is critical

4. **Visual polish pass**
   - Consistent color palette per `agent_docs/games.md` color table
   - Smooth screen transitions (fade/slide, 300ms)
   - Loading states: skeleton screens with gentle pulse animation
   - Error states: friendly cloud illustration with retry button
   - Haptic feedback: light tap on buttons, medium on game events
   - App icon: Breeze kite character on sky blue background

5. **Accessibility**
   - Touch targets: minimum 44x44pt everywhere (66x66pt in games)
   - Color contrast: WCAG AA on staff/consent screens
   - VoiceOver labels on staff PIN screen, patient selection, consent screen
   - Game screens: VoiceOver not applicable (visual/interactive only)

### Acceptance Criteria:
- iPad cannot exit Kite app (Guided Access or MDM)
- Upload retry works: disconnect WiFi → play session → reconnect → data syncs
- Inactivity resets to PIN screen after 120s
- All screens visually consistent with the sky/kite theme
- No accessibility violations on non-game screens

---

## Integration Checklist (after all tracks merge)

- [ ] Replace mock API with real API (`EXPO_PUBLIC_USE_MOCK_API=false`)
- [ ] Verify tablet auth flow works with real backend
- [ ] Verify patient list loads from real database
- [ ] Verify game data uploads and appears in `game_results` table
- [ ] Verify metrics are computed after session completion
- [ ] Verify flags appear on dashboard for the same patient
- [ ] Test full flow: PIN → patient → consent → 4 games → upload → dashboard shows data

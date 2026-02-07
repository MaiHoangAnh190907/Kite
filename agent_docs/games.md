# Game Specifications

> These specs define the exact behavior, data collection, and difficulty scaling for each
> mini-game. Each game must feel like fun play — never like a test.

## Shared Design Principles

- **No text.** All instructions conveyed via animation, icons, and optional audio.
- **No failure state.** Every child earns a star for every game, regardless of performance.
- **No scores visible.** The child never sees accuracy numbers or rankings.
- **Positive reinforcement only.** Sparkles, stars, happy sounds. Never "wrong" or "try again."
- **Consistent art style.** Hand-illustrated storybook aesthetic. Bright, warm colors.
- **60fps mandatory.** All animations must run at 60fps on iPad 8th gen.
- **Touch targets:** Minimum 66x66pt for game elements (children have less precision).

## Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Sky Blue | `#87CEEB` | Background base |
| Sunset Orange | `#FF8C42` | Accent, Breeze kite color |
| Cloud White | `#F8F9FA` | Clouds, UI elements |
| Grass Green | `#4CAF50` | Success feedback |
| Storm Grey | `#78909C` | Avoid targets |
| Golden Yellow | `#FFD700` | Stars, tap targets |
| Soft Purple | `#B39DDB` | Night sky variant |

## Breeze (Kite Character)

- Diamond-shaped kite with a long flowing tail
- Color: Sunset Orange body, white pattern, colorful tail streamers
- Idle animation: gentle bobbing + tail swaying
- Happy animation: loop-de-loop, tail sparkles
- Flying animation: moves left-to-right with slight vertical wave
- Rendered as Skia Path with animated control points

---

## Game 1: Cloud Catch

**Domain:** Attention & Reaction Time
**Duration:** 150 seconds (2.5 minutes)
**Concept:** Tap the golden clouds, avoid the storm clouds.

### Visual Design

- Sky background with gentle parallax scrolling (far clouds move slow, near clouds move fast)
- Golden clouds: fluffy, bright, slightly glowing edge
- Storm clouds: dark grey, slightly jagged edges, tiny lightning icon
- Clouds spawn from top and sides, drift downward at varying speeds
- Breeze hovers at bottom of screen, reacts to taps (happy bounce on correct, small shake on miss)

### Difficulty Progression

| Time | Cloud Speed | Spawn Rate | Distractors |
|------|------------|------------|-------------|
| 0-30s | Slow (3s to cross screen) | 1 cloud/2s | None |
| 30-60s | Medium (2.5s) | 1 cloud/1.5s | Birds fly across (ignore) |
| 60-90s | Medium-fast (2s) | 1 cloud/1.2s | Rainbows appear (ignore) |
| 90-120s | Fast (1.5s) | 1 cloud/1s | Mixed distractors |
| 120-150s | Fast (1.5s) | 1 cloud/0.8s | Storm clouds increase to 40% |

### Target Mix

- Golden clouds (tap): 60-70% of spawns
- Storm clouds (avoid): 20-30% of spawns
- Distractors (ignore): 10% of spawns (after 30s)

### Data Collection

For each cloud that appears:
```typescript
{
  type: 'stimulus',
  stimulusId: string,       // Unique cloud ID
  stimulusType: 'golden' | 'storm' | 'distractor',
  spawnTimestamp: number,    // When cloud appeared
  spawnPosition: { x, y },
  speed: number,
}
```

For each tap:
```typescript
{
  type: 'tap',
  timestamp: number,
  position: { x, y },
  targetId: string | null,  // Cloud tapped (null if tap missed all clouds)
  correct: boolean,          // True if golden cloud tapped
  reactionTimeMs: number,   // Time since this cloud spawned
}
```

For each cloud that exits screen untapped:
```typescript
{
  type: 'miss',
  stimulusId: string,
  stimulusType: 'golden',   // Only log misses for golden clouds
  timeOnScreen: number,
}
```

### Computed Metrics

| Metric | Formula |
|--------|---------|
| `attention_accuracy` | golden_tapped / total_golden_spawned |
| `reaction_time_mean` | mean(reactionTimeMs) for correct taps |
| `reaction_time_cv` | std(reactionTimeMs) / mean(reactionTimeMs) |
| `false_positive_rate` | storm_tapped / total_taps |
| `attention_decay` | accuracy_last_30s / accuracy_first_30s |

### End Animation

- Clouds clear away revealing bright sun
- Stars float down (always earn 1 star)
- Breeze does a happy loop

---

## Game 2: Star Sequence

**Domain:** Working Memory
**Duration:** ~150 seconds (adaptive — ends early on 2 consecutive max-length failures)
**Concept:** Stars light up in a sequence. Tap them in the same order.

### Visual Design

- Dark purple sky background (night theme)
- Stars arranged in a grid pattern
- Inactive stars: dim white glow
- Active stars (during sequence): bright golden pulse with sparkle effect
- Correct tap: star stays golden with a "ding" sound
- Incorrect tap: gentle blue glow (not red/negative) and sequence resets for that round
- Grid starts as 3x3 (9 stars), expands to 4x4 (16 stars) at sequence length 5+

### Difficulty Progression

| Round | Sequence Length | Grid Size | Timing |
|-------|----------------|-----------|--------|
| 1-3 | 2 | 3x3 | 800ms between stars |
| 4-6 | 3 | 3x3 | 700ms between stars |
| 7-9 | 4 | 3x3 | 600ms between stars |
| 10-12 | 5 | 4x4 | 600ms between stars |
| 13-15 | 6 | 4x4 | 500ms between stars |
| 16+ | 7+ | 4x4 | 500ms between stars |

After 2 consecutive failures at the same length, game ends.

### Data Collection

Per round:
```typescript
{
  type: 'round',
  roundNumber: number,
  sequenceLength: number,
  sequenceShown: number[],      // Star indices in order shown
  sequenceTapped: number[],     // Star indices in order tapped
  correct: boolean,
  tapTimestamps: number[],      // Timestamp of each tap
  interTapIntervals: number[],  // Time between consecutive taps
}
```

### Computed Metrics

| Metric | Formula |
|--------|---------|
| `max_sequence_length` | Longest sequence correctly recalled |
| `memory_accuracy` | correct_rounds / total_rounds |
| `learning_rate` | Linear regression slope of accuracy over rounds |
| `spatial_error_pattern` | Frequency map of position confusions (which stars get swapped) |

### End Animation

- Stars form a constellation shape (smiley face or kite)
- Breeze flies through the constellation
- Star reward floats down

---

## Game 3: Wind Trails

**Domain:** Fine Motor Control
**Duration:** ~150 seconds
**Concept:** Trace a winding path through the sky with your finger.

### Visual Design

- Daytime sky background with distant mountains
- Path: visible dashed line from start (green circle) to end (golden star)
- Paths curve, loop, and narrow — like wind currents in the sky
- Tracing feedback:
  - On path: finger leaves a bright golden trail, gentle sparkle particles
  - Off path: trail fades to light blue (not red/wrong), still visible
- Small cloud icons along the path as checkpoints (puff animation when reached)
- Breeze follows the child's finger along the path

### Path Progression (6 paths total)

| Path | Shape | Width | Features |
|------|-------|-------|----------|
| 1 | Gentle S-curve | Wide (44pt) | Straight sections |
| 2 | Tighter S-curve | Wide (44pt) | Longer path |
| 3 | Loop + curve | Medium (33pt) | First loop |
| 4 | Zigzag | Medium (33pt) | Sharp direction changes |
| 5 | Spiral inward | Narrow (22pt) | Continuous curve |
| 6 | Complex path (curves + loops + zigzag) | Narrow (22pt) | All elements combined |

### Data Collection

Continuous (every frame, 60hz):
```typescript
{
  type: 'trace',
  pathIndex: number,          // Which path (0-5)
  timestamp: number,
  fingerPosition: { x, y },
  idealPosition: { x, y },   // Nearest point on ideal path
  deviation: number,          // Distance from ideal path (px)
  pressure: number | null,    // If available
  speed: number,              // px/ms of finger movement
}
```

Per path:
```typescript
{
  type: 'path_complete',
  pathIndex: number,
  duration: number,
  meanDeviation: number,
  maxDeviation: number,
  completionPercent: number,  // % of path where finger was within bounds
  smoothnessScore: number,    // Based on jerk metric
}
```

### Computed Metrics

| Metric | Formula |
|--------|---------|
| `motor_precision` | mean(deviation) across all paths, normalized to path width |
| `motor_smoothness` | mean(jerk) — lower is smoother. Jerk = rate of acceleration change |
| `completion_rate` | mean(completionPercent) across all paths |
| `speed_accuracy_ratio` | (speed_percentile) / (accuracy_percentile) — high = rushing |

### End Animation

- Trail transforms into a rainbow across the sky
- Breeze slides down the rainbow
- Star reward

---

## Game 4: Sky Sort

**Domain:** Categorization, Processing Speed & Cognitive Flexibility
**Duration:** 150 seconds (2.5 minutes)
**Concept:** Sort falling objects into the correct baskets by swiping.

### Visual Design

- Sky background fading into ground at bottom
- Two baskets at bottom-left and bottom-right (labeled with icons, not text)
- Objects fall from top center with slight random horizontal offset
- Object types: birds (blue), butterflies (orange), airplanes (grey), kites (red)
- Each object ~80x80pt with distinct silhouette
- Correct sort: object slides into basket, small celebration burst
- Incorrect sort: object gently bounces back up and fades (not punishing)
- Rule indicator at top: two icons showing "what goes where"

### Rule Progression

| Time | Rule | Left Basket | Right Basket |
|------|------|-------------|--------------|
| 0-50s | Sort by type | Birds + Butterflies (nature) | Airplanes + Kites (flying things) |
| 50-55s | Rule switch animation (baskets glow, new icons) | | |
| 55-100s | Sort by color | Blue + Grey (cool colors) | Orange + Red (warm colors) |
| 100-105s | Rule switch animation | | |
| 105-150s | Sort by size | Small objects | Large objects |

### Object Spawn Rate

| Time | Rate | Fall Speed |
|------|------|------------|
| 0-50s | 1 object/2.5s | Slow (3s to reach baskets) |
| 55-100s | 1 object/2s | Medium (2.5s) |
| 105-150s | 1 object/1.5s | Medium-fast (2s) |

### Data Collection

Per object:
```typescript
{
  type: 'sort',
  objectId: string,
  objectType: 'bird' | 'butterfly' | 'airplane' | 'kite',
  objectColor: string,
  objectSize: 'small' | 'large',
  currentRule: 'type' | 'color' | 'size',
  spawnTimestamp: number,
  sortTimestamp: number,
  direction: 'left' | 'right',
  correct: boolean,
  reactionTimeMs: number,
}
```

Per rule switch:
```typescript
{
  type: 'rule_switch',
  fromRule: string,
  toRule: string,
  timestamp: number,
  firstSortAfterSwitch: {
    reactionTimeMs: number,
    correct: boolean,
  },
}
```

### Computed Metrics

| Metric | Formula |
|--------|---------|
| `processing_speed` | correct_sorts / total_time_minutes |
| `sort_accuracy` | correct_sorts / total_sorts |
| `switch_cost` | accuracy_after_switch (first 5 sorts) - accuracy_before_switch (last 5 sorts) |
| `error_recovery_time` | mean time from error to next correct sort |

### End Animation

- All remaining objects transform into confetti
- Baskets open and release balloons
- Breeze catches balloons and floats up
- Star reward

---

## Session Reward Summary

After all 4 games, the celebration screen shows:
- 4 stars earned (always 4 — one per game)
- 4 sky stickers collected (one per game):
  - Cloud Catch → Sun sticker
  - Star Sequence → Constellation sticker
  - Wind Trails → Rainbow sticker
  - Sky Sort → Balloon sticker
- Breeze does a final sky dance
- "Great flying today! Time to see the doctor!"
- On repeat visits, previously earned stickers are shown alongside new ones

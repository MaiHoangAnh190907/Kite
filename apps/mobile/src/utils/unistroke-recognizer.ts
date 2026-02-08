/**
 * $1 Unistroke Recognizer (Wobbrock et al., 2007)
 * Recognizes single-stroke gestures from a set of templates.
 */

interface Point {
  x: number;
  y: number;
}

export type SymbolName =
  | 'horizontal_line'
  | 'vertical_line'
  | 'v_shape'
  | 'inverted_v'
  | 'circle';

export interface RecognitionResult {
  name: SymbolName;
  score: number;
}

const NUM_POINTS = 64;
const SQUARE_SIZE = 250;
const HALF_DIAGONAL = 0.5 * Math.sqrt(SQUARE_SIZE * SQUARE_SIZE + SQUARE_SIZE * SQUARE_SIZE);
const ANGLE_RANGE = Math.PI * 0.25; // 45 degrees
const ANGLE_PRECISION = Math.PI / 90; // 2 degrees
const PHI = 0.5 * (-1 + Math.sqrt(5)); // golden ratio

// ─── Geometry helpers ────────────────────────────────────────────────

function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function pathLength(points: Point[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += distance(points[i - 1], points[i]);
  }
  return d;
}

function centroid(points: Point[]): Point {
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / points.length, y: cy / points.length };
}

function boundingBox(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

// ─── Algorithm steps ─────────────────────────────────────────────────

function resample(points: Point[], n: number): Point[] {
  const interval = pathLength(points) / (n - 1);
  let D = 0;
  const newPoints: Point[] = [{ ...points[0] }];

  for (let i = 1; i < points.length; i++) {
    const d = distance(points[i - 1], points[i]);
    if (D + d >= interval) {
      let remaining = interval - D;
      let prev = points[i - 1];
      while (D + d >= interval && newPoints.length < n) {
        const t = remaining / distance(prev, points[i]);
        const nx = prev.x + t * (points[i].x - prev.x);
        const ny = prev.y + t * (points[i].y - prev.y);
        const newPt = { x: nx, y: ny };
        newPoints.push(newPt);
        prev = newPt;
        remaining = interval;
        D = 0;
      }
      D = distance(prev, points[i]);
    } else {
      D += d;
    }
  }

  while (newPoints.length < n) {
    newPoints.push({ ...points[points.length - 1] });
  }

  return newPoints.slice(0, n);
}

function rotateBy(points: Point[], angle: number): Point[] {
  const c = centroid(points);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return points.map((p) => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }));
}

function rotateToZero(points: Point[]): Point[] {
  const c = centroid(points);
  const angle = Math.atan2(c.y - points[0].y, c.x - points[0].x);
  return rotateBy(points, angle);
}

function scaleToSquare(points: Point[], size: number): Point[] {
  const bb = boundingBox(points);
  const w = bb.maxX - bb.minX;
  const h = bb.maxY - bb.minY;
  const sx = w > 0 ? size / w : 1;
  const sy = h > 0 ? size / h : 1;
  return points.map((p) => ({
    x: p.x * sx,
    y: p.y * sy,
  }));
}

function translateToOrigin(points: Point[]): Point[] {
  const c = centroid(points);
  return points.map((p) => ({
    x: p.x - c.x,
    y: p.y - c.y,
  }));
}

function distanceAtAngle(points: Point[], template: Point[], angle: number): number {
  const rotated = rotateBy(points, angle);
  let d = 0;
  for (let i = 0; i < rotated.length; i++) {
    d += distance(rotated[i], template[i]);
  }
  return d / rotated.length;
}

function distanceAtBestAngle(
  points: Point[],
  template: Point[],
  angleA: number,
  angleB: number,
  threshold: number,
): number {
  let a = angleA;
  let b = angleB;
  let x1 = PHI * a + (1 - PHI) * b;
  let x2 = (1 - PHI) * a + PHI * b;
  let f1 = distanceAtAngle(points, template, x1);
  let f2 = distanceAtAngle(points, template, x2);

  while (Math.abs(b - a) > threshold) {
    if (f1 < f2) {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = PHI * a + (1 - PHI) * b;
      f1 = distanceAtAngle(points, template, x1);
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = (1 - PHI) * a + PHI * b;
      f2 = distanceAtAngle(points, template, x2);
    }
  }

  return Math.min(f1, f2);
}

// ─── Template processing ─────────────────────────────────────────────

function processTemplate(rawPoints: Point[]): Point[] {
  let pts = resample(rawPoints, NUM_POINTS);
  pts = rotateToZero(pts);
  pts = scaleToSquare(pts, SQUARE_SIZE);
  pts = translateToOrigin(pts);
  return pts;
}

// ─── Generate template points ────────────────────────────────────────

function makeLinePoints(x1: number, y1: number, x2: number, y2: number, n: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
  }
  return pts;
}

function makeCirclePoints(cx: number, cy: number, r: number, n: number, clockwise: boolean): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const angle = clockwise
      ? (i / n) * Math.PI * 2
      : -(i / n) * Math.PI * 2;
    pts.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }
  return pts;
}

function makeVPoints(down: boolean, spread: number = 100): Point[] {
  const pts: Point[] = [];
  const n = 20;
  const halfSpread = spread / 2;
  const cx = 150;
  if (down) {
    // V shape: top-left → bottom-center → top-right
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push({ x: cx - halfSpread + t * halfSpread, y: 50 + t * 150 });
    }
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      pts.push({ x: cx + t * halfSpread, y: 200 - t * 150 });
    }
  } else {
    // Inverted V: bottom-left → top-center → bottom-right
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push({ x: cx - halfSpread + t * halfSpread, y: 200 - t * 150 });
    }
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      pts.push({ x: cx + t * halfSpread, y: 50 + t * 150 });
    }
  }
  return pts;
}

function makeVPointsReversed(down: boolean, spread: number = 100): Point[] {
  // Same shapes but drawn right-to-left
  return makeVPoints(down, spread).reverse();
}

function makeCirclePointsFromAngle(cx: number, cy: number, r: number, n: number, startAngle: number, clockwise: boolean): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const sweep = clockwise
      ? (i / n) * Math.PI * 2
      : -(i / n) * Math.PI * 2;
    const angle = startAngle + sweep;
    pts.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }
  return pts;
}

// ─── Templates ───────────────────────────────────────────────────────

interface Template {
  name: SymbolName;
  points: Point[];
}

const RAW_TEMPLATES: { name: SymbolName; rawPoints: Point[] }[] = [
  // Horizontal line — left to right
  { name: 'horizontal_line', rawPoints: makeLinePoints(50, 150, 250, 150, 30) },
  // Horizontal line — right to left
  { name: 'horizontal_line', rawPoints: makeLinePoints(250, 150, 50, 150, 30) },
  // Vertical line — top to bottom
  { name: 'vertical_line', rawPoints: makeLinePoints(150, 50, 150, 250, 30) },
  // Vertical line — bottom to top
  { name: 'vertical_line', rawPoints: makeLinePoints(150, 250, 150, 50, 30) },
  // V shape — left-to-right, normal spread
  { name: 'v_shape', rawPoints: makeVPoints(true, 100) },
  // V shape — right-to-left
  { name: 'v_shape', rawPoints: makeVPointsReversed(true, 100) },
  // V shape — wide spread
  { name: 'v_shape', rawPoints: makeVPoints(true, 160) },
  // V shape — narrow spread
  { name: 'v_shape', rawPoints: makeVPoints(true, 60) },
  // Inverted V — left-to-right, normal spread
  { name: 'inverted_v', rawPoints: makeVPoints(false, 100) },
  // Inverted V — right-to-left
  { name: 'inverted_v', rawPoints: makeVPointsReversed(false, 100) },
  // Inverted V — wide spread
  { name: 'inverted_v', rawPoints: makeVPoints(false, 160) },
  // Inverted V — narrow spread
  { name: 'inverted_v', rawPoints: makeVPoints(false, 60) },
  // Circle — clockwise from right (0°)
  { name: 'circle', rawPoints: makeCirclePoints(150, 150, 100, 36, true) },
  // Circle — counterclockwise from right (0°)
  { name: 'circle', rawPoints: makeCirclePoints(150, 150, 100, 36, false) },
  // Circle — clockwise from top (-90°)
  { name: 'circle', rawPoints: makeCirclePointsFromAngle(150, 150, 100, 36, -Math.PI / 2, true) },
  // Circle — counterclockwise from top (-90°)
  { name: 'circle', rawPoints: makeCirclePointsFromAngle(150, 150, 100, 36, -Math.PI / 2, false) },
  // Circle — clockwise from bottom (90°)
  { name: 'circle', rawPoints: makeCirclePointsFromAngle(150, 150, 100, 36, Math.PI / 2, true) },
  // Circle — counterclockwise from left (180°)
  { name: 'circle', rawPoints: makeCirclePointsFromAngle(150, 150, 100, 36, Math.PI, false) },
  // Circle — smaller radius
  { name: 'circle', rawPoints: makeCirclePoints(150, 150, 60, 36, true) },
  { name: 'circle', rawPoints: makeCirclePoints(150, 150, 60, 36, false) },
];

const TEMPLATES: Template[] = RAW_TEMPLATES.map((t) => ({
  name: t.name,
  points: processTemplate(t.rawPoints),
}));

// ─── Public API ──────────────────────────────────────────────────────

export function recognize(points: Point[]): RecognitionResult | null {
  if (points.length < 6) return null;

  let processed = resample(points, NUM_POINTS);
  processed = rotateToZero(processed);
  processed = scaleToSquare(processed, SQUARE_SIZE);
  processed = translateToOrigin(processed);

  let bestDistance = Infinity;
  let bestTemplate: Template | null = null;

  for (const template of TEMPLATES) {
    const d = distanceAtBestAngle(
      processed,
      template.points,
      -ANGLE_RANGE,
      ANGLE_RANGE,
      ANGLE_PRECISION,
    );
    if (d < bestDistance) {
      bestDistance = d;
      bestTemplate = template;
    }
  }

  if (!bestTemplate) return null;

  const score = 1 - bestDistance / HALF_DIAGONAL;

  if (score < 0.35) return null;

  return { name: bestTemplate.name, score };
}

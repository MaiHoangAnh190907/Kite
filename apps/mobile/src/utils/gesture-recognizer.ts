export type GestureSymbol = 'horizontal' | 'vertical' | 'v_shape' | 'circle';

interface Point {
  x: number;
  y: number;
}

interface GestureResult {
  symbol: GestureSymbol | null;
  accuracy: number;
}

function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function boundingBox(points: Point[]): { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += distance(points[i - 1], points[i]);
  }
  return len;
}

function checkHorizontalLine(points: Point[], bb: ReturnType<typeof boundingBox>): number {
  if (bb.width < 30) return 0;
  const aspect = bb.width / Math.max(bb.height, 1);
  if (aspect < 2.5) return 0;

  const yValues = points.map((p) => p.y);
  const yDev = stdDev(yValues);
  const normalizedDev = yDev / Math.max(bb.width, 1);
  if (normalizedDev > 0.15) return 0;

  return Math.min(1, aspect / 5) * (1 - normalizedDev / 0.15);
}

function checkVerticalLine(points: Point[], bb: ReturnType<typeof boundingBox>): number {
  if (bb.height < 30) return 0;
  const aspect = bb.height / Math.max(bb.width, 1);
  if (aspect < 2.5) return 0;

  const xValues = points.map((p) => p.x);
  const xDev = stdDev(xValues);
  const normalizedDev = xDev / Math.max(bb.height, 1);
  if (normalizedDev > 0.15) return 0;

  return Math.min(1, aspect / 5) * (1 - normalizedDev / 0.15);
}

function checkCircle(points: Point[], bb: ReturnType<typeof boundingBox>): number {
  if (points.length < 8) return 0;

  const first = points[0];
  const last = points[points.length - 1];
  const diag = Math.sqrt(bb.width ** 2 + bb.height ** 2);
  if (diag < 30) return 0;

  // End point must be close to start point
  const closeness = distance(first, last) / diag;
  if (closeness > 0.35) return 0;

  // Check aspect ratio is somewhat square
  const aspectRatio = Math.min(bb.width, bb.height) / Math.max(bb.width, bb.height);
  if (aspectRatio < 0.4) return 0;

  // Check path wraps around center
  const centerX = (bb.minX + bb.maxX) / 2;
  const centerY = (bb.minY + bb.maxY) / 2;
  let angleSum = 0;
  for (let i = 1; i < points.length; i++) {
    const a1 = Math.atan2(points[i - 1].y - centerY, points[i - 1].x - centerX);
    const a2 = Math.atan2(points[i].y - centerY, points[i].x - centerX);
    let da = a2 - a1;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    angleSum += da;
  }
  const fullRotation = Math.abs(angleSum) / (2 * Math.PI);
  if (fullRotation < 0.7) return 0;

  return Math.min(1, fullRotation) * (1 - closeness) * aspectRatio;
}

function checkVShape(points: Point[], bb: ReturnType<typeof boundingBox>): number {
  if (points.length < 5) return 0;
  if (bb.width < 25 || bb.height < 25) return 0;

  // Find the point with max Y (bottom-most = vertex of V)
  let vertexIdx = 0;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i++) {
    if (points[i].y > maxY) {
      maxY = points[i].y;
      vertexIdx = i;
    }
  }

  // Vertex should be roughly in the middle portion of the stroke
  const relPos = vertexIdx / (points.length - 1);
  if (relPos < 0.2 || relPos > 0.8) return 0;

  // Left arm: points[0..vertex], right arm: points[vertex..end]
  const leftArm = points.slice(0, vertexIdx + 1);
  const rightArm = points.slice(vertexIdx);

  if (leftArm.length < 2 || rightArm.length < 2) return 0;

  // Left arm should go downward (start.y < vertex.y)
  const leftDrop = points[vertexIdx].y - points[0].y;
  // Right arm should go upward (end.y < vertex.y)
  const rightRise = points[vertexIdx].y - points[points.length - 1].y;

  if (leftDrop < bb.height * 0.3) return 0;
  if (rightRise < bb.height * 0.3) return 0;

  // Both arms should be roughly straight (low deviation from their line)
  const leftStraightness = armStraightness(leftArm);
  const rightStraightness = armStraightness(rightArm);

  if (leftStraightness < 0.6 || rightStraightness < 0.6) return 0;

  return leftStraightness * rightStraightness * Math.min(leftDrop, rightDrop(rightRise, bb.height)) / bb.height;
}

function rightDrop(rise: number, height: number): number {
  return Math.min(rise, height);
}

function armStraightness(arm: Point[]): number {
  if (arm.length < 2) return 0;
  const start = arm[0];
  const end = arm[arm.length - 1];
  const lineLen = distance(start, end);
  if (lineLen < 1) return 0;
  const pLen = pathLength(arm);
  if (pLen < 1) return 0;
  return Math.min(1, lineLen / pLen);
}

export function recognizeGesture(points: Point[]): GestureResult {
  if (points.length < 3) {
    return { symbol: null, accuracy: 0 };
  }

  const bb = boundingBox(points);

  const scores: { symbol: GestureSymbol; score: number }[] = [
    { symbol: 'horizontal', score: checkHorizontalLine(points, bb) },
    { symbol: 'vertical', score: checkVerticalLine(points, bb) },
    { symbol: 'circle', score: checkCircle(points, bb) },
    { symbol: 'v_shape', score: checkVShape(points, bb) },
  ];

  scores.sort((a, b) => b.score - a.score);

  const best = scores[0];
  if (best.score < 0.15) {
    return { symbol: null, accuracy: 0 };
  }

  return { symbol: best.symbol, accuracy: best.score };
}

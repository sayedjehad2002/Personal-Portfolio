/** A surface he can stand on: a straight piece from (x0, y0) to (x1, y1), in physics units (y points down). */
export type Solid = { x0: number; x1: number; y0: number; y1: number; kind: "ground" | "platform" | "rock" };

/** Highest surface at x that is at or below `feet` (within a small tolerance above them). */
export function surfaceBelow(solids: Solid[], x: number, feet: number, tol = 2) {
  let best = Infinity;
  for (const s of solids) {
    if (x < s.x0 || x > s.x1) continue;
    const t = s.x1 > s.x0 ? (x - s.x0) / (s.x1 - s.x0) : 0;
    const y = s.y0 + (s.y1 - s.y0) * t;
    if (y >= feet - tol && y < best) best = y;
  }
  return best;
}

/** Highest surface at x that is reachable by a jump from `feet`. */
export function surfaceReachable(solids: Solid[], x: number, feet: number, maxUp: number) {
  let best = Infinity;
  for (const s of solids) {
    if (x < s.x0 || x > s.x1) continue;
    const t = s.x1 > s.x0 ? (x - s.x0) / (s.x1 - s.x0) : 0;
    const y = s.y0 + (s.y1 - s.y0) * t;
    if (y >= feet - maxUp && y < best) best = y;
  }
  return best;
}

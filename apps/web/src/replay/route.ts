import type { MapDef } from "@conquerra/content";
import { quadPoint } from "../map/shapes";

/**
 * The replay's ways (session 21), in map units: where an army walks (one gentle curve per border crossed), and the
 * point on a border where two armies meet. Shared by the army figures and the dust behind them, so they agree.
 */

export interface Pt {
  x: number;
  y: number;
}

/** A curved way through these stops: the point at share t of it, and its heading (radians). */
export function routePoint(stops: readonly Pt[], t: number, bendCap: number): [number, number, number] {
  const legs = stops.slice(1).map((p1, i) => {
    const p0 = stops[i]!;
    const dx = p1.x - p0.x, dy = p1.y - p0.y, len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(len * 0.16, bendCap);
    return [p0.x, p0.y, (p0.x + p1.x) / 2 + (-dy / len) * bend, (p0.y + p1.y) / 2 + (dx / len) * bend, p1.x, p1.y] as const;
  });
  if (!legs.length) return [stops[0]?.x ?? 0, stops[0]?.y ?? 0, 0];
  const f = Math.max(0, Math.min(1, t)) * legs.length;
  const k = Math.min(legs.length - 1, Math.floor(f));
  return quadPoint(...legs[k]!, f - k);
}

/** Border meeting points: the middle of the longest stretch two territories share (a sea lane's middle across water). */
export function borderPoints(map: MapDef): (a: string, b: string) => Pt | null {
  const g = map.geometry!;
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const at = new Map<string, Pt>();
  for (const b of g.borderLines) {
    let best: number[] | null = null, bestLen = -1;
    for (const l of b.lines) {
      let len = 0;
      for (let i = 2; i < l.length; i += 2) len += Math.hypot(l[i]! - l[i - 2]!, l[i + 1]! - l[i - 1]!);
      if (len > bestLen) (bestLen = len), (best = l as number[]);
    }
    if (!best) continue;
    // The point halfway along the line.
    let walked = 0;
    for (let i = 2; i < best.length; i += 2) {
      const seg = Math.hypot(best[i]! - best[i - 2]!, best[i + 1]! - best[i - 1]!);
      if (walked + seg >= bestLen / 2) {
        const k = seg ? (bestLen / 2 - walked) / seg : 0;
        at.set(key(b.a, b.b), { x: best[i - 2]! + (best[i]! - best[i - 2]!) * k, y: best[i - 1]! + (best[i + 1]! - best[i - 1]!) * k });
        break;
      }
      walked += seg;
    }
  }
  for (const l of g.seaLanes) {
    const n = l.path.length / 2;
    if (n < 1 || at.has(key(l.a, l.b))) continue;
    const m = Math.floor((n - 1) / 2);
    at.set(key(l.a, l.b), { x: l.path[2 * m]!, y: l.path[2 * m + 1]! });
  }
  return (a, b) => at.get(key(a, b)) ?? null;
}

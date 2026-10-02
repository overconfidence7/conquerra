import type { Line, MapGeometry } from "@conquerra/content";

/**
 * Geometry helpers shared by the renderers: which territory is under a point, and the outline around each
 * realm (all the land one House holds) for the glowing House border. Pure, so it's tested without WebGL.
 */

type Rings = readonly Line[];

/** Even-odd point-in-polygon over all rings (a ring inside another is a hole). */
export function insideRings(rings: Rings, x: number, y: number): boolean {
  let inside = false;
  for (const r of rings)
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i]!, yi = r[i + 1]!, xj = r[j]!, yj = r[j + 1]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  return inside;
}

export interface HitTester {
  /** The territory at a map point, or null (sea, lake, mountain range). */
  at(x: number, y: number): string | null;
}

export function hitTester(g: Pick<MapGeometry, "territories">): HitTester {
  const items = g.territories.map((t) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of t.rings)
      for (let i = 0; i < r.length; i += 2) {
        x0 = Math.min(x0, r[i]!);
        x1 = Math.max(x1, r[i]!);
        y0 = Math.min(y0, r[i + 1]!);
        y1 = Math.max(y1, r[i + 1]!);
      }
    return { id: t.id, rings: t.rings, x0, y0, x1, y1 };
  });
  return {
    at(x, y) {
      for (const t of items) if (x >= t.x0 && x <= t.x1 && y >= t.y0 && y <= t.y1 && insideRings(t.rings, x, y)) return t.id;
      return null;
    },
  };
}

const pk = (x: number, y: number) => `${x},${y}`;

/**
 * The outline of each group of territories (for example everything one House holds), as joined-up lines.
 * Borders between two territories of the same group are left out, so the glow runs round the realm, not every
 * territory. Works because neighbouring outlines share exactly the same points (docs/map-data.md).
 */
export function groupOutlines(g: Pick<MapGeometry, "territories">, groupOf: (territory: string) => string | null): Map<string, Line[]> {
  const segs = new Map<string, Map<string, { a: [number, number]; b: [number, number]; n: number }>>();
  for (const t of g.territories) {
    const grp = groupOf(t.id);
    if (grp === null) continue;
    let m = segs.get(grp);
    if (!m) segs.set(grp, (m = new Map()));
    for (const r of t.rings)
      for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
        const a: [number, number] = [r[j]!, r[j + 1]!], b: [number, number] = [r[i]!, r[i + 1]!];
        const ka = pk(a[0], a[1]), kb = pk(b[0], b[1]);
        if (ka === kb) continue;
        const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        const s = m.get(key);
        if (s) s.n++;
        else m.set(key, { a, b, n: 1 });
      }
  }
  const out = new Map<string, Line[]>();
  for (const [grp, m] of segs) {
    // Edges used once are on the outside of the group; chain them into lines.
    const adj = new Map<string, { key: string; to: [number, number] }[]>();
    const add = (from: [number, number], to: [number, number], key: string) => {
      const k = pk(from[0], from[1]);
      const l = adj.get(k);
      if (l) l.push({ key, to });
      else adj.set(k, [{ key, to }]);
    };
    for (const [key, s] of m) if (s.n === 1) add(s.a, s.b, key), add(s.b, s.a, key);
    const used = new Set<string>();
    const lines: Line[] = [];
    for (const [key, s] of m) {
      if (s.n !== 1 || used.has(key)) continue;
      used.add(key);
      const pts = [s.a[0], s.a[1], s.b[0], s.b[1]];
      // Walk forward from b, then backward from a.
      for (const dir of [1, -1]) {
        let cur = dir === 1 ? s.b : s.a;
        for (;;) {
          const next = (adj.get(pk(cur[0], cur[1])) ?? []).find((e) => !used.has(e.key));
          if (!next) break;
          used.add(next.key);
          if (dir === 1) pts.push(next.to[0], next.to[1]);
          else pts.unshift(next.to[0], next.to[1]);
          cur = next.to;
        }
      }
      lines.push(pts);
    }
    out.set(grp, lines);
  }
  return out;
}

/** Points along a quadratic curve (start, control, end), for curved names and bowed sea lanes. */
export function quadPoint(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, t: number): [number, number, number] {
  const u = 1 - t;
  const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
  const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
  // Direction (angle) of the curve at t.
  const dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
  return [x, y, Math.atan2(dy, dx)];
}

/**
 * Province label lines are three points (start, a point on the curve's middle, end). Turn the middle point into
 * the control point of a quadratic curve that passes through it.
 */
export function labelCurve(path: readonly number[]): [number, number, number, number, number, number] {
  const [x0, y0, mx, my, x1, y1] = path as [number, number, number, number, number, number];
  return [x0, y0, 2 * mx - (x0 + x1) / 2, 2 * my - (y0 + y1) / 2, x1, y1];
}

import type { Rng } from "@conquerra/engine";
import type { Mesh } from "./mesh";
import { components } from "./land";
import { contactEdges, edgeLength } from "./contacts";
import { dist, pointSegDist, randomDirection } from "./util";

/** Key for an unordered pair of territories. */
export const pairKey = (a: number, b: number) => (a < b ? a * 10000 + b : b * 10000 + a);
export const pairOf = (k: number): [number, number] => [Math.floor(k / 10000), k % 10000];

/** Every pair of territories that touch, with the cell pairs along their shared border. */
export function touching(mesh: Mesh, owner: Int32Array): Map<number, [number, number][]> {
  const out = new Map<number, [number, number][]>();
  for (let e = 0; e < mesh.edgeA.length; e++) {
    const a = mesh.edgeCellA[e]!, b = mesh.edgeCellB[e]!;
    if (b < 0) continue;
    const ta = owner[a]!, tb = owner[b]!;
    if (ta < 0 || tb < 0 || ta === tb) continue;
    const k = pairKey(ta, tb);
    let l = out.get(k);
    if (!l) out.set(k, (l = []));
    l.push(ta < tb ? [a, b] : [b, a]);
  }
  return out;
}

export interface Barrier {
  kind: "rock" | "water";
  /** Territory pairs this barrier separates. */
  cut: number[];
  /** Pairs left open: passes through a range, land bridges across a strait. */
  open: number[];
}

export interface BarrierOptions {
  ranges: number;
  straits: number;
  /** Longest a range (each way from its middle) or strait can run before it reaches the coast, as a share of the map's shorter side. */
  length: number;
  /** Cells where ranges and straits may start (default: the biggest landmass). */
  mainland?: Set<number>;
}

interface TerritoryInfo {
  cx: number[];
  cy: number[];
  size: number[];
}

function territoryInfo(mesh: Mesh, owner: Int32Array, count: number): TerritoryInfo {
  const cx = new Array<number>(count).fill(0), cy = new Array<number>(count).fill(0), size = new Array<number>(count).fill(0);
  for (let c = 0; c < mesh.cells; c++) {
    const t = owner[c]!;
    if (t < 0) continue;
    cx[t]! += mesh.x[c]!;
    cy[t]! += mesh.y[c]!;
    size[t]!++;
  }
  for (let t = 0; t < count; t++) (cx[t] = cx[t]! / size[t]!), (cy[t] = cy[t]! / size[t]!);
  return { cx, cy, size };
}

/**
 * Plan the mountain ranges and straits. Each one is a wiggly line across the land; every pair of neighbouring
 * territories on opposite sides of the line gets separated, except a few pairs left open as passes or land bridges.
 * Returns the plan only; `applyBarriers` turns it into rock and water.
 */
export function planBarriers(
  mesh: Mesh,
  rng: Rng,
  owner: Int32Array,
  count: number,
  elev: Float64Array,
  isSea: (c: number) => boolean,
  opts: BarrierOptions,
): Barrier[] {
  const info = territoryInfo(mesh, owner, count);
  const touch = touching(mesh, owner);
  const avgCells = info.size.reduce((a, b) => a + b, 0) / count;
  const radius = Math.sqrt(avgCells) * mesh.spacing * 0.56;
  const used = new Set<number>(); // pairs already in a barrier
  const usedTerritory = new Uint8Array(count);
  const barriers: Barrier[] = [];
  const minDim = Math.min(mesh.width, mesh.height);
  const land = Array.from({ length: mesh.cells }, (_, c) => c).filter((c) => owner[c]! >= 0);
  const mainland = opts.mainland ?? new Set(components(mesh, (c) => owner[c]! >= 0)[0]);

  const tryOne = (kind: "rock" | "water"): Barrier | null => {
    // Where it starts: ranges on high ground, straits at the coast.
    let start: number;
    let dir: [number, number];
    if (kind === "rock") {
      const high = land.filter((c) => mainland.has(c)).sort((a, b) => elev[b]! - elev[a]! || a - b);
      start = high[rng.int(Math.max(1, Math.floor(high.length * 0.3)))]!;
      dir = randomDirection(rng);
    } else {
      const coast = land.filter((c) => mainland.has(c) && mesh.neighbors[c]!.some((m) => isSea(m)));
      if (!coast.length) return null;
      start = coast[rng.int(coast.length)]!;
      // Head inland: away from the sea next to the start.
      const sea = mesh.neighbors[start]!.find((m) => isSea(m))!;
      const [rx, ry] = randomDirection(rng);
      let dx = mesh.x[start]! - mesh.x[sea]! + rx * 0.4 * mesh.spacing, dy = mesh.y[start]! - mesh.y[sea]! + ry * 0.4 * mesh.spacing;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      dir = [dx / d, dy / d];
    }
    if (usedTerritory[owner[start]!]) return null;

    // Walk the line, turning a little at each step, until it reaches its length, the sea or the map edge.
    const step = mesh.spacing * 1.5;
    const maxLen = opts.length * minDim;
    const walk = (sx: number, sy: number, d: [number, number], len: number) => {
      const pts: [number, number][] = [];
      let [x, y] = [sx, sy];
      let [dx, dy] = d;
      for (let l = 0; l < len; l += step) {
        const [px, py] = randomDirection(rng);
        dx += px * 0.25;
        dy += py * 0.25;
        const m = Math.sqrt(dx * dx + dy * dy);
        dx /= m;
        dy /= m;
        x += dx * step;
        y += dy * step;
        if (x < 0 || y < 0 || x > mesh.width || y > mesh.height) break;
        const c = mesh.delaunay.find(x, y, start);
        pts.push([x, y]);
        if (owner[c]! < 0) break;
      }
      return pts;
    };
    const sx = mesh.x[start]!, sy = mesh.y[start]!;
    const line: [number, number][] =
      kind === "rock"
        ? [...walk(sx, sy, [-dir[0], -dir[1]], maxLen).reverse(), [sx, sy], ...walk(sx, sy, dir, maxLen)]
        : [[mesh.x[mesh.neighbors[start]!.find((m) => isSea(m))!]!, mesh.y[mesh.neighbors[start]!.find((m) => isSea(m))!]!], [sx, sy], ...walk(sx, sy, dir, maxLen)];
    if (line.length < 4) return null;

    // Which side of the line, and how far along it, is a point?
    const where = (px: number, py: number) => {
      let best = Infinity, side = 0, along = 0, acc = 0;
      for (let i = 0; i < line.length - 1; i++) {
        const [ax, ay] = line[i]!, [bx, by] = line[i + 1]!;
        const d = pointSegDist(px, py, ax, ay, bx, by);
        const segLen = dist(ax, ay, bx, by);
        if (d < best) {
          best = d;
          side = (bx - ax) * (py - ay) - (by - ay) * (px - ax) > 0 ? 1 : -1;
          const t = segLen > 0 ? ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (segLen * segLen) : 0;
          along = acc + Math.max(0, Math.min(1, t)) * segLen;
        }
        acc += segLen;
      }
      return { d: best, side, along };
    };

    const cut: { k: number; along: number }[] = [];
    for (const [k, cells] of touch) {
      if (used.has(k)) continue;
      const [a, b] = pairOf(k);
      const wa = where(info.cx[a]!, info.cy[a]!), wb = where(info.cx[b]!, info.cy[b]!);
      if (wa.side === wb.side || wa.d > radius * 1.7 || wb.d > radius * 1.7) continue;
      let mx = 0, my = 0;
      for (const [ca, cb] of cells) (mx += mesh.x[ca]! + mesh.x[cb]!), (my += mesh.y[ca]! + mesh.y[cb]!);
      const wm = where(mx / (2 * cells.length), my / (2 * cells.length));
      if (wm.d > radius * 1.1) continue;
      if (usedTerritory[a] && usedTerritory[b]) continue;
      cut.push({ k, along: wm.along });
    }
    if (cut.length < 3) return null;
    cut.sort((p, q) => p.along - q.along || p.k - q.k);
    const opens = kind === "rock" ? Math.max(1, Math.round(cut.length / 5)) : 1;
    const open = new Set<number>();
    // Spread the passes along the range, each at the widest border near its spot (so the pass can be wide).
    const width = (k: number) => touch.get(k)!.length;
    for (let i = 0; i < opens; i++) {
      const at = Math.floor(((i + 0.5) * cut.length) / opens);
      const near = [at - 1, at, at + 1].filter((j) => j >= 0 && j < cut.length && !open.has(cut[j]!.k));
      open.add(cut[near.sort((x, y) => width(cut[y]!.k) - width(cut[x]!.k) || x - y)[0] ?? at]!.k);
    }
    return { kind, cut: cut.map((p) => p.k).filter((k) => !open.has(k)), open: [...open] };
  };

  const want: ("rock" | "water")[] = [...Array<"rock">(opts.ranges).fill("rock"), ...Array<"water">(opts.straits).fill("water")];
  for (const kind of want) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const b = tryOne(kind);
      if (!b) continue;
      barriers.push(b);
      for (const k of [...b.cut, ...b.open]) {
        used.add(k);
        const [x, y] = pairOf(k);
        usedTerritory[x] = 1;
        usedTerritory[y] = 1;
      }
      break;
    }
  }

  // Never cut the map in two: while the land graph falls apart, reopen a cut pair that joins the smallest piece back.
  for (;;) {
    const closed = new Set(barriers.flatMap((b) => b.cut));
    const adj: number[][] = Array.from({ length: count }, () => []);
    for (const k of touch.keys()) {
      if (closed.has(k)) continue;
      const [a, b] = pairOf(k);
      adj[a]!.push(b);
      adj[b]!.push(a);
    }
    const comp = new Int32Array(count).fill(-1);
    const sizes: number[] = [];
    for (let s = 0; s < count; s++) {
      if (comp[s] !== -1) continue;
      const q = [s];
      comp[s] = sizes.length;
      for (let h = 0; h < q.length; h++) for (const m of adj[q[h]!]!) if (comp[m] === -1) (comp[m] = sizes.length), q.push(m);
      sizes.push(q.length);
    }
    if (sizes.length <= 1) break;
    // Islands are joined by sea lanes later; only repair pieces split by a barrier.
    let fixed = false;
    const order = sizes.map((s, i) => i).sort((p, q) => sizes[p]! - sizes[q]! || p - q);
    for (const small of order) {
      const b = barriers.find((br) => br.cut.some((k) => {
        const [x, y] = pairOf(k);
        return (comp[x] === small) !== (comp[y] === small);
      }));
      if (!b) continue;
      const k = b.cut.find((kk) => {
        const [x, y] = pairOf(kk);
        return (comp[x] === small) !== (comp[y] === small);
      })!;
      b.cut = b.cut.filter((kk) => kk !== k);
      b.open.push(k);
      fixed = true;
      break;
    }
    if (!fixed) break;
  }
  return barriers;
}

/**
 * Turn the plan into land changes: the cells along each cut border become rock (ranges, numbered 1, 2, ...) or water (straits).
 * Open pairs keep a gap in the middle of their border, at least `minGap` map units wide where the border is that
 * long (so a pass reads at Mid zoom), which is the pass or the land bridge. Returns the gap cells of each open pair.
 */
export function applyBarriers(
  mesh: Mesh,
  owner: Int32Array,
  barriers: Barrier[],
  rock: Uint8Array,
  water: Uint8Array,
  minGap: number,
): Map<number, number[]> {
  const touch = touching(mesh, owner);
  const edges = contactEdges(mesh, owner); // the same edges as `touch`, in the same order
  const protectedCells = new Set<number>();
  const gaps = new Map<number, number[]>();
  for (const b of barriers)
    for (const k of b.open) {
      const cells = touch.get(k);
      if (!cells) continue;
      let mx = 0, my = 0;
      for (const [ca, cb] of cells) (mx += mesh.x[ca]! + mesh.x[cb]!), (my += mesh.y[ca]! + mesh.y[cb]!);
      mx /= 2 * cells.length;
      my /= 2 * cells.length;
      const byMid = cells.map((pair, i) => ({ pair, len: edgeLength(mesh, edges.get(k)![i]!) })).sort(
        (p, q) =>
          dist(mesh.x[p.pair[0]]!, mesh.y[p.pair[0]]!, mx, my) + dist(mesh.x[p.pair[1]]!, mesh.y[p.pair[1]]!, mx, my) -
            (dist(mesh.x[q.pair[0]]!, mesh.y[q.pair[0]]!, mx, my) + dist(mesh.x[q.pair[1]]!, mesh.y[q.pair[1]]!, mx, my)) || p.pair[0] - q.pair[0],
      );
      // Keep the middle of the border open, widening out until the opening is `minGap` long (at least two edges).
      const keep: number[] = [];
      let open = 0;
      for (const [i, { pair, len }] of byMid.entries()) {
        if (i >= 2 && open >= minGap) break;
        keep.push(...pair);
        open += len;
      }
      for (const c of keep) protectedCells.add(c);
      gaps.set(k, [...new Set(keep)]);
    }
  // Rock cells remember which range they belong to (1, 2, ...).
  let range = 0;
  for (const b of barriers) {
    if (b.kind === "rock") range++;
    for (const k of [...b.cut, ...b.open]) {
      for (const [ca, cb] of touch.get(k) ?? [])
        for (const c of [ca, cb]) {
          if (protectedCells.has(c)) continue;
          owner[c] = -1;
          if (b.kind === "rock") rock[c] = range;
          else water[c] = 1;
        }
    }
  }
  return gaps;
}

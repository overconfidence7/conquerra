import { BIOME_CODES, type Biome, type MapDef } from "@conquerra/content";
import { insideRings } from "../../map/shapes";

/**
 * Where the painted scenery goes, worked out from the map data alone (so it works on any map, random or hand-made,
 * and no map file changes): mountain ranges drawn as chains of ridges along each range's spine, sea cliffs on high
 * or rocky coasts, bridges where two territories meet across a river, a gatehouse on every pass road, a few
 * landmarks, and forest clearings. Everything is seeded from the map, so the same map always gets the same painting.
 * Pure (no drawing), so it's tested without WebGL; world.ts draws it.
 *
 * None of it carries game state: it's decoration under the info layer.
 */

export type LandmarkKind = "ruins" | "stones" | "lighthouse" | "windmill";
export const LANDMARK_KINDS: readonly LandmarkKind[] = ["ruins", "stones", "lighthouse", "windmill"];

/** One sprite: where its foot stands, its width (map units), a slight turn (radians) and a mirror flip. */
export interface Piece {
  x: number;
  y: number;
  w: number;
  rot: number;
  flip: boolean;
  /** Which variant (1..n). */
  v: number;
}

export interface Scenery {
  /** Each range as a chain: wide ridge pieces where it runs across the screen, single peaks where it's steep, at its ends and as fill. */
  ranges: (Piece & { kind: "ridge" | "peak" })[];
  cliffs: Piece[];
  bridges: (Piece & { kind: "stone" | "wood" })[];
  gates: Piece[];
  landmarks: (Piece & { kind: LandmarkKind })[];
  /** Open glades in big forests (the ground there is painted as grass, and the trees left out). */
  clearings: { x: number; y: number; r: number }[];
  /** Decorations (by index in `geometry.decorations`) that aren't drawn: peaks inside ranges (the chains replace them), and trees or hills under a landmark or in a clearing. */
  hidden: Set<number>;
  /** Trees whose kind changes (index -> kind): pines higher up and further north, broadleaf lower and further south. */
  treeKind: Map<number, "tree-conifer" | "tree-broadleaf">;
}

/** Sizes in map units (a typical territory is 80-110 across). */
export const SCENERY_SIZE = { ridgeMin: 34, ridgeMax: 66, peakMin: 18, peakMax: 34, cliff: 34, bridge: 17, gate: 24, landmark: 26 };
/** Height over width of the ridge and peak art, for working out what a piece covers. */
const RIDGE_ASPECT = 0.55, PEAK_ASPECT = 0.82;

// ---------- Seeded numbers ----------

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A small seeded generator (mulberry32). */
export function seeded(seed: string) {
  let a = hashString(seed) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    shuffle<T>(xs: T[]): T[] {
      for (let i = xs.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [xs[i], xs[j]] = [xs[j]!, xs[i]!];
      }
      return xs;
    },
  };
}

/** Smooth value noise in [0, 1], seeded, for clearings and the pine/broadleaf mix. */
function valueNoise(seed: string, scale: number) {
  const s = hashString(seed);
  const h = (ix: number, iy: number) => {
    let x = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + s;
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  };
  return (px: number, py: number) => {
    const x = px / scale, y = py / scale;
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

// ---------- Reading the map ----------

const BIOME_OF = new Map(Object.entries(BIOME_CODES).map(([b, c]) => [c, b as Biome]));

function decodeBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

interface Ground {
  biome(x: number, y: number): Biome | null;
  /** Height above the sea, 0 (the shore) to 1 (the highest ground on the map); below 0 is water. */
  height(x: number, y: number): number;
  water(x: number, y: number): boolean;
}

function ground(map: MapDef): Ground {
  const g = map.geometry!;
  const { cols, rows, cellSize, data } = g.biome;
  const hm = g.heightMap;
  const h = decodeBase64(hm.data);
  let top = hm.seaLevel + 1;
  for (const v of h) top = Math.max(top, v);
  const cellOf = (x: number, y: number, c: number, r: number, size: number) => {
    const cx = Math.floor(x / size), cy = Math.floor(y / size);
    if (cx < 0 || cy < 0 || cx >= c || cy >= r) return -1;
    return cy * c + cx;
  };
  return {
    biome(x, y) {
      const i = cellOf(x, y, cols, rows, cellSize);
      return i < 0 ? null : (BIOME_OF.get(data[i]!) ?? null);
    },
    height(x, y) {
      const i = cellOf(x, y, hm.cols, hm.rows, hm.cellSize);
      return i < 0 ? -1 : (h[i]! - hm.seaLevel) / (top - hm.seaLevel);
    },
    water(x, y) {
      const b = this.biome(x, y);
      return b === null || b === "shallow" || b === "deep";
    },
  };
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

/** Angle folded into (-pi/2, pi/2]: a line's direction with no "forwards". */
const fold = (a: number) => {
  let x = a % Math.PI;
  if (x > Math.PI / 2) x -= Math.PI;
  if (x <= -Math.PI / 2) x += Math.PI;
  return x;
};

/** Everything the scenery must keep clear of: banners (pills), plaques, castles, building sites and passes. */
interface Keepout {
  labels: { x: number; y: number; r: number }[];
  plaques: { x: number; y: number }[];
  castles: { x: number; y: number }[];
  sites: { x: number; y: number }[];
  passes: { x: number; y: number }[];
  laneEnds: { x: number; y: number }[];
}

function keepout(map: MapDef): Keepout {
  const g = map.geometry!;
  return {
    labels: g.territories.map((t) => t.label),
    // A plaque sits just under the middle of its province's name line.
    plaques: g.provinceLabels.map((l) => ({ x: l.path[2]!, y: l.path[3]! + 14 })),
    castles: g.territories.flatMap((t) => (t.castle ? [t.castle] : [])),
    sites: g.territories.map((t) => t.site),
    passes: g.passes.map((p) => ({ x: p.x, y: p.y })),
    laneEnds: g.seaLanes.flatMap((l) => [
      { x: l.path[0]!, y: l.path[1]! },
      { x: l.path[l.path.length - 2]!, y: l.path[l.path.length - 1]! },
    ]),
  };
}

// ---------- Mountain ranges as chains ----------

/**
 * Each range's spine, found from its outline: the range is rasterised, a distance-to-edge map picks out its middle
 * line, and pieces are laid along it, biggest first, overlapping like links of a chain. Where the spine runs across
 * the screen a wide ridge goes there; where it runs up and down (a ridge drawn across it would look wrong in this
 * three-quarter view) single peaks stack instead. Smaller single peaks fill what's left, including the ends. Nothing
 * goes near a pass, so the gap and the road through it stay open.
 */
function rangeChains(map: MapDef, gr: Ground, ko: Keepout, rng: ReturnType<typeof seeded>): Scenery["ranges"] {
  const g = map.geometry!;
  const out: Scenery["ranges"] = [];
  const C = 4; // raster cell, map units
  for (const m of g.mountains) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of m.rings)
      for (let i = 0; i < r.length; i += 2) {
        x0 = Math.min(x0, r[i]!);
        x1 = Math.max(x1, r[i]!);
        y0 = Math.min(y0, r[i + 1]!);
        y1 = Math.max(y1, r[i + 1]!);
      }
    if (!Number.isFinite(x0)) continue;
    const cols = Math.ceil((x1 - x0) / C) + 2, rows = Math.ceil((y1 - y0) / C) + 2;
    const ox = x0 - C, oy = y0 - C;
    // Scanline fill (even-odd over every ring).
    const inside = new Uint8Array(cols * rows);
    for (let ry = 0; ry < rows; ry++) {
      const y = oy + (ry + 0.5) * C;
      const xs: number[] = [];
      for (const r of m.rings)
        for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
          const yi = r[i + 1]!, yj = r[j + 1]!;
          if (yi > y !== yj > y) xs.push(r[i]! + ((y - yi) / (yj - yi)) * (r[j]! - r[i]!));
        }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil((xs[k]! - ox) / C - 0.5)), c1 = Math.min(cols - 1, Math.floor((xs[k + 1]! - ox) / C - 0.5));
        for (let c = c0; c <= c1; c++) inside[ry * cols + c] = 1;
      }
    }
    // Distance to the edge (two-pass chamfer, in map units).
    const D = new Float32Array(cols * rows);
    const BIG = 1e9;
    for (let i = 0; i < D.length; i++) D[i] = inside[i] ? BIG : 0;
    const a = C, d = C * Math.SQRT2;
    for (let ry = 0; ry < rows; ry++)
      for (let c = 0; c < cols; c++) {
        const i = ry * cols + c;
        if (!D[i]) continue;
        let v = D[i]!;
        if (c > 0) v = Math.min(v, D[i - 1]! + a);
        if (ry > 0) {
          v = Math.min(v, D[i - cols]! + a);
          if (c > 0) v = Math.min(v, D[i - cols - 1]! + d);
          if (c < cols - 1) v = Math.min(v, D[i - cols + 1]! + d);
        }
        D[i] = v;
      }
    for (let ry = rows - 1; ry >= 0; ry--)
      for (let c = cols - 1; c >= 0; c--) {
        const i = ry * cols + c;
        if (!D[i]) continue;
        let v = D[i]!;
        if (c < cols - 1) v = Math.min(v, D[i + 1]! + a);
        if (ry < rows - 1) {
          v = Math.min(v, D[i + cols]! + a);
          if (c < cols - 1) v = Math.min(v, D[i + cols + 1]! + d);
          if (c > 0) v = Math.min(v, D[i + cols - 1]! + d);
        }
        D[i] = v;
      }
    // The spine: cells at least as far from the edge as every neighbour across one axis.
    const spine: { x: number; y: number; d: number; j: number }[] = [];
    const all: { x: number; y: number; d: number; j: number }[] = [];
    for (let ry = 1; ry < rows - 1; ry++)
      for (let c = 1; c < cols - 1; c++) {
        const i = ry * cols + c, v = D[i]!;
        if (!v) continue;
        const cell = { x: ox + (c + 0.5) * C, y: oy + (ry + 0.5) * C, d: v, j: rng.next() };
        all.push(cell);
        const ridgeH = v >= D[i - 1]! && v >= D[i + 1]!, ridgeV = v >= D[i - cols]! && v >= D[i + cols]!;
        const ridgeD = (v >= D[i - cols - 1]! && v >= D[i + cols + 1]!) || (v >= D[i - cols + 1]! && v >= D[i + cols - 1]!);
        if (v >= C * 1.5 && (ridgeH || ridgeV || ridgeD)) spine.push(cell);
      }
    const passes = g.passes.filter((p) => p.range === m.id);
    // Spatial buckets, so "what's near here" doesn't scan the whole range.
    const B = 32;
    const key = (bx: number, by: number) => (bx + 4096) * 8192 + (by + 4096);
    const bucketed = <T extends { x: number; y: number }>() => {
      const map = new Map<number, T[]>();
      return {
        add(t: T) {
          const k = key(Math.floor(t.x / B), Math.floor(t.y / B));
          (map.get(k) ?? map.set(k, []).get(k)!).push(t);
        },
        /** Does anything within about r of (x, y) pass the test? */
        some(x: number, y: number, r: number, test: (t: T) => boolean): boolean {
          const n = Math.ceil(r / B), bx = Math.floor(x / B), by = Math.floor(y / B);
          for (let dy = -n; dy <= n; dy++)
            for (let dx = -n; dx <= n; dx++) {
              const list = map.get(key(bx + dx, by + dy));
              if (list) for (const t of list) if (test(t)) return true;
            }
          return false;
        },
        near(x: number, y: number, r: number): T[] {
          const out: T[] = [];
          this.some(x, y, r, (t) => (out.push(t), false));
          return out;
        },
      };
    };
    const spineAt = bucketed<(typeof spine)[number]>();
    for (const c of spine) spineAt.add(c);
    const placed = bucketed<{ x: number; y: number; w: number; aspect: number }>();
    /** The box a piece covers (its foot at y, art rising above it). */
    const covers = (x: number, y: number, w: number, aspect: number, px: number, py: number, pad: number) =>
      px > x - w / 2 - pad && px < x + w / 2 + pad && py > y - w * aspect * 0.88 - pad && py < y + w * aspect * 0.12 + pad;
    // Clear of the passes (so the gap and road stay open), standing on land (not hanging over a coast), and away
    // from a sea lane's landing.
    const clearOfPasses = (x: number, y: number, w: number, aspect: number) =>
      passes.every((p) => !covers(x, y, w, aspect, p.x, p.y, 12)) &&
      !gr.water(x - w * 0.3, y) &&
      !gr.water(x + w * 0.3, y) &&
      !gr.water(x, y + 4) &&
      ko.laneEnds.every((e) => dist(e.x, e.y, x, y) > w * 0.7 + 10);
    const direction = (x: number, y: number, r: number) => {
      // The spine's direction here: the main axis of the spine cells nearby.
      let n = 0, mx = 0, my = 0;
      const near = spineAt.near(x, y, r).filter((s) => dist(s.x, s.y, x, y) < r);
      for (const s of near) (mx += s.x), (my += s.y), n++;
      if (n < 3) return 0;
      mx /= n;
      my /= n;
      let sxx = 0, sxy = 0, syy = 0;
      for (const s of near) {
        const dx = s.x - mx, dy = s.y - my;
        sxx += dx * dx;
        sxy += dx * dy;
        syy += dy * dy;
      }
      return fold(0.5 * Math.atan2(2 * sxy, sxx - syy));
    };
    const REACH = SCENERY_SIZE.ridgeMax;
    // 1. The chain: the widest parts of the spine first, so the big pieces sit in the middle of the range.
    for (const s of [...spine].sort((p, q) => q.d + q.j * C - (p.d + p.j * C))) {
      const w = Math.max(SCENERY_SIZE.ridgeMin, Math.min(SCENERY_SIZE.ridgeMax, s.d * 3.4 * (0.9 + s.j * 0.2)));
      if (placed.some(s.x, s.y, REACH, (p) => dist(p.x, p.y, s.x, s.y) < (p.w + w) * 0.24)) continue;
      const ang = direction(s.x, s.y, w * 0.8);
      const across = Math.abs(ang) < 0.62;
      const kind = across ? "ridge" : "peak";
      const pw = across ? w : Math.max(SCENERY_SIZE.peakMin, Math.min(SCENERY_SIZE.peakMax + 6, w * 0.62));
      const aspect = across ? RIDGE_ASPECT : PEAK_ASPECT;
      // The foot sits a little below the spine, so the art rises over the range's middle.
      const fy = s.y + pw * aspect * 0.3;
      if (!clearOfPasses(s.x, fy, pw, aspect)) continue;
      placed.add({ x: s.x, y: fy, w: pw, aspect });
      out.push({ kind, x: s.x, y: fy, w: pw, rot: across ? ang * 0.35 : 0, flip: rng.next() < 0.5, v: 1 + rng.int(kind === "ridge" ? 3 : 4) });
    }
    // 2. Fill: single peaks wherever the range isn't covered yet (its ends, bends and wide parts).
    for (const s of all.filter((c) => c.d >= C * 1.2).sort((p, q) => q.d + q.j * C - (p.d + p.j * C))) {
      const w = Math.max(SCENERY_SIZE.peakMin, Math.min(SCENERY_SIZE.peakMax, s.d * 2.4 * (0.85 + s.j * 0.3)));
      const fy = s.y + w * PEAK_ASPECT * 0.3;
      if (placed.some(s.x, s.y, REACH, (p) => covers(p.x, p.y, p.w * 0.6, p.aspect, s.x, s.y, 0) || dist(p.x, p.y, s.x, fy) < (p.w + w) * 0.22)) continue;
      if (!clearOfPasses(s.x, fy, w, PEAK_ASPECT)) continue;
      placed.add({ x: s.x, y: fy, w, aspect: PEAK_ASPECT });
      out.push({ kind: "peak", x: s.x, y: fy, w, rot: 0, flip: rng.next() < 0.5, v: 1 + rng.int(4) });
    }
  }
  return out;
}

// ---------- Coasts ----------

interface CoastPoint {
  x: number;
  y: number;
  /** Along the coast. */
  tan: number;
  /** Out to sea (unit vector). */
  nx: number;
  ny: number;
}

/** Points every few units along every coast (territory outline edges with water just outside). */
function coastPoints(map: MapDef, gr: Ground, step: number): CoastPoint[][] {
  const g = map.geometry!;
  const stretches: CoastPoint[][] = [];
  for (const t of g.territories)
    for (const r of t.rings) {
      let run: CoastPoint[] = [];
      // Distance walked round the ring, and where the next sample falls.
      let walked = 0, next = 0;
      // Which side of the ring's edges is outside the territory: the same all the way round, so test it once.
      let out = 0;
      for (let i = 0; i < r.length; i += 2) {
        const ax = r[i]!, ay = r[i + 1]!, bx = r[(i + 2) % r.length]!, by = r[(i + 3) % r.length]!;
        const len = Math.hypot(bx - ax, by - ay);
        if (len < 1e-6) continue;
        const tx = (bx - ax) / len, ty = (by - ay) / len;
        for (; next < walked + len; next += step) {
          const s = next - walked;
          const x = ax + tx * s, y = ay + ty * s;
          if (!out) out = insideRings(t.rings, x - ty * 1.5, y + tx * 1.5) ? -1 : 1;
          const nx = -ty * out, ny = tx * out;
          if (gr.water(x + nx * 9, y + ny * 9) && gr.water(x + nx * 15, y + ny * 15)) run.push({ x, y, tan: Math.atan2(ty, tx), nx, ny });
          else if (run.length) {
            stretches.push(run);
            run = [];
          }
        }
        walked += len;
      }
      if (run.length) stretches.push(run);
    }
  return stretches;
}

/**
 * Sea cliffs: on coasts facing down the screen (so their rock face shows in this three-quarter view, or turned a
 * little for coasts facing down and to one side), where the land just inland is high or rocky. Low, sandy coasts
 * keep their beach. Never by a sea lane's landing, a banner, a castle or a building site.
 */
function cliffs(coast: CoastPoint[][], gr: Ground, ko: Keepout, rng: ReturnType<typeof seeded>): Piece[] {
  const out: Piece[] = [];
  const W = SCENERY_SIZE.cliff;
  /** Steps (6 units each) either side of a point that a piece covers. */
  const half = Math.round(W / 2 / 6);
  for (const run of coast) {
    let last = -Infinity;
    for (let k = half; k + half < run.length; k++) {
      const p = run[k]!;
      if (p.ny < 0.25) continue;
      // Open sea in front (not a narrow inlet or a channel), and high or rocky land behind.
      if (!gr.water(p.x + p.nx * 30, p.y + p.ny * 30) || !gr.water(p.x + p.nx * 45, p.y + p.ny * 45)) continue;
      const ix = p.x - p.nx * 18, iy = p.y - p.ny * 18;
      const b = gr.biome(ix, iy);
      const high = gr.height(ix, iy) > 0.14 || b === "hills" || b === "rock" || b === "snow";
      if (!high || b === "sand" || gr.biome(p.x - p.nx * 6, p.y - p.ny * 6) === "sand") continue;
      // A fairly straight stretch, so the piece follows the coast instead of cutting across a bay.
      const a = run[k - half]!, z = run[k + half]!;
      const chord = Math.hypot(z.x - a.x, z.y - a.y) || 1;
      const off = Math.abs((p.x - a.x) * (z.y - a.y) - (p.y - a.y) * (z.x - a.x)) / chord;
      if (off > 5 || chord < W * 0.75) continue;
      // Pieces about 0.8 of a width apart along the coast.
      const along = k * 6;
      if (along - last < W * 0.8) continue;
      if (ko.laneEnds.some((e) => dist(e.x, e.y, p.x, p.y) < W * 1.1)) continue;
      if (ko.labels.some((l) => dist(l.x, l.y, p.x, p.y) < Math.max(l.r, 22) + 6)) continue;
      if (ko.castles.some((c) => dist(c.x, c.y, p.x, p.y) < 34) || ko.sites.some((s) => dist(s.x, s.y, p.x, p.y) < 28)) continue;
      last = along;
      const tan = Math.atan2(z.y - a.y, z.x - a.x);
      out.push({ x: p.x, y: p.y, w: W * (0.9 + rng.next() * 0.2), rot: Math.max(-0.45, Math.min(0.45, fold(tan))), flip: rng.next() < 0.5, v: 1 + rng.int(3) });
    }
  }
  return out;
}

// ---------- Rivers ----------

/** The middle of a line, and its direction there. */
function lineMid(l: readonly number[]): [number, number, number] {
  let total = 0;
  for (let i = 2; i < l.length; i += 2) total += Math.hypot(l[i]! - l[i - 2]!, l[i + 1]! - l[i - 1]!);
  let acc = 0;
  for (let i = 2; i < l.length; i += 2) {
    const seg = Math.hypot(l[i]! - l[i - 2]!, l[i + 1]! - l[i - 1]!);
    if (acc + seg >= total / 2 && seg > 0) {
      const t = (total / 2 - acc) / seg;
      return [l[i - 2]! + (l[i]! - l[i - 2]!) * t, l[i - 1]! + (l[i + 1]! - l[i - 1]!) * t, Math.atan2(l[i + 1]! - l[i - 1]!, l[i]! - l[i - 2]!)];
    }
    acc += seg;
  }
  return [l[0]!, l[1]!, 0];
}

const lineLength = (l: readonly number[]) => {
  let s = 0;
  for (let i = 2; i < l.length; i += 2) s += Math.hypot(l[i]! - l[i - 2]!, l[i + 1]! - l[i - 1]!);
  return s;
};

/** The stone bridge's deck runs about 20 degrees below horizontal, left to right (the wooden one is asked for the same way). */
const BRIDGE_AXIS = 0.35;

/**
 * One bridge where two territories meet across a river, at the middle of their shared border. Wooden near a river's
 * source (a smaller stream) or among farmland in its middle reaches, stone further down. Turned to cross the river, as far as
 * the art allows.
 */
function bridges(map: MapDef, gr: Ground, ko: Keepout, rng: ReturnType<typeof seeded>): Scenery["bridges"] {
  const g = map.geometry!;
  const out: Scenery["bridges"] = [];
  const riverBorders = new Set(map.borders.filter((b) => b.type === "river").map((b) => `${b.a}|${b.b}`));
  for (const bl of g.borderLines) {
    if (!riverBorders.has(`${bl.a}|${bl.b}`) && !riverBorders.has(`${bl.b}|${bl.a}`)) continue;
    const line = [...bl.lines].sort((p, q) => lineLength(q) - lineLength(p))[0];
    if (!line || lineLength(line) < 30) continue;
    const [x, y, tan] = lineMid(line);
    if (ko.labels.some((l) => dist(l.x, l.y, x, y) < 20) || ko.castles.some((c) => dist(c.x, c.y, x, y) < 28) || ko.sites.some((s) => dist(s.x, s.y, x, y) < 22)) continue;
    // How far down its river this point is (0 = the source, 1 = the mouth).
    let along = 0.5, best = Infinity;
    for (const r of g.rivers) {
      const n = r.path.length / 2;
      for (let i = 0; i < n; i++) {
        const d = dist(r.path[i * 2]!, r.path[i * 2 + 1]!, x, y);
        if (d < best) (best = d), (along = i / Math.max(1, n - 1));
      }
    }
    const farmland = [-12, 12].some((o) => gr.biome(x + Math.cos(tan + Math.PI / 2) * o, y + Math.sin(tan + Math.PI / 2) * o) === "farmland");
    const kind = along < 0.3 || (farmland && along < 0.65) ? "wood" : "stone";
    // The deck goes across the river: pick the mirror image whose deck is nearest that direction, then turn the rest.
    const cross = fold(tan + Math.PI / 2);
    const plain = fold(cross - BRIDGE_AXIS), mirrored = fold(cross + BRIDGE_AXIS);
    const flip = Math.abs(mirrored) < Math.abs(plain);
    const rot = Math.max(-0.6, Math.min(0.6, flip ? mirrored : plain));
    out.push({ kind, x, y, w: SCENERY_SIZE.bridge * (kind === "wood" ? 0.9 : 1) * (0.95 + rng.next() * 0.1), rot, flip, v: 1 });
  }
  return out;
}

// ---------- Landmarks ----------

const LANDMARK_GROUND: Record<LandmarkKind, Biome[]> = {
  lighthouse: ["grass", "hills", "sand", "rock"],
  windmill: ["farmland"],
  stones: ["grass", "hills"],
  ruins: ["grass", "farmland", "hills", "forest", "sand", "swamp"],
};

/**
 * A few landmarks to make each map memorable: about one per 15 territories, on grounds that suit them (lighthouses
 * on coasts, windmills on farmland, standing stones on grass or hills, ruins almost anywhere), spread apart, and
 * never on a capital, a building site, a pass, a sea lane's landing, or under a banner or a province plaque.
 */
function landmarks(map: MapDef, gr: Ground, ko: Keepout, coast: CoastPoint[][], rng: ReturnType<typeof seeded>): Scenery["landmarks"] {
  const g = map.geometry!;
  const want = Math.max(1, Math.round(map.territories.length / 15));
  const W = SCENERY_SIZE.landmark;
  // Squares a river runs through (on the biome grid), so "away from rivers" is one lookup.
  const { cols, rows, cellSize } = g.biome;
  const wet = new Uint8Array(cols * rows);
  for (const r of g.rivers)
    for (let i = 0; i + 2 < r.path.length; i += 2) {
      const ax = r.path[i]!, ay = r.path[i + 1]!, bx = r.path[i + 2]!, by = r.path[i + 3]!;
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (cellSize / 2)));
      for (let k = 0; k <= n; k++) {
        const c = Math.floor((ax + ((bx - ax) * k) / n) / cellSize), rr = Math.floor((ay + ((by - ay) * k) / n) / cellSize);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (c + dx >= 0 && c + dx < cols && rr + dy >= 0 && rr + dy < rows) wet[(rr + dy) * cols + c + dx] = 1;
      }
    }
  const nearRiver = (x: number, y: number) => wet[Math.floor(y / cellSize) * cols + Math.floor(x / cellSize)] === 1;
  const clear = (x: number, y: number) =>
    !ko.labels.some((l) => dist(l.x, l.y, x, y) < Math.max(l.r, 24) + 16) &&
    !ko.plaques.some((p) => Math.abs(p.x - x) < 80 && Math.abs(p.y - y) < 26) &&
    !ko.castles.some((c) => dist(c.x, c.y, x, y) < 48) &&
    !ko.sites.some((s) => dist(s.x, s.y, x, y) < 34) &&
    !ko.passes.some((p) => dist(p.x, p.y, x, y) < 56) &&
    !ko.laneEnds.some((e) => dist(e.x, e.y, x, y) < 34) &&
    !nearRiver(x, y);
  // Spread them out: about the spacing of `want` points over the land, at most.
  let landCells = 0;
  for (const ch of g.biome.data) if (ch !== "o" && ch !== "O") landCells++;
  const spacing = Math.max(160, Math.sqrt((landCells * g.biome.cellSize * g.biome.cellSize) / want) * 0.7);
  // Candidates: biome squares (seeded order) and, for lighthouses, coast points facing open water.
  // (Land squares only: the sea is most of the grid on island maps.)
  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!gr.water((c + 0.5) * cellSize, (r + 0.5) * cellSize)) cells.push({ x: (c + 0.5) * cellSize, y: (r + 0.5) * cellSize });
  rng.shuffle(cells);
  const shore = rng.shuffle(coast.flat().map((p) => ({ x: p.x - p.nx * 9, y: p.y - p.ny * 9 })));
  const out: Scenery["landmarks"] = [];
  const kinds = rng.shuffle([...LANDMARK_KINDS]);
  for (let n = 0; out.length < want && n < want * 4; n++) {
    const kind = kinds[n % kinds.length]!;
    const pool = kind === "lighthouse" ? shore : cells;
    const at = pool.find(
      (p) =>
        LANDMARK_GROUND[kind].includes(gr.biome(p.x, p.y) as Biome) &&
        clear(p.x, p.y) &&
        // Its whole footprint on land, not just its foot.
        [[-W / 2, 0], [W / 2, 0], [0, -W * 0.6]].every(([dx, dy]) => !gr.water(p.x + dx!, p.y + dy!)) &&
        out.every((o) => dist(o.x, o.y, p.x, p.y) >= spacing),
    );
    if (!at) continue;
    out.push({ kind, x: Math.round(at.x * 10) / 10, y: Math.round(at.y * 10) / 10, w: W * (kind === "lighthouse" ? 0.9 : 1), rot: 0, flip: rng.next() < 0.5, v: 1 });
  }
  return out;
}

// ---------- Forests ----------

/**
 * Forests read as woods, not uniform blobs: a few open glades inside big forests (seeded), and pines on high ground
 * and in the north, broadleaf trees lower down and in the south, with a ragged line between.
 */
function forests(map: MapDef, gr: Ground, seed: string, hidden: Set<number>): Pick<Scenery, "clearings" | "treeKind"> {
  const g = map.geometry!;
  const glade = valueNoise(`${seed}|glades`, 95);
  const mix = valueNoise(`${seed}|pines`, 140);
  const clearings: Scenery["clearings"] = [];
  const treeKind = new Map<number, "tree-conifer" | "tree-broadleaf">();
  const forestAround = (x: number, y: number, r: number) => {
    let f = 0, n = 0;
    for (let a = 0; a < 8; a++) {
      const b = gr.biome(x + Math.cos((a * Math.PI) / 4) * r, y + Math.sin((a * Math.PI) / 4) * r);
      n++;
      if (b === "forest") f++;
    }
    return f / n;
  };
  // Glades: where the slow noise peaks, deep inside a forest (forest all round at two distances).
  const { cols, rows, cellSize } = g.biome;
  for (let r = 1; r < rows - 1; r += 2)
    for (let c = 1; c < cols - 1; c += 2) {
      const x = (c + 0.5) * cellSize, y = (r + 0.5) * cellSize;
      if (gr.biome(x, y) !== "forest" || glade(x, y) < 0.64) continue;
      if (forestAround(x, y, 20) < 0.85 || forestAround(x, y, 38) < 0.75) continue;
      if (clearings.some((k) => dist(k.x, k.y, x, y) < 70)) continue;
      clearings.push({ x, y, r: 11 + (glade(x + 31, y - 17) - 0.5) * 6 });
    }
  // Only trees in a forest (many trees close by) change kind: lone trees in fields keep the one they were given.
  const B = 32;
  const trees = new Map<number, { x: number; y: number }[]>();
  const bkey = (bx: number, by: number) => (bx + 4096) * 8192 + (by + 4096);
  for (const d of g.decorations) {
    if (d.kind !== "tree-conifer" && d.kind !== "tree-broadleaf") continue;
    const k = bkey(Math.floor(d.x / B), Math.floor(d.y / B));
    (trees.get(k) ?? trees.set(k, []).get(k)!).push(d);
  }
  const inForest = (x: number, y: number) => {
    let n = 0;
    const bx = Math.floor(x / B), by = Math.floor(y / B);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const t of trees.get(bkey(bx + dx, by + dy)) ?? []) if (dist(t.x, t.y, x, y) < 28) n++;
    return n >= 8;
  };
  g.decorations.forEach((d, i) => {
    if (d.kind !== "tree-conifer" && d.kind !== "tree-broadleaf") return;
    if (clearings.some((k) => dist(k.x, k.y, d.x, d.y) < k.r * 1.3)) {
      hidden.add(i);
      return;
    }
    if (!inForest(d.x, d.y)) return;
    // Pines on high ground and in the north; the line between wobbles with the noise.
    const north = 1 - d.y / g.height;
    const score = gr.height(d.x, d.y) * 1.6 + north * 0.7 + (mix(d.x, d.y) - 0.5) * 0.9;
    const kind = score > 0.78 ? "tree-conifer" : "tree-broadleaf";
    if (kind !== d.kind) treeKind.set(i, kind);
  });
  return { clearings, treeKind };
}

// ---------- All of it ----------

export function sceneryFor(map: MapDef): Scenery {
  const g = map.geometry!;
  const seed = `${map.id}|${map.generator?.seed ?? ""}|${g.width}x${g.height}`;
  const gr = ground(map);
  const ko = keepout(map);
  const ranges = rangeChains(map, gr, ko, seeded(`${seed}|ranges`));
  const coast = coastPoints(map, gr, 6);
  const hidden = new Set<number>();
  // The chains replace the scattered peaks inside ranges (peaks on high ground outside a range stay).
  const rangeBoxes = g.mountains.map((m) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of m.rings)
      for (let i = 0; i < r.length; i += 2) (x0 = Math.min(x0, r[i]!)), (x1 = Math.max(x1, r[i]!)), (y0 = Math.min(y0, r[i + 1]!)), (y1 = Math.max(y1, r[i + 1]!));
    return { m, x0, y0, x1, y1 };
  });
  g.decorations.forEach((d, i) => {
    if (d.kind === "peak" && rangeBoxes.some((b) => d.x >= b.x0 && d.x <= b.x1 && d.y >= b.y0 && d.y <= b.y1 && insideRings(b.m.rings, d.x, d.y))) hidden.add(i);
  });
  const lm = landmarks(map, gr, ko, coast, seeded(`${seed}|landmarks`));
  // Landmarks stand in the open: nothing drawn right on top of them.
  g.decorations.forEach((d, i) => {
    if (lm.some((l) => Math.abs(l.x - d.x) < l.w * 0.6 && d.y > l.y - l.w * 0.9 && d.y < l.y + 8)) hidden.add(i);
  });
  const cl = cliffs(coast, gr, ko, seeded(`${seed}|cliffs`));
  const br = bridges(map, gr, ko, seeded(`${seed}|bridges`));
  const fo = forests(map, gr, seed, hidden);
  return {
    ranges,
    cliffs: cl,
    bridges: br,
    gates: g.passes.map((p) => ({ x: p.x, y: p.y, w: SCENERY_SIZE.gate, rot: 0, flip: false, v: 1 })),
    landmarks: lm,
    ...fo,
    hidden,
  };
}

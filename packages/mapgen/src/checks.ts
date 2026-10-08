import type { MapDef, Rules } from "@conquerra/content";
import { insideRings } from "./util";

/** Plain graph helpers over a map's borders (all border types, sea lanes included). */
export function adjacency(map: MapDef): Map<string, string[]> {
  const adj = new Map<string, string[]>(map.territories.map((t) => [t.id, []]));
  for (const b of map.borders) {
    adj.get(b.a)!.push(b.b);
    adj.get(b.b)!.push(b.a);
  }
  return adj;
}

export function bfs(adj: Map<string, string[]>, from: string, skip?: (a: string, b: string) => boolean): Map<string, number> {
  const d = new Map([[from, 0]]);
  const q = [from];
  for (let h = 0; h < q.length; h++) {
    const cur = q[h]!;
    for (const n of adj.get(cur) ?? [])
      if (!d.has(n) && !skip?.(cur, n)) {
        d.set(n, d.get(cur)! + 1);
        q.push(n);
      }
  }
  return d;
}

export interface Fairness {
  /** Borders to the nearest other capital, for each capital. */
  nearest: number[];
  /** Gold per turn from the land each capital is closest to (within 2 borders). */
  income: number[];
  fair: boolean;
  /** Higher is better (used to search for layouts). */
  score: number;
}

/** Distances and incomes as flat arrays, for fast fairness checks while searching. */
export interface FairnessTable {
  ids: string[];
  /** dist[i * n + j]: borders from territory i to j (99 if unreachable). */
  dist: Int32Array;
  income: Float64Array;
}

export function fairnessTable(dists: Map<string, Map<string, number>>, income: Map<string, number>): FairnessTable {
  const ids = [...dists.keys()];
  const n = ids.length;
  const dist = new Int32Array(n * n);
  ids.forEach((a, i) => ids.forEach((b, j) => (dist[i * n + j] = dists.get(a)!.get(b) ?? 99)));
  return { ids, dist, income: Float64Array.from(ids, (id) => income.get(id) ?? 0) };
}

/** Fairness of capitals given by name. */
export function fairness(slots: readonly string[], dists: Map<string, Map<string, number>>, income: Map<string, number>): Fairness {
  const tbl = fairnessTable(dists, income);
  return fairnessOf(slots.map((s) => tbl.ids.indexOf(s)), tbl);
}

/**
 * Is a set of capitals fair? Every capital should be about as far from its nearest rival as the others are
 * (within 1 border), and the land around it that it's closest to should be worth about the same (within 30%).
 */
export function fairnessOf(slots: readonly number[], tbl: FairnessTable): Fairness {
  const n = tbl.ids.length, k = slots.length;
  const nearest = slots.map((s) => {
    let m = 99;
    for (const o of slots) if (o !== s) m = Math.min(m, tbl.dist[s * n + o]!);
    return m;
  });
  const share = new Array<number>(k).fill(0);
  const ds = new Array<number>(k).fill(0);
  for (let t = 0; t < n; t++) {
    let best = 99, winners = 0;
    for (let i = 0; i < k; i++) {
      ds[i] = tbl.dist[slots[i]! * n + t]!;
      if (ds[i]! < best) (best = ds[i]!), (winners = 1);
      else if (ds[i] === best) winners++;
    }
    if (best > 2) continue;
    for (let i = 0; i < k; i++) if (ds[i] === best) share[i]! += tbl.income[t]! / winners;
  }
  const spread = Math.max(...nearest) - Math.min(...nearest);
  const ratio = Math.min(...share) / Math.max(1e-9, Math.max(...share));
  return {
    nearest,
    income: share.map((s) => Math.round(s * 10) / 10),
    fair: spread <= 1 && ratio >= 0.7,
    score: Math.min(...nearest) * 100 - spread * 40 + ratio * 60,
  };
}

/**
 * Session 20b: how exposed each capital spot of a layout is, beyond distance and gold (the paper check). For each spot:
 *  - `room`: the land closer to it than to any rival capital (within 4 borders): what it can take without a fight;
 *  - `front`: the territories just outside that land (the borders it must hold);
 *  - `rivals`: rival capitals within 4 borders;
 *  - `exposure`: (front + 3 x rivals) per territory of room. Lower is safer.
 * The layout passes when every spot's exposure is within `band` times the safest one's.
 */
export interface Exposure {
  room: number[];
  front: number[];
  rivals: number[];
  exposure: number[];
  fair: boolean;
}

export function exposureOf(slots: readonly string[], dists: Map<string, Map<string, number>>, adj: Map<string, string[]>, band = 2): Exposure {
  const ids = [...dists.keys()];
  const home = slots.map(() => new Set<string>());
  for (const t of ids) {
    const d = slots.map((s) => dists.get(s)!.get(t) ?? 99);
    const best = Math.min(...d);
    if (best > 4 || d.filter((x) => x === best).length > 1) continue;
    home[d.indexOf(best)]!.add(t);
  }
  const room = home.map((h) => h.size);
  const front = home.map((h) => {
    const out = new Set<string>();
    for (const t of h) for (const n of adj.get(t) ?? []) if (!h.has(n)) out.add(n);
    return out.size;
  });
  const rivals = slots.map((s) => slots.filter((o) => o !== s && (dists.get(s)!.get(o) ?? 99) <= 4).length);
  const exposure = slots.map((_, i) => (front[i]! + 3 * rivals[i]!) / Math.max(1, room[i]!));
  return { room, front, rivals, exposure, fair: Math.max(...exposure) <= band * Math.max(1e-9, Math.min(...exposure)) };
}

/** All-pairs border distances. */
export function allDistances(map: MapDef): Map<string, Map<string, number>> {
  const adj = adjacency(map);
  return new Map(map.territories.map((t) => [t.id, bfs(adj, t.id)]));
}

export const territoryIncome = (map: MapDef, rules: Rules) => new Map(map.territories.map((t) => [t.id, rules.terrain[t.terrain].income]));

/** Shoelace area of a ring. */
function ringArea(r: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < r.length; i += 2) {
    const j = (i + 2) % r.length;
    s += r[i]! * r[j + 1]! - r[j]! * r[i + 1]!;
  }
  return Math.abs(s) / 2;
}

/** Area of a shape drawn with the even-odd rule: rings inside another ring are holes. */
export function shapeArea(rings: readonly (readonly number[])[]): number {
  let total = 0;
  rings.forEach((r, i) => {
    const depth = rings.filter((o, j) => j !== i && insideRings([o], r[0]!, r[1]!)).length;
    total += depth % 2 === 0 ? ringArea(r) : -ringArea(r);
  });
  return total;
}

export interface ChokeCount {
  passes: number;
  seaLanes: number;
  /** Ordinary borders that are the only land link between two sizeable parts of the map. */
  landBridges: number;
  total: number;
}

/** Count the choke points: passes, sea lanes, and land bridges (a single border holding two big areas together). */
export function chokePoints(map: MapDef): ChokeCount {
  const passes = map.borders.filter((b) => b.type === "pass").length;
  const seaLanes = map.borders.filter((b) => b.type === "sea").length;
  const land = new Map<string, string[]>(map.territories.map((t) => [t.id, []]));
  for (const b of map.borders)
    if (b.type !== "sea") {
      land.get(b.a)!.push(b.b);
      land.get(b.b)!.push(b.a);
    }
  const landBridges = landBridgeBorders(map, land).length;
  return { passes, seaLanes, landBridges, total: passes + seaLanes + landBridges };
}

/** Ordinary borders that are the only land link between two parts of 3+ territories each. */
export function landBridgeBorders(map: MapDef, landAdj?: Map<string, string[]>): MapDef["borders"] {
  let land = landAdj;
  if (!land) {
    land = new Map<string, string[]>(map.territories.map((t) => [t.id, []]));
    for (const b of map.borders)
      if (b.type !== "sea") {
        land.get(b.a)!.push(b.b);
        land.get(b.b)!.push(b.a);
      }
  }
  const out: MapDef["borders"] = [];
  for (const b of map.borders) {
    if (b.type === "sea" || b.type === "pass") continue;
    const cut = (x: string, y: string) => (x === b.a && y === b.b) || (x === b.b && y === b.a);
    const side = bfs(land, b.a, cut);
    if (side.has(b.b)) continue;
    const other = bfs(land, b.b, cut);
    if (side.size >= 3 && other.size >= 3) out.push(b);
  }
  return out;
}

/** No hairline borders: every land border is at least this long (map units; a typical one is about 90). */
export const MIN_BORDER_CHECK = 22;
/** Every pass is at least this wide (map units), so it reads at Mid zoom. */
export const MIN_PASS_CHECK = 28;

const lineLength = (l: readonly number[]) => {
  let s = 0;
  for (let i = 2; i < l.length; i += 2) s += Math.hypot(l[i]! - l[i - 2]!, l[i + 1]! - l[i - 1]!);
  return s;
};

/** How long each land border is, as drawn (map units), keyed "a|b". */
export function borderLengths(map: MapDef): Map<string, number> {
  return new Map((map.geometry?.borderLines ?? []).map((b) => [`${b.a}|${b.b}`, b.lines.reduce((a, l) => a + lineLength(l), 0)]));
}

export interface CheckLimits {
  minChokePoints: number;
  /** At least this many sea lanes (default 0). */
  minSeaLanes?: number;
}

export interface CheckResult {
  ok: boolean;
  problems: string[];
  chokePoints: ChokeCount;
}

/**
 * The map checks. A generated map must pass all of them, or the map maker tries the next seed.
 *  - every territory can reach every other;
 *  - no slivers or giant blobs (area 40%–220% of average, and room for a banner);
 *  - provinces of sensible size, each in one piece;
 *  - fair capital layouts for every player count;
 *  - enough choke points and sea lanes;
 *  - no hairline borders, and passes wide enough to see.
 */
export function checkMap(map: MapDef, rules: Rules, limits: CheckLimits): CheckResult {
  const problems: string[] = [];
  const adj = adjacency(map);
  const ids = map.territories.map((t) => t.id);

  if (bfs(adj, ids[0]!).size !== ids.length) problems.push("not every territory can reach every other");

  const geo = map.geometry;
  if (geo) {
    const areas = geo.territories.map((t) => shapeArea(t.rings));
    const mean = areas.reduce((a, b) => a + b, 0) / areas.length;
    geo.territories.forEach((t, i) => {
      if (areas[i]! < mean * 0.4) problems.push(`${t.id} is a sliver (${Math.round((100 * areas[i]!) / mean)}% of average)`);
      if (areas[i]! > mean * 2.2) problems.push(`${t.id} is a giant blob (${Math.round((100 * areas[i]!) / mean)}% of average)`);
      if (t.label.r < 14) problems.push(`${t.id} has no room for a banner`);
    });
  }

  const avg = ids.length / map.provinces.length;
  const lo = Math.max(2, Math.floor(avg * 0.5)), hi = Math.ceil(avg * 1.7);
  for (const p of map.provinces) {
    const members = map.territories.filter((t) => t.province === p.id).map((t) => t.id);
    if (members.length < lo || members.length > hi) problems.push(`province ${p.id} has ${members.length} territories (want ${lo}–${hi})`);
    const inside = new Set(members);
    if (members.length && bfs(adj, members[0]!, (_, b) => !inside.has(b)).size !== members.length) problems.push(`province ${p.id} is in pieces`);
  }

  const dists = allDistances(map);
  const income = territoryIncome(map, rules);
  for (let n = map.minPlayers; n <= map.maxPlayers; n++) {
    const layout = map.capitalLayouts?.find((l) => l.players === n);
    if (!layout) {
      if (map.capitalLayouts) problems.push(`no capital layout for ${n} players`);
      continue;
    }
    if (!fairness(layout.slots, dists, income).fair) problems.push(`capitals for ${n} players aren't fair`);
  }

  if (geo) {
    const lengths = borderLengths(map);
    for (const b of map.borders) {
      if (b.type === "sea") continue;
      const l = lengths.get(`${b.a}|${b.b}`) ?? 0;
      if (b.type === "pass" && l < MIN_PASS_CHECK) problems.push(`the pass between ${b.a} and ${b.b} is only ${l.toFixed(1)} wide (want ${MIN_PASS_CHECK})`);
      if (b.type !== "pass" && l < MIN_BORDER_CHECK) problems.push(`${b.a} and ${b.b} share a hairline border (${l.toFixed(1)}; want ${MIN_BORDER_CHECK})`);
    }
  }

  const chokes = chokePoints(map);
  if (chokes.seaLanes < (limits.minSeaLanes ?? 0)) problems.push(`only ${chokes.seaLanes} sea lanes (want ${limits.minSeaLanes})`);
  if (chokes.total < limits.minChokePoints) problems.push(`only ${chokes.total} choke points (want ${limits.minChokePoints})`);
  return { ok: problems.length === 0, problems, chokePoints: chokes };
}

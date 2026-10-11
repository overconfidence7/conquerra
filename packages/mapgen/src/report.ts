import type { MapDef, Rules } from "@conquerra/content";
import { allDistances, borderLengths, checkMap, fairness, MIN_BORDER_CHECK, MIN_PASS_CHECK, shapeArea, territoryIncome, type CheckLimits } from "./checks";
import type { Recipe } from "./recipes";
import { LAND_SHAPES } from "./shapes";

/*
 * Plain-words reports on a finished map, for the map lab now and the player map builder later. Everything here
 * takes a finished MapDef (it doesn't care whether the map was generated or drawn by hand).
 */

export interface CheckRow {
  /** What's checked, in plain words. */
  label: string;
  ok: boolean;
  /** The numbers behind it ("shortest 24.1; at least 22"). */
  detail: string;
  /** The checker's own words for each problem found. */
  problems: string[];
}

/** `checkMap`, one row per rule, in plain words. */
export function explainChecks(map: MapDef, rules: Rules, limits: CheckLimits): CheckRow[] {
  const { problems, chokePoints: ch } = checkMap(map, rules, limits);
  const take = (re: RegExp) => problems.filter((p) => re.test(p));
  const areas = sizeSpread(map);
  const lengths = borderLengths(map);
  const land = map.borders.filter((b) => b.type !== "sea" && b.type !== "pass").map((b) => lengths.get(`${b.a}|${b.b}`) ?? 0);
  const passes = map.borders.filter((b) => b.type === "pass").map((b) => lengths.get(`${b.a}|${b.b}`) ?? 0);
  const avg = map.territories.length / map.provinces.length;
  const lo = Math.max(2, Math.floor(avg * 0.5)), hi = Math.ceil(avg * 1.7);
  const provSizes = map.provinces.map((p) => map.territories.filter((t) => t.province === p.id).length);
  const row = (label: string, re: RegExp, detail: string): CheckRow => {
    const found = take(re);
    return { label, ok: found.length === 0, detail, problems: found };
  };
  return [
    row("Every territory can reach every other (by land, pass or sea lane)", /can reach/, `${map.territories.length} territories`),
    row("Territories are about the same size (40%–220% of average)", /sliver|giant blob/, areas ? `smallest ${areas.min}%, biggest ${areas.max}% of average` : "no outlines"),
    row("Every territory has room for its banner", /banner/, ""),
    row(`Provinces have ${lo}–${hi} territories and are each in one piece`, /^province/, `${map.provinces.length} provinces of ${Math.min(...provSizes)}–${Math.max(...provSizes)}`),
    row(`Capitals are fair for ${map.minPlayers}–${map.maxPlayers} players`, /capital/, `${(map.capitalLayouts ?? []).length} layouts`),
    row("No hairline borders (neighbours share a border you can see)", /hairline/, land.length ? `shortest ${Math.min(...land).toFixed(1)}; at least ${MIN_BORDER_CHECK}` : ""),
    row("Passes are wide enough to see", /pass between/, passes.length ? `${passes.length} passes, narrowest ${Math.min(...passes).toFixed(1)}; at least ${MIN_PASS_CHECK}` : "no passes"),
    row("Enough sea lanes", /sea lanes/, `${ch.seaLanes}; at least ${limits.minSeaLanes ?? 0}`),
    row("Enough choke points (passes, sea lanes, land bridges)", /choke points/, `${ch.passes} passes + ${ch.seaLanes} sea lanes + ${ch.landBridges} land bridges = ${ch.total}; at least ${limits.minChokePoints}`),
  ];
}

export interface FairnessRow {
  players: number;
  /** Borders from each capital to its nearest rival: the closest and the furthest pair. */
  gap: { min: number; max: number };
  /** Gold a turn from the land each capital is nearest to: least and most, and least / most. */
  income: { min: number; max: number; ratio: number };
  fair: boolean;
}

/** How fair the capitals are at each player count the map claims. */
export function fairnessRows(map: MapDef, rules: Rules): FairnessRow[] {
  const dists = allDistances(map);
  const income = territoryIncome(map, rules);
  return (map.capitalLayouts ?? [])
    .map((l) => {
      const f = fairness(l.slots, dists, income);
      const lo = Math.min(...f.income), hi = Math.max(...f.income);
      return { players: l.players, gap: { min: Math.min(...f.nearest), max: Math.max(...f.nearest) }, income: { min: lo, max: hi, ratio: hi ? lo / hi : 0 }, fair: f.fair };
    })
    .sort((a, b) => a.players - b.players);
}

export interface SizeSpread {
  /** Smallest and biggest territory, as % of the average. */
  min: number;
  max: number;
  /** How many territories fall in each band of % of average. */
  bands: { from: number; to: number; count: number }[];
}

/** How even the territory sizes are. */
export function sizeSpread(map: MapDef): SizeSpread | null {
  const g = map.geometry;
  if (!g) return null;
  const areas = g.territories.map((t) => shapeArea(t.rings));
  const mean = areas.reduce((a, b) => a + b, 0) / areas.length;
  const pct = areas.map((a) => Math.round((100 * a) / mean));
  const edges = [0, 60, 80, 100, 120, 140, 170, 1000];
  return {
    min: Math.min(...pct),
    max: Math.max(...pct),
    bands: edges.slice(0, -1).map((from, i) => ({ from, to: edges[i + 1]!, count: pct.filter((p) => p >= from && p < edges[i + 1]!).length })),
  };
}

/** A short fingerprint of a whole map (FNV-1a over its JSON): the same map gives the same text in Node and every browser. */
export function mapFingerprint(map: MapDef): string {
  const s = JSON.stringify(map);
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

/** The order keys are written in, so a copied recipe reads like the ones in configs.ts. */
const KEY_ORDER = ["id", "name", "seed", "shape", "mask", "territories", "provinces", "players", "capitals", "startBonus", "water", "seas", "lakes", "islandChains", "islands", "landBridge", "mountainRanges", "straits", "seaLanes", "minSeaLanes", "rivers", "minChokePoints", "aspect", "roughness", "laneReach", "maxAttempts"];

/** A recipe as JSON, ready to paste into `MAP_CONFIGS` (configs.ts). */
export function recipeToJson(r: Recipe): string {
  const ordered: Record<string, unknown> = {};
  for (const k of KEY_ORDER) if ((r as Record<string, unknown>)[k] !== undefined) ordered[k] = (r as Record<string, unknown>)[k];
  for (const [k, v] of Object.entries(r)) if (!(k in ordered) && v !== undefined) ordered[k] = v;
  return JSON.stringify(ordered, null, 2);
}

/** Read a recipe back (from the lab's "Paste recipe" or a file). Throws with a plain message if it isn't one. */
export function recipeFromJson(text: string): Recipe {
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("That isn't a recipe (it isn't valid JSON).");
  }
  const need = (k: string, type: string) => {
    if (typeof o[k] !== type) throw new Error(`A recipe needs "${k}" (${type}).`);
  };
  need("id", "string");
  need("name", "string");
  need("seed", "string");
  need("territories", "number");
  need("provinces", "number");
  const p = o.players as Recipe["players"] | undefined;
  if (!p || typeof p.min !== "number" || typeof p.max !== "number" || !p.recommended) throw new Error('A recipe needs "players": { min, max, recommended: { min, max } }.');
  if (o.shape !== undefined && !LAND_SHAPES.includes(o.shape as never)) throw new Error(`Unknown shape "${String(o.shape)}" (${LAND_SHAPES.join(", ")}).`);
  for (const [k, v] of Object.entries(o)) if (!KEY_ORDER.includes(k) && k !== "players") throw new Error(`Unknown recipe setting "${k}" (value ${JSON.stringify(v)}).`);
  return o as unknown as Recipe;
}

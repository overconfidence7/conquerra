import type { MapDef, RandomGrade, RandomStart, Rules } from "@conquerra/content";
import { Rng, seedRng } from "@conquerra/engine";
import { adjacency, allDistances, exposureOf } from "./checks";
import { generateMap, type MapGenOptions } from "./index";
import { recipeFor, type Recipe } from "./recipes";
import { parseRandomId, randomPlayers, RANDOM_MAX_SEATS, RANDOM_PREFIX, type RandomShape, type RandomSize } from "./randomId";
import { isRandomVersion, randomMapId, RANDOM_SHAPES, RANDOM_TRIES, RANDOM_VERSION, randomVersionDef, type RandomVersion } from "./seed";
import { RANDOM_TEXT } from "./randomText";

export * from "./randomId";
export * from "./seed";

/**
 * Random maps (session 30). A random map is its id and nothing else: "80-crescent-quiet-heron" is 80 territories, a
 * crescent, and the seed "quiet-heron". The same id makes the same map, byte for byte, at the same map maker version
 * (`MAPGEN_VERSION`, which a game pins), so a game stores only the id and the version, and every page and the room build the map
 * themselves. The recipe's knobs follow the twelve official maps' (configs.ts) by size and shape, with a little
 * variety from the seed; each stage of the map maker draws from its own random stream.
 */

/**
 * The recipe for a random map, tuned as the twelve were (configs.ts) for its size and shape: about 4.5 territories a
 * province, a lake for every 40 territories, a range for every 28 or so, rivers and sea lanes growing with size, and
 * the choke points asked for. The seed nudges a few knobs (a lake or a river more or less, the coast's roughness) so
 * two maps of the same size and shape differ in more than their outline.
 */
export function randomRecipe(size: RandomSize, shape: RandomShape, seed: string, version: RandomVersion = RANDOM_VERSION, seats?: number): Recipe {
  const T = size;
  const land = RANDOM_SHAPES[shape];
  const rng = new Rng(seedRng(`${seed}|recipe`));
  const nudge = (n: number, lo: number) => Math.max(lo, n + (rng.int(3) - 1));
  const base = recipeFor(land, T, seed);
  const id = randomMapId(size, shape, seed);
  // (Big archipelagos stay at 14 islands at most: more makes a map of rafts no fair layout fits.)
  const islands = land === "archipelago" ? Math.min(14, Math.max(5, Math.round(T / 6.5))) : undefined;
  // The map grows with its territories but a mesh cell doesn't, so the longest sea lane grows as the map's width does.
  const laneReach = Math.round((land === "inlandSea" || land === "crescent" ? 20 : 16) * Math.max(1, Math.sqrt(T / 80)));
  return {
    ...base,
    id: `${RANDOM_PREFIX}${id}`,
    name: `Random, ${T} territories`,
    seed,
    provinces: Math.round(T / 4.5),
    lakes: land === "archipelago" ? 0 : nudge(Math.max(1, Math.round(T / 40)), 1),
    // (Session 33b: at most 10 ranges on the big sizes: every range's passes are one more way for a try to fail.)
    mountainRanges: land === "archipelago" ? Math.max(1, Math.round(T / 60)) : Math.min(T >= 300 ? 10 : Infinity, nudge(Math.max(2, Math.round(T / 28)), 2)),
    rivers: nudge(Math.max(3, Math.round(T / 20)), 2),
    ...(land === "continent" ? { water: 0.36 + rng.next() * 0.03 } : { roughness: 0.55 + rng.next() * 0.1 }),
    ...(islands !== undefined ? { islands, seaLanes: Math.round(islands * 0.5), minSeaLanes: islands - 1 } : {}),
    // (Session 34: version 6 seats up to 20 on the big sizes; versions before it 10.)
    players: randomPlayers(size, shape, seats ?? randomVersionDef(version).seats ?? RANDOM_MAX_SEATS),
    laneReach,
    streams: "staged",
    maxAttempts: RANDOM_TRIES,
    // Session 33b: the big sizes (new in version 5) search harder for fair capital layouts: most of their rejected
    // tries were a layout for 8 to 10 players not found in the usual 20 starts.
    ...(T >= 300 ? { layoutStarts: 60 } : {}),
    // Session 34 (version 6): above 10 seats the exposure band alone judges a layout (the paper check's even gaps
    // can't hold for 12 to 20 capitals often enough: about 6 in 10 seeds passed at 12).
    ...(randomVersionDef(version).paperUpTo !== undefined ? { paperUpTo: randomVersionDef(version).paperUpTo } : {}),
    // Session 31 (version 3): a fatter crescent (a smaller bay a little further off, one isle in it), longer sea lanes
    // across the bay and fewer choke points asked for: about 5 in 6 seeds pass at the band of 4.0 instead of 1 in 3.
    ...(version >= 3 && land === "crescent" ? { islands: 1, bite: 0.5, biteOffset: 0.5, laneReach: Math.round(laneReach * 1.6), minChokePoints: Math.max(4, Math.round(T / 18)) } : {}),
  };
}

/** The map's own fairness check at generation: every layout within the exposure band (a reason to reject, or null). */
export function exposureProblem(map: MapDef, band: number = randomVersionDef(RANDOM_VERSION).band): string | null {
  const d = allDistances(map), adj = adjacency(map);
  for (const l of map.capitalLayouts ?? []) {
    const e = exposureOf(l.slots, d, adj, band);
    if (!e.fair) return `capitals for ${l.players} players too unevenly exposed (${(Math.max(...e.exposure) / Math.max(1e-9, Math.min(...e.exposure))).toFixed(1)}x)`;
  }
  return null;
}

/**
 * The harder spots of each layout (the seat rule deals them to bots first): the spots at least 1.5 times as exposed as
 * the layout's middle spot, the most exposed first, a third of the table at most. Session 31: each also gets `bonus`
 * extra troops at the start (the layout's `bonus`, as the official maps' weak spots have; 0 for version 2's maps).
 * Session 33 (version 4): with a `grade`, the head start is graded by exposure instead (`gradeBonus`), and the harder
 * spots stay as they are for the seat rule (always written, an empty list too, so a spot with a head start isn't taken
 * for a harder one).
 */
export const HARDER_THAN_MIDDLE = 1.5;
export function markHarder(map: MapDef, bonus = 0, grade?: RandomGrade, start?: RandomStart): MapDef {
  const d = allDistances(map), adj = adjacency(map);
  for (const l of map.capitalLayouts ?? []) {
    const e = exposureOf(l.slots, d, adj).exposure;
    const middle = [...e].sort((a, b) => a - b)[Math.floor(e.length / 2)]!;
    const harder = l.slots
      .map((s, i) => ({ s, x: e[i]! }))
      .filter((p) => p.x >= HARDER_THAN_MIDDLE * middle)
      .sort((a, b) => b.x - a.x || (a.s < b.s ? -1 : 1))
      .slice(0, Math.floor(l.players / 3))
      .map((p) => p.s)
      .sort();
    if (grade) {
      l.harder = harder;
      const extra = gradeBonus(e, grade);
      const given = l.slots.map((s, i) => [s, extra[i]!] as const).filter(([, n]) => n > 0);
      if (given.length) l.bonus = Object.fromEntries(given);
      if (start) startBuildings(l, e, start);
      continue;
    }
    if (harder.length) l.harder = harder;
    if (harder.length && bonus > 0) l.bonus = Object.fromEntries(harder.map((s) => [s, bonus]));
  }
  return map;
}

/**
 * Session 33, the graded head start (random map version 4): each spot's extra troops from its exposure (the map
 * maker's check, `exposureOf`). The reference spot is the layout's safest (or, `from: "middle"`, its middle one); every
 * spot more exposed than it gets `round(k × (e − e₀) / e₀)`, at least `least` and at most `cap`; the rest get none.
 */
export function gradeBonus(exposure: readonly number[], grade: RandomGrade): number[] {
  const sorted = [...exposure].sort((a, b) => a - b);
  const e0 = grade.from === "middle" ? sorted[Math.floor(sorted.length / 2)]! : sorted[0]!;
  return exposure.map((e) => (e > e0 + 1e-9 ? Math.min(grade.cap, Math.max(grade.least, Math.round((grade.k * (e - e0)) / Math.max(1e-9, e0)))) : 0));
}

/**
 * Session 33b, the income head start (random map version 5): the spots `start.spots` names by exposure rank start with
 * a market at their capital (`start.market`) and `start.culture` levels of culture there. Ranks as `gradeBonus`'s: the
 * safest is rank 0. "aboveMiddle": the more exposed half (ranks above (n - 1) / 2: 2 and 3 of 4, 3 to 5 of 6);
 * "exposedThird": the most exposed third (at least one); "all": every spot but the safest. Ties keep the slot order.
 */
export function startSpots(exposure: readonly number[], spots: RandomStart["spots"]): number[] {
  const n = exposure.length;
  const order = exposure.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x || a.i - b.i).map((o) => o.i);
  const from = spots === "all" ? 1 : spots === "exposedThird" ? n - Math.max(1, Math.floor(n / 3)) : Math.floor((n - 1) / 2) + 1;
  return order.slice(from).sort((a, b) => a - b);
}
function startBuildings(l: NonNullable<MapDef["capitalLayouts"]>[number], exposure: readonly number[], start: RandomStart) {
  const given = startSpots(exposure, start.spots).map((i) => l.slots[i]!);
  const cultured = start.cultureSpots ? startSpots(exposure, start.cultureSpots).map((i) => l.slots[i]!) : given;
  if (start.market && given.length) l.buildings = Object.fromEntries(given.map((s) => [s, "market" as const]));
  if (start.culture > 0 && cultured.length) l.culture = Object.fromEntries(cultured.map((s) => [s, start.culture]));
}

/** Session 33b: the one try a hint names, or null if it doesn't pass (then every try is made, as without a hint). */
function tryAt(recipe: MapGenOptions, rules: Rules, attempt: number): ReturnType<typeof generateMap> | null {
  try {
    return generateMap({ ...recipe, firstAttempt: attempt, maxAttempts: attempt }, rules);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("No map passed")) return null;
    throw e;
  }
}

export class RandomMapFailed extends Error {
  constructor(readonly tries: string[]) {
    super(RANDOM_TEXT.failed);
  }
}

/**
 * Make a random map from its id ("80-crescent-quiet-heron" or "random:80-..."). Throws `RandomMapFailed` (its
 * message is the player's line) if no try passed the checks, or an Error with `RANDOM_TEXT.badId` for a bad id.
 * `version` (session 31): the random map version to build at (a game pins it); the current one if left out, and
 * `RANDOM_TEXT.oldVersion` for one this build can't make. `band` overrides the version's band, `grade` its graded
 * head start (session 33) and `start` its income head start (session 33b), all for the sim's experiments. `attempt`
 * (session 33b): the try that passed when the map was first made (the room and the online pages are told it), so it's
 * made in one try instead of all of them; if that try doesn't pass, every try is made as usual.
 */
export function randomMap(id: string, rules: Rules, opts: Pick<MapGenOptions, "stageSeeds" | "log" | "onProgress"> & { version?: number | null; band?: number; grade?: RandomGrade; start?: RandomStart; attempt?: number | null; seats?: number; paperUpTo?: number } = {}): { map: MapDef; attempt: number } {
  const p = parseRandomId(id);
  if (!p) throw new Error(RANDOM_TEXT.badId);
  const { version: asked, band: bandOverride, grade: gradeOverride, start: startOverride, attempt: hint, seats, paperUpTo, ...gen } = opts;
  const version: RandomVersion = asked == null ? RANDOM_VERSION : isRandomVersion(asked) ? asked : (() => { throw new Error(RANDOM_TEXT.oldVersion(asked)); })();
  const v = randomVersionDef(version);
  const band = bandOverride ?? v.band;
  const recipe: MapGenOptions = { ...randomRecipe(p.size, p.shape, p.seed, version, seats), ...(paperUpTo !== undefined ? { paperUpTo } : {}), ...gen, accept: (m) => exposureProblem(m, band) };
  try {
    const r = (hint && hint > 1 && hint <= RANDOM_TRIES && tryAt(recipe, rules, hint)) || generateMap(recipe, rules);
    const map = markHarder(r.map, v.bonus, gradeOverride ?? v.grade, startOverride ?? v.start);
    map.generator = { ...map.generator!, version };
    return { map, attempt: r.attempt };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("No map passed")) throw new RandomMapFailed(e.message.split("\n").slice(1));
    throw e;
  }
}

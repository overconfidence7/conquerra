import type { MapDef, Rules } from "@conquerra/content";
import { Rng, seedRng } from "@conquerra/engine";
import { adjacency, allDistances, exposureOf } from "./checks";
import { generateMap, type MapGenOptions } from "./index";
import { recipeFor, type Recipe } from "./recipes";
import { parseRandomId, randomPlayers, RANDOM_PREFIX, type RandomShape, type RandomSize } from "./randomId";
import { randomMapId, RANDOM_EXPOSURE_BAND, RANDOM_SHAPES, RANDOM_TRIES } from "./seed";
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
export function randomRecipe(size: RandomSize, shape: RandomShape, seed: string): Recipe {
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
    mountainRanges: land === "archipelago" ? Math.max(1, Math.round(T / 60)) : nudge(Math.max(2, Math.round(T / 28)), 2),
    rivers: nudge(Math.max(3, Math.round(T / 20)), 2),
    ...(land === "continent" ? { water: 0.36 + rng.next() * 0.03 } : { roughness: 0.55 + rng.next() * 0.1 }),
    ...(islands !== undefined ? { islands, seaLanes: Math.round(islands * 0.5), minSeaLanes: islands - 1 } : {}),
    players: randomPlayers(size, shape),
    laneReach,
    streams: "staged",
    maxAttempts: RANDOM_TRIES,
  };
}

/** The map's own fairness check at generation: every layout within the exposure band (a reason to reject, or null). */
export function exposureProblem(map: MapDef): string | null {
  const d = allDistances(map), adj = adjacency(map);
  for (const l of map.capitalLayouts ?? []) {
    const e = exposureOf(l.slots, d, adj, RANDOM_EXPOSURE_BAND);
    if (!e.fair) return `capitals for ${l.players} players too unevenly exposed (${(Math.max(...e.exposure) / Math.max(1e-9, Math.min(...e.exposure))).toFixed(1)}x)`;
  }
  return null;
}

/**
 * The harder spots of each layout (the seat rule deals them to bots first): the spots at least 1.5 times as exposed as
 * the layout's middle spot, the most exposed first, a third of the table at most. A random map has no start bonus
 * (that's sized by sims, map by map), so this is how its weaker spots are known.
 */
export const HARDER_THAN_MIDDLE = 1.5;
export function markHarder(map: MapDef): MapDef {
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
    if (harder.length) l.harder = harder;
  }
  return map;
}

export class RandomMapFailed extends Error {
  constructor(readonly tries: string[]) {
    super(RANDOM_TEXT.failed);
  }
}

/**
 * Make a random map from its id ("80-crescent-quiet-heron" or "random:80-..."). Throws `RandomMapFailed` (its
 * message is the player's line) if no try passed the checks, or an Error with `RANDOM_TEXT.badId` for a bad id.
 */
export function randomMap(id: string, rules: Rules, opts: Pick<MapGenOptions, "stageSeeds" | "log"> = {}): { map: MapDef; attempt: number } {
  const p = parseRandomId(id);
  if (!p) throw new Error(RANDOM_TEXT.badId);
  const recipe: MapGenOptions = { ...randomRecipe(p.size, p.shape, p.seed), ...opts, accept: exposureProblem };
  try {
    const r = generateMap(recipe, rules);
    return { map: markHarder(r.map), attempt: r.attempt };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("No map passed")) throw new RandomMapFailed(e.message.split("\n").slice(1));
    throw e;
  }
}

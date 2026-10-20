import type { MapDef, Rules } from "@conquerra/content";
import { LAYOUT_VERSION } from "@conquerra/content/bigTables";
import { createGame, viewFor, type GameContext, type PlayerView, type TerritoryId } from "@conquerra/engine";
import { exposureProblem, generateMap, landBridgeBorders, mapFingerprint, markHarder, RANDOM_PREFIX, type Recipe } from "@conquerra/mapgen";

/**
 * The map lab's pure core: making a map from a recipe, and the view the preview shows. It runs in the lab's
 * worker, and the tests run it in Node to check the lab makes exactly what `generateMap` makes.
 */

export interface LabMade {
  recipe: Recipe;
  map: MapDef | null;
  /** Which try passed (1 = the seed itself, 2 = "seed#2", ...). */
  attempt: number;
  /** Why each earlier try was rejected. */
  rejected: string[];
  ms: number;
  fingerprint: string | null;
  /** Set when no try passed. */
  error: string | null;
}

declare const performance: { now(): number };

export function makeLabMap(recipe: Recipe, rules: Rules): LabMade {
  const t0 = performance.now();
  try {
    // (Session 30: a random map's recipe gets the random maps' own check and its harder spots, as in the game.)
    const random = recipe.id.startsWith(RANDOM_PREFIX);
    const r = generateMap(random ? { ...recipe, accept: exposureProblem } : recipe, rules);
    if (random) markHarder(r.map);
    return { recipe, map: r.map, attempt: r.attempt, rejected: r.rejected, ms: performance.now() - t0, fingerprint: mapFingerprint(r.map), error: null };
  } catch (e) {
    const lines = (e as Error).message.split("\n");
    return { recipe, map: null, attempt: 0, rejected: lines.slice(1), ms: performance.now() - t0, fingerprint: null, error: lines[0] ?? String(e) };
  }
}

/** Plain names for the seats in the preview (House colours follow seat order). */
const SEATS = ["North", "South", "East", "West", "Hill", "Vale", "Coast", "Marsh", "Wood", "Isle"];

/**
 * What the preview shows: the map as a new game would start at this player count, seen with no fog (every
 * capital in its House colours). With `capitals` off, every territory is neutral.
 */
export function labView(map: MapDef, rules: Rules, players: number, capitals: boolean): { ctx: GameContext; view: PlayerView } {
  const ctx: GameContext = { map, rules };
  const n = Math.max(map.minPlayers, Math.min(map.maxPlayers, players));
  const state = createGame(ctx, {
    gameId: "lab",
    seed: "lab",
    players: Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: SEATS[i] ?? `Seat ${i + 1}` })),
    settings: { fog: false },
    layouts: LAYOUT_VERSION,
  });
  const view = viewFor(ctx, state, "p1");
  if (capitals) return { ctx, view };
  const territories: PlayerView["territories"] = {};
  for (const [id, t] of Object.entries(view.territories))
    territories[id] = t.detail === "full" ? { ...t, owner: null, capitalOf: null, leaders: [], troops: Math.min(t.troops, 3) } : t;
  return { ctx, view: { ...view, territories } };
}

/** Territories at the ends of the map's choke points: passes, sea lanes and land bridges. */
export function chokeTerritories(map: MapDef): TerritoryId[] {
  const out = new Set<TerritoryId>();
  for (const b of map.borders) if (b.type === "pass" || b.type === "sea") out.add(b.a).add(b.b);
  for (const b of landBridgeBorders(map)) out.add(b.a).add(b.b);
  return [...out].sort();
}

/** A new random seed for the lab's "Random" button (the map maker itself never makes randomness). */
export function randomSeed(): string {
  const words = ["amber", "briar", "cinder", "dusk", "ember", "fern", "gale", "heath", "iron", "jade", "kestrel", "lark", "mire", "north", "oak", "pike", "quill", "rook", "sable", "thorn", "umber", "vale", "wold", "yarrow"];
  const b = crypto.getRandomValues(new Uint8Array(3));
  return `${words[b[0]! % words.length]}-${words[b[1]! % words.length]}-${b[2]! % 100}`;
}

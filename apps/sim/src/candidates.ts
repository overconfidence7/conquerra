/**
 * Candidate maps for Nate (session 10): make each one, check it, and run a quick Captain sim at the player counts it
 * suits, next to a plain continent of the same size (to see what the shape itself does to game length and runaways).
 *
 *   pnpm --filter @conquerra/sim candidates                 everything (about 15 minutes)
 *   pnpm --filter @conquerra/sim candidates --games 50      quicker
 *   pnpm --filter @conquerra/sim candidates --only ringsea
 *
 * Writes docs/maps/candidates.json (the numbers behind docs/maps/candidates.md).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeCaptainBot } from "@conquerra/bots";
import { defaultRules, type MapDef } from "@conquerra/content";
import { explainChecks, fairnessRows, generateMap, mapFingerprint, recipeFor, sizeSpread, type Recipe } from "@conquerra/mapgen";
import { runGame, simReport, type SimReport } from "@conquerra/simcore";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const args = process.argv.slice(2);
const arg = (k: string, d: string) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1]! : d);
const GAMES = Number(arg("games", "200"));
const only = arg("only", "");

export interface Candidate {
  key: string;
  why: string;
  recipe: Recipe;
}

const named = (r: Recipe, id: string, name: string): Recipe => ({ ...r, id, name });

/** The six candidates (seeds picked by eye from six tries of each recipe; see docs/maps/candidates.md). */
export const CANDIDATES: Candidate[] = [
  { key: "shattered-isles", why: "Nine islands of different sizes and one islet, every crossing a sea lane: a naval map for 4–6.", recipe: named(recipeFor("archipelago", 60, "archipelago-60-5"), "shattered-isles", "The Shattered Isles") },
  { key: "twin-realms", why: "Two big continents joined by one narrow land bridge and two sea lanes: a natural front line for 4–8.", recipe: named(recipeFor("twinContinents", 80, "twinContinents-80-2"), "twin-realms", "The Twin Realms") },
  { key: "moon-coast", why: "A long crescent round a bay with two isles in it: short fronts and long marches for 4–8.", recipe: named(recipeFor("crescent", 80, "crescent-80-2"), "moon-coast", "The Moon Coast") },
  { key: "ringsea", why: "Land in a ring round an inland sea with an island in the middle that every shore can reach: for 6–10.", recipe: named(recipeFor("inlandSea", 100, "inlandSea-100-6"), "ringsea", "The Ringsea") },
  { key: "crownlands", why: "My extra: a crown-shaped land with five peninsula points, each a natural stronghold, for 6–10.", recipe: named(recipeFor("mask", 100, "mask-100-5", { mask: "crown" }), "crownlands", "The Crownlands") },
  // Two mountain ranges, not the four a 120 map gets by default: with 11 passes, 8–10 player games ran 44–45 turns.
  // Suggested for 6–8: at 10 players it still averages about 41.5 turns (fair capitals exist up to 10).
  { key: "wyrmland", why: "The biggest: a dragon-shaped land (head, neck, wing, legs, and its tail curled into an island) for 6–8 with room to spare.", recipe: named(recipeFor("mask", 120, "mask-120-2", { mask: "dragon", mountainRanges: 2, players: { min: 2, max: 10, recommended: { min: 6, max: 8 } } }), "wyrmland", "Wyrmland") },
];

/** Plain continents of the same sizes, for comparison. */
const BASELINES: Record<number, Recipe> = Object.fromEntries([60, 80, 100, 120].map((n) => [n, recipeFor("continent", n, `continent-${n}-1`)]));

function sim(map: MapDef, players: number, seed: string): SimReport {
  const ctx = { map, rules: defaultRules };
  const results = Array.from({ length: GAMES }, (_, i) => runGame(ctx, `${seed}-${players}p-${i}`, players, { luck: defaultRules.combat.luck, fog: true, mode: "classic" }, false, makeCaptainBot()));
  return simReport(results, players);
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const line = (r: SimReport) =>
  `${r.players}p: ${r.turns.avg.toFixed(1)} turns (median ${r.turns.median}), ${pct(r.upTo40)} within 40, ${pct(r.in30to40)} in 30–40 | seats ${r.seatWins.map(pct).join("/")} | half the map by turn 10 ${pct(r.runaway.halfMapByTurn10)}, halfway leader wins ${pct(r.runaway.halfwayLeaderWins)}, comebacks ${pct(r.runaway.comebacks)} | battles ${r.battles.perGame.toFixed(0)}/game, passes ${pct(r.battles.passShare)}, sea lanes ${pct(r.battles.seaShare)}`;

const out: unknown[] = [];
const baselineDone = new Map<string, SimReport>();
for (const c of CANDIDATES) {
  if (only && c.key !== only) continue;
  const t0 = performance.now();
  const made = generateMap(c.recipe, defaultRules);
  const makeMs = Math.round(performance.now() - t0);
  const map = made.map;
  const checks = explainChecks(map, defaultRules, { minChokePoints: c.recipe.minChokePoints ?? 5, minSeaLanes: c.recipe.minSeaLanes ?? 1 });
  const counts = [...new Set([map.recommendedPlayers.min, map.recommendedPlayers.max])];
  const types: Record<string, number> = {};
  for (const b of map.borders) types[b.type] = (types[b.type] ?? 0) + 1;
  console.log(`\n${map.name} (${c.key}): ${map.territories.length} territories, ${map.provinces.length} provinces, players ${map.minPlayers}–${map.maxPlayers} (suggested ${map.recommendedPlayers.min}–${map.recommendedPlayers.max}); made in ${makeMs} ms on try ${made.attempt}; checks ${checks.every((x) => x.ok) ? "all pass" : "FAIL"}; borders ${JSON.stringify(types)}; fingerprint ${mapFingerprint(map)}`);
  const sims: SimReport[] = [];
  const base: SimReport[] = [];
  for (const n of counts) {
    const r = sim(map, n, c.key);
    sims.push(r);
    console.log(`  ${line(r)}`);
    const bkey = `${map.territories.length}-${n}`;
    if (!baselineDone.has(bkey)) {
      const bm = generateMap(BASELINES[map.territories.length]!, defaultRules).map;
      baselineDone.set(bkey, sim(bm, n, `continent-${map.territories.length}`));
    }
    base.push(baselineDone.get(bkey)!);
    console.log(`  (continent ${map.territories.length}) ${line(baselineDone.get(bkey)!)}`);
  }
  out.push({
    key: c.key,
    why: c.why,
    recipe: c.recipe,
    attempt: made.attempt,
    makeMs,
    fingerprint: mapFingerprint(map),
    territories: map.territories.length,
    provinces: map.provinces.length,
    provinceSizes: map.provinces.map((p) => map.territories.filter((t) => t.province === p.id).length),
    borders: types,
    chokePoints: made.check.chokePoints,
    checks: checks.map((x) => ({ label: x.label, ok: x.ok, detail: x.detail })),
    fairness: fairnessRows(map, defaultRules),
    sizes: sizeSpread(map),
    sims,
    continent: base,
  });
}
mkdirSync(join(root, "docs/maps"), { recursive: true });
// With --only, that map's results replace its entry in the file.
const file = join(root, "docs/maps/candidates.json");
const prev = only && existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")).candidates as { key: string }[]) : [];
const merged = only ? CANDIDATES.map((c) => out.find((o) => (o as { key: string }).key === c.key) ?? prev.find((p) => p.key === c.key)).filter(Boolean) : out;
writeFileSync(file, `${JSON.stringify({ games: GAMES, made: "2026-10-05", candidates: merged }, null, 1)}\n`);

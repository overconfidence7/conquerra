/**
 * Before a new seed becomes an official map: Captain games on today's map and on the same recipe with another seed
 * (and mask), side by side. The Fallen are off by default, so only the map differs from earlier map write-ups.
 *
 *   pnpm --filter @conquerra/sim exec tsx scripts/seed-sim.ts wyrmland mask-120-6 --mask wyrm --players 6,8,10 --games 200
 */
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { makeCaptainBot } from "@conquerra/bots";
import { generateMap, MAP_CONFIGS } from "@conquerra/mapgen";
import { runGame, simReport } from "@conquerra/simcore";

const args = process.argv.slice(2);
const arg = (k: string, d: string) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1]! : d);
const [id, seed] = args;
const base = MAP_CONFIGS.find((c) => c.id === id);
if (!base || !seed) throw new Error("Usage: seed-sim.ts <mapId> <seed> [--mask id] [--players 6,8] [--games 200] [--fallen on]");
const games = Number(arg("games", "200"));
const players = arg("players", "6").split(",").map(Number);
const fallen = arg("fallen", "off") === "on";
const candidate = generateMap({ ...base, seed, ...(arg("mask", "") ? { mask: arg("mask", "") } : {}) }, defaultRules).map;
for (const [label, map] of [["today", maps[id]!], [`seed ${seed}`, candidate]] as const)
  for (const n of players) {
    const ctx = { map, rules: defaultRules };
    const results = Array.from({ length: games }, (_, i) => runGame(ctx, `seedsim-${n}p-${i}`, n, { fallen }, false, makeCaptainBot()));
    const r = simReport(results, n);
    console.log(
      `${base.name} (${label}), ${n} players, ${games} games: ${r.turns.avg.toFixed(1)} turns, ${(100 * r.upTo40).toFixed(0)}% within 40, ${(100 * r.in30to40).toFixed(0)}% in 30-40;`,
      `half the map by turn 10 ${(100 * r.runaway.halfMapByTurn10).toFixed(0)}%, halfway leader wins ${(100 * r.runaway.halfwayLeaderWins).toFixed(0)}%, comebacks ${(100 * r.runaway.comebacks).toFixed(0)}%; pass battles ${(100 * r.battles.passShare).toFixed(0)}%, sea ${(100 * r.battles.seaShare).toFixed(0)}%`,
    );
  }

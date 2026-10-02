import { defaultRules, maps } from "@conquerra/content";
import { indexMap, type GameContext, type GameMode } from "@conquerra/engine";
import { narrate } from "./narrate";
import { runGame, type GameSummary } from "./runGame";

/**
 * Bot-vs-bot simulator.
 *   pnpm sim                          500 games, 4 players
 *   pnpm sim --games 1000 --players 6 --luck 0.3
 *   pnpm sim --watch --seed demo      print one game turn by turn in plain English
 */
const args = process.argv.slice(2);
const arg = (name: string, dflt: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1]!.startsWith("--") ? args[i + 1]! : dflt;
};
const flag = (name: string) => args.includes(`--${name}`);

const map = maps[arg("map", "embervale")];
if (!map) throw new Error(`Unknown map. Available: ${Object.keys(maps).join(", ")}`);
const ctx: GameContext = { map, rules: defaultRules };
const players = Number(arg("players", "4"));
const games = Number(arg("games", "500"));
const luck = Number(arg("luck", String(defaultRules.combat.luck)));
const mode = arg("mode", "classic") as GameMode;
const turnLimit = arg("turn-limit", "") ? Number(arg("turn-limit", "")) : mode === "conquest" ? 30 : null;
const fog = arg("fog", "on") !== "off";
const seedPrefix = arg("seed", "sim");
const settings = { luck, mode, turnLimit, fog };

if (flag("watch")) {
  const g = runGame(ctx, seedPrefix, players, settings, true);
  const idx = indexMap(ctx.map);
  const name = (id: string | null) => (id ? `Bot ${id.slice(1)}` : "neutral");
  const place = (id: string) => idx.byId.get(id)?.name ?? id;
  for (const turn of g.log ?? []) for (const e of turn) console.log(narrate(e, name, place));
  process.exit(0);
}

const t0 = Date.now();
const results: GameSummary[] = [];
const errors: { seed: string; error: string }[] = [];
for (let i = 0; i < games; i++) {
  const seed = `${seedPrefix}-${i}`;
  try {
    results.push(runGame(ctx, seed, players, settings));
  } catch (e) {
    errors.push({ seed, error: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  }
}
const ms = Date.now() - t0;

const avg = (f: (g: GameSummary) => number) => results.reduce((a, g) => a + f(g), 0) / Math.max(1, results.length);
const pct = (n: number) => `${((100 * n) / Math.max(1, results.length)).toFixed(1)}%`;
const wins = Array.from({ length: players }, (_, i) => results.filter((g) => g.winnerSeat === i).length);
const draws = results.filter((g) => g.winner === "draw").length;
const reasons = new Map<string, number>();
for (const g of results) reasons.set(String(g.endReason), (reasons.get(String(g.endReason)) ?? 0) + 1);
const decided = results.filter((g) => g.decidedTurn !== null);
const sortedTurns = results.map((g) => g.turns).sort((a, b) => a - b);

console.log(`\nConquerra simulator — ${map.name}, ${players} Recruit bots, luck ${luck}, ${mode}${turnLimit ? ` (${turnLimit} turns)` : ""}, fog ${fog ? "on" : "off"}`);
console.log(`Games: ${results.length} finished, ${errors.length} crashed, in ${(ms / 1000).toFixed(1)}s (${(ms / Math.max(1, games)).toFixed(1)} ms/game)\n`);
console.log("Win rate by player slot (fair ≈ " + (100 / players).toFixed(1) + "% each):");
wins.forEach((w, i) => console.log(`  Player ${i + 1}: ${pct(w)}`));
console.log(`  Draws: ${pct(draws)}`);
console.log(`\nHow games ended: ${[...reasons.entries()].map(([k, v]) => `${k} ${pct(v)}`).join(", ")}`);
console.log(`Game length (turns): avg ${avg((g) => g.turns).toFixed(1)}, median ${sortedTurns[Math.floor(sortedTurns.length / 2)] ?? "-"}, min ${sortedTurns[0] ?? "-"}, max ${sortedTurns[sortedTurns.length - 1] ?? "-"}`);
console.log(`Battles per game: ${avg((g) => g.battles).toFixed(1)}, captures per game: ${avg((g) => g.captures).toFixed(1)}`);
console.log(`Orders per game: ${avg((g) => g.orders).toFixed(0)}, fizzled: ${((100 * results.reduce((a, g) => a + g.fizzles, 0)) / Math.max(1, results.reduce((a, g) => a + g.orders, 0))).toFixed(1)}%`);
console.log(`Initiative used per game: ${avg((g) => g.initiatives).toFixed(1)}, leaders killed per game: ${avg((g) => g.leadersKilled).toFixed(1)}`);
console.log(`\nPredictability (lower = more exciting):`);
console.log(`  Winner locked in the lead at ${(100 * (decided.reduce((a, g) => a + g.decidedTurn! / g.turns, 0) / Math.max(1, decided.length))).toFixed(0)}% of the way through the game, on average`);
console.log(`  Lead changes per game: ${avg((g) => g.leadChanges).toFixed(1)}`);
if (errors.length) {
  console.log(`\nCRASHES (first 3):`);
  for (const e of errors.slice(0, 3)) console.log(`  seed ${e.seed}:\n${e.error}`);
  process.exit(1);
}

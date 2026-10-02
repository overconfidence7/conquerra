import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { indexMap, type GameContext, type GameMode } from "@conquerra/engine";
import { narrate } from "./narrate";
import { runGame, type GameSummary } from "./runGame";

/**
 * Bot-vs-bot simulator.
 *   pnpm sim                                   500 games, 4 players
 *   pnpm sim --games 1000 --players 2,4,6      several table sizes in one run
 *   pnpm sim --games 50 --players 2,6,10       includes CPU timing (10 players uses the Greatmarch map)
 *   pnpm sim --watch --seed demo               print one game turn by turn in plain English
 * Options: --map embervale|greatmarch (default: Embervale up to 6 players, Greatmarch above),
 *          --luck 0.3, --mode classic|conquest, --turn-limit N, --fog on|off, --seed prefix
 */
const args = process.argv.slice(2);
const arg = (name: string, dflt: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1]!.startsWith("--") ? args[i + 1]! : dflt;
};
const flag = (name: string) => args.includes(`--${name}`);

const playerCounts = arg("players", "4").split(",").map(Number);
const games = Number(arg("games", "500"));
const luck = Number(arg("luck", String(defaultRules.combat.luck)));
const mode = arg("mode", "classic") as GameMode;
const turnLimit = arg("turn-limit", "") ? Number(arg("turn-limit", "")) : null;
const fog = arg("fog", "on") !== "off";
const seedPrefix = arg("seed", "sim");
const settings = { luck, mode, fog, ...(turnLimit ? { turnLimit } : {}) };

function ctxFor(players: number): GameContext {
  const name = arg("map", players > 6 ? "greatmarch" : "embervale");
  const map = maps[name];
  if (!map) throw new Error(`Unknown map. Available: ${Object.keys(maps).join(", ")}`);
  return { map, rules: defaultRules };
}

if (flag("watch")) {
  const ctx = ctxFor(playerCounts[0]!);
  const g = runGame(ctx, seedPrefix, playerCounts[0]!, settings, true);
  const idx = indexMap(ctx.map);
  const name = (id: string | null) => (id ? `Bot ${id.slice(1)}` : "neutral");
  const place = (id: string) => idx.byId.get(id)?.name ?? id;
  for (const turn of g.log ?? []) for (const e of turn) console.log(narrate(e, name, place));
  process.exit(0);
}

const stats = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const avg = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
  return { avg, p95: s[Math.floor(s.length * 0.95)] ?? 0, max: s[s.length - 1] ?? 0 };
};
const ms = (x: number) => `${x.toFixed(2)} ms`;
let crashed = 0;

for (const players of playerCounts) {
  const ctx = ctxFor(players);
  const t0 = Date.now();
  const results: GameSummary[] = [];
  const errors: { seed: string; error: string }[] = [];
  for (let i = 0; i < games; i++) {
    const seed = `${seedPrefix}-${players}p-${i}`;
    try {
      results.push(runGame(ctx, seed, players, settings));
    } catch (e) {
      errors.push({ seed, error: e instanceof Error ? (e.stack ?? e.message) : String(e) });
    }
  }
  const wall = Date.now() - t0;
  crashed += errors.length;

  const avg = (f: (g: GameSummary) => number) => results.reduce((a, g) => a + f(g), 0) / Math.max(1, results.length);
  const pct = (k: number) => `${((100 * k) / Math.max(1, results.length)).toFixed(1)}%`;
  const wins = Array.from({ length: players }, (_, i) => results.filter((g) => g.winnerSeat === i).length);
  const draws = results.filter((g) => g.winner === "draw").length;
  const reasons = new Map<string, number>();
  for (const g of results) reasons.set(String(g.endReason), (reasons.get(String(g.endReason)) ?? 0) + 1);
  const decided = results.filter((g) => g.decidedTurn !== null);
  const turns = results.map((g) => g.turns).sort((a, b) => a - b);
  const inBand = results.filter((g) => g.turns >= 15 && g.turns <= 25).length;
  const resolve = stats(results.flatMap((g) => g.resolveMs));
  const plan = stats(results.flatMap((g) => g.planMs));
  const total = stats(results.flatMap((g) => g.resolveMs.map((r, i) => r + g.planMs[i]!)));

  console.log(`\n=== ${players} players — ${ctx.map.name}, Recruit bots, luck ${luck}, ${mode}${turnLimit ? ` (${turnLimit} turns)` : ""}, fog ${fog ? "on" : "off"} ===`);
  console.log(`Games: ${results.length} finished, ${errors.length} crashed, in ${(wall / 1000).toFixed(1)}s`);
  console.log(`Win rate by seat (fair ≈ ${(100 / players).toFixed(1)}% each): ${wins.map((w) => pct(w)).join(" / ")}   draws ${pct(draws)}`);
  console.log(`How games ended: ${[...reasons.entries()].map(([k, v]) => `${k} ${pct(v)}`).join(", ")}`);
  console.log(`Game length (turns): avg ${avg((g) => g.turns).toFixed(1)}, median ${turns[Math.floor(turns.length / 2)] ?? "-"}, min ${turns[0] ?? "-"}, max ${turns[turns.length - 1] ?? "-"}; ${pct(inBand)} within 15–25`);
  console.log(`Per game: ${avg((g) => g.battles).toFixed(1)} battles, ${avg((g) => g.captures).toFixed(1)} captures, ${avg((g) => g.hires).toFixed(1)} specialists hired, ${avg((g) => g.invests).toFixed(1)} culture raises, ${avg((g) => g.leadersKilled).toFixed(1)} leaders killed`);
  const kinds = ["normal", "river", "pass", "sea"];
  console.log(`Battles by border (per game, % that captured): ${kinds.map((k) => { const b = results.reduce((a, g) => a + (g.byBorder[k]?.battles ?? 0), 0), c = results.reduce((a, g) => a + (g.byBorder[k]?.captures ?? 0), 0); return `${k} ${(b / Math.max(1, results.length)).toFixed(1)} (${b ? ((100 * c) / b).toFixed(0) : "-"}%)`; }).join(", ")}`);
  console.log(`Orders per game: ${avg((g) => g.orders).toFixed(0)} (${((100 * results.reduce((a, g) => a + g.presets, 0)) / Math.max(1, results.reduce((a, g) => a + g.orders, 0))).toFixed(0)}% with a preset), fizzled: ${((100 * results.reduce((a, g) => a + g.fizzles, 0)) / Math.max(1, results.reduce((a, g) => a + g.orders, 0))).toFixed(1)}%`);
  console.log(`Predictability (lower = more exciting): winner locked in the lead at ${(100 * (decided.reduce((a, g) => a + g.decidedTurn! / g.turns, 0) / Math.max(1, decided.length))).toFixed(0)}% of the game; ${avg((g) => g.leadChanges).toFixed(1)} lead changes per game`);
  console.log(`CPU per turn (this machine): resolve avg ${ms(resolve.avg)}, p95 ${ms(resolve.p95)}, worst ${ms(resolve.max)} | bots planning (all seats) avg ${ms(plan.avg)}, worst ${ms(plan.max)} | total avg ${ms(total.avg)}, worst ${ms(total.max)}`);
  if (errors.length) {
    console.log(`CRASHES (first 3):`);
    for (const e of errors.slice(0, 3)) console.log(`  seed ${e.seed}:\n${e.error}`);
  }
}
if (crashed) process.exit(1);

/**
 * Session 18, Part 2: leaders in play, in one process (orders and speed). Plays `games` games on a table with one
 * seat of `kind` against `others`, and reports: how many orders that seat's leaders write a turn (by leader), its
 * leaders' planning time per turn, what its Steward bought, and who won.
 *   npx tsx apps/sim/scripts/s18-leaders.ts [kind=delegate-80] [others=marshal] [map=wyrmland] [players=10] [games=10]
 */
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { type Bot } from "@conquerra/bots";
import type { GameContext, StepEvent } from "@conquerra/engine";
import { playTable } from "@conquerra/simcore";
import { botFor, seatsFor } from "../src/tournament";

declare const performance: { now(): number };
const [kind = "delegate-80", others = "marshal", map = "wyrmland", players = "10", games = "10"] = process.argv.slice(2);
const ctx: GameContext = { map: maps[map]!, rules: defaultRules };
const n = Number(players);
const counts = { turns: 0, leader: 0, steward: 0, max: 0 };
const times: number[] = [];
const bought = { forts: 0, markets: 0, barracks: 0, culture: 0, troops: 0 };
let wins = 0, turnsAll = 0;
for (let g = 0; g < Number(games); g++) {
  const spec = { map, players: n, seats: [kind, ...Array.from({ length: n - 1 }, () => others)], games: Number(games), seed: "s18", fog: true, diplomacy: true };
  const seed = `s18-${map}-${n}p-${g}`;
  const kinds = seatsFor(spec, 0, seed);
  const bots: Bot[] = kinds.map((k) => botFor(k));
  // Time and count the seat under test (seat 0).
  const inner = bots[0]!;
  bots[0] = {
    ...inner,
    plan(c, view, last) {
      const t0 = performance.now();
      const os = inner.plan(c, view, last);
      times.push(performance.now() - t0);
      const l = os.filter((o) => o.general).length, s = os.filter((o) => o.steward).length;
      counts.turns++;
      counts.leader += l;
      counts.steward += s;
      counts.max = Math.max(counts.max, l + s);
      return os;
    },
  };
  const r = playTable(ctx, seed, bots, {
    settings: { fog: true, diplomacy: true },
    onEvents: (_b, ev: readonly StepEvent[]) => {
      for (const e of ev) {
        if (!("by" in e) || !e.by || (e as { player?: string }).player !== "p1") continue;
        if (e.type === "built") bought[e.building === "fort" ? "forts" : e.building === "market" ? "markets" : "barracks"]++;
        if (e.type === "invested") bought.culture++;
        if (e.type === "recruited") bought.troops += e.count;
      }
    },
  });
  if (r.winner === "p1") wins++;
  turnsAll += r.turns;
}
times.sort((a, b) => a - b);
const avg = times.reduce((a, b) => a + b, 0) / times.length;
console.log(`${kind} vs ${others} on ${map}:${n}, ${games} games: won ${wins} (${((100 * wins) / Number(games)).toFixed(0)}%, fair ${(100 / n).toFixed(0)}%), ${(turnsAll / Number(games)).toFixed(1)} turns a game`);
console.log(`orders a turn: Leader ${(counts.leader / counts.turns).toFixed(1)}, Steward ${(counts.steward / counts.turns).toFixed(1)}, most in one turn ${counts.max}`);
console.log(`planning a turn: average ${avg.toFixed(1)} ms, 95th ${times[Math.floor(times.length * 0.95)]!.toFixed(1)} ms, worst ${times[times.length - 1]!.toFixed(1)} ms`);
console.log(`its leaders bought (all games): ${JSON.stringify(bought)}`);

/** Session 34b: a `GamePool` worker. Reads games from stdin (one JSON line each), plays them, writes the results. */
import { createInterface } from "node:readline";
import type { LiteResult } from "./pool";
import { playOne, type TournamentSpec } from "./tournament";

for await (const line of createInterface({ input: process.stdin })) {
  if (!line.trim()) continue;
  const { id, spec, i } = JSON.parse(line) as { id: number; spec: TournamentSpec; i: number };
  const g = playOne(spec, i);
  const per = g.resolveMs.map((ms, t) => ms + (g.turnPlanMs[t] ?? 0));
  const r: LiteResult = {
    seed: g.seed,
    turns: g.turns,
    seats: g.seats.map((s) => ({ capital: s.capital, won: s.won })),
    turnMsAvg: per.length ? per.reduce((a, b) => a + b, 0) / per.length : 0,
    turnMsMax: per.length ? Math.max(...per) : 0,
  };
  process.stdout.write(`${JSON.stringify({ id, r })}\n`);
}

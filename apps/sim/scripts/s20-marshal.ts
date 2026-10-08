/**
 * Session 20, Part 2: one change at a time to the Marshal, measured.
 *   npx tsx apps/sim/scripts/s20-marshal.ts <games> <tables: embervale:4,wyrmland:6> <seats: delegate-80,marshal> <label>=<json change> ...
 * A change is {"judgement": {...}, "personalities": {"*": {...}, "turtle": {...}}} (merged into the Marshals' own; the
 * delegating seat's leaders keep the shared judgement). Seats are rotated each game. For each table: the win rate of
 * each seat kind (fair share), game length (median, share at the 60-turn cap), half the map by turn 10, and whether the
 * halfway leader won.
 */
import { runTournament, type TournamentSpec } from "../src/tournament";

const [games = "500", tablesArg = "embervale:4,wyrmland:6", seatsArg = "delegate-80,marshal", ...changes] = process.argv.slice(2);
const pct = (k: number, of: number) => `${((100 * k) / Math.max(1, of)).toFixed(1)}%`;
for (const c of changes.length ? changes : ["today={}"]) {
  const i = c.indexOf("=");
  const label = c.slice(0, i);
  const ch = JSON.parse(c.slice(i + 1)) as { judgement?: Record<string, unknown>; personalities?: Record<string, Record<string, unknown>> };
  for (const t of tablesArg.split(",")) {
    const [map, n] = t.split(":") as [string, string];
    const players = Number(n);
    const head = seatsArg.split(",");
    // One of each listed seat (the last fills the table).
    const seats = [...head.slice(0, -1), ...Array(players - head.length + 1).fill(head[head.length - 1])];
    const spec: TournamentSpec = { map, players, seats, games: Number(games), seed: "s20P", fog: true, diplomacy: true, ...(ch.judgement || ch.personalities ? { tweak: { ...(ch.judgement ? { judgement: ch.judgement } : {}), ...(ch.personalities ? { personalities: ch.personalities } : {}) } } : {}) };
    const t0 = Date.now();
    const r = await runTournament(spec);
    const base = (k: string) => k.replace(/^marshal-[a-z]+/, "marshal");
    const kinds = [...new Set(r.flatMap((g) => g.kinds.map(base)))];
    const rate = (k: string) => {
      let seatsOf = 0, wins = 0;
      for (const g of r)
        g.kinds.forEach((x, s) => {
          if (base(x) !== k) return;
          seatsOf++;
          if (g.seats[s]!.won) wins++;
        });
      return `${k} ${pct(wins, seatsOf)} (${((wins / Math.max(1, seatsOf)) * players).toFixed(2)}x)`;
    };
    const turns = r.map((g) => g.turns).sort((a, b) => a - b);
    const at10 = r.filter((g) => g.topShareTurn10 !== null);
    const won = r.filter((g) => g.winner !== "draw");
    const half = won.filter((g) => g.leaderHalfway);
    console.log(
      `${label.padEnd(12)} ${t.padEnd(12)} ${kinds.map(rate).join(", ")} | fair ${(100 / players).toFixed(1)}% | length median ${turns[Math.floor(turns.length / 2)]}, avg ${(turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(1)}, at the 60 cap ${pct(turns.filter((x) => x >= 60).length, turns.length)} | half-map by 10 ${pct(at10.filter((g) => g.topShareTurn10! > 0.5).length, at10.length)}, halfway leader won ${pct(half.filter((g) => g.leaderHalfway === g.winner).length, half.length)} | ${((Date.now() - t0) / 1000).toFixed(0)}s`,
    );
  }
}

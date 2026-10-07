/**
 * Session 19, Part 2: culture and buildings that pay. Each lever (a rule change), on its own and in pairs, against
 * today's rules:
 *  - a Captain with the default Steward (`captain-steward-20`) against plain Captains, Embervale 4 and Wyrmland 6;
 *  - a table of Marshals (each personality's win rate, game length, the runaway measures), Embervale 4 and Wyrmland 6;
 *  - "what wins": in those Marshal games, the win rate by markets and by culture levels raised by turn 10.
 *   npx tsx apps/sim/scripts/s19-levers.ts [games=500] [variant names...]
 */
import { runTournament, type TournamentSpec } from "../src/tournament";

export const LEVERS: Record<string, Record<string, unknown>> = {
  today: {},
  culture: { culture: { incomePerLevel: 1 } },
  markets: { buildings: { market: { income: 3 } } },
  marketsCheap: { buildings: { market: { cost: 4 } } },
  forts: { buildings: { fort: { cost: 5 } } },
  fortsQuick: { buildings: { fort: { buildTurns: 1 } } },
  "culture+markets": { culture: { incomePerLevel: 1 }, buildings: { market: { income: 3 } } },
  "culture+forts": { culture: { incomePerLevel: 1 }, buildings: { fort: { cost: 5 } } },
  "markets+forts": { buildings: { market: { income: 3 }, fort: { cost: 5 } } },
};

const games = Number(process.argv[2] ?? 500);
const names = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(LEVERS);
const pct = (k: number, of: number) => `${((100 * k) / Math.max(1, of)).toFixed(1)}%`;
const run = (map: string, players: number, seats: string[], rules: Record<string, unknown>, n = games) => runTournament({ map, players, seats, games: n, seed: "s19L", fog: true, diplomacy: true, rules } as TournamentSpec);

for (const name of names) {
  const rules = LEVERS[name]!;
  const out: string[] = [`## ${name} ${JSON.stringify(rules)}`];
  for (const [map, players] of [["embervale", 4], ["wyrmland", 6]] as const) {
    // The default Steward against plain Captains.
    const st = await run(map, players, ["captain-steward-20", ...Array.from({ length: players - 1 }, () => "captain")], rules);
    const mine = st.map((g) => g.seats[g.kinds.indexOf("captain-steward-20")]!);
    const won = mine.filter((s) => s.won).length;
    const avg = (f: (s: (typeof mine)[number]) => number) => (mine.reduce((a, s) => a + f(s), 0) / mine.length).toFixed(1);
    out.push(`${map}:${players} captain-steward-20 vs captains: ${pct(won, st.length)} (fair ${(100 / players).toFixed(1)}%, x${((won / st.length) * players).toFixed(2)}); markets by 10 ${avg((s) => s.markets10)}, culture by 10 ${avg((s) => s.culture10)}, forts by 10 ${avg((s) => s.forts10)}`);
    // A table of Marshals.
    const m = await run(map, players, ["marshal"], rules, map === "embervale" ? games * 2 : games);
    const seats = m.flatMap((g) => g.seats.map((s, i) => ({ s, k: g.kinds[i]! })));
    const kinds = [...new Set(seats.map((x) => x.k))].sort();
    out.push(`${map}:${players} Marshals: ${kinds.map((k) => `${k.slice(8)} ${pct(seats.filter((x) => x.k === k && x.s.won).length, seats.filter((x) => x.k === k).length)}`).join(", ")}`);
    const turns = m.map((g) => g.turns);
    const at10 = m.filter((g) => g.topShareTurn10 !== null);
    const won2 = m.filter((g) => g.winner !== "draw");
    const half = won2.filter((g) => g.leaderHalfway);
    const past10 = won2.filter((g) => g.leaderTurn10);
    out.push(
      `${map}:${players} Marshals: ${(turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(1)} turns, ${pct(turns.filter((t) => t <= 40).length, turns.length)} within 40; half-map at 10 ${pct(at10.filter((g) => g.topShareTurn10! > 0.5).length, at10.length)}, halfway leader won ${pct(half.filter((g) => g.leaderHalfway === g.winner).length, half.length)}, comebacks ${pct(past10.filter((g) => g.leaderTurn10 !== g.winner).length, past10.length)}`,
    );
    // What wins: win rate by markets and culture by turn 10 (seats still in at turn 10).
    const in10 = seats.filter((x) => x.s.land10 !== null && (x.s.out === null || x.s.out > 10));
    const bucket = (f: (s: (typeof in10)[number]["s"]) => number, edges: number[]) =>
      edges.map((lo, i) => {
        const hi = edges[i + 1] ?? Infinity;
        const xs = in10.filter((x) => f(x.s) >= lo && f(x.s) < hi);
        return `${lo}${hi === Infinity ? "+" : hi - lo > 1 ? `-${hi - 1}` : ""}: ${pct(xs.filter((x) => x.s.won).length, xs.length)} (n ${xs.length})`;
      }).join(" · ");
    out.push(`${map}:${players} what wins, markets by 10: ${bucket((s) => s.markets10, [0, 1, 2, 4])}`);
    out.push(`${map}:${players} what wins, culture by 10: ${bucket((s) => s.culture10, [0, 1, 3, 6])}`);
  }
  console.log(out.join("\n"));
}

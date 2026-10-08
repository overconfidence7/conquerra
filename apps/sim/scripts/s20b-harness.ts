/**
 * Session 20b, Step 0: why two harnesses gave all-in delegating (delegate-100) on Embervale 4 two numbers (34.6% and
 * 42.6%). One seat against the rest, with its win rate by capital spot and how often it drew each spot.
 *   npx tsx apps/sim/scripts/s20b-harness.ts <map:players> <games> <seat> <others> <seed> [<seed> ...]
 */
import { runTournament } from "../src/tournament";

const [table = "embervale:4", games = "500", seat = "delegate-100", others = "marshal", ...seeds] = process.argv.slice(2);
const [map, n] = table.split(":") as [string, string];
const players = Number(n);
const pct = (k: number, of: number) => `${((100 * k) / Math.max(1, of)).toFixed(1)}%`;
for (const seed of seeds.length ? seeds : ["s20P", "s19"]) {
  const r = await runTournament({ map, players, seats: [seat, ...Array(players - 1).fill(others)], games: Number(games), seed, fog: true, diplomacy: true });
  const mine = r.map((g) => g.seats[g.kinds.indexOf(seat)]!);
  const spots = new Map<string, { n: number; won: number }>();
  for (const s of mine) {
    const x = spots.get(s.capital) ?? { n: 0, won: 0 };
    x.n++;
    if (s.won) x.won++;
    spots.set(s.capital, x);
  }
  // Every seat's win rate by spot (the spot's own strength, whoever sits there).
  const all = new Map<string, { n: number; won: number }>();
  for (const g of r)
    for (const s of g.seats) {
      const x = all.get(s.capital) ?? { n: 0, won: 0 };
      x.n++;
      if (s.won) x.won++;
      all.set(s.capital, x);
    }
  const won = mine.filter((s) => s.won).length;
  console.log(
    `${table} ${seed}: ${seat} won ${pct(won, mine.length)} (x${((won / mine.length) * players).toFixed(2)}) | its spots: ${[...spots]
      .sort()
      .map(([c, x]) => `${c} ${x.n} games, won ${pct(x.won, x.n)}`)
      .join("; ")} | every seat by spot: ${[...all].sort().map(([c, x]) => `${c} ${pct(x.won, x.n)}`).join(", ")}`,
  );
}

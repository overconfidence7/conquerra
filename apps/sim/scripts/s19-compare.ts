/** Session 19: two seat kinds' behaviours side by side (each against the same table). */
import { runTournament } from "../src/tournament";
const [table = "embervale:4", games = "1000", others = "marshal", ...seats] = process.argv.slice(2);
const [map, n] = table.split(":") as [string, string];
const players = Number(n);
for (const seat of seats) {
  const r = await runTournament({ map, players, seats: [seat, ...Array.from({ length: players - 1 }, () => others)], games: Number(games), seed: "s19", fog: true, diplomacy: true });
  const isSeat = (k: string) => k === seat || (seat.startsWith("marshal+") && k.startsWith("marshal-") && k.includes("+") && k.slice(k.indexOf("+")) === seat.slice(7));
  const mine = r.map((g) => g.seats[g.kinds.findIndex(isSeat)]!);
  const avg = (f: (s: (typeof mine)[number]) => number) => (mine.reduce((a, s) => a + f(s), 0) / mine.length).toFixed(2);
  console.log(`${seat}: won ${avg((s) => (s.won ? 100 : 0))}%, out ${avg((s) => (s.out !== null ? 100 : 0))}% (out by 10: ${avg((s) => (s.out !== null && s.out <= 10 ? 100 : 0))}%), land5 ${avg((s) => s.land5 ?? 0)}, land8 ${avg((s) => s.land8 ?? 0)}, land10 ${avg((s) => s.land10 ?? 0)}, took8 ${avg((s) => s.took8)}, lost8 ${avg((s) => s.lost8)}, attacks ${avg((s) => s.attacks)}, conc10 ${avg((s) => s.concentration10)}, gold10 troops ${avg((s) => s.gold10.troops)} specs ${avg((s) => s.gold10.specialists)} bld ${avg((s) => s.gold10.buildings)}, deals ${avg((s) => s.deals)} broken ${avg((s) => s.broken)}`);
}

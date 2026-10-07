/**
 * Session 19: seat fairness by capital spot. Marshal tables on a map at a table size; each capital spot's win rate
 * (seats are dealt to spots at random every game, so a spot that wins much more or less is the map's doing).
 *   npx tsx apps/sim/scripts/s19-spots.ts <map:players> [games=500]
 */
import { maps } from "@conquerra/content/maps";
import { runTournament } from "../src/tournament";
const [table = "krakenmere:8", games = "500", seats = "marshal", fog = "on"] = process.argv.slice(2);
const [map, n] = table.split(":") as [string, string];
const r = await runTournament({ map, players: Number(n), seats: seats.split(","), games: Number(games), seed: "s19S", fog: fog !== "off", diplomacy: true });
const by = new Map<string, { n: number; won: number }>();
for (const g of r) for (const s of g.seats) {
  const x = by.get(s.capital) ?? { n: 0, won: 0 };
  x.n++;
  if (s.won) x.won++;
  by.set(s.capital, x);
}
const name = (t: string) => maps[map]!.territories.find((x) => x.id === t)?.name ?? t;
const rows = [...by].filter(([, x]) => x.n >= 20).sort((a, b) => b[1].won / b[1].n - a[1].won / a[1].n);
console.log(`${table} ${seats}${fog === "off" ? " fog off" : ""}: ${by.size} capital spots used; fair ${(100 / Number(n)).toFixed(1)}%; spots with 20+ games:`);
console.log(rows.map(([t, x]) => `${name(t)} ${((100 * x.won) / x.n).toFixed(1)}% (${x.n})`).join(" · "));

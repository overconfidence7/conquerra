/**
 * Session 20b: fair seats on every official map. Starts from the map's own layout for that table size, measures each
 * capital spot's win rate (tables of Marshals, the same games for every layout), then moves the weakest and strongest
 * spots (apps/sim/src/fairSeats.ts) while the spread between spots shrinks, within a budget of layouts. Then checks
 * the start and the best on fresh games, and prints the recipe line.
 *   npx tsx apps/sim/scripts/s20b-fair-seats.ts <map:players> [games=300] [budget=12] [checkGames=300]
 * Output lines start with "start", "best", "check", "recipe" and "exposure" (for the write-up and the exposure check).
 */
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { adjacency, allDistances, exposureOf, fairness, territoryIncome } from "@conquerra/mapgen";
import { rankCorrelation, searchFairSeats } from "../src/fairSeats";
import { runTournament } from "../src/tournament";

const [table = "wyrmland:6", gamesArg = "300", budgetArg = "12", checkArg = "300"] = process.argv.slice(2);
const [id, n] = table.split(":") as [string, string];
const players = Number(n);
const map = maps[id]!;
const name = (t: string) => map.territories.find((x) => x.id === t)!.name;
const dists = allDistances(map);
const adj = adjacency(map);
const income = territoryIncome(map, defaultRules);

async function rates(layout: readonly string[], games: number, seed: string): Promise<number[]> {
  const r = await runTournament({ map: id, players, seats: ["marshal"], games, seed, fog: true, diplomacy: true, layout: [...layout] });
  const won = new Map(layout.map((t) => [t, 0]));
  for (const g of r) for (const s of g.seats) if (s.won) won.set(s.capital, (won.get(s.capital) ?? 0) + 1);
  return layout.map((t) => won.get(t)! / r.length);
}
const pct = (x: number) => `${(100 * x).toFixed(0)}%`;
const show = (layout: readonly string[], rs: readonly number[]) => {
  const lo = Math.min(...rs), hi = Math.max(...rs);
  return `${layout.map((t, i) => `${name(t)} ${pct(rs[i]!)}`).join(", ")} | best ${pct(hi)}, worst ${pct(lo)}, spread ${(100 * (hi - lo)).toFixed(0)} pts, fair ${(100 / players).toFixed(1)}%`;
};

const t0 = Date.now();
const start = map.capitalLayouts!.find((l) => l.players === players)!.slots;
const res = await searchFairSeats({
  start,
  slots: map.capitalSlots,
  measure: (l) => rates(l, Number(gamesArg), "s20bF"),
  paperFair: (l) => fairness(l, dists, income).fair,
  dist: (a, b) => dists.get(a)!.get(b) ?? 99,
  exposure: (l, s) => exposureOf(l, dists, adj).exposure[l.indexOf(s)]!,
  budget: Number(budgetArg),
  log: (line) => console.log(line),
});
console.log(`start ${table}: ${show(res.start.layout, res.start.rates)}`);
console.log(`best ${table}: ${show(res.best.layout, res.best.rates)} (${res.tried.length} layouts measured, ${((Date.now() - t0) / 60000).toFixed(1)} min)`);
// Fresh games for both (the search's own numbers favour whatever it picked).
const checkStart = await rates(res.start.layout, Number(checkArg), "s20bC");
const checkBest = res.best === res.start ? checkStart : await rates(res.best.layout, Number(checkArg), "s20bC");
console.log(`check ${table} before: ${show(res.start.layout, checkStart)}`);
console.log(`check ${table} after: ${show(res.best.layout, checkBest)}`);
console.log(`recipe ${table}: capitals: {${players}: ${JSON.stringify(res.best.layout)}}`);
// The exposure check against the measured spots (every layout the search measured).
const corr = res.tried.map((m) => rankCorrelation(exposureOf(m.layout, dists, adj).exposure.map((e) => -e), m.rates));
const weakest = res.tried.map((m) => {
  const e = exposureOf(m.layout, dists, adj).exposure;
  const w = m.rates.indexOf(Math.min(...m.rates));
  // Is the weakest spot among the more exposed half?
  return e.filter((x) => x > e[w]!).length < players / 2;
});
const ex = exposureOf(res.best.layout, dists, adj);
console.log(
  `exposure ${table}: rank correlation with spot win rates ${(corr.reduce((a, b) => a + b, 0) / corr.length).toFixed(2)} (avg over ${corr.length} layouts), weakest spot among the more exposed half in ${weakest.filter(Boolean).length} of ${weakest.length}; best layout exposure ${ex.exposure.map((x) => x.toFixed(2)).join("/")} (${ex.fair ? "within" : "outside"} the band)`,
);

/**
 * Session 19: fair seats by simulation. Equal bots on a map's capital layout show which capital spots win far more
 * or less often than their share. This starts from the map's layout and, a few rounds, tries moving the strongest
 * and the weakest spot to each other capital spot of the map (only layouts that also pass the map maker's own
 * fairness check: distances and gold nearby), keeping the layout whose spots win most evenly. Prints the best layout
 * for the recipe's `capitals`.
 *   npx tsx apps/sim/scripts/s19-fair-seats.ts <map:players> [games=200] [rounds=3] [seats=marshal]
 */
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { allDistances, fairness, territoryIncome } from "@conquerra/mapgen";
import { runTournament } from "../src/tournament";

const [table = "embervale:4", gamesArg = "200", roundsArg = "3", seats = "marshal"] = process.argv.slice(2);
const [id, n] = table.split(":") as [string, string];
const players = Number(n);
const map = maps[id]!;
const name = (t: string) => map.territories.find((x) => x.id === t)!.name;
const dists = allDistances(map);
const income = territoryIncome(map, defaultRules);
const paperFair = (slots: string[]) => fairness(slots, dists, income).fair;

async function evaluate(layout: string[], games: number) {
  const r = await runTournament({ map: id, players, seats: seats.split(","), games, seed: "s19F", fog: true, diplomacy: true, layout });
  const won = new Map(layout.map((t) => [t, 0]));
  for (const g of r) for (const s of g.seats) if (s.won) won.set(s.capital, (won.get(s.capital) ?? 0) + 1);
  const rates = layout.map((t) => won.get(t)! / r.length);
  const fair = 1 / players;
  return { layout, rates, spread: Math.max(...rates) - Math.min(...rates), error: rates.reduce((a, x) => a + (x - fair) ** 2, 0) };
}
const show = (e: Awaited<ReturnType<typeof evaluate>>) => e.layout.map((t, i) => `${name(t)} ${(100 * e.rates[i]!).toFixed(0)}%`).join(", ") + ` | spread ${(100 * e.spread).toFixed(0)} pts`;

const games = Number(gamesArg);
let best = await evaluate(map.capitalLayouts!.find((l) => l.players === players)!.slots, games);
console.log(`start: ${show(best)}`);
for (let round = 0; round < Number(roundsArg); round++) {
  const order = best.layout.map((t, i) => ({ t, r: best.rates[i]! })).sort((a, b) => a.r - b.r);
  const movers = [order[0]!.t, order[order.length - 1]!.t];
  let improved = false;
  for (const m of movers) {
    for (const s of map.capitalSlots) {
      if (best.layout.includes(s)) continue;
      const cand = best.layout.map((t) => (t === m ? s : t));
      if (!paperFair(cand)) continue;
      const e = await evaluate(cand, games);
      if (e.error < best.error) {
        best = e;
        improved = true;
        console.log(`  better: ${show(best)}`);
      }
    }
    if (improved) break;
  }
  if (!improved) break;
}
// Check the winner on fresh games.
const check = await evaluate(best.layout, games * 2);
console.log(`best: ${show(check)}\nrecipe: capitals: {${players}: ${JSON.stringify(best.layout)}}`);

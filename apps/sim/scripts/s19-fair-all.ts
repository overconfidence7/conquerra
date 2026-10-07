/**
 * Session 19: every capital layout of a map at a table size that passes the map maker's fairness check (from the
 * map's own capital spots), each played by equal bots; the layouts whose spots win most evenly, checked again on more
 * games. For small maps (the number of layouts grows fast).
 *   npx tsx apps/sim/scripts/s19-fair-all.ts <map:players> [games=100] [top=5] [checkGames=600]
 */
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { allDistances, fairness, territoryIncome } from "@conquerra/mapgen";
import { runTournament } from "../src/tournament";

const [table = "embervale:4", gamesArg = "100", topArg = "5", checkArg = "600"] = process.argv.slice(2);
const [id, n] = table.split(":") as [string, string];
const players = Number(n);
const map = maps[id]!;
const name = (t: string) => map.territories.find((x) => x.id === t)!.name;
const dists = allDistances(map);
const income = territoryIncome(map, defaultRules);
const slots = map.capitalSlots;
const combos: string[][] = [];
const pick = (start: number, cur: string[]) => {
  if (cur.length === players) return void (fairness(cur, dists, income).fair && combos.push([...cur]));
  for (let i = start; i < slots.length; i++) pick(i + 1, [...cur, slots[i]!]);
};
pick(0, []);
console.log(`${combos.length} layouts pass the paper check`);
async function evaluate(layout: string[], games: number, seed: string) {
  const r = await runTournament({ map: id, players, seats: ["marshal"], games, seed, fog: true, diplomacy: true, layout });
  const won = new Map(layout.map((t) => [t, 0]));
  for (const g of r) for (const s of g.seats) if (s.won) won.set(s.capital, (won.get(s.capital) ?? 0) + 1);
  const rates = layout.map((t) => won.get(t)! / r.length);
  return { layout, rates, spread: Math.max(...rates) - Math.min(...rates), turns: r.reduce((a, g) => a + g.turns, 0) / r.length };
}
const show = (e: Awaited<ReturnType<typeof evaluate>>) => `${e.layout.map((t, i) => `${name(t)} ${(100 * e.rates[i]!).toFixed(0)}%`).join(", ")} | spread ${(100 * e.spread).toFixed(0)} pts, ${e.turns.toFixed(1)} turns`;
const all = [];
for (const c of combos) all.push(await evaluate(c, Number(gamesArg), "s19A"));
all.sort((a, b) => a.spread - b.spread);
const current = map.capitalLayouts!.find((l) => l.players === players)!.slots;
console.log(`today's layout: ${show(await evaluate(current, Number(checkArg), "s19C"))}`);
for (const e of all.slice(0, Number(topArg))) console.log(`checked: ${show(await evaluate(e.layout, Number(checkArg), "s19C"))} -> ${JSON.stringify(e.layout)}`);

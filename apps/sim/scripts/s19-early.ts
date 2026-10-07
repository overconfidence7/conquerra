/** Session 19: how often a seat is knocked out early (by turn 3 and by turn 6), per seat kind, on a table. */
import { runTournament } from "../src/tournament";
const [table = "embervale:4", games = "2000", ...seats] = process.argv.slice(2);
const [map, n] = table.split(":") as [string, string];
const r = await runTournament({ map, players: Number(n), seats: seats.length ? seats : ["marshal"], games: Number(games), seed: "s19", fog: true, diplomacy: true });
const all = r.flatMap((g) => g.seats);
const pct = (k: number) => `${((100 * k) / all.length).toFixed(1)}%`;
console.log(`${table} ${seats.join(",") || "marshal"}: out by turn 1 ${pct(all.filter((s) => s.out !== null && s.out <= 1).length)}, by 3 ${pct(all.filter((s) => s.out !== null && s.out <= 3).length)}, by 6 ${pct(all.filter((s) => s.out !== null && s.out <= 6).length)}; ${(r.reduce((a, g) => a + g.turns, 0) / r.length).toFixed(1)} turns`);

/**
 * Session 18: one seat against a table of others (rotated seats), its win rate and what it spent its gold on.
 *   npx tsx apps/sim/scripts/s18-variant.ts [seat=captain-steward-20] [others=captain] [map=embervale] [players=4] [games=300]
 */
import { runTournament } from "../src/tournament";
const [seat = "captain-steward-20", others = "captain", map = "embervale", n = "4", games = "300"] = process.argv.slice(2);
const players = Number(n);
const r = await runTournament({ map, players, seats: [seat, ...Array.from({ length: players - 1 }, () => others)], games: Number(games), seed: "s18", fog: true, diplomacy: true });
const mine = r.map((g) => g.seats[g.kinds.indexOf(seat)]!);
const won = mine.filter((s) => s.won).length;
const avg = (f: (s: (typeof mine)[number]) => number) => (mine.reduce((a, s) => a + f(s), 0) / mine.length).toFixed(1);
console.log(`${map}:${players} ${seat} vs ${others}: won ${((100 * won) / r.length).toFixed(1)}%; buildings ${avg((s) => s.gold.buildings)}g culture ${avg((s) => s.gold.culture)}g troops ${avg((s) => s.gold.troops)}g; markets by 10 ${avg((s) => s.markets10)}`);

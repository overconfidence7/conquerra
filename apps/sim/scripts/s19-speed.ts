/**
 * Session 19's speed check before M4: resolving a turn and every bot planning (diplomacy and the Fallen included), at
 * 10 players on a ~200-territory map with every system on, average, 95th percentile and worst (ms). Few workers, so
 * the timings aren't crowded.
 *   npx tsx apps/sim/scripts/s19-speed.ts [map=krakenmere] [players=10] [games=20] [workers=4]
 */
import { runTournament } from "../src/tournament";
const [map = "krakenmere", players = "10", games = "20", workers = "4"] = process.argv.slice(2);
const r = await runTournament({ map, players: Number(players), seats: ["marshal"], games: Number(games), seed: "s19speed", fog: true, diplomacy: true }, Number(workers));
const stat = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return `avg ${(s.reduce((a, b) => a + b, 0) / s.length).toFixed(1)} ms, 95% ${s[Math.floor(s.length * 0.95)]!.toFixed(1)} ms, worst ${s[s.length - 1]!.toFixed(1)} ms`;
};
console.log(`${map}, ${players} players, ${r.length} games, ${r.reduce((a, g) => a + g.turns, 0)} turns, every system on:`);
console.log(`  resolving a turn: ${stat(r.flatMap((g) => g.resolveMs))}`);
console.log(`  all bots planning a turn (talks, orders, the Fallen): ${stat(r.flatMap((g) => g.turnPlanMs))}`);
console.log(`  one Marshal planning: ${stat(r.flatMap((g) => Object.values(g.planMs).flat()))}`);

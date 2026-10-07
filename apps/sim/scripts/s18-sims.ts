/**
 * Session 18, Part 2's sims (`docs/sim-results-m3-leaders.md`): one seat of each kind against a table of others, on
 * Embervale (4 players) and Wyrmland (6), with each seat's win rate against fair and what it built.
 *   npx tsx apps/sim/scripts/s18-sims.ts [games=300]
 */
import { runTournament, type TournamentSpec } from "../src/tournament";

const games = Number(process.argv[2] ?? 300);
const runs: [string, string][] = [
  ["delegate-80", "marshal"],
  ["delegate-65", "marshal"],
  ["delegate-50", "marshal"],
  ["captain-steward-20", "captain"],
  ["captain-steward-20", "marshal"],
  ["captain", "captain"],
];
const tables: [string, number][] = [
  ["embervale", 4],
  ["wyrmland", 6],
];
for (const [map, players] of tables)
  for (const [seat, others] of runs) {
    const spec: TournamentSpec = { map, players, seats: [seat, ...Array.from({ length: players - 1 }, () => others)], games, seed: "s18", fog: true, diplomacy: true };
    const r = await runTournament(spec);
    // The seat under test (seats rotate from game to game).
    const mine = r.map((g) => g.seats[g.kinds.indexOf(seat)]!);
    const won = mine.filter((s) => s.won).length;
    const avg = (f: (s: (typeof mine)[number]) => number) => (mine.reduce((a, s) => a + f(s), 0) / mine.length).toFixed(1);
    const turns = (r.reduce((a, g) => a + g.turns, 0) / r.length).toFixed(1);
    console.log(
      `${map}:${players} ${seat} vs ${others}: won ${((100 * won) / r.length).toFixed(1)}% (fair ${(100 / players).toFixed(1)}%, x${((won / r.length) * players).toFixed(2)}), ${turns} turns; ` +
        `by turn 10: forts ${avg((s) => s.forts10)}, markets ${avg((s) => s.markets10)}, culture ${avg((s) => s.culture10)}; gold on buildings ${avg((s) => s.gold.buildings)}, culture ${avg((s) => s.gold.culture)}, troops ${avg((s) => s.gold.troops)}; first market turn ${avg((s) => s.firstMarket ?? 0)}, land at 10 ${avg((s) => s.land10 ?? 0)}`,
    );
  }

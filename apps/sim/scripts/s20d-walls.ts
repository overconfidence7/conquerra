/**
 * Session 20d, Part 3: the Steward's walls, measured on a delegating seat (Leader on Run the military, Steward on Run
 * the realm) against Marshals. Seats rotate each game.
 *   npx tsx apps/sim/scripts/s20d-walls.ts <games> <tables: wyrmland:6,rootholm:8> [seat kind, default delegate-80] [--seed s]
 * For the seat: win rate (and x fair), the turn of its first wall (median, of the games it walled), walls it built a
 * game (territories), the share of its walled territory-turns holding more than 1 troop (a garrison the wall can lend),
 * and attacks on its walls a game; for every seat at the table, attacks on walls a game.
 */
import { runTournament, type TournamentSpec } from "../src/tournament";

const argv = process.argv.slice(2);
const si = argv.indexOf("--seed");
const seed = si >= 0 ? argv.splice(si, 2)[1]! : "s20d";
const [games = "300", tablesArg = "wyrmland:6,rootholm:8", seat = "delegate-80"] = argv;
const pct = (k: number, of: number) => `${((100 * k) / Math.max(1, of)).toFixed(1)}%`;
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : NaN);

for (const t of tablesArg.split(",")) {
  const [map, n] = t.split(":") as [string, string];
  const players = Number(n);
  const spec: TournamentSpec = { map, players, seats: [seat, ...Array(players - 1).fill("marshal")], games: Number(games), seed, fog: true, diplomacy: true };
  const t0 = Date.now();
  const r = await runTournament(spec);
  const mine = r.map((g) => g.seats[g.kinds.indexOf(seat)]!);
  const won = mine.filter((s) => s.won).length;
  const walled = mine.filter((s) => s.firstWall !== null);
  const wt = mine.reduce((a, s) => a + (s.walledTurns ?? 0), 0);
  const wg = mine.reduce((a, s) => a + (s.walledGarrisoned ?? 0), 0);
  const allBattles = r.reduce((a, g) => a + g.seats.reduce((b, s) => b + s.wallBattles, 0), 0);
  console.log(
    `${t} ${seat}: won ${pct(won, mine.length)} (${((won / mine.length) * players).toFixed(2)}x fair) | walled in ${pct(walled.length, mine.length)} of games, first wall turn ${median(walled.map((s) => s.firstWall!))} (median), ${(mine.reduce((a, s) => a + s.wallsBuilt, 0) / mine.length).toFixed(1)} walled territories a game | garrisoned (more than 1 troop) ${pct(wg, wt)} of walled territory-turns | attacks on its walls ${(mine.reduce((a, s) => a + s.wallBattles, 0) / mine.length).toFixed(2)} a game (held ${pct(mine.reduce((a, s) => a + s.wallHolds, 0), mine.reduce((a, s) => a + s.wallBattles, 0))}); on anyone's walls ${(allBattles / r.length).toFixed(2)} a game | ${r.length} games, ${((Date.now() - t0) / 1000).toFixed(0)} s`,
  );
}

/**
 * Session 23: the tables before and after the Marshal learns (the baseline in Step 0, Part 1's re-run, Part 2's check).
 *
 *   npx tsx apps/sim/scripts/s23-tables.ts delegate <games> <map:players,...> <seed>
 *     the delegating seat (Leader 80%, Steward 20%) against Marshals: its win rate as times fair.
 *   npx tsx apps/sim/scripts/s23-tables.ts marshals <games> <map:players,...> <seed>
 *     all-Marshal tables: game length, the turn cap, the halfway leader's win rate, and each personality's win rate
 *     and style (gold on buildings and culture, walls, how fast it attacks).
 *   npx tsx apps/sim/scripts/s23-tables.ts recruit <games> <map:players,...> <seed>
 *     one Recruit against Captains (it should stay easy).
 *
 * Fog and diplomacy on; seats rotated each game. Uses every core but one.
 */
import { runTournament } from "../src/tournament";

const [mode = "marshals", gamesArg = "300", tablesArg = "embervale:4", seed = "s23"] = process.argv.slice(2);
const games = Number(gamesArg);
const pct = (k: number, of: number) => `${((100 * k) / Math.max(1, of)).toFixed(1)}%`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const CAP = 60;

for (const t of tablesArg.split(",")) {
  const [map, n] = t.split(":") as [string, string];
  const players = Number(n);
  const t0 = Date.now();
  if (mode === "delegate" || mode === "recruit") {
    const seat = mode === "delegate" ? "delegate-80" : "recruit";
    const others = mode === "delegate" ? "marshal" : "captain";
    const r = await runTournament({ map, players, seats: [seat, ...Array(players - 1).fill(others)], games, seed, fog: true, diplomacy: true });
    const mine = r.map((g) => g.seats[g.kinds.indexOf(seat)]!);
    const won = mine.filter((s) => s.won).length;
    const turns = r.map((g) => g.turns);
    console.log(
      `${mode} ${t.padEnd(16)} ${seed}: ${seat} won ${pct(won, r.length)} = ${((won / r.length) * players).toFixed(2)}x fair (fair ${(100 / players).toFixed(1)}%) | buildings ${avg(mine.map((s) => s.gold.buildings)).toFixed(0)}g culture ${avg(mine.map((s) => s.gold.culture)).toFixed(0)}g walls ${avg(mine.map((s) => s.wallsBuilt)).toFixed(2)} | length avg ${avg(turns).toFixed(1)} | ${((Date.now() - t0) / 1000).toFixed(0)}s`,
    );
    continue;
  }
  const r = await runTournament({ map, players, seats: ["marshal"], games, seed, fog: true, diplomacy: true });
  const turns = r.map((g) => g.turns).sort((a, b) => a - b);
  const won = r.filter((g) => g.winner !== "draw");
  const half = won.filter((g) => g.leaderHalfway);
  console.log(
    `marshals ${t.padEnd(16)} ${seed}: ${r.length} games | length median ${turns[Math.floor(turns.length / 2)]}, avg ${avg(turns).toFixed(1)}, at the ${CAP} cap ${pct(turns.filter((x) => x >= CAP).length, turns.length)}, draws ${pct(r.length - won.length, r.length)} | halfway leader won ${pct(half.filter((g) => g.leaderHalfway === g.winner).length, half.length)} | ${((Date.now() - t0) / 1000).toFixed(0)}s`,
  );
  // Each personality: win rate (times fair) and style.
  const by = new Map<string, { seats: number; won: number; build: number[]; culture: number[]; walls: number[]; walled: number; firstAttack: number[]; attacks: number[]; land10: number[] }>();
  for (const g of r)
    g.seats.forEach((s, i) => {
      const k = g.kinds[i]!.replace(/^marshal-/, "");
      const x = by.get(k) ?? { seats: 0, won: 0, build: [], culture: [], walls: [], walled: 0, firstAttack: [], attacks: [], land10: [] };
      x.seats++;
      if (s.won) x.won++;
      x.build.push(s.gold.buildings);
      x.culture.push(s.gold.culture);
      x.walls.push(s.wallsBuilt);
      if (s.wallsBuilt > 0) x.walled++;
      x.attacks.push(s.attacks / Math.max(1, s.out ?? g.turns));
      if (s.land10 !== null) x.land10.push(s.land10);
      by.set(k, x);
    });
  for (const [k, x] of [...by].sort())
    console.log(
      `  ${k.padEnd(12)} won ${pct(x.won, x.seats).padStart(6)} = ${((x.won / x.seats) * players).toFixed(2)}x (${x.seats} seats) | buildings ${avg(x.build).toFixed(0)}g culture ${avg(x.culture).toFixed(0)}g | walled in ${pct(x.walled, x.seats)} of games (${avg(x.walls).toFixed(2)} walls) | attacks/turn ${avg(x.attacks).toFixed(2)} | land at turn 10 ${avg(x.land10).toFixed(1)}`,
    );
}

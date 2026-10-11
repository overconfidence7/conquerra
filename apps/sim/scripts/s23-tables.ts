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
 * A last argument, a JSON change to the Marshals' shared judgement ('{"lesson":true}'), plays the Marshal seats with it.
 * Fog and diplomacy on; seats rotated each game. Uses every core but one. (The tables themselves: `src/tables.ts`.)
 */
import { marshalTable, seatTable } from "../src/tables";

const [mode = "marshals", gamesArg = "300", tablesArg = "embervale:4", seed = "s23", tweakArg = ""] = process.argv.slice(2);
const tweak = tweakArg ? { tweak: { judgement: JSON.parse(tweakArg) as Record<string, unknown> } } : {};
const games = Number(gamesArg);

for (const t of tablesArg.split(",")) {
  const [map, n] = t.split(":") as [string, string];
  const o = { map, players: Number(n), games, seed, ...tweak };
  const { lines } = mode === "delegate" || mode === "recruit" ? await seatTable(mode, o) : await marshalTable(o);
  for (const l of lines) console.log(l);
}

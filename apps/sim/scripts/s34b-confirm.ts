/**
 * Session 34b: a second proof on fresh games for the tables the pin would change. For each table, today's layout as it
 * ships (its own head start) against the layout and bonus from s34b-layouts' "pin"/"keep" and "bonus" lines.
 *   npx tsx apps/sim/scripts/s34b-confirm.ts rootholm:10,krakenmere:10 [--games 600] [--seed s34bQ] [--workers 19]
 * Session 35: `--tag s35 --from 3` reads docs/sims/s35-layouts-<map><n>.txt and takes "today" from layout version 3
 * (Krakenmere 14, which version 1 doesn't seat); left out, 34b's run exactly.
 */
import { readFileSync } from "node:fs";
import { maps } from "@conquerra/content/maps";
import { layoutFor } from "@conquerra/engine";
import { GamePool, type LiteResult } from "../src/pool";

const args = process.argv.slice(2);
const opt = (name: string, dflt: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : dflt;
};
const GAMES = Number(opt("games", "600"));
const SEED = opt("seed", "s34bQ");
const pool = new GamePool(Number(opt("workers", "19")));
const TAG = opt("tag", "s34b");
const FROM = Number(opt("from", "1"));
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

async function one(table: string) {
  const [id, n] = table.split(":") as [string, string];
  const players = Number(n);
  const text = readFileSync(`docs/sims/${TAG}-layouts-${id}${players}.txt`, "utf8");
  const slots = JSON.parse(/^(?:pin|keep) \S+: (\[.*?\])/m.exec(text)![1]!) as string[];
  const bonus = JSON.parse(/^bonus \S+: (\{.*\})$/m.exec(text)![1]!) as Record<string, number>;
  const today = FROM > 1 ? layoutFor(maps[id]!, players, FROM)!.slots : maps[id]!.capitalLayouts!.find((l) => l.players === players)!.slots;
  const base = { map: id, players, seats: ["marshal"], games: GAMES, seed: SEED, fog: true as const, diplomacy: true };
  const rates = (layout: readonly string[], rs: readonly LiteResult[]) => layout.map((t) => rs.filter((g) => g.seats.some((s) => s.capital === t && s.won)).length / rs.length);
  const [a, b] = await Promise.all([pool.run(base), pool.run({ ...base, layout: slots, bonus })]);
  const ra = rates(today, a), rb = rates(slots, b);
  const line = (r: number[]) => `best ${pct(Math.max(...r))}, worst ${pct(Math.min(...r))}, spread ${(100 * (Math.max(...r) - Math.min(...r))).toFixed(1)} pts | ${r.map(pct).join(" / ")}`;
  console.log(`confirm ${table} (${GAMES} games, ${SEED}) today: ${line(ra)}`);
  console.log(`confirm ${table} (${GAMES} games, ${SEED}) new: ${line(rb)}`);
}

await Promise.all(args[0]!.split(",").map(one));
pool.close();

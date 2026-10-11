/**
 * Session 23, Part 3: the start bonus, sized by the sims (Nate, Oct 9 and 10).
 *   npx tsx apps/sim/scripts/s23-bonus.ts <map:players> [games=300] [seed=s23p3]
 *
 * Tables of Marshals (fog and diplomacy on), the same games for every option (one seed). First each capital spot's
 * win rate on the map's layout; a spot under half its fair share is weak. Then the weak spots get +2, +4 and +6 troops
 * at their capital (all of them at once), and each keeps the smallest bonus that brings it to at least half of fair
 * without taking it above fair (if +6 doesn't get it there: +6, and it's listed). Then the chosen bonuses together.
 * Output lines: "spots", "try", "choose", "check" and "recipe" (the bonus for the map's data).
 */
import { maps } from "@conquerra/content/maps";
import { runTournament } from "../src/tournament";

const [table = "embervale:4", gamesArg = "300", seed = "s23p3"] = process.argv.slice(2);
const [id, n] = table.split(":") as [string, string];
const players = Number(n);
const games = Number(gamesArg);
const map = maps[id]!;
const slots = map.capitalLayouts!.find((l) => l.players === players)!.slots;
const name = (t: string) => map.territories.find((x) => x.id === t)!.name;
const fair = 1 / players;
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

async function rates(bonus: Record<string, number> | undefined): Promise<Map<string, number>> {
  const r = await runTournament({ map: id, players, seats: ["marshal"], games, seed, fog: true, diplomacy: true, ...(bonus ? { bonus } : {}) });
  const won = new Map(slots.map((t) => [t, 0]));
  for (const g of r) for (const s of g.seats) if (s.won) won.set(s.capital, (won.get(s.capital) ?? 0) + 1);
  return new Map(slots.map((t) => [t, won.get(t)! / r.length]));
}
const show = (rs: Map<string, number>, b?: Record<string, number>) => slots.map((t) => `${name(t)}${b?.[t] ? ` (+${b[t]})` : ""} ${pct(rs.get(t)!)}`).join(", ");

const t0 = Date.now();
// Today's bonuses are what we size from: none (the map's data may carry some from an earlier run; they're replaced).
const before = await rates({});
console.log(`spots ${table} ${seed}: ${show(before)} | fair ${pct(fair)}, half ${pct(fair / 2)}`);
const weak = slots.filter((t) => before.get(t)! < fair / 2);
if (!weak.length) {
  console.log(`recipe ${table}: none (no spot under half of fair) | ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  process.exit(0);
}
const tries = new Map<number, Map<string, number>>();
for (const b of [2, 4, 6]) {
  const bonus = Object.fromEntries(weak.map((t) => [t, b]));
  const rs = await rates(bonus);
  tries.set(b, rs);
  console.log(`try ${table} +${b}: ${show(rs, bonus)}`);
}
const chosen: Record<string, number> = {};
const listed: string[] = [];
for (const t of weak) {
  const ok = [2, 4, 6].find((b) => tries.get(b)!.get(t)! >= fair / 2 && tries.get(b)!.get(t)! <= fair);
  const enough = [2, 4, 6].find((b) => tries.get(b)!.get(t)! >= fair / 2);
  const b = ok ?? enough ?? 6;
  if (!ok && enough) listed.push(`${name(t)} (+${b} goes above fair: ${pct(tries.get(b)!.get(t)!)})`);
  if (!enough) listed.push(`${name(t)} (+6 isn't enough: ${pct(tries.get(6)!.get(t)!)})`);
  chosen[t] = b;
  console.log(`choose ${table} ${name(t)} (${t}): before ${pct(before.get(t)!)}, +${b} -> ${pct(tries.get(b)!.get(t)!)}`);
}
const check = await rates(chosen);
console.log(`check ${table}: ${show(check, chosen)}`);
console.log(`recipe ${table}: ${JSON.stringify(chosen)}${listed.length ? ` | listed: ${listed.join("; ")}` : ""} | ${((Date.now() - t0) / 1000).toFixed(0)}s`);

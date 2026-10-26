/**
 * Session 34b: the official 200s' capital layouts chosen with the simulator (session 20b's search and session 23's
 * start bonus, for Krakenmere and Rootholm at 8 to 20 seats). Every table runs at once on one shared set of workers.
 *
 *   npx tsx apps/sim/scripts/s34b-layouts.ts rootholm:8,krakenmere:10,... [--games 300] [--budget 10] [--workers 19]
 *     [--band 4] [--out docs/sims] [--tag s34b] [--from 1]
 * Session 35: `--tag s35` names the files and the games' seeds (s35F, s35C, s35P), and `--from 3` starts the search from
 * a layout version's layout for the table (Krakenmere 14, which version 1 doesn't seat); left out, 34b's run exactly.
 *
 * For each table (its own file, docs/sims/s34b-layouts-<map><n>.txt):
 *  1. "status": the map's current layout (its own for 2 to 10, session 34's beside the map for 11 and up): the paper
 *     check, its exposure from most to least exposed.
 *  2. The search (`searchFairSeats`, seed s34bF): each spot's share of wins among all-Marshal tables (personalities
 *     dealt) with no head start at all, the same games for every layout; moves that keep the layout within the paper
 *     check (10 and under), the exposure band (no looser than the start's own) and no two capitals side by side.
 *  3. "check" on fresh games (seed s34bC): the current layout and the best, bare. "pin" when the best is at least 5
 *     points fairer (the gap between the best and the worst spot), else "keep".
 *  4. The start bonus on the layout that ships (session 23's way, on s34bC's games): every spot under half of fair gets
 *     +2, then +4, then +6; each keeps the smallest that brings it to half of fair without taking it above fair (+6 if
 *     none does). "bonus" is the result.
 *  5. "proof" on fresh games again (seed s34bP): the layout as it ships today (with today's head start) and the new one
 *     with its bonus, the bars beside each (the best spot under 2 x fair, the worst above half of fair), turns and CPU.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { layoutFor } from "@conquerra/engine";
import { adjacency, allDistances, exposureOf, fairnessOf, fairnessTable, territoryIncome } from "@conquerra/mapgen";
import { searchFairSeats } from "../src/fairSeats";
import { GamePool, type LiteResult } from "../src/pool";
import type { TournamentSpec } from "../src/tournament";

const args = process.argv.slice(2);
const opt = (name: string, dflt: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : dflt;
};
const tables = (args[0] ?? "rootholm:10").split(",");
const GAMES = Number(opt("games", "300"));
const BUDGET = Number(opt("budget", "10"));
const BAND = Number(opt("band", "4"));
const OUT = opt("out", "docs/sims");
const TAG = opt("tag", "s34b");
const FROM = Number(opt("from", "1"));
const pool = new GamePool(Number(opt("workers", "19")));
mkdirSync(OUT, { recursive: true });

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

async function one(table: string) {
  const [id, n] = table.split(":") as [string, string];
  const players = Number(n);
  const map = maps[id]!;
  const file = join(OUT, `${TAG}-layouts-${id}${players}.txt`);
  writeFileSync(file, "");
  const log = (line: string) => {
    appendFileSync(file, `${line}\n`);
    console.log(`[${table}] ${line}`);
  };
  const name = (t: string) => map.territories.find((x) => x.id === t)!.name;
  const dists = allDistances(map), adj = adjacency(map);
  const tbl = fairnessTable(dists, territoryIncome(map, defaultRules));
  const fair = 1 / players;
  const current = FROM > 1 ? layoutFor(map, players, FROM)! : map.capitalLayouts!.find((l) => l.players === players)!;
  const ratio = (l: readonly string[]) => {
    const e = exposureOf(l, dists, adj, BAND).exposure;
    return Math.max(...e) / Math.max(1e-9, Math.min(...e));
  };
  const gap = (l: readonly string[]) => Math.min(...l.flatMap((a, i) => l.slice(i + 1).map((b) => dists.get(a)!.get(b) ?? 99)));
  const paper = (l: readonly string[]) => fairnessOf(l.map((t) => tbl.ids.indexOf(t)), tbl).fair;
  const band = Math.max(BAND, ratio(current.slots));
  log(`status ${table}: ${current.slots.length} spots, paper check ${paper(current.slots) ? "passes" : "fails"}, exposure ${ratio(current.slots).toFixed(2)}x (band ${BAND}), nearest rival ${gap(current.slots)}; moves allowed within ${band.toFixed(2)}x${players <= 10 ? " and the paper check" : ""}`);

  const spec = (seed: string, layout?: readonly string[], bonus?: Record<string, number>): TournamentSpec => ({
    map: id,
    players,
    seats: ["marshal"],
    games: GAMES,
    seed,
    fog: true,
    diplomacy: true,
    ...(layout ? { layout: [...layout], bonus: bonus ?? {} } : {}),
  });
  const rates = (layout: readonly string[], rs: readonly LiteResult[]) => {
    const won = new Map(layout.map((t) => [t, 0]));
    for (const g of rs) for (const s of g.seats) if (s.won) won.set(s.capital, (won.get(s.capital) ?? 0) + 1);
    return layout.map((t) => won.get(t)! / rs.length);
  };
  const extra = (rs: readonly LiteResult[]) => {
    const turns = rs.reduce((a, g) => a + g.turns, 0) / rs.length;
    const avg = rs.reduce((a, g) => a + g.turnMsAvg, 0) / rs.length;
    const worst = Math.max(...rs.map((g) => g.turnMsMax));
    return `turns ${turns.toFixed(1)}, CPU a turn ${avg.toFixed(0)} ms avg / ${(worst / 1000).toFixed(2)} s worst`;
  };
  const show = (layout: readonly string[], rs: readonly number[], bonus: Record<string, number> = {}) => {
    const lo = Math.min(...rs), hi = Math.max(...rs);
    return `${layout.map((t, i) => `${name(t)} (${t}${bonus[t] ? ` +${bonus[t]}` : ""}) ${pct(rs[i]!)}`).join(", ")} | best ${pct(hi)}, worst ${pct(lo)}, spread ${(100 * (hi - lo)).toFixed(1)} pts, fair ${pct(fair)} | bars: best ${hi < 2 * fair ? "under" : "OVER"} 2x fair, worst ${lo > fair / 2 ? "above" : "UNDER"} half`;
  };

  // 2. The search, bare spots.
  const t0 = Date.now();
  const res = await searchFairSeats({
    start: current.slots,
    slots: map.capitalSlots,
    measure: async (l) => rates(l, await pool.run(spec(`${TAG}F`, l))),
    paperFair: (l) => (players > 10 || paper(l)) && ratio(l) <= band + 1e-9 && gap(l) >= 2,
    dist: (a, b) => dists.get(a)!.get(b) ?? 99,
    exposure: (l, s) => exposureOf(l, dists, adj).exposure[l.indexOf(s)]!,
    budget: BUDGET,
    log: (line) => log(`search ${line}`),
  });
  log(`start ${table}: ${show(res.start.layout, res.start.rates)}`);
  log(`best ${table}: ${show(res.best.layout, res.best.rates)} (${res.tried.length} layouts measured, ${((Date.now() - t0) / 60000).toFixed(0)} min)`);

  // 3. Fresh games for both.
  const cStartRs = await pool.run(spec(`${TAG}C`, res.start.layout));
  const cStart = rates(res.start.layout, cStartRs);
  const cBestRs = res.best === res.start ? cStartRs : await pool.run(spec(`${TAG}C`, res.best.layout));
  const cBest = rates(res.best.layout, cBestRs);
  log(`check ${table} before: ${show(res.start.layout, cStart)} | ${extra(cStartRs)}`);
  log(`check ${table} after: ${show(res.best.layout, cBest)} | ${extra(cBestRs)}`);
  const spread = (r: readonly number[]) => Math.max(...r) - Math.min(...r);
  const pin = res.best !== res.start && spread(cBest) <= spread(cStart) - 0.05;
  const ships = pin ? res.best.layout : res.start.layout;
  const base = pin ? cBest : cStart;
  log(`${pin ? "pin" : "keep"} ${table}: ${JSON.stringify([...ships].sort())} (fresh games: spread ${(100 * spread(cStart)).toFixed(1)} -> ${(100 * spread(cBest)).toFixed(1)} pts)`);

  // 4. The start bonus (session 23's way), on the same fresh games.
  const weak = ships.filter((_, i) => base[i]! < fair / 2);
  const chosen: Record<string, number> = {};
  if (weak.length) {
    const tries = new Map<number, number[]>();
    for (const b of [2, 4, 6]) {
      const bonus = Object.fromEntries(weak.map((t) => [t, b]));
      const r = rates(ships, await pool.run(spec(`${TAG}C`, ships, bonus)));
      tries.set(b, r);
      log(`try ${table} +${b}: ${show(ships, r, bonus)}`);
    }
    for (const t of weak) {
      const i = ships.indexOf(t);
      const ok = [2, 4, 6].find((b) => tries.get(b)![i]! >= fair / 2 && tries.get(b)![i]! <= fair);
      const enough = [2, 4, 6].find((b) => tries.get(b)![i]! >= fair / 2);
      chosen[t] = ok ?? enough ?? 6;
      log(`choose ${table} ${name(t)} (${t}): bare ${pct(base[i]!)}, +${chosen[t]} -> ${pct(tries.get(chosen[t]!)![i]!)}${ok ? "" : enough ? " (goes above fair)" : " (+6 isn't enough)"}`);
    }
  }
  log(`bonus ${table}: ${JSON.stringify(chosen)}`);

  // 5. The proof on fresh games: as it ships today (its own head start) against the new layout with its bonus.
  const todayRs = await pool.run(spec(`${TAG}P`));
  const newRs = await pool.run(spec(`${TAG}P`, ships, chosen));
  const todayBonus = current.bonus ?? {};
  log(`proof ${table} today: ${show(current.slots, rates(current.slots, todayRs), todayBonus)}${current.buildings ? ` (and a market and culture at ${Object.keys(current.buildings).length})` : ""} | ${extra(todayRs)}`);
  log(`proof ${table} new: ${show(ships, rates(ships, newRs), chosen)} | ${extra(newRs)}`);
  log(`done ${table} in ${((Date.now() - t0) / 60000).toFixed(0)} min`);
}

await Promise.all(tables.map((t) => one(t).catch((e: Error) => console.log(`[${t}] FAILED ${e.stack}`))));
pool.close();

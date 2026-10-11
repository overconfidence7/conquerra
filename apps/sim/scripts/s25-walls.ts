/**
 * Session 25: walls that pay back. The stacking wall bonus (`rules.walls.stackPerTerritory`, capped at `stackMax`),
 * measured against the stop rules, per table:
 *   (a) the payback: a delegating seat whose Steward walls (`delegate-80+walls39`) and one that never walls
 *       (`delegate-80+nowalls`) at a table of dealt Marshals: their win rates;
 *   (b) walls built a game, walled territory-turns holding more than 1 troop, attacks on walls a game and the share
 *       the wall held (at the payback table and at the all-Marshal table);
 *   (c) all-Marshal game length and the halfway leader's win rate, (d) each personality's win rate (both from
 *       `src/tables.ts`, as session 23 measured them);
 *   (e) the delegating seat (Leader 80%, Steward 20%) against Marshals, as times fair.
 *
 *   npx tsx apps/sim/scripts/s25-walls.ts --rules walls.stackPerTerritory=0.1,walls.stackMax=0.4 [--games 300]
 *     [--tables embervale:4,wyrmland:6,rootholm:8] [--seed s25] [--only ab,marshals,delegate] [--label B]
 *     [--tweak '{"judgement":{...}}'] [--seat-rule]
 * `--rules` is the CLI's (`walls.stackMax=null`: no cap). Ends each table with one SUMMARY line for the sweep table.
 */
import { defaultRules } from "@conquerra/content";
import { ruleOverrides } from "../src/ruleArgs";
import type { TableResult } from "@conquerra/simcore";
import { marshalTable, seatTable } from "../src/tables";
import { runTournament } from "../src/tournament";

const argv = process.argv.slice(2);
const opt = (name: string, dflt: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1]! : dflt;
};
const rulesArg = opt("rules", "");
const games = Number(opt("games", "300"));
const seed = opt("seed", "s25");
const label = opt("label", rulesArg || "off");
const only = new Set(opt("only", "ab,marshals,delegate").split(","));
const tweak = opt("tweak", "") ? (JSON.parse(opt("tweak", "")) as { judgement?: Record<string, unknown> }) : undefined;
const rules = rulesArg ? ruleOverrides(rulesArg, defaultRules) : undefined;
const extra = argv.includes("--seat-rule") ? { seatRule: true } : undefined;

type Seat = TableResult["seats"][number];
/** (b): walls built a game, garrisoned walled territory-turns, attacks on walls a game, the share held. */
function wallStats(seats: Seat[], games: number) {
  const sum = (f: (s: Seat) => number) => seats.reduce((a, s) => a + f(s), 0);
  const battles = sum((s) => s.wallBattles);
  const held = sum((s) => s.wallHolds);
  return {
    built: sum((s) => s.wallsBuilt) / games,
    garrisoned: (100 * sum((s) => s.walledGarrisoned ?? 0)) / Math.max(1, sum((s) => s.walledTurns ?? 0)),
    attacks: battles / games,
    held: (100 * held) / Math.max(1, battles),
    battles,
    text() {
      return `walls built ${this.built.toFixed(2)}/game | garrisoned (more than 1 troop) ${this.garrisoned.toFixed(1)}% of walled territory-turns | attacks on walls ${this.attacks.toFixed(2)}/game, held ${this.held.toFixed(1)}% (${held} of ${battles})`;
    },
  };
}

console.log(`s25-walls ${label} | rules ${rulesArg || "(as rules.json)"} | seed ${seed}, ${games} games a table${tweak ? ` | tweak ${JSON.stringify(tweak)}` : ""}${extra ? " | seat rule on" : ""}`);
for (const t of opt("tables", "embervale:4,wyrmland:6,rootholm:8").split(",")) {
  const [map, n] = t.split(":") as [string, string];
  const players = Number(n);
  const o = { map, players, games, seed, ...(rules ? { rules } : {}), ...(tweak ? { tweak } : {}), ...(extra ? { extra } : {}) };
  const summary: string[] = [];
  if (only.has("ab")) {
    const t0 = Date.now();
    const seats = ["delegate-80+walls39", "delegate-80+nowalls", ...Array(players - 2).fill("marshal")];
    const r = await runTournament({ map, players, seats, games, seed, fog: true, diplomacy: true, ...(rules ? { rules } : {}), ...(tweak ? { tweak } : {}), ...(extra ?? {}) });
    const of = (k: string) => r.map((g) => g.seats[g.kinds.indexOf(k)]!);
    const rate = (xs: Seat[]) => (100 * xs.filter((s) => s.won).length) / xs.length;
    const walls = of("delegate-80+walls39"), none = of("delegate-80+nowalls");
    const marshals = r.flatMap((g) => g.seats.filter((_, i) => g.kinds[i]!.startsWith("marshal-")));
    const w = wallStats(walls, r.length), all = wallStats(r.flatMap((g) => g.seats), r.length);
    console.log(`(a) payback ${t.padEnd(12)}: walls its core ${rate(walls).toFixed(1)}% | never walls ${rate(none).toFixed(1)}% | Marshals ${rate(marshals).toFixed(1)}% | fair ${(100 / players).toFixed(1)}% | edge ${(rate(walls) - rate(none)).toFixed(1)} points | ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    console.log(`(b) the walling seat: ${w.text()}`);
    console.log(`(b) everyone at that table: ${all.text()}`);
    summary.push(`walls ${rate(walls).toFixed(1)} / never ${rate(none).toFixed(1)} (edge ${(rate(walls) - rate(none)).toFixed(1)})`, `ab walls held ${all.held.toFixed(1)}% of ${all.battles}`);
  }
  if (only.has("marshals")) {
    const m = await marshalTable(o);
    for (const l of m.lines) console.log(l);
    const all = wallStats(m.results.flatMap((g) => g.seats), m.results.length);
    console.log(`(b) all-Marshal: ${all.text()}`);
    const top = Object.entries(m.personalities).sort((a, b) => b[1] - a[1])[0]!;
    summary.push(`length ${m.length.toFixed(1)}`, `halfway ${m.halfwayWon.toFixed(1)}%`, `turtle ${m.personalities.turtle?.toFixed(2)}`, `top ${top[0]} ${top[1].toFixed(2)}`, `marshal walls held ${all.held.toFixed(1)}% of ${all.battles}, built ${all.built.toFixed(2)}/game`);
  }
  if (only.has("delegate")) {
    const d = await seatTable("delegate", o);
    for (const l of d.lines) console.log(l);
    summary.push(`delegate ${d.xFair.toFixed(2)}x`);
  }
  console.log(`SUMMARY ${label} ${t}: ${summary.join(" | ")}`);
}

/**
 * The standard balance tables (session 23, shared with session 25's wall sweep): a delegating seat against Marshals, a
 * Recruit against Captains, and all-Marshal tables with each personality's win rate and style. Fog and diplomacy on;
 * seats rotated each game. Each returns its printed lines and the numbers the stop rules look at.
 */
import { runTournament, type TournamentSpec } from "./tournament";

export const pct = (k: number, of: number) => `${((100 * k) / Math.max(1, of)).toFixed(1)}%`;
export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const CAP = 60;

export interface TableOpts {
  map: string;
  players: number;
  games: number;
  seed: string;
  tweak?: TournamentSpec["tweak"];
  rules?: TournamentSpec["rules"];
  /** Session 32: blackout fog (standard fog by default). */
  fog?: TournamentSpec["fog"];
  /** Extra spec fields (session 25: `seatRule`). */
  extra?: Partial<TournamentSpec>;
}

const specOf = (o: TableOpts, seats: string[]): TournamentSpec => ({
  map: o.map,
  players: o.players,
  seats,
  games: o.games,
  seed: o.seed,
  fog: o.fog ?? true,
  diplomacy: true,
  ...(o.tweak ? { tweak: o.tweak } : {}),
  ...(o.rules ? { rules: o.rules } : {}),
  ...(o.extra ?? {}),
});

/** One seat (`delegate-80` against Marshals, or `recruit` against Captains): its win rate, as times fair. */
export async function seatTable(mode: "delegate" | "recruit", o: TableOpts) {
  const t0 = Date.now();
  const seat = mode === "delegate" ? "delegate-80" : "recruit";
  const others = mode === "delegate" ? "marshal" : "captain";
  const r = await runTournament(specOf(o, [seat, ...Array(o.players - 1).fill(others)]));
  const mine = r.map((g) => g.seats[g.kinds.indexOf(seat)]!);
  const won = mine.filter((s) => s.won).length;
  const xFair = (won / r.length) * o.players;
  const line = `${mode} ${`${o.map}:${o.players}`.padEnd(16)} ${o.seed}: ${seat} won ${pct(won, r.length)} = ${xFair.toFixed(2)}x fair (fair ${(100 / o.players).toFixed(1)}%) | buildings ${avg(mine.map((s) => s.gold.buildings)).toFixed(0)}g culture ${avg(mine.map((s) => s.gold.culture)).toFixed(0)}g walls ${avg(mine.map((s) => s.wallsBuilt)).toFixed(2)} | length avg ${avg(r.map((g) => g.turns)).toFixed(1)} | ${((Date.now() - t0) / 1000).toFixed(0)}s`;
  return { lines: [line], xFair, results: r };
}

/** An all-Marshal table: game length, the cap, the halfway leader's win rate, and each personality's win rate and style. */
export async function marshalTable(o: TableOpts) {
  const t0 = Date.now();
  const r = await runTournament(specOf(o, ["marshal"]));
  const turns = r.map((g) => g.turns).sort((a, b) => a - b);
  const won = r.filter((g) => g.winner !== "draw");
  const half = won.filter((g) => g.leaderHalfway);
  const halfwayWon = (100 * half.filter((g) => g.leaderHalfway === g.winner).length) / Math.max(1, half.length);
  const lines = [
    `marshals ${`${o.map}:${o.players}`.padEnd(16)} ${o.seed}: ${r.length} games | length median ${turns[Math.floor(turns.length / 2)]}, avg ${avg(turns).toFixed(1)}, at the ${CAP} cap ${pct(turns.filter((x) => x >= CAP).length, turns.length)}, draws ${pct(r.length - won.length, r.length)} | halfway leader won ${pct(half.filter((g) => g.leaderHalfway === g.winner).length, half.length)} | ${((Date.now() - t0) / 1000).toFixed(0)}s`,
  ];
  const by = new Map<string, { seats: number; won: number; build: number[]; culture: number[]; walls: number[]; walled: number; attacks: number[]; land10: number[] }>();
  for (const g of r)
    g.seats.forEach((s, i) => {
      const k = g.kinds[i]!.replace(/^marshal-/, "");
      const x = by.get(k) ?? { seats: 0, won: 0, build: [], culture: [], walls: [], walled: 0, attacks: [], land10: [] };
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
  const personalities: Record<string, number> = {};
  for (const [k, x] of [...by].sort()) {
    personalities[k] = (x.won / x.seats) * o.players;
    lines.push(
      `  ${k.padEnd(12)} won ${pct(x.won, x.seats).padStart(6)} = ${((x.won / x.seats) * o.players).toFixed(2)}x (${x.seats} seats) | buildings ${avg(x.build).toFixed(0)}g culture ${avg(x.culture).toFixed(0)}g | walled in ${pct(x.walled, x.seats)} of games (${avg(x.walls).toFixed(2)} walls) | attacks/turn ${avg(x.attacks).toFixed(2)} | land at turn 10 ${avg(x.land10).toFixed(1)}`,
    );
  }
  return { lines, length: avg(turns), halfwayWon, personalities, results: r };
}

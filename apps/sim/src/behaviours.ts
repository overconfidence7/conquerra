/**
 * Session 17: what wins. Reads tournament results (JSON lines from `pnpm tournament --out`) and prints, in plain numbers:
 *  - each kind of seat's behaviours on average (land by turns 5/10/15, fronts, concentration, first fort / market /
 *    culture, where the gold went, deals);
 *  - winners against the rest of their table: how much more (or less) of each behaviour the winner showed;
 *  - each behaviour's win rate by quarter (seats split into four equal groups by how much of it they showed).
 *   npx tsx apps/sim/src/behaviours.ts results.jsonl [more.jsonl ...]
 */
import { readFileSync } from "node:fs";
import type { SeatStats, TableResult } from "@conquerra/simcore";

type Row = TableResult & { kinds: string[]; spec?: { players: number; map: string } };

/** The behaviours, as numbers per seat (null: doesn't apply, e.g. land at turn 15 in a game over by then). */
export const BEHAVIOURS: Record<string, (s: SeatStats, r: Row) => number | null> = {
  "land at turn 5": (s) => s.land5,
  "land at turn 10": (s) => s.land10,
  "land at turn 15": (s) => s.land15,
  "captures by turn 8": (s) => s.took8,
  "land lost by turn 8": (s) => s.lost8,
  "rivals attacked a turn": (s) => (s.attacks ? s.frontsPerTurn : 0),
  "rivals attacked in all": (s) => s.rivalsAttacked,
  "army concentration (turns 1-10)": (s) => s.concentration10,
  "attacks on the leader (share)": (s) => s.leaderShare,
  "first fort (turn; never = 60)": (s) => s.firstFort ?? 60,
  "first market (turn; never = 60)": (s) => s.firstMarket ?? 60,
  "first culture (turn; never = 60)": (s) => s.firstCulture ?? 60,
  "markets by turn 10": (s) => s.markets10,
  "forts by turn 10": (s) => s.forts10,
  "culture raises by turn 10": (s) => s.culture10,
  "gold share on troops (turns 1-10)": (s) => share(s.gold10, "troops"),
  "gold share on buildings (turns 1-10)": (s) => share(s.gold10, "buildings"),
  "gold share on culture (turns 1-10)": (s) => share(s.gold10, "culture"),
  "gold share on specialists (turns 1-10)": (s) => share(s.gold10, "specialists"),
  "gold share on spies (turns 1-10)": (s) => share(s.gold10, "spies"),
  "deals made": (s) => s.deals,
  "deals broken": (s) => s.broken,
  "joint wars": (s) => s.wars,
  truces: (s) => s.truces,
};

function share(g: SeatStats["gold"], k: keyof SeatStats["gold"]): number {
  const all = Object.values(g).reduce((a, b) => a + b, 0);
  return all ? g[k] / all : 0;
}

export function load(files: readonly string[]): Row[] {
  return files.flatMap((f) => readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row));
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const f2 = (x: number) => (Number.isNaN(x) ? "-" : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2));

/** Each kind's behaviours on average. */
export function byKind(rows: readonly Row[]): string {
  const kinds = [...new Set(rows.flatMap((r) => r.kinds))].sort();
  const out = [`| behaviour | ${kinds.join(" | ")} |`, `|---|${kinds.map(() => "---").join("|")}|`];
  const winRate = kinds.map((k) => {
    const seats = rows.flatMap((r) => r.seats.filter((_, i) => r.kinds[i] === k));
    return `${((100 * seats.filter((s) => s.won).length) / Math.max(1, seats.length)).toFixed(1)}%`;
  });
  out.push(`| **wins** | ${winRate.join(" | ")} |`);
  for (const [name, f] of Object.entries(BEHAVIOURS)) {
    const cells = kinds.map((k) => f2(mean(rows.flatMap((r) => r.seats.flatMap((s, i) => (r.kinds[i] === k ? [f(s, r)] : []))).filter((x): x is number => x !== null))));
    out.push(`| ${name} | ${cells.join(" | ")} |`);
  }
  return out.join("\n");
}

/**
 * Winners against their own table: for each behaviour, the winner's value minus the average of the other seats at
 * its table (games with a winner), averaged over games; and in how many games the winner showed more of it than
 * the table's average. Plain, and it compares like with like (same map, same game).
 */
export function winnersVsTable(rows: readonly Row[]): { name: string; diff: number; more: number; games: number }[] {
  return Object.entries(BEHAVIOURS).map(([name, f]) => {
    const diffs: number[] = [];
    let more = 0;
    for (const r of rows) {
      const w = r.seats.find((s) => s.won);
      if (!w) continue;
      const wv = f(w, r);
      const others = r.seats.filter((s) => !s.won).map((s) => f(s, r)).filter((x): x is number => x !== null);
      if (wv === null || !others.length) continue;
      const d = wv - mean(others);
      diffs.push(d);
      if (d > 0) more++;
    }
    return { name, diff: mean(diffs), more: diffs.length ? more / diffs.length : NaN, games: diffs.length };
  });
}

/** A behaviour's win rate by quarter: seats sorted by how much of it they showed, cut into four equal groups. */
export function quarters(rows: readonly Row[], f: (s: SeatStats, r: Row) => number | null): { lo: number; hi: number; win: number; n: number }[] {
  const all = rows.flatMap((r) => r.seats.map((s) => ({ v: f(s, r), won: s.won }))).filter((x): x is { v: number; won: boolean } => x.v !== null).sort((a, b) => a.v - b.v);
  const q = Math.floor(all.length / 4);
  return [0, 1, 2, 3].map((k) => {
    const part = all.slice(k * q, k === 3 ? all.length : (k + 1) * q);
    return { lo: part[0]?.v ?? NaN, hi: part[part.length - 1]?.v ?? NaN, win: part.filter((x) => x.won).length / Math.max(1, part.length), n: part.length };
  });
}

export function report(rows: readonly Row[]): string {
  const lines = [byKind(rows), "", "| behaviour | winner minus the rest of its table | winner showed more of it | win rate by quarter (least → most) |", "|---|---|---|---|"];
  for (const w of winnersVsTable(rows)) {
    const qs = quarters(rows, BEHAVIOURS[w.name]!);
    lines.push(`| ${w.name} | ${w.diff >= 0 ? "+" : ""}${f2(w.diff)} | ${(100 * w.more).toFixed(0)}% | ${qs.map((q) => `${(100 * q.win).toFixed(0)}%`).join(" · ")} |`);
  }
  return lines.join("\n");
}

if (process.argv[1]?.endsWith("behaviours.ts")) console.log(report(load(process.argv.slice(2))));

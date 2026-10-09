/**
 * Session 20c: the mop-up fixtures again, with Nate's measures for mass and sweep (Part 1.6).
 *   npx tsx apps/sim/scripts/s20c-mopup.ts run [leader|marshal|cleanup|all] [maps] [reps]
 * MOPUP_DIR=sim-results/mopup-wide/ for the wide set (60 positions; reps 3 gives the 180 runs).
 *
 * For each run (the leading seat played as in s20-mopup.ts; the rivals keep their Marshals; 15 turns at most):
 *  - turns until every rival is out;
 *  - "got away" (Nate's cases): a rival took a territory from the leading seat after the finish began and still held it
 *    when that turn ended (the security blanket is meant to take anything they take straight back); "took any" counts
 *    every capture, even one taken back the same turn;
 *  - orders a turn the leading seat wrote while finishing (average, and the most in one turn);
 *  - recruits near the fight: the share of the troops it recruited within 2 steps of a rival's land;
 *  - troops left behind: spare troops (all but 1 a territory, the capital left out) as each turn ends that stand more
 *    than 3 steps from any land the rivals held when the turn was planned, as a share of all its spare troops.
 * (The measures read the true board; the bots never do.)
 */
import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { playTable } from "@conquerra/simcore";
import { indexMap, seedRng, type GameContext, type GameState, type PlayerId, type TerritoryId } from "@conquerra/engine";
import { botFor } from "../src/tournament";
import type { MopupFixture } from "./s20-mopup";

const DIR = process.env.MOPUP_DIR ? `${process.env.MOPUP_DIR.replace(/\/?$/, "/")}` : fileURLToPath(new URL("../../../packages/bots/test/fixtures/mopup/", import.meta.url));
const args = process.argv.slice(2);
const self = fileURLToPath(import.meta.url);

type Job = { file: string; how: string; rep: number };
export interface Run {
  name: string;
  map: string;
  how: string;
  turns: number;
  won: boolean;
  gotAway: boolean;
  tookAny: boolean;
  /** Territories the rivals took from it, in all, and those they still held as the turn ended. */
  retaken: number;
  kept: number;
  orders: number[];
  recruitNear: number;
  recruitAll: number;
  behind: number;
  spare: number;
  ms: number[];
  /** Session 20d: territories the rivals held as each turn was planned (the true board), and those no order of ours went for that turn. */
  held?: number;
  missed?: number;
  /** ... of those, the ones the leading seat couldn't see as it planned. */
  heldFog?: number;
  missedFog?: number;
}

const pool = <T>(jobs: unknown[], workers = 19): Promise<T[]> => {
  const n = Math.min(workers, jobs.length);
  return Promise.all(
    Array.from({ length: n }, (_, w) =>
      new Promise<T[]>((resolve, reject) => {
        const child = spawn(process.execPath, ["--import", "tsx", self, "--worker", JSON.stringify(jobs.filter((_, i) => i % n === w))], { stdio: ["ignore", "pipe", "inherit"] });
        let out = "";
        child.stdout.on("data", (d) => (out += d));
        child.on("exit", (code) => (code === 0 ? resolve(out.split("\n").filter(Boolean).map((l) => JSON.parse(l) as T)) : reject(new Error(`worker ${w} exited ${code}`))));
      }),
    ),
  ).then((p) => p.flat());
};

/** Each territory's distance (in steps, over the whole map) from the nearest land of a rival of `top`. */
function fromRivals(ctx: GameContext, s: GameState, top: PlayerId): Map<TerritoryId, number> {
  const idx = indexMap(ctx.map);
  const d = new Map<TerritoryId, number>();
  const q: TerritoryId[] = [];
  for (const t of idx.ids) {
    const o = s.territories[t]!.owner;
    if (o && o !== top) (d.set(t, 0), q.push(t));
  }
  for (let h = 0; h < q.length; h++) for (const nb of idx.neighbors.get(q[h]!)!) if (!d.has(nb)) (d.set(nb, d.get(q[h]!)! + 1), q.push(nb));
  return d;
}

export function runFixture(fx: MopupFixture, how: string, rep: number): Run {
  const c: GameContext = { map: maps[fx.map]!, rules: { ...defaultRules, game: { ...defaultRules.game, maxTurnsHard: 500 } } };
  const seat = Number(fx.top.slice(1)) - 1;
  const start = structuredClone(fx.state);
  // Session 20d: FOG=off plays the same positions with the fog lifted.
  if (process.env.FOG === "off") start.settings = { ...start.settings, fog: false };
  if (rep > 0) start.rng = seedRng(`${fx.name}-rep${rep}`);
  const kinds = [...fx.kinds];
  if (how !== "marshal") {
    kinds[seat] = how === "cleanup" ? "delegate-80+cleanup" : "delegate-80";
    const p = start.players[seat]!;
    for (const l of p.leaders) {
      if (l.of !== p.id) continue;
      if (l.kind === "leader") (l.command = { kind: "military" }), (l.budget = { share: 0.8 }), (l.purse = Math.floor(p.gold * 0.8));
      else (l.command = { kind: "realm" }), (l.budget = { share: 0.2 }), (l.purse = Math.floor(p.gold * 0.2));
    }
    p.gold -= p.leaders.filter((l) => l.of === p.id).reduce((a, l) => a + l.purse, 0);
  }
  const bots = kinds.map((k) => botFor(k));
  const top = fx.top;
  const orders: number[] = [];
  const ms: number[] = [];
  const inner = bots[seat]!;
  // Session 20d: where our orders went each turn (every move's target, chained ones included), and what we could see.
  const aimed = new Map<number, Set<TerritoryId>>();
  const visible = new Map<number, Set<TerritoryId>>();
  const targetsOf = (o: { kind: string; to?: TerritoryId; then?: unknown; fallback?: unknown }, into: Set<TerritoryId>) => {
    if (o.kind === "move" && o.to) into.add(o.to);
    if (o.then) targetsOf(o.then as never, into);
    if (o.fallback) targetsOf(o.fallback as never, into);
  };
  bots[seat] = { ...inner, plan: (cc, v, l) => { const t0 = performance.now(); const o = inner.plan(cc, v, l); const into = new Set<TerritoryId>(); for (const x of o) targetsOf(x as never, into); aimed.set(v.turn, into); visible.set(v.turn, new Set(Object.entries(v.territories).filter(([, x]) => x.detail === "full").map(([t]) => t))); ms.push(performance.now() - t0); if (process.env.SLOWPLAN && ms[ms.length - 1]! > Number(process.env.SLOWPLAN)) process.stderr.write(`slow plan ${fx.name} T${v.turn}: ${ms[ms.length - 1]!.toFixed(0)} ms, ${o.length} orders
`); orders.push(o.length); return o; } };
  let retaken = 0, kept = 0, recruitNear = 0, recruitAll = 0, behind = 0, spare = 0, held = 0, missed = 0, heldFog = 0, missedFog = 0;
  let planned: GameState | null = null;
  let taken = new Set<TerritoryId>();
  const settle = (s: GameState) => {
    for (const t of taken) if (s.territories[t]!.owner !== top) kept++;
    taken = new Set();
  };
  const from = start.turn;
  const r = playTable(c, `${fx.name}-run`, bots, {
    start,
    maxTurns: from + 14,
    onEvents: (before, events) => {
      planned = before;
      const went = aimed.get(before.turn);
      const saw = visible.get(before.turn);
      if (went && saw)
        for (const t of Object.keys(before.territories)) {
          const o = before.territories[t]!.owner;
          if (!o || o === top) continue;
          held++;
          if (!went.has(t)) missed++;
          if (!saw.has(t)) (heldFog++, !went.has(t) && missedFog++);
        }
      const d = fromRivals(c, before, top);
      for (const e of events) {
        if (e.type === "battle" && e.captured && e.defender === top && e.player !== top) (retaken++, taken.add(e.to));
        if (e.type === "recruited" && e.player === top) {
          recruitAll += e.count;
          if ((d.get(e.territory) ?? 99) <= 2) recruitNear += e.count;
        }
      }
    },
    onTurn: (s) => {
      if (s.turn === from || !planned) return;
      settle(s);
      const d = fromRivals(c, planned, top);
      const cap = s.players.find((p) => p.id === top)!.capital;
      for (const t of Object.keys(s.territories)) {
        const x = s.territories[t]!;
        if (x.owner !== top || t === cap) continue;
        const sp = Math.max(0, x.troops - 1);
        spare += sp;
        if ((d.get(t) ?? 99) > 3) behind += sp;
      }
    },
  });
  const end = r.final!;
  settle(end);
  return { name: `${fx.name}${rep ? `#${rep}` : ""}`, map: fx.map, how, turns: end.winner ? end.turn - from + 1 : 99, won: end.winner === top, gotAway: kept > 0, tookAny: retaken > 0, retaken, kept, orders, recruitNear, recruitAll, behind, spare, ms, held, missed, heldFog, missedFog };
}

export function summarize(how: string, rs: Run[], detail = true): string[] {
  const out: string[] = [];
  const t = rs.map((r) => r.turns);
  const sorted = [...t].sort((a, b) => a - b);
  const pc = (k: number) => `${Math.round((100 * k) / rs.length)}%`;
  const all = rs.flatMap((r) => r.orders);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  out.push(
    `${how.padEnd(8)} ${rs.length} runs: median ${sorted[Math.floor(sorted.length / 2)]}, within 2 ${pc(rs.filter((r) => r.turns <= 2).length)}, within 3 ${pc(rs.filter((r) => r.turns <= 3).length)}, within 5 ${pc(rs.filter((r) => r.turns <= 5).length)}, unfinished ${rs.filter((r) => r.turns === 99).length}, lost ${rs.filter((r) => r.turns !== 99 && !r.won).length}`,
  );
  out.push(
    `   got away ${pc(rs.filter((r) => r.gotAway).length)} (kept ${avg(rs.map((r) => r.kept)).toFixed(2)} a run); took any ${pc(rs.filter((r) => r.tookAny).length)} (${avg(rs.map((r) => r.retaken)).toFixed(2)} a run); orders a turn ${avg(all).toFixed(1)} (most ${Math.max(0, ...all)}); recruits within 2 steps ${(100 * rs.reduce((a, r) => a + r.recruitNear, 0) / Math.max(1, rs.reduce((a, r) => a + r.recruitAll, 0))).toFixed(0)}%; spare troops left behind ${(100 * rs.reduce((a, r) => a + r.behind, 0) / Math.max(1, rs.reduce((a, r) => a + r.spare, 0))).toFixed(0)}%; plan ${avg(rs.flatMap((r) => r.ms)).toFixed(1)} ms (worst ${Math.max(0, ...rs.flatMap((r) => r.ms)).toFixed(0)})`,
  );
  const sum = (f: (r: Run) => number | undefined) => rs.reduce((a, r) => a + (f(r) ?? 0), 0);
  out.push(`   never ordered (session 20d): ${sum((r) => r.missed)} of ${sum((r) => r.held)} rival territory-turns (${((100 * sum((r) => r.missed)) / Math.max(1, sum((r) => r.held))).toFixed(1)}%); in the fog ${sum((r) => r.missedFog)} of ${sum((r) => r.heldFog)} (${((100 * sum((r) => r.missedFog)) / Math.max(1, sum((r) => r.heldFog))).toFixed(1)}%)`);
  const hist = new Map<number, number>();
  for (const x of t) hist.set(x, (hist.get(x) ?? 0) + 1);
  out.push(`   turns: ${[...hist].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k === 99 ? "15+" : k}:${v}`).join(" ")}`);
  out.push(`   slow (over 3): ${rs.filter((r) => r.turns > 3).map((r) => `${r.name}=${r.turns === 99 ? "15+" : r.turns}${r.gotAway ? "*" : ""}`).join(" ")}`);
  if (detail) for (const m of [...new Set(rs.map((r) => r.map))]) out.push(`   ${m.padEnd(12)} ${rs.filter((r) => r.map === m).map((r) => (r.turns === 99 ? "–" : r.won ? r.turns : `x${r.turns}`) + (r.gotAway ? "*" : "")).join(" ")}`);
  return out;
}

if (args[0] === "--worker") {
  for (const j of JSON.parse(args[1]!) as Job[]) process.stdout.write(`${JSON.stringify(runFixture(JSON.parse(readFileSync(j.file, "utf8")) as MopupFixture, j.how, j.rep))}\n`);
} else if (args[0] === "run") {
  const hows = !args[1] || args[1] === "all" ? ["leader", "marshal"] : args[1].split(",");
  const only = args[2] && args[2] !== "all" ? args[2].split(",") : undefined;
  const reps = Number(args[3] ?? 1);
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && (!only || only.some((m) => f.startsWith(m))));
  const jobs: Job[] = hows.flatMap((how) => files.flatMap((f) => Array.from({ length: reps }, (_, rep) => ({ file: `${DIR}${f}`, how, rep }))));
  const res = await pool<Run>(jobs);
  for (const how of hows) {
    const rs = res.filter((r) => r.how === how).sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
    for (const line of summarize(how, rs, rs.length <= 60)) console.log(line);
  }
}

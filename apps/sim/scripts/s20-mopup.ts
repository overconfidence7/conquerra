/**
 * Session 20: the mop-up fixtures (Part 1.3), positions where one seat holds 85–95% of the map with two or three small
 * rivals left, made from real Marshal games at the moment a player passes 85%, and how many turns it takes to finish
 * them from there.
 *   npx tsx apps/sim/scripts/s20-mopup.ts make <map:players> <wanted> [games] [seats]   writes packages/bots/test/fixtures/mopup/
 *   npx tsx apps/sim/scripts/s20-mopup.ts run [leader|marshal|cleanup|all] [maps]        turns to finish each fixture
 * In "run", the leading seat is played by a delegating player (its Leader on Run the military with 80%, its Steward on
 * Run the realm with 20%: the purses as if it had been delegating all along), by its own Marshal, or with every military
 * leader it has on Clean up. The rivals keep their Marshals. Capped at 15 turns.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { playTable } from "@conquerra/simcore";
import { indexMap, type GameContext, type GameState, type PlayerId } from "@conquerra/engine";
import { botFor, seatsFor, type TournamentSpec } from "../src/tournament";

const DIR = fileURLToPath(new URL("../../../packages/bots/test/fixtures/mopup/", import.meta.url));
export interface MopupFixture {
  name: string;
  map: string;
  players: number;
  kinds: string[];
  top: PlayerId;
  share: number;
  rivals: { id: PlayerId; land: number }[];
  state: GameState;
}

/** Who holds what, and the leader's share; null unless it's a mop-up position (85–95%, two or three rivals). */
export function mopupShape(ctx: GameContext, s: GameState): { top: PlayerId; share: number; rivals: { id: PlayerId; land: number }[] } | null {
  const held = new Map<PlayerId, number>();
  for (const t of ctx.map.territories) {
    const o = s.territories[t.id]!.owner;
    if (o) held.set(o, (held.get(o) ?? 0) + 1);
  }
  const ranked = [...held].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  const [top, n] = ranked[0]!;
  const share = n / ctx.map.territories.length;
  const rivals = ranked.slice(1).map(([id, land]) => ({ id, land }));
  return { top, share, rivals };
}

const args = process.argv.slice(2);
const self = fileURLToPath(import.meta.url);
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

type Job = { kind: "make"; map: string; players: number; seats: string[]; i: number } | { kind: "run"; file: string; how: string };

function work(job: Job): unknown {
  const ctx: GameContext = { map: maps[job.kind === "make" ? job.map : "embervale"]!, rules: defaultRules };
  if (job.kind === "make") {
    const spec: TournamentSpec = { map: job.map, players: job.players, seats: job.seats, games: 0, seed: "s20M", fog: true, diplomacy: true };
    const seed = `${spec.seed}-${spec.map}-${spec.players}p-${job.i}`;
    const kinds = seatsFor(spec, job.i, seed);
    let found: MopupFixture | null = null;
    let dead = false;
    playTable(ctx, seed, kinds.map((k) => botFor(k)), {
      settings: { fog: true, diplomacy: true },
      stop: (s) => {
        if (found || dead) return true;
        const m = mopupShape(ctx, s);
        if (!m || m.share < 0.85) return false;
        const alive = m.rivals.length;
        if (alive >= 2 && alive <= 3 && m.share <= 0.95) found = { name: `${job.map}-${job.players}-${job.i}`, map: job.map, players: job.players, kinds, top: m.top, share: m.share, rivals: m.rivals, state: structuredClone(s) };
        else dead = true;
        return true;
      },
    });
    return found;
  }
  const fx = JSON.parse(readFileSync(job.file, "utf8")) as MopupFixture;
  // No turn cap while finishing (Rootholm's positions come late in 60-turn games).
  const c: GameContext = { map: maps[fx.map]!, rules: { ...defaultRules, game: { ...defaultRules.game, maxTurnsHard: 500 } } };
  const seat = Number(fx.top.slice(1)) - 1;
  const start = structuredClone(fx.state);
  const kinds = [...fx.kinds];
  if (job.how !== "marshal") {
    kinds[seat] = job.how === "cleanup" ? "delegate-80+cleanup" : "delegate-80";
    // The purses as if it had been delegating: 80% of its treasury with its Leader, 20% with its Steward.
    const p = start.players[seat]!;
    for (const l of p.leaders) {
      if (l.of !== p.id) continue;
      if (l.kind === "leader") (l.command = { kind: "military" }), (l.budget = { share: 0.8 }), (l.purse = Math.floor(p.gold * 0.8));
      else (l.command = { kind: "realm" }), (l.budget = { share: 0.2 }), (l.purse = Math.floor(p.gold * 0.2));
    }
    p.gold -= p.leaders.filter((l) => l.of === p.id).reduce((a, l) => a + l.purse, 0);
  }
  const from = start.turn;
  const r = playTable(c, `${fx.name}-run`, kinds.map((k) => botFor(k)), { start, maxTurns: from + 14 });
  const end = r.final!;
  const m = mopupShape(c, end);
  return { name: fx.name, map: fx.map, how: job.how, turns: end.winner ? end.turn - from + 1 : 99, won: end.winner === fx.top, share: m?.share ?? 0, left: m?.rivals.length ?? 0 };
}

if (args[0] === "--worker") {
  for (const j of JSON.parse(args[1]!) as Job[]) process.stdout.write(`${JSON.stringify(work(j))}\n`);
} else if (args[0] === "make") {
  const [map, n] = args[1]!.split(":") as [string, string];
  const wanted = Number(args[2] ?? 7);
  const games = Number(args[3] ?? 60);
  const seats = (args[4] ?? "marshal").split(",");
  const jobs: Job[] = Array.from({ length: games }, (_, i) => ({ kind: "make", map, players: Number(n), seats, i }));
  const got = (await pool<MopupFixture | null>(jobs)).filter((x): x is MopupFixture => !!x).sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  console.log(`${map}:${n}: ${got.length} of ${games} games reached a mop-up position`);
  mkdirSync(DIR, { recursive: true });
  for (const f of got.slice(0, wanted)) {
    writeFileSync(`${DIR}${f.name}.json`, JSON.stringify(f));
    console.log(`  ${f.name}: turn ${f.state.turn}, ${(100 * f.share).toFixed(0)}%, rivals ${f.rivals.map((r) => r.land).join("/")}`);
  }
} else if (args[0] === "run") {
  const hows = !args[1] || args[1] === "all" ? ["leader", "marshal"] : args[1].split(",");
  const only = args[2]?.split(",");
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && (!only || only.some((m) => f.startsWith(m))));
  const jobs: Job[] = hows.flatMap((how) => files.map((f) => ({ kind: "run" as const, file: `${DIR}${f}`, how })));
  const res = await pool<{ name: string; map: string; how: string; turns: number; won: boolean; share: number; left: number }>(jobs);
  for (const how of hows) {
    const rs = res.filter((r) => r.how === how).sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
    const t = rs.map((r) => r.turns);
    const sorted = [...t].sort((a, b) => a - b);
    console.log(`${how.padEnd(8)} ${rs.length} fixtures: median ${sorted[Math.floor(sorted.length / 2)]}, within 2 ${rs.filter((r) => r.turns <= 2).length}, within 4 ${rs.filter((r) => r.turns <= 4).length}, unfinished after 15 ${rs.filter((r) => r.turns === 99).length}, lost ${rs.filter((r) => r.turns !== 99 && !r.won).length}`);
    for (const m of [...new Set(rs.map((r) => r.map))]) console.log(`   ${m.padEnd(12)} ${rs.filter((r) => r.map === m).map((r) => (r.turns === 99 ? "–" : r.won ? r.turns : `x${r.turns}`)).join(" ")}`);
  }
}
void indexMap;

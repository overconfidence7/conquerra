/**
 * Session 17: tournaments, in parallel (one process per core), recording every seat's behaviours (simcore's seats.ts).
 *   pnpm tournament --table wyrmland:6 --seats marshal-turtle,captain,captain,captain,captain,captain --games 300
 *   pnpm tournament --table embervale:4 --seats marshal --games 300 --out results.jsonl
 * Seats are listed like `pnpm sim --mix` and rotated each game so nobody keeps a lucky seat. Kinds: captain, recruit,
 * marshal (personalities dealt from the game's seed), marshal-<personality>, expander (session 16's stand-in for a
 * person), and `sighted:<kind>` (that seat plans with fog off: a sharp person piecing everything together).
 * Options: --fog on|off, --diplomacy on|off, --seed prefix, --workers N (default: cores - 1), --out file (JSON lines),
 * --quiet (no summary).
 */
import { spawn } from "node:child_process";
import { cpus } from "node:os";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defaultRules, marshalData, MarshalJudgement, Personality, type PersonalityId } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { dealPersonalities, makeCaptainBot, makeMarshalBot, makeRecruitBot, personality, PERSONALITY_IDS, type Bot } from "@conquerra/bots";
import { playTable, type TableResult } from "@conquerra/simcore";
import type { GameContext } from "@conquerra/engine";

const args = process.argv.slice(2);
const arg = (name: string, dflt: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1]! : dflt;
};

export interface TournamentSpec {
  map: string;
  players: number;
  seats: string[];
  games: number;
  seed: string;
  fog: boolean;
  diplomacy: boolean;
  /** Trying a change (Part 2's A/B tests): merged into the shared judgement and into named personalities. */
  tweak?: { judgement?: Record<string, unknown>; personalities?: Record<string, Record<string, unknown>> };
}

/** `b` merged into `a`, objects deep (arrays and numbers replaced). */
function merge<T>(a: T, b: unknown): T {
  if (!b || typeof b !== "object" || Array.isArray(b) || typeof a !== "object" || a === null) return (b === undefined ? a : b) as T;
  const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
  for (const [k, v] of Object.entries(b)) out[k] = merge(out[k], v);
  return out as T;
}

export function botFor(kind: string, tweak?: TournamentSpec["tweak"]): Bot {
  const k = kind.replace(/^sighted:/, "");
  if (k === "captain") return makeCaptainBot();
  if (k === "recruit") return makeRecruitBot();
  // Session 16's stand-in for a person running away: the Captain with its caution turned down.
  if (k === "expander") return { ...makeCaptainBot({ chainMargin: 1, off: ["chokes", "breakthrough", "forts", "culture"] }), id: "expander" };
  if (k.startsWith("marshal-") && PERSONALITY_IDS.includes(k.slice(8) as PersonalityId)) {
    const id = k.slice(8) as PersonalityId;
    if (!tweak) return makeMarshalBot(id);
    const all = tweak.personalities?.["*"];
    const p = Personality.parse(merge(merge(personality(id), all), tweak.personalities?.[id]));
    return makeMarshalBot(p, MarshalJudgement.parse(merge(marshalData.judgement, tweak.judgement)));
  }
  throw new Error(`Unknown seat kind ${kind}`);
}

/** Game `i`'s seat kinds (rotated), with "marshal" seats given personalities from the seed. */
export function seatsFor(spec: TournamentSpec, i: number, seed: string): string[] {
  const kinds = Array.from({ length: spec.players }, (_, k) => spec.seats[(k + i) % spec.seats.length]!);
  const marshals = kinds.flatMap((k, s) => (k.replace(/^sighted:/, "") === "marshal" ? [`s${s}`] : []));
  const dealt = dealPersonalities(seed, marshals);
  return kinds.map((k, s) => (k.replace(/^sighted:/, "") === "marshal" ? k.replace("marshal", `marshal-${dealt[`s${s}`]}`) : k));
}

export function playOne(spec: TournamentSpec, i: number): TableResult & { kinds: string[] } {
  const ctx: GameContext = { map: maps[spec.map]!, rules: defaultRules };
  const seed = `${spec.seed}-${spec.map}-${spec.players}p-${i}`;
  const kinds = seatsFor(spec, i, seed);
  const bots = kinds.map((k) => botFor(k, spec.tweak));
  const sighted = kinds.flatMap((k, s) => (k.startsWith("sighted:") ? [s] : []));
  const r = playTable(ctx, seed, bots, { settings: { fog: spec.fog, diplomacy: spec.diplomacy }, sighted });
  return { ...r, kinds };
}

/** Run a tournament on every core; resolves with every game's result. */
export function runTournament(spec: TournamentSpec, workers = Math.max(1, cpus().length - 1)): Promise<(TableResult & { kinds: string[] })[]> {
  const self = fileURLToPath(import.meta.url);
  const n = Math.min(workers, spec.games);
  return Promise.all(
    Array.from({ length: n }, (_, w) =>
      new Promise<(TableResult & { kinds: string[] })[]>((resolve, reject) => {
        const child = spawn(process.execPath, ["--import", "tsx", self, "--worker", JSON.stringify({ spec, w, n })], { stdio: ["ignore", "pipe", "inherit"] });
        let out = "";
        child.stdout.on("data", (d) => (out += d));
        child.on("exit", (code) => (code === 0 ? resolve(out.split("\n").filter(Boolean).map((l) => JSON.parse(l))) : reject(new Error(`worker ${w} exited ${code}`))));
      }),
    ),
  ).then((parts) => parts.flat().sort((a, b) => a.seed.localeCompare(b.seed, "en", { numeric: true })));
}

if (args.includes("--worker")) {
  const { spec, w, n } = JSON.parse(arg("worker", "{}")) as { spec: TournamentSpec; w: number; n: number };
  for (let i = w; i < spec.games; i += n) process.stdout.write(`${JSON.stringify(playOne(spec, i))}\n`);
} else if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [map, players] = arg("table", "embervale:4").split(":") as [string, string];
  const spec: TournamentSpec = {
    map,
    players: Number(players),
    seats: arg("seats", "captain").split(","),
    games: Number(arg("games", "100")),
    seed: arg("seed", "t17"),
    fog: arg("fog", "on") !== "off",
    diplomacy: arg("diplomacy", "on") !== "off",
    ...(arg("tweak", "") ? { tweak: JSON.parse(arg("tweak", "")) } : {}),
  };
  const t0 = Date.now();
  const results = await runTournament(spec, Number(arg("workers", String(Math.max(1, cpus().length - 1)))));
  if (arg("out", "")) writeFileSync(arg("out", ""), results.map((r) => JSON.stringify({ spec: { ...spec, games: undefined }, ...r })).join("\n") + "\n");
  if (!args.includes("--quiet")) console.log(summary(spec, results, Date.now() - t0));
}

/** Win rates by kind (and by personality), game length, the runaway measures and planning time, in plain lines. */
export function summary(spec: TournamentSpec, results: readonly (TableResult & { kinds: string[] })[], ms: number): string {
  const lines: string[] = [];
  const pct = (k: number, of: number) => `${((100 * k) / Math.max(1, of)).toFixed(1)}%`;
  const games = results.length;
  lines.push(`=== ${maps[spec.map]!.name}, ${spec.players} players, seats ${spec.seats.join(",")}, fog ${spec.fog ? "on" : "off"}: ${games} games in ${(ms / 1000).toFixed(0)}s ===`);
  const base = (k: string) => k.replace(/^sighted:/, "");
  const kinds = [...new Set(results.flatMap((r) => r.kinds))].sort();
  const wins = (k: string) => results.filter((r) => r.seats.some((s, i) => r.kinds[i] === k && s.won)).length;
  const seatsOf = (k: string) => results.reduce((a, r) => a + r.kinds.filter((x) => x === k).length, 0);
  lines.push(`Win rate per seat by kind (fair ${(100 / spec.players).toFixed(1)}%): ${kinds.map((k) => `${k} ${pct(wins(k), seatsOf(k))}`).join(", ")}`);
  const marshalSeats = results.reduce((a, r) => a + r.kinds.filter((k) => base(k).startsWith("marshal-")).length, 0);
  if (marshalSeats) lines.push(`All Marshal seats: ${pct(results.filter((r) => r.seats.some((s, i) => base(r.kinds[i]!).startsWith("marshal-") && s.won)).length, marshalSeats)} per seat`);
  const turns = results.map((r) => r.turns).sort((a, b) => a - b);
  lines.push(`Game length: avg ${(turns.reduce((a, b) => a + b, 0) / Math.max(1, games)).toFixed(1)}, median ${turns[Math.floor(games / 2)] ?? "-"}; ${pct(turns.filter((t) => t <= 40).length, games)} within 40; draws ${pct(results.filter((r) => r.winner === "draw").length, games)}`);
  const at10 = results.filter((r) => r.topShareTurn10 !== null);
  const won = results.filter((r) => r.winner !== "draw");
  const half = won.filter((r) => r.leaderHalfway);
  const past10 = won.filter((r) => r.leaderTurn10);
  lines.push(
    `Runaways: half the map after turn 10 ${pct(at10.filter((r) => r.topShareTurn10! > 0.5).length, at10.length)}; the halfway leader won ${pct(half.filter((r) => r.leaderHalfway === r.winner).length, half.length)}; comebacks ${pct(past10.filter((r) => r.leaderTurn10 !== r.winner).length, past10.length)}`,
  );
  const seatWins = Array.from({ length: spec.players }, (_, i) => results.filter((r) => r.seats[i]!.won).length);
  lines.push(`Win rate by seat: ${seatWins.map((w) => pct(w, games)).join(" / ")}`);
  const plan = new Map<string, number[]>();
  for (const r of results) for (const [k, v] of Object.entries(r.planMs)) plan.set(k, [...(plan.get(k) ?? []), ...v]);
  lines.push(
    `Planning per seat per turn: ${[...plan]
      .map(([k, v]) => {
        const s = [...v].sort((a, b) => a - b);
        return `${k} avg ${(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2)} ms, worst ${s[s.length - 1]!.toFixed(1)} ms`;
      })
      .join(" | ")}`,
  );
  return lines.join("\n");
}

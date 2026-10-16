/**
 * Session 17: tournaments, in parallel (one process per core), recording every seat's behaviours (simcore's seats.ts).
 *   pnpm tournament --table wyrmland:6 --seats marshal-turtle,captain,captain,captain,captain,captain --games 300
 *   pnpm tournament --table embervale:4 --seats marshal --games 300 --out results.jsonl
 * Seats are listed like `pnpm sim --mix` and rotated each game so nobody keeps a lucky seat. Kinds: captain, recruit,
 * marshal (personalities dealt from the game's seed), marshal-<personality>, expander (session 16's stand-in for a
 * person), and `sighted:<kind>` (that seat plans with fog off: a sharp person piecing everything together).
 * Options: --fog on|off|blackout, --diplomacy on|off, --seed prefix, --workers N (default: cores - 1), --out file (JSON lines),
 * --quiet (no summary).
 */
import { spawn } from "node:child_process";
import { cpus } from "node:os";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defaultRules, marshalData, type PersonalityId } from "@conquerra/content";
import { MarshalJudgement, Personality } from "@conquerra/content/personalities";
import { maps } from "@conquerra/content/maps";
import { dealPersonalities, makeCaptainBot, makeDelegateSeat, makeLeaderPathSeat, makeMarshalBot, makeRecruitBot, makeStewardSeat, personality, PERSONALITY_IDS, type Bot } from "@conquerra/bots";
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
  /** Session 32: "blackout" too (land never seen is hidden; the bots play from the land they know). */
  fog: boolean | "blackout";
  diplomacy: boolean;
  /** Trying a change (Part 2's A/B tests): merged into the shared judgement and into named personalities. */
  tweak?: { judgement?: Record<string, unknown>; personalities?: Record<string, Record<string, unknown>> };
  /** Trying a rule change (session 19's balance levers): merged into the game's rules. */
  rules?: Record<string, unknown>;
  /** Game settings beyond fog and diplomacy (switching a system off, for its cost in turns). */
  settings?: Record<string, unknown>;
  /** A capital layout to try for this many players (session 19's fair seats), instead of the map's own. */
  layout?: string[];
  /** Start bonuses to try (session 23): extra troops by capital spot, instead of the map's own. */
  bonus?: Record<string, number>;
  /**
   * The seat rule (session 25): harder spots go to bots first. The delegating seats ("delegate-...") stand in for a
   * person; every other seat is a bot. Left out: every spot at random, as before.
   */
  seatRule?: boolean;
}

/** `b` merged into `a`, objects deep (arrays and numbers replaced). */
function merge<T>(a: T, b: unknown): T {
  if (!b || typeof b !== "object" || Array.isArray(b) || typeof a !== "object" || a === null) return (b === undefined ? a : b) as T;
  const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
  // (A key set to undefined switches that part off.)
  for (const [k, v] of Object.entries(b)) if (v === undefined) delete out[k];
    else out[k] = merge(out[k], v);
  return out as T;
}

/**
 * Session 19's one-change seats, as `<kind>+<option>+...`:
 *  - `delegate-80+mtalk` (talks as a Marshal in the leaders' style), `+stays` (its Leader stays home), `+stewfirst`
 *    (its Steward's purchases first in the queue);
 *  - `marshal-<p>+<judgement change>` and `marshal+...` (personality dealt): `goes` (its Leader goes with its attacks),
 *    `armies` (troops and armies first in its queue), `style` (plays in the leaders' neutral style, keeping its
 *    personality's name for dealing).
 */
const SEAT_JUDGEMENT: Record<string, Record<string, unknown>> = {
  goes: { leaderGoes: true },
  armies: { queue: "armies" },
  nogoes: { leaderGoes: false },
  spending: { queue: "spending" },
  // Session 20: anticipate and counter; marches of several hops; and each switched off.
  counter: { counter: { minArmy: 4, strike: 0.5, block: 35 } },
  nocounter: { counter: undefined },
  counter2: { counter: { minArmy: 3, strike: 1.5, block: 60 } },
  march6: { march: 6 },
  march1: { march: 1 },
  // Session 20, Part 2's one-change tests for the Marshal.
  region: { region: { from: 0.33, pull: 1.5 } },
  anticipate: { anticipate: { guard: true, reach: true, fort: true } },
  antifort: { anticipate: { guard: false, reach: false, fort: true } },
  norealm: { realm: undefined },
  nofinish: { finish: undefined },
  nocounter2: { counter: undefined },
  noanticipate: { anticipate: undefined },
  lean: { crowdedLean: true },
  anticrowd: { anticipate: { guard: true, reach: true, fort: true, crowded: true } },
  // Session 20c, Part 2's one-change tests.
  pause1: { pause: { back: 1 } },
  pause2: { pause: { back: 2 } },
  pause9: { pause: { back: 9 } },
  home3f: { homeSweep: { troops: 3, first: true } },
  home3a: { homeSweep: { troops: 3, first: false } },
  home2f: { homeSweep: { troops: 2, first: true } },
  march20: { march: 20 },
  carry: { carryCaptured: true },
  lead15: { leaderGoesFrom: 15 },
  lead1: { leaderGoesFrom: 0 },
};

/** "+walls<N>": walls finished with up to N gold left; "+nowalls": never (session 20b). */
const wallsOpt = (opts: readonly string[]): number | undefined => {
  if (opts.includes("nowalls")) return 0;
  const o = opts.find((x) => /^walls\d+$/.test(x));
  return o ? Number(o.slice(5)) : undefined;
};

export function botFor(kind: string, tweak?: TournamentSpec["tweak"]): Bot {
  const [head, ...opts] = kind.replace(/^sighted:/, "").split("+");
  const k = head!;
  if (opts.length && /^delegate-\d+$/.test(k)) {
    const share = Number(k.slice(9)) / 100;
    return makeDelegateSeat(share, {
      id: kind.replace(/^sighted:/, ""),
      ...(opts.includes("mtalk") ? { diplomat: makeMarshalBot(marshalData.leaders.style).diplomat } : {}),
      ...(opts.includes("stays") ? { leaderStays: true } : {}),
      ...(opts.includes("stewfirst") ? { stewardFirst: true } : {}),
      ...(opts.includes("cleanup") ? { cleanUp: true } : {}),
      ...(opts.includes("report") ? { report: true } : {}),
      // Session 20b: "+walls39" (its Steward walls land worth holding with up to 39 gold left), "+nowalls" (never).
      ...(wallsOpt(opts) !== undefined ? { walls: wallsOpt(opts) } : {}),
      // Session 20's one-change tests: its leaders plan with a judgement change (see SEAT_JUDGEMENT).
      ...(opts.some((o) => SEAT_JUDGEMENT[o]) ? { judgement: opts.reduce((J, o) => (SEAT_JUDGEMENT[o] ? MarshalJudgement.parse(merge(J, SEAT_JUDGEMENT[o])) : J), marshalData.judgement) } : {}),
    });
  }
  if (opts.length && k.startsWith("marshal-") && PERSONALITY_IDS.includes(k.slice(8) as PersonalityId)) {
    const id = k.slice(8) as PersonalityId;
    if (opts.includes("lead")) return makeLeaderPathSeat(kind.replace(/^sighted:/, ""), makeMarshalBot(id).diplomat);
    if (opts.includes("leadn")) return makeLeaderPathSeat(kind.replace(/^sighted:/, ""), makeMarshalBot(marshalData.leaders.style).diplomat);
    if (opts.includes("leadc")) return makeLeaderPathSeat(kind.replace(/^sighted:/, ""));
    const hg = opts.find((o) => /^leadh\d+$/.test(o));
    if (hg) return makeLeaderPathSeat(kind.replace(/^sighted:/, ""), makeMarshalBot(id).diplomat, { homeGuard: Number(hg.slice(5)) });
    let J = MarshalJudgement.parse(merge(marshalData.judgement, tweak?.judgement));
    for (const o of opts) if (SEAT_JUDGEMENT[o]) J = MarshalJudgement.parse(merge(J, SEAT_JUDGEMENT[o]));
    // `guard-<steps>-<reach>-<turns>-<opening>`: a capital guard (session 19).
    const gd = opts.find((o) => o.startsWith("guard-"));
    if (gd) {
      const [steps, reach, turns, opening, crowded = 12] = gd.slice(6).split("-").map(Number) as [number, number, number, number, number?];
      J = { ...J, capitalGuard: { steps, reach, turns, opening, crowded } };
    }
    let P = opts.includes("style") ? { ...marshalData.leaders.style, id } : Personality.parse(merge(merge(personality(id), tweak?.personalities?.["*"]), tweak?.personalities?.[id]));
    // Session 20b: "+walls39" / "+nowalls" (its wall building), and "+realmcrowded" (it builds like the Steward on a crowded table too).
    const w = wallsOpt(opts);
    if (w !== undefined) P = { ...P, build: { ...P.build, walls: w } };
    if (opts.includes("realmcrowded")) J = { ...J, realmCrowded: true };
    return { ...makeMarshalBot(P as Personality, J), id: kind.replace(/^sighted:/, "") };
  }
  if (k === "captain") return makeCaptainBot();
  if (k === "recruit") return makeRecruitBot();
  // Session 16's stand-in for a person running away: the Captain with its caution turned down.
  if (k === "expander") return { ...makeCaptainBot({ chainMargin: 1, off: ["chokes", "breakthrough", "forts", "culture"] }), id: "expander" };
  // Session 18: a player who hands everything to their leaders ("delegate-80": the Leader on 80% of the income, the
  // Steward on the rest), and a Captain with the default Steward ("captain-steward-20").
  if (/^delegate-\d+$/.test(k)) return makeDelegateSeat(Number(k.slice(9)) / 100);
  if (/^captain-steward-\d+$/.test(k)) return makeStewardSeat(Number(k.slice(16)) / 100);
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
/**
 * Session 20c: a seat's leaders' personalities. A Marshal's carry its own; a delegating seat's are named in its kind
 * ("delegate-80+lead-conqueror+stew-turtle"); everyone else's are Neutral.
 */
export function stylesOf(kind: string): { leader?: string; steward?: string } | undefined {
  const [head, ...opts] = kind.replace(/^sighted:/, "").split("+");
  if (head!.startsWith("marshal-")) return { leader: head!.slice(8), steward: head!.slice(8) };
  const lead = opts.find((o) => o.startsWith("lead-"))?.slice(5);
  const stew = opts.find((o) => o.startsWith("stew-"))?.slice(5);
  return lead || stew ? { ...(lead ? { leader: lead } : {}), ...(stew ? { steward: stew } : {}) } : undefined;
}

export function seatsFor(spec: TournamentSpec, i: number, seed: string): string[] {
  const kinds = Array.from({ length: spec.players }, (_, k) => spec.seats[(k + i) % spec.seats.length]!);
  const isDealt = (k: string) => k.replace(/^sighted:/, "").split("+")[0] === "marshal";
  const marshals = kinds.flatMap((k, s) => (isDealt(k) ? [`s${s}`] : []));
  const dealt = dealPersonalities(seed, marshals);
  return kinds.map((k, s) => (isDealt(k) ? k.replace("marshal", `marshal-${dealt[`s${s}`]}`) : k));
}

export function playOne(spec: TournamentSpec, i: number): TableResult & { kinds: string[] } {
  const base = maps[spec.map]!;
  const own = base.capitalLayouts?.find((l) => l.players === spec.players);
  const map =
    spec.layout || spec.bonus
      ? { ...base, capitalLayouts: [...(base.capitalLayouts ?? []).filter((l) => l.players !== spec.players), { players: spec.players, slots: spec.layout ?? own!.slots, ...(spec.bonus ? { bonus: spec.bonus } : own?.bonus ? { bonus: own.bonus } : {}) }] }
      : base;
  const ctx: GameContext = { map, rules: spec.rules ? merge(defaultRules, spec.rules) : defaultRules };
  const seed = `${spec.seed}-${spec.map}-${spec.players}p-${i}`;
  const kinds = seatsFor(spec, i, seed);
  const bots = kinds.map((k) => botFor(k, spec.tweak));
  const sighted = kinds.flatMap((k, s) => (k.startsWith("sighted:") ? [s] : []));
  const people = spec.seatRule ? kinds.flatMap((k, s) => (k.replace(/^sighted:/, "").startsWith("delegate-") ? [s] : [])) : undefined;
  const r = playTable(ctx, seed, bots, { settings: { fog: spec.fog, diplomacy: spec.diplomacy, ...(spec.settings ?? {}) }, sighted, styles: kinds.map(stylesOf), ...(people ? { people, seatRule: "botsFirst" as const } : {}) });
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

/** Run as a program (not imported by another script, such as s17-runaway.ts with its own workers). */
const isMain = !!process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain && args.includes("--worker")) {
  // Session 20d's one-change tests: MARSHAL_PATCH='{"leaders":{"steward":{"plan":{...}}}}' is merged into the shared
  // settings for every seat (the workers inherit it).
  if (process.env.MARSHAL_PATCH) {
    const deep = (to: Record<string, unknown>, from: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(from)) v && typeof v === "object" && !Array.isArray(v) && to[k] && typeof to[k] === "object" ? deep(to[k] as Record<string, unknown>, v as Record<string, unknown>) : (to[k] = v);
    };
    deep(marshalData as unknown as Record<string, unknown>, JSON.parse(process.env.MARSHAL_PATCH) as Record<string, unknown>);
  }
  const { spec, w, n } = JSON.parse(arg("worker", "{}")) as { spec: TournamentSpec; w: number; n: number };
  for (let i = w; i < spec.games; i += n) process.stdout.write(`${JSON.stringify(playOne(spec, i))}\n`);
} else if (isMain) {
  const [map, players] = arg("table", "embervale:4").split(":") as [string, string];
  const spec: TournamentSpec = {
    map,
    players: Number(players),
    seats: arg("seats", "captain").split(","),
    games: Number(arg("games", "100")),
    seed: arg("seed", "t17"),
    fog: arg("fog", "on") === "blackout" ? "blackout" : arg("fog", "on") !== "off",
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
  lines.push(`=== ${maps[spec.map]!.name}, ${spec.players} players, seats ${spec.seats.join(",")}, fog ${spec.fog === "blackout" ? "blackout" : spec.fog ? "on" : "off"}: ${games} games in ${(ms / 1000).toFixed(0)}s ===`);
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

/**
 * Session 30: all-Marshal games in parallel (one process per core but one), for the random maps and blackout fog.
 *
 *   npx tsx apps/sim/scripts/s30-sims.ts <map>:<players> <games> [--seed s30] [--fog on|off|blackout] [--json out.json]
 *     <map>: an official map's id (embervale), or a random map's id ("random:80-crescent-quiet-heron")
 *   npx tsx apps/sim/scripts/s30-sims.ts --random <size>:<shape>:<n> [--start 0] <players> ...
 *     n random maps of that size and shape in a row (the seed words from `--start`), one game each. `--band 3.0`
 *     builds them at another exposure band (session 31).
 *   npx tsx apps/sim/scripts/s30-sims.ts --digest <players> <games> [--fog ...]
 *     every official map at that table size (or its smallest suggested one): a fingerprint of every game's result, to
 *     show a change left the twelve maps' games exactly as they were.
 *
 * Prints win rates by seat against fair, the average turns to a win, and (with --json) every game's summary.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { defaultRules, type MapDef } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { runGame, type GameSummary } from "@conquerra/simcore";
import { dealPersonalities, makeMarshalBot } from "@conquerra/bots";
import { createGame, type GameSettings } from "@conquerra/engine";
import { adjacency, allDistances, exposureOf } from "@conquerra/mapgen";

const self = fileURLToPath(import.meta.url);
const args = process.argv.slice(2);
const opt = (name: string, dflt: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : dflt;
};

/** A map by its id: official, or random (built by the map maker from its id, at this generator version). */
async function mapOf(id: string, band?: number): Promise<MapDef> {
  if (id.startsWith("random:")) {
    const { randomMap } = await import("@conquerra/mapgen");
    // (Session 31: `--band 3.0` builds at another exposure band, for the sim's experiments; the current version otherwise.)
    return randomMap(id.slice("random:".length), defaultRules, band ? { band } : {}).map;
  }
  const m = maps[id];
  if (!m) throw new Error(`Unknown map ${id}`);
  return m;
}

interface Job {
  map: string;
  players: number;
  game: number;
  seed: string;
  /** Session 31: a random map's exposure band, if not its version's. */
  band?: number;
}
interface Result {
  map: string;
  players: number;
  seed: string;
  winnerSeat: number | null;
  turns: number;
  endReason: GameSummary["endReason"];
  ms: number;
  /** For a random map: how many tries the map maker took, or why it gave up. */
  error?: string;
  /**
   * The winner's capital spot: its rank in the layout by the map maker's exposure check (0 the safest), and whether the
   * layout marks it harder (the seat rule's mark on a random map, or a start bonus on an official one).
   */
  spotRank?: number;
  harder?: boolean;
  /** How many spots that layout marks harder. */
  harderSpots?: number;
}

const fogArg = opt("fog", "on");
const settingsOf = (): Partial<GameSettings> => ({ luck: defaultRules.combat.luck, mode: "classic", fog: fogArg === "blackout" ? "blackout" : fogArg !== "off", fallen: true, spoils: true, fate: true, diplomacy: true, spies: true }) as Partial<GameSettings>;

async function play(job: Job): Promise<Result> {
  const t0 = Date.now();
  try {
    const map = await mapOf(job.map, job.band);
    const seats = Array.from({ length: job.players }, (_, i) => `s${i}`);
    const dealt = dealPersonalities(job.seed, seats);
    const bots = seats.map((s) => makeMarshalBot(dealt[s]!));
    const ctx = { map, rules: defaultRules };
    const g = runGame(ctx, job.seed, job.players, settingsOf(), false, bots);
    // Where each seat started (the same deal runGame made), and the winner's spot by exposure.
    const start = createGame(ctx, { gameId: `sim-${job.seed}`, seed: job.seed, players: seats.map((_, i) => ({ id: `p${i + 1}`, name: `Bot ${i + 1}` })), settings: settingsOf(), startBonus: true });
    const layout = map.capitalLayouts?.find((l) => l.players === job.players);
    let spot: Pick<Result, "spotRank" | "harder" | "harderSpots"> = {};
    if (layout && g.winnerSeat !== null) {
      const cap = start.players[g.winnerSeat]!.capital;
      const e = exposureOf(layout.slots, allDistances(map), adjacency(map)).exposure;
      const order = layout.slots.map((s, i) => ({ s, x: e[i]! })).sort((a, b) => a.x - b.x || (a.s < b.s ? -1 : 1));
      const marked = new Set([...(layout.harder ?? []), ...Object.keys(layout.bonus ?? {})]);
      spot = { spotRank: order.findIndex((o) => o.s === cap), harder: marked.has(cap), harderSpots: marked.size };
    }
    return { map: job.map, players: job.players, seed: job.seed, winnerSeat: g.winnerSeat, turns: g.turns, endReason: g.endReason, ms: Date.now() - t0, ...spot };
  } catch (e) {
    return { map: job.map, players: job.players, seed: job.seed, winnerSeat: null, turns: 0, endReason: null, ms: Date.now() - t0, error: e instanceof Error ? e.message.split("\n")[0]! : String(e) };
  }
}

// A worker: jobs as JSON on the command line's file, results as JSON lines.
if (args[0] === "--worker") {
  const jobs = JSON.parse(Buffer.from(args[1]!, "base64").toString("utf8")) as Job[];
  for (const j of jobs) process.stdout.write(`${JSON.stringify(await play(j))}\n`);
  process.exit(0);
}

async function runAll(jobs: Job[]): Promise<Result[]> {
  const n = Math.max(1, Math.min(jobs.length, availableParallelism() - 1));
  const shards: Job[][] = Array.from({ length: n }, () => []);
  jobs.forEach((j, i) => shards[i % n]!.push(j));
  const out: Result[] = [];
  let done = 0;
  await Promise.all(
    shards.map(
      (shard) =>
        new Promise<void>((resolve, reject) => {
          const child = spawn(process.execPath, ["--import", "tsx", self, "--worker", Buffer.from(JSON.stringify(shard)).toString("base64")], { stdio: ["ignore", "pipe", "inherit"] });
          let buf = "";
          child.stdout.on("data", (d: Buffer) => {
            buf += d.toString();
            let nl: number;
            while ((nl = buf.indexOf("\n")) >= 0) {
              const line = buf.slice(0, nl);
              buf = buf.slice(nl + 1);
              if (!line.trim()) continue;
              out.push(JSON.parse(line) as Result);
              if (++done % 25 === 0) process.stderr.write(`  ${done}/${jobs.length}\n`);
            }
          });
          child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`worker exited ${code}`))));
        }),
    ),
  );
  // In the jobs' order, whatever order the workers finished in.
  const order = new Map(jobs.map((j, i) => [`${j.map}|${j.seed}`, i]));
  return out.sort((a, b) => order.get(`${a.map}|${a.seed}`)! - order.get(`${b.map}|${b.seed}`)!);
}

function report(title: string, players: number, rs: Result[]) {
  const ok = rs.filter((r) => !r.error);
  const wins = Array.from({ length: players }, (_, i) => ok.filter((r) => r.winnerSeat === i).length);
  const fair = 100 / players;
  const pct = (k: number) => (100 * k) / Math.max(1, ok.length);
  const turns = ok.map((r) => r.turns).sort((a, b) => a - b);
  const avg = turns.reduce((a, b) => a + b, 0) / Math.max(1, turns.length);
  const worst = Math.max(...wins.map((w) => Math.abs(pct(w) - fair)));
  console.log(`\n=== ${title}: ${players} players, all Marshals, fog ${fogArg} ===`);
  console.log(`Games: ${ok.length} played, ${rs.length - ok.length} not (${[...new Set(rs.filter((r) => r.error).map((r) => r.error))].slice(0, 3).join("; ")})`);
  console.log(`Win rate by seat (fair ${fair.toFixed(1)}%): ${wins.map((w) => `${pct(w).toFixed(1)}%`).join(" / ")}; furthest from fair ${worst.toFixed(1)} points`);
  console.log(`Turns: avg ${avg.toFixed(1)}, median ${turns[Math.floor(turns.length / 2)] ?? 0}, min ${turns[0] ?? 0}, max ${turns.at(-1) ?? 0}; within 40: ${pct(ok.filter((r) => r.turns <= 40).length).toFixed(0)}%; ended: ${[...new Set(ok.map((r) => r.endReason))].map((e) => `${e} ${pct(ok.filter((r) => r.endReason === e).length).toFixed(0)}%`).join(", ")}`);
  console.log(`Time: ${(ok.reduce((a, r) => a + r.ms, 0) / 1000 / Math.max(1, ok.length)).toFixed(1)} s a game`);
  // The winner's spot by exposure rank (0 the safest): each rank's fair share is one in `players`.
  const ranked = ok.filter((r) => r.spotRank !== undefined);
  if (ranked.length) {
    const byRank = Array.from({ length: players }, (_, i) => ranked.filter((r) => r.spotRank === i).length);
    console.log(`Wins by the spot's exposure (safest first, fair ${fair.toFixed(1)}%): ${byRank.map((w) => `${((100 * w) / ranked.length).toFixed(1)}%`).join(" / ")}`);
    // Spots marked harder: how often one won, against their share of the seats.
    const withHarder = ranked.filter((r) => (r.harderSpots ?? 0) > 0);
    const seatsHarder = withHarder.reduce((a, r) => a + r.harderSpots!, 0) / Math.max(1, withHarder.length);
    if (withHarder.length)
      console.log(`Harder spots: marked on ${withHarder.length} of ${ranked.length} maps (${seatsHarder.toFixed(1)} a map); they won ${((100 * withHarder.filter((r) => r.harder).length) / withHarder.length).toFixed(1)}% of those games against a fair ${((100 * seatsHarder) / players).toFixed(1)}%`);
  }
  return { title, players, games: ok.length, failed: rs.length - ok.length, seats: wins.map(pct), worst, avgTurns: avg };
}

const seedPrefix = opt("seed", "s30");
const json = opt("json", "");

if (args[0] === "--digest") {
  const players = Number(args[1]);
  const games = Number(args[2]);
  const jobs: Job[] = [];
  for (const [id, m] of Object.entries(maps)) {
    const p = players <= m.maxPlayers && players >= m.minPlayers ? players : m.recommendedPlayers.min;
    for (let i = 0; i < games; i++) jobs.push({ map: id, players: p, game: i, seed: `${seedPrefix}-${id}-${p}p-${i}` });
  }
  const rs = await runAll(jobs);
  const lines = rs.map((r) => `${r.map} ${r.seed} ${r.winnerSeat} ${r.turns} ${r.endReason}`);
  for (const id of Object.keys(maps)) {
    const mine = rs.filter((r) => r.map === id);
    console.log(`${id.padEnd(16)} ${mine.length} games, avg ${(mine.reduce((a, r) => a + r.turns, 0) / mine.length).toFixed(1)} turns, digest ${createHash("sha256").update(lines.filter((l) => l.startsWith(`${id} `)).join("\n")).digest("hex").slice(0, 12)}`);
  }
  console.log(`All: ${createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16)}`);
  if (json) writeFileSync(json, JSON.stringify(rs, null, 1));
} else if (args[0] === "--random") {
  const [size, shape, n] = args[1]!.split(":") as [string, string, string];
  const players = Number(args[2]);
  const start = Number(opt("start", "0"));
  const { seedWords, RANDOM_SHAPE_IDS } = await import("@conquerra/mapgen");
  // "all": the five shapes in turn.
  const shapeOf = (i: number) => (shape === "all" ? RANDOM_SHAPE_IDS[i % RANDOM_SHAPE_IDS.length]! : shape);
  const band = opt("band", "");
  const jobs: Job[] = Array.from({ length: Number(n) }, (_, i) => ({ map: `random:${size}-${shapeOf(i)}-${seedWords(start + i)}`, players, game: i, seed: `${seedPrefix}-${size}-${shape}-${i}`, ...(band ? { band: Number(band) } : {}) }));
  const rs = await runAll(jobs);
  const r = report(`${n} random maps, ${size} territories, ${shape}`, players, rs);
  if (shape === "all")
    for (const sh of RANDOM_SHAPE_IDS) {
      const mine = rs.filter((x) => x.map.includes(`-${sh}-`) && !x.error);
      console.log(`  ${sh}: ${mine.length} played, avg ${(mine.reduce((a, x) => a + x.turns, 0) / Math.max(1, mine.length)).toFixed(1)} turns`);
    }
  if (json) writeFileSync(json, JSON.stringify({ summary: r, games: rs }, null, 1));
} else {
  const [map, p] = args[0]!.split(":") as [string, string];
  const players = Number(p);
  const games = Number(args[1] ?? 100);
  const jobs: Job[] = Array.from({ length: games }, (_, i) => ({ map, players, game: i, seed: `${seedPrefix}-${map}-${players}p-${i}` }));
  const rs = await runAll(jobs);
  const r = report(map, players, rs);
  if (json) writeFileSync(json, JSON.stringify({ summary: r, games: rs }, null, 1));
}

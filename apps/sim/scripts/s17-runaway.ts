/**
 * Session 17, Part 3: stopping a runaway (Nate's game). Wyrmland, 6 players. Seat 1 is a stand-in for a person running
 * away; the other five are Marshals (personalities dealt from the seed) or Captains. Each turn it records:
 *  - whether the stand-in is truly a runaway (the Captain's rule on the real land: 40% of the map, or a quarter and
 *    1.75 times anyone else);
 *  - how many of the others name it a runaway from their own view (a Captain: its priority 8 on what it sees and
 *    remembers; a Marshal: its own rule on its estimates and memory), and how many name someone else when nobody truly is;
 *  - joint wars aimed at it, and the Fallen's world events on it.
 *   npx tsx apps/sim/scripts/s17-runaway.ts [games=300] [stand-in=sighted:marshal-blitzer] [others=marshal|captain] [rotate]
 * TWEAK='<json>' tries a change to the Marshals (as `pnpm tournament --tweak`).
 * Stand-ins: `expander` (session 16's), any tournament seat kind; `sighted:` plans with fog off (a sharp person piecing
 * everything together). `rotate`: the stand-in takes every seat in turn.
 */
import { cpus } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { landEstimates, runawayLeader, type MarshalBot } from "@conquerra/bots";
import { indexMap, type GameContext, type PlayerView } from "@conquerra/engine";
import { playTable } from "@conquerra/simcore";
import { botFor, seatsFor, type TournamentSpec } from "../src/tournament";

const ctx: GameContext = { map: maps.wyrmland!, rules: defaultRules };
const idx = indexMap(ctx.map);

interface Row {
  won: boolean;
  turns: number;
  trueAt: number | null;
  seenAt: number | null;
  trueTurns: number;
  seeing: number;
  looking: number;
  /** Turns nobody truly ran away, and seat-turns on those that named someone anyway (false alarms). */
  calmLooking: number;
  falseAlarms: number;
  wars: number[];
  fallenOnIt: number;
  fallenOnOthers: number;
  at12: number;
  peak: number;
}

/** Who a Captain thinks is running away, from its own view (exactly its priority 8). */
function captainSees(view: PlayerView): string | null {
  const known = new Map<string, number>();
  let mine = 0;
  for (const t of idx.ids) {
    const v = view.territories[t]!;
    const o = v.detail === "full" ? v.owner : (v.lastSeen?.owner ?? null);
    if (o === view.me.id) mine++;
    else if (o) known.set(o, (known.get(o) ?? 0) + 1);
  }
  const alive = view.players.filter((p) => p.eliminatedTurn === null);
  return runawayLeader(landEstimates(known, alive.map((p) => p.id)), mine, idx.ids.length, alive.length);
}

function playOne(standIn: string, others: string, i: number, rotate: boolean): Row {
  const spec: TournamentSpec = { map: "wyrmland", players: 6, seats: [standIn, others, others, others, others, others], games: 0, seed: "s17rw", fog: true, diplomacy: true };
  const seed = `s17rw-${i}`;
  const kinds = seatsFor(spec, rotate ? i : 0, seed);
  const exSeat = kinds.indexOf(standIn);
  const ex = `p${exSeat + 1}`;
  // TWEAK (JSON, as `pnpm tournament --tweak`): try a change to the Marshals' judgement or personalities.
  const bots = kinds.map((k) => botFor(k, process.env.TWEAK ? JSON.parse(process.env.TWEAK) : undefined));
  const row: Row = { won: false, turns: 0, trueAt: null, seenAt: null, trueTurns: 0, seeing: 0, looking: 0, calmLooking: 0, falseAlarms: 0, wars: [], fallenOnIt: 0, fallenOnOthers: 0, at12: 0, peak: 0 };
  let truth: string | null = null;
  let views: ReadonlyMap<string, PlayerView> = new Map();
  const r = playTable(ctx, seed, bots, {
    settings: { fog: true },
    sighted: standIn.startsWith("sighted:") ? [exSeat] : [],
    onTurn: (s, v) => {
      views = v;
      const land = new Map<string, number>();
      for (const t of idx.ids) {
        const o = s.territories[t]!.owner;
        if (o) land.set(o, (land.get(o) ?? 0) + 1);
      }
      const alive = s.players.filter((p) => p.eliminatedTurn === null);
      truth = runawayLeader(landEstimates(land, alive.map((p) => p.id)), 0, idx.ids.length, alive.length);
      const share = (land.get(ex) ?? 0) / idx.ids.length;
      row.peak = Math.max(row.peak, share);
      if (s.turn === 12) row.at12 = share;
      if (truth === ex) (row.trueTurns++, (row.trueAt ??= s.turn));
    },
    onEvents: (before, events) => {
      // Who each living opponent named this turn (Marshals: their memory after planning; Captains: their rule).
      for (const [seat, p] of before.players.entries()) {
        if (p.id === ex || p.eliminatedTurn !== null) continue;
        const b = bots[seat] as Partial<MarshalBot>;
        let named: string | null;
        if (b.memoryOf) {
          const m = b.memoryOf(`sim-${seed}`, p.id);
          named = m?.runaway && m.runaway.named === before.turn ? m.runaway.player : null;
        } else named = captainSees(views.get(p.id)!);
        if (truth === ex) {
          row.looking++;
          if (named === ex) (row.seeing++, (row.seenAt ??= before.turn));
        } else if (!truth) {
          row.calmLooking++;
          if (named) row.falseAlarms++;
        }
      }
      for (const e of events) {
        if (e.type === "dealStarted" && e.deal.terms.kind === "war" && e.deal.terms.target === ex) row.wars.push(before.turn);
        if (e.type === "worldEvent") e.against === ex ? row.fallenOnIt++ : row.fallenOnOthers++;
      }
    },
  });
  row.won = r.winner === ex;
  row.turns = r.turns;
  return row;
}

const args = process.argv.slice(2);
if (args[0] === "--worker") {
  const { standIn, others, w, n, games, rotate } = JSON.parse(args[1]!) as { standIn: string; others: string; w: number; n: number; games: number; rotate: boolean };
  for (let i = w; i < games; i += n) process.stdout.write(`${JSON.stringify(playOne(standIn, others, i, rotate))}\n`);
} else {
  const games = Number(args[0] ?? 300);
  const standIn = args[1] ?? "sighted:marshal-blitzer";
  const others = args[2] ?? "marshal";
  const rotate = args.includes("rotate");
  const n = Math.max(1, Math.min(games, cpus().length - 1));
  const self = fileURLToPath(import.meta.url);
  const rows = (
    await Promise.all(
      Array.from({ length: n }, (_, w) =>
        new Promise<Row[]>((resolve, reject) => {
          const c = spawn(process.execPath, ["--import", "tsx", self, "--worker", JSON.stringify({ standIn, others, w, n, games, rotate })], { stdio: ["ignore", "pipe", "inherit"] });
          let out = "";
          c.stdout.on("data", (d) => (out += d));
          c.on("exit", (code) => (code === 0 ? resolve(out.split("\n").filter(Boolean).map((l) => JSON.parse(l))) : reject(new Error(`worker ${w}: ${code}`))));
        }),
      ),
    )
  ).flat();
  const avg = (f: (r: Row) => number, of = rows) => (of.length ? of.reduce((a, r) => a + f(r), 0) / of.length : 0);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const ran = rows.filter((r) => r.trueAt !== null);
  const seen = ran.filter((r) => r.seenAt !== null);
  console.log(`=== Wyrmland, 6 players: ${standIn} (seat 1${rotate ? ", rotated" : ""}) vs 5 ${others}s, ${games} games ===`);
  console.log(`Stand-in wins ${pct(avg((r) => +r.won))} (fair 17%); games last ${avg((r) => r.turns).toFixed(1)} turns; its land at turn 12 ${pct(avg((r) => r.at12))}, at its peak ${pct(avg((r) => r.peak))}`);
  console.log(`It became a true runaway in ${pct(ran.length / games)} of games, first on turn ${avg((r) => r.trueAt!, ran).toFixed(1)}`);
  console.log(
    `While it was: the others named it in ${pct(ran.reduce((a, r) => a + r.seeing, 0) / Math.max(1, ran.reduce((a, r) => a + r.looking, 0)))} of their turns; someone named it in ${pct(seen.length / Math.max(1, ran.length))} of those games, ${avg((r) => r.seenAt! - r.trueAt!, seen).toFixed(1)} turns after it truly was one`,
  );
  console.log(`False alarms (nobody truly running away, a seat named someone): ${pct(rows.reduce((a, r) => a + r.falseAlarms, 0) / Math.max(1, rows.reduce((a, r) => a + r.calmLooking, 0)))} of seat-turns`);
  console.log(`Joint wars against it: ${avg((r) => r.wars.length).toFixed(2)} a game (in ${pct(avg((r) => +(r.wars.length > 0)))} of games; first on turn ${avg((r) => r.wars[0]!, rows.filter((r) => r.wars.length)).toFixed(1)})`);
  console.log(`The Fallen's world events on it: ${avg((r) => r.fallenOnIt).toFixed(2)} a game (on everyone else ${avg((r) => r.fallenOnOthers).toFixed(2)})`);
}

/**
 * Session 20c, Part 2: how the leaders and Marshals move in whole games, measured per seat kind.
 *   npx tsx apps/sim/scripts/s20c-play.ts <games> <map:players> <seats: delegate-80,marshal> [label]
 * Seats are rotated each game (one of each listed seat, the last fills the table). Fog and diplomacy on. Per seat kind:
 *  - win rate (fair share);
 *  - land lost a turn, and of the territories it lost, the share it held again by the end of the next turn;
 *  - how far its spare troops stand from the nearest rival army (a rival territory with 3 or more troops), in steps,
 *    weighted by troops, as each turn starts;
 *  - its Leader on the main chain: of the turns it attacked, the share where its own Leader went with its biggest
 *    attack or that attack's chain on;
 *  - orders a turn.
 * (The measures read the true board; the bots never do.)
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { playTable } from "@conquerra/simcore";
import { indexMap, type GameContext, type GameState, type Order, type PlayerId, type TerritoryId } from "@conquerra/engine";
import { botFor, seatsFor, stylesOf, type TournamentSpec } from "../src/tournament";

const args = process.argv.slice(2);
const self = fileURLToPath(import.meta.url);
type Job = { map: string; players: number; seats: string[]; i: number; seed: string };
interface Row { kind: string; won: boolean; turns: number; lost: number; back: number; dist: number; weight: number; attackTurns: number; leaderMain: number; orders: number; planned: number; hops: number; retreats: number; fronts: number; gold: { troops: number; buildings: number; culture: number; specialists: number; spies: number }; lateTurns: number; lateMain: number }

function work(job: Job): Row[] {
  const ctx: GameContext = { map: maps[job.map]!, rules: defaultRules };
  const idx = indexMap(ctx.map);
  const spec: TournamentSpec = { map: job.map, players: job.players, seats: job.seats, games: 0, seed: job.seed, fog: true, diplomacy: true };
  const seed = `${spec.seed}-${spec.map}-${spec.players}p-${job.i}`;
  const kinds = seatsFor(spec, job.i, seed);
  const ids = kinds.map((_, k) => `p${k + 1}` as PlayerId);
  const rows: Row[] = kinds.map((k) => ({ kind: k.replace(/^marshal-[a-z]+/, "marshal"), won: false, turns: 0, lost: 0, back: 0, dist: 0, weight: 0, attackTurns: 0, leaderMain: 0, orders: 0, planned: 0, hops: 0, retreats: 0, fronts: 0, gold: { troops: 0, buildings: 0, culture: 0, specialists: 0, spies: 0 }, lateTurns: 0, lateMain: 0 }));
  let state: GameState | null = null;
  const bots = kinds.map((k, s) => {
    const b = botFor(k);
    return {
      ...b,
      plan: (c: GameContext, v: Parameters<typeof b.plan>[1], l?: Parameters<typeof b.plan>[2]) => {
        const o = b.plan(c, v, l);
        const r = rows[s]!;
        r.orders += o.length;
        r.planned++;
        // How it chains: hops on from an attack ("All" moves on), and pulling back.
        r.hops += o.filter((x) => x.kind === "move" && x.troops === "all").length;
        r.retreats += o.filter((x) => x.kind === "retreat").length;
        // The main chain: its biggest attack (by the army sent; "all" counts the whole stack) and the hops on from it.
        const moves = o.filter((x): x is Extract<Order, { kind: "move" }> => x.kind === "move");
        const troopsAt = (t: TerritoryId) => { const tv = v.territories[t]; return tv && tv.detail === "full" ? tv.troops : 0; };
        const attacks = moves.filter((m) => { const tv = v.territories[m.to]; return tv && (tv.detail === "full" ? tv.owner !== v.me.id : true); });
        if (attacks.length) {
          r.attackTurns++;
          const size = (m: Extract<Order, { kind: "move" }>) => (typeof m.troops === "number" ? m.troops : troopsAt(m.from));
          const main = [...attacks].sort((a, b2) => size(b2) - size(a))[0]!;
          const chain = new Set([main.id]);
          let head = main.to;
          for (const m of moves) if (m.from === head && m.troops === "all") (chain.add(m.id), (head = m.to));
          // (The Leader may also arrive with the march into the territory the main attack sets out from.)
          const rides = moves.some((m) => m.withLeader && (chain.has(m.id) || m.to === main.from));
          if (rides) r.leaderMain++;
          // (After the opening, when a Marshal's Leader leads the main effort.)
          if (v.turn >= 15) (r.lateTurns++, rides && r.lateMain++);
        }
        return o;
      },
    };
  });
  const lostAt = new Map<PlayerId, { t: TerritoryId; turn: number }[]>();
  const r = playTable(ctx, seed, bots, {
    settings: { fog: true, diplomacy: true },
    // (Each seat's leaders' personalities: a Marshal's carry its own; "+lead-conqueror" on a delegating seat.)
    styles: kinds.map(stylesOf),
    onTurn: (s) => {
      state = s;
      // Retaken by the end of the next turn.
      for (const [p, list] of lostAt) {
        const keep: { t: TerritoryId; turn: number }[] = [];
        for (const x of list) {
          if (s.territories[x.t]!.owner === p) rows[ids.indexOf(p)]!.back++;
          else if (s.turn - x.turn < 2) keep.push(x);
        }
        lostAt.set(p, keep);
      }
      // Spare troops' distance from the nearest rival army.
      for (const [k, p] of ids.entries()) {
        if (s.players[k]!.eliminatedTurn !== null) continue;
        const d = new Map<TerritoryId, number>();
        const q: TerritoryId[] = [];
        for (const t of idx.ids) {
          const x = s.territories[t]!;
          if (x.owner && x.owner !== p && x.troops >= 3) (d.set(t, 0), q.push(t));
        }
        for (let h = 0; h < q.length; h++) for (const nb of idx.neighbors.get(q[h]!)!) if (!d.has(nb)) (d.set(nb, d.get(q[h]!)! + 1), q.push(nb));
        for (const t of idx.ids) {
          const x = s.territories[t]!;
          if (x.owner !== p || x.troops <= 1 || !d.has(t)) continue;
          rows[k]!.dist += (x.troops - 1) * d.get(t)!;
          rows[k]!.weight += x.troops - 1;
        }
      }
    },
    onEvents: (before, events) => {
      for (const e of events)
        if (e.type === "battle" && e.captured && e.defender && ids.includes(e.defender)) {
          rows[ids.indexOf(e.defender)]!.lost++;
          (lostAt.get(e.defender) ?? lostAt.set(e.defender, []).get(e.defender)!).push({ t: e.to, turn: before.turn });
        }
    },
  });
  void state;
  for (const [k, row] of rows.entries()) {
    row.won = r.winner === ids[k];
    row.turns = r.seats[k]!.out ?? r.turns;
    row.fronts = r.seats[k]!.frontsPerTurn;
    row.gold = r.seats[k]!.gold;
  }
  return rows;
}

const pool = (jobs: Job[], workers = 19): Promise<Row[][]> => {
  const n = Math.min(workers, jobs.length);
  return Promise.all(
    Array.from({ length: n }, (_, w) =>
      new Promise<Row[][]>((resolve, reject) => {
        const child = spawn(process.execPath, ["--import", "tsx", self, "--worker", JSON.stringify(jobs.filter((_, i) => i % n === w))], { stdio: ["ignore", "pipe", "inherit"] });
        let out = "";
        child.stdout.on("data", (d) => (out += d));
        child.on("exit", (code) => (code === 0 ? resolve(out.split("\\n").join("\n").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row[])) : reject(new Error(`worker ${w} exited ${code}`))));
      }),
    ),
  ).then((p) => p.flat());
};

if (args[0] === "--worker") {
  for (const j of JSON.parse(args[1]!) as Job[]) process.stdout.write(`${JSON.stringify(work(j))}\n`);
} else {
  const [games = "300", table = "wyrmland:6", seatsArg = "delegate-80,marshal", label = "today"] = args;
  const [map, n] = table.split(":") as [string, string];
  const players = Number(n);
  const head = seatsArg.split(",");
  const seats = [...head.slice(0, -1), ...Array(players - head.length + 1).fill(head[head.length - 1])];
  const t0 = Date.now();
  const res = await pool(Array.from({ length: Number(games) }, (_, i) => ({ map, players, seats, i, seed: "s20cP" })));
  const all = res.flat();
  const f = (x: number, d = 1) => x.toFixed(d);
  const parts = [...new Set(all.map((r) => r.kind))].map((k) => {
    const rs = all.filter((r) => r.kind === k);
    const sum = (g: (r: Row) => number) => rs.reduce((a, r) => a + g(r), 0);
    return `${k}: won ${f((100 * rs.filter((r) => r.won).length) / rs.length)}% (${f((rs.filter((r) => r.won).length / rs.length) * players, 2)}x), lost ${f(sum((r) => r.lost) / sum((r) => r.planned), 2)}/turn, back within a turn ${f((100 * sum((r) => r.back)) / Math.max(1, sum((r) => r.lost)))}%, spare troops ${f(sum((r) => r.dist) / Math.max(1, sum((r) => r.weight)), 2)} steps from a rival army, Leader on the main chain ${f((100 * sum((r) => r.leaderMain)) / Math.max(1, sum((r) => r.attackTurns)))}% of attack turns (${f((100 * sum((r) => r.lateMain)) / Math.max(1, sum((r) => r.lateTurns)))}% from turn 15), orders ${f(sum((r) => r.orders) / sum((r) => r.planned))}/turn${process.env.STYLE ? `, hops ${f(sum((r) => r.hops) / sum((r) => r.planned), 2)}/turn, retreats ${f(sum((r) => r.retreats) / sum((r) => r.planned), 2)}/turn, rivals fought ${f(sum((r) => r.fronts) / rs.length, 2)}/turn, spent: buildings ${f(sum((r) => r.gold.buildings) / rs.length, 0)}, culture ${f(sum((r) => r.gold.culture) / rs.length, 0)}, troops ${f(sum((r) => r.gold.troops) / rs.length, 0)} gold a game` : ""}`;
  });
  console.log(`${label.padEnd(10)} ${table.padEnd(12)} ${res.length} games | ${parts.join(" | ")} | ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

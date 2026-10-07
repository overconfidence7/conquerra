/**
 * Session 20, Part 1: a delegating seat against Marshals, measured turn by turn.
 *   npx tsx apps/sim/scripts/s20-leaders.ts <games> <tables: wyrmland:6,rootholm:9> [seat kind, default delegate-80] [rivals, default marshal]
 * Prints its win rate (fair share), land lost a turn, and for its military leaders:
 *  - gold left unspent in their purses at the end of each turn's orders (average, and the share of turns with more than
 *    one troop's worth left);
 *  - orders a turn its Leader on Run the military wrote, against a Marshal planning the same seat from the same view
 *    with the same gold (the leaders' neutral style), counting army orders (moves, recruits, retreats, hires).
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defaultRules, marshalData } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { freshMemory, planMarshal, type Bot } from "@conquerra/bots";
import { playTable } from "@conquerra/simcore";
import { type GameContext, type GameState, type Order, type PlayerId } from "@conquerra/engine";
import { botFor, seatsFor, type TournamentSpec } from "../src/tournament";

interface Line {
  won: boolean;
  seatKind: string;
  /** Per turn of the measured seat: unspent military purse gold; its Leader's army orders; a Marshal's on the same view. */
  unspent: number[];
  leaderOrders: number[];
  marshalOrders: number[];
  lost: number[];
  turns: number;
}

const ARMY = new Set(["move", "recruit", "retreat", "hire", "advance"]);
const self = fileURLToPath(import.meta.url);
const args = process.argv.slice(2);

function one(map: string, players: number, seat: string, rivals: string, i: number): Line[] {
  const ctx: GameContext = { map: maps[map]!, rules: defaultRules };
  const spec: TournamentSpec = { map, players, seats: [seat, ...Array(players - 1).fill(rivals)], games: 0, seed: "s20L", fog: true, diplomacy: true };
  const seed = `${spec.seed}-${map}-${players}p-${i}`;
  const kinds = seatsFor(spec, i, seed);
  const measured = kinds.flatMap((k, s) => (k === seat ? [`p${s + 1}`] : []));
  const lines = new Map<PlayerId, Line>(measured.map((p) => [p, { won: false, seatKind: seat, unspent: [], leaderOrders: [], marshalOrders: [], lost: [], turns: 0 }]));
  const bots: Bot[] = kinds.map((k, s) => {
    const b = botFor(k);
    if (!measured.includes(`p${s + 1}`)) return b;
    return {
      ...b,
      plan(c, view, lastTurn) {
        const orders = b.plan(c, view, lastTurn);
        const line = lines.get(view.me.id)!;
        line.leaderOrders.push(orders.filter((o) => o.general === view.me.id && ARMY.has(o.kind)).length);
        const leader = view.me.leaders.find((l) => l.kind === "leader" && l.of === view.me.id);
        const gold = leader?.purse ?? 0;
        const m = planMarshal({ ctx: c, view: { ...view, me: { ...view.me, gold } }, personality: marshalData.leaders.style, judgement: marshalData.judgement, memory: freshMemory(), ...(lastTurn ? { lastTurn } : {}) });
        line.marshalOrders.push(m.orders.filter((o: Order) => ARMY.has(o.kind)).length);
        return orders;
      },
    };
  });
  let before: GameState | null = null;
  const r = playTable(ctx, seed, bots, {
    settings: { fog: true, diplomacy: true },
    onTurn: (s) => void (before = s),
    onEvents: (st, events) => {
      for (const [pid, line] of lines) {
        const p = st.players.find((x) => x.id === pid)!;
        if (p.eliminatedTurn !== null) continue;
        const military = p.leaders.filter((l) => l.kind === "leader" && l.command);
        if (!military.length) continue;
        const keys = new Set(military.map((l) => l.of));
        let spent = 0;
        for (const e of events) {
          if (!("player" in e) || e.player !== pid || !("by" in e) || !e.by || e.by.kind !== "leader" || !keys.has(e.by.of)) continue;
          if ("cost" in e && typeof e.cost === "number") spent += e.cost;
        }
        line.unspent.push(military.reduce((a, l) => a + l.purse, 0) - spent);
        line.lost.push(events.filter((e) => e.type === "battle" && e.captured && e.defender === pid).length);
      }
    },
  });
  void before;
  for (const [pid, line] of lines) {
    line.won = r.winner === pid;
    line.turns = r.turns;
  }
  return [...lines.values()];
}

if (args[0] === "--worker") {
  const jobs = JSON.parse(args[1]!) as [string, number, string, string, number][];
  for (const j of jobs) for (const l of one(...j)) process.stdout.write(`${JSON.stringify(l)}\n`);
} else {
  const [games = "300", tables = "wyrmland:6", seat = "delegate-80", rivals = "marshal"] = args;
  for (const t of tables.split(",")) {
    const [map, n] = t.split(":") as [string, string];
    const jobs = Array.from({ length: Number(games) }, (_, i) => [map, Number(n), seat, rivals, i]);
    const W = 19;
    const t0 = Date.now();
    const res = (
      await Promise.all(
        Array.from({ length: W }, (_, w) =>
          new Promise<Line[]>((resolve, reject) => {
            const child = spawn(process.execPath, ["--import", "tsx", self, "--worker", JSON.stringify(jobs.filter((_, i) => i % W === w))], { stdio: ["ignore", "pipe", "inherit"] });
            let out = "";
            child.stdout.on("data", (d) => (out += d));
            child.on("exit", (code) => (code === 0 ? resolve(out.split("\n").filter(Boolean).map((l) => JSON.parse(l) as Line)) : reject(new Error(`worker ${w} exited ${code}`))));
          }),
        ),
      )
    ).flat();
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    const all = (f: (l: Line) => number[]) => res.flatMap(f);
    const troop = defaultRules.troops.cost;
    const unspent = all((l) => l.unspent);
    const lo = all((l) => l.leaderOrders), mo = all((l) => l.marshalOrders);
    console.log(
      `${seat} vs ${rivals} on ${t}: ${res.length} seats in ${((Date.now() - t0) / 1000).toFixed(0)}s | wins ${((100 * res.filter((l) => l.won).length) / res.length).toFixed(1)}% (fair ${(100 / Number(n)).toFixed(1)}%) | land lost a turn ${avg(all((l) => l.lost)).toFixed(2)} | unspent purse ${avg(unspent).toFixed(1)} gold a turn, over one troop ${((100 * unspent.filter((x) => x > troop).length) / Math.max(1, unspent.length)).toFixed(1)}% of turns | orders a turn: Leader ${avg(lo).toFixed(1)}, Marshal same seat ${avg(mo).toFixed(1)}; Leader ≥ Marshal on ${((100 * lo.filter((x, i) => x >= mo[i]!).length) / Math.max(1, lo.length)).toFixed(0)}% of turns | median length ${[...res.map((l) => l.turns)].sort((a, b) => a - b)[Math.floor(res.length / 2)]}`,
    );
  }
}

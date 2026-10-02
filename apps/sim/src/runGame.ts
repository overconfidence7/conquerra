import { performance } from "node:perf_hooks";
import { recruitBot, type Bot } from "@conquerra/bots";
import {
  createGame,
  indexMap,
  resolveTurn,
  viewFor,
  type GameContext,
  type GameSettings,
  type GameState,
  type OrdersByPlayer,
  type StepEvent,
} from "@conquerra/engine";

export interface GameSummary {
  seed: string;
  winner: string | "draw";
  winnerSeat: number | null;
  endReason: GameState["endReason"];
  turns: number;
  battles: number;
  captures: number;
  orders: number;
  fizzles: number;
  initiatives: number;
  leadersKilled: number;
  hires: number;
  invests: number;
  presets: number;
  /** First turn after which the eventual winner led in territory count for the rest of the game. */
  decidedTurn: number | null;
  /** How many times the territory leader changed hands. */
  leadChanges: number;
  /** CPU time per turn in milliseconds: the engine resolving, and the bots planning (all seats). */
  resolveMs: number[];
  planMs: number[];
  log?: StepEvent[][];
}

export function runGame(ctx: GameContext, seed: string, playerCount: number, settings: Partial<GameSettings>, keepLog = false, bot: Bot = recruitBot): GameSummary {
  const players = Array.from({ length: playerCount }, (_, i) => ({ id: `p${i + 1}`, name: `Bot ${i + 1}` }));
  let s = createGame(ctx, { gameId: `sim-${seed}`, seed, players, settings });
  const idx = indexMap(ctx.map);
  const sum: GameSummary = {
    seed, winner: "draw", winnerSeat: null, endReason: null, turns: 0, battles: 0, captures: 0, orders: 0, fizzles: 0,
    initiatives: 0, leadersKilled: 0, hires: 0, invests: 0, presets: 0, decidedTurn: null, leadChanges: 0, resolveMs: [], planMs: [],
  };
  const leaders: (string | null)[] = [];
  const log: StepEvent[][] = [];
  while (!s.winner) {
    const orders: OrdersByPlayer = {};
    const p0 = performance.now();
    for (const p of s.players)
      if (p.eliminatedTurn === null) {
        const o = bot.plan(ctx, viewFor(ctx, s, p.id));
        orders[p.id] = o;
        sum.orders += o.length;
        sum.presets += o.filter((x) => x.preset).length;
      }
    const p1 = performance.now();
    const r = resolveTurn(ctx, s, orders);
    const p2 = performance.now();
    sum.planMs.push(p1 - p0);
    sum.resolveMs.push(p2 - p1);
    s = r.state;
    if (keepLog) log.push(r.events);
    for (const e of r.events) {
      if (e.type === "battle") (sum.battles++, e.captured && sum.captures++);
      if (e.type === "fizzled") sum.fizzles++;
      if (e.type === "initiative") sum.initiatives++;
      if (e.type === "leaderKilled") sum.leadersKilled++;
      if (e.type === "hired") sum.hires++;
      if (e.type === "invested") sum.invests++;
    }
    const counts = new Map<string, number>();
    for (const id of idx.ids) {
      const o = s.territories[id]!.owner;
      if (o) counts.set(o, (counts.get(o) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? null;
    if (leaders.length && leaders[leaders.length - 1] !== top) sum.leadChanges++;
    leaders.push(top);
  }
  sum.winner = s.winner;
  sum.endReason = s.endReason;
  sum.turns = s.turn;
  sum.winnerSeat = s.winner === "draw" ? null : players.findIndex((p) => p.id === s.winner);
  if (s.winner !== "draw") {
    let t = leaders.length;
    while (t > 0 && leaders[t - 1] === s.winner) t--;
    sum.decidedTurn = t + 1;
  }
  if (keepLog) sum.log = log;
  return sum;
}

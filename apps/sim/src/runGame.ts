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
  /** Which bot (by id, e.g. "captain") won, for mixed tables. */
  winnerBot: string | null;
  endReason: GameState["endReason"];
  turns: number;
  battles: number;
  captures: number;
  /** Attacks with at least 8 times the defenders' troops, and how many of them failed to capture. */
  lopsided: number;
  lopsidedFailed: number;
  /** Battles and captures by the kind of border the attack crossed (two-step cavalry moves count as normal). */
  byBorder: Record<string, { battles: number; captures: number }>;
  orders: number;
  fizzles: number;
  /** Moves and attacks launched from land the same army moved into or captured earlier that turn (chained hops). */
  hops: number;
  hopCaptures: number;
  initiatives: number;
  leadersKilled: number;
  hires: number;
  invests: number;
  presets: number;
  /** First turn after which the eventual winner led in territory count for the rest of the game. */
  decidedTurn: number | null;
  /** How many times the territory leader changed hands. */
  leadChanges: number;
  /** Biggest share of the map's territories any one player held after turn 10 (null if the game ended sooner). */
  topShareTurn10: number | null;
  /** CPU time per turn in milliseconds: the engine resolving, and the bots planning (all seats). */
  resolveMs: number[];
  planMs: number[];
  /** Planning time per bot per turn (ms), by bot id. */
  planMsByBot: Record<string, number[]>;
  log?: StepEvent[][];
}

/** `bot`: one bot for every seat, or one per seat (mixed tables). */
export function runGame(ctx: GameContext, seed: string, playerCount: number, settings: Partial<GameSettings>, keepLog = false, bot: Bot | Bot[] = recruitBot): GameSummary {
  const seatBot = (i: number) => (Array.isArray(bot) ? bot[i % bot.length]! : bot);
  const players = Array.from({ length: playerCount }, (_, i) => ({ id: `p${i + 1}`, name: `Bot ${i + 1}` }));
  let s = createGame(ctx, { gameId: `sim-${seed}`, seed, players, settings });
  const idx = indexMap(ctx.map);
  const sum: GameSummary = {
    seed, winner: "draw", winnerSeat: null, endReason: null, turns: 0, battles: 0, captures: 0, lopsided: 0, lopsidedFailed: 0, byBorder: {}, orders: 0, fizzles: 0, hops: 0, hopCaptures: 0,
    initiatives: 0, leadersKilled: 0, hires: 0, invests: 0, presets: 0, decidedTurn: null, leadChanges: 0, topShareTurn10: null, resolveMs: [], planMs: [], planMsByBot: {}, winnerBot: null,
  };
  const leaders: (string | null)[] = [];
  const log: StepEvent[][] = [];
  while (!s.winner) {
    const orders: OrdersByPlayer = {};
    const p0 = performance.now();
    for (const [seat, p] of s.players.entries())
      if (p.eliminatedTurn === null) {
        const b = seatBot(seat);
        const v = viewFor(ctx, s, p.id);
        const b0 = performance.now();
        const o = b.plan(ctx, v);
        (sum.planMsByBot[b.id] ??= []).push(performance.now() - b0);
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
    const arrived = new Set<string>();
    for (const e of r.events) {
      if (e.type === "battle" || e.type === "moved") {
        if (arrived.has(`${e.player}|${e.from}`)) {
          sum.hops++;
          if (e.type === "battle" && e.captured) sum.hopCaptures++;
        }
        if (e.type === "moved" || e.captured) arrived.add(`${e.player}|${e.to}`);
      }
      if (e.type === "battle") {
        sum.battles++;
        if (e.captured) sum.captures++;
        if (e.attackers.troops >= 8 * Math.max(1, e.defenders.troops)) {
          sum.lopsided++;
          if (!e.captured) sum.lopsidedFailed++;
        }
        const kind = idx.border(e.from, e.to) ?? "normal";
        const b = (sum.byBorder[kind] ??= { battles: 0, captures: 0 });
        b.battles++;
        if (e.captured) b.captures++;
      }
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
    if (leaders.length === 9) sum.topShareTurn10 = Math.max(0, ...counts.values()) / idx.ids.length;
    leaders.push(top);
  }
  sum.winner = s.winner;
  sum.endReason = s.endReason;
  sum.turns = s.turn;
  sum.winnerSeat = s.winner === "draw" ? null : players.findIndex((p) => p.id === s.winner);
  sum.winnerBot = sum.winnerSeat === null ? null : seatBot(sum.winnerSeat).id;
  if (s.winner !== "draw") {
    let t = leaders.length;
    while (t > 0 && leaders[t - 1] === s.winner) t--;
    sum.decidedTurn = t + 1;
  }
  if (keepLog) sum.log = log;
  return sum;
}

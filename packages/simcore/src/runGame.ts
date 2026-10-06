import { fallenBot, recruitBot, type Bot } from "@conquerra/bots";
import {
  createGame,
  indexMap,
  replayFor,
  resolveTurn,
  viewFor,
  type GameContext,
  type GameSettings,
  type GameState,
  type OrdersByPlayer,
  type ReplayEvent,
  type StepEvent,
} from "@conquerra/engine";

/** Timing only (never game logic): the same clock in Node and in a browser worker. */
declare const performance: { now(): number };

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
  /** Culture raises by where they went: the capital, a choke point (facing a rival across a pass or sea lane), other frontier land, or interior land. */
  investsAt: Record<"capital" | "choke" | "frontier" | "interior", number>;
  /** Troops recruited by site: the capital, a barracks, or a territory in a fully held province. */
  recruitsAt: Record<"capital" | "barracks" | "province", number>;
  presets: number;
  /** First turn after which the eventual winner led in territory count for the rest of the game. */
  decidedTurn: number | null;
  /** How many times the territory leader changed hands. */
  leadChanges: number;
  /** Biggest share of the map's territories any one player held after turn 10 (null if the game ended sooner). */
  topShareTurn10: number | null;
  /** Who held the most territories after turn 10 (null if the game ended sooner). */
  leaderTurn10: string | null;
  /** Who held the most territories at the game's halfway point (after turn ceil(turns / 2)). */
  leaderHalfway: string | null;
  /** CPU time per turn in milliseconds: the engine resolving, and the bots planning (all seats). */
  resolveMs: number[];
  planMs: number[];
  /** Planning time per bot per turn (ms), by bot id. */
  planMsByBot: Record<string, number[]>;
  /** The Fallen: world events played, and how hard each player was hit (events, troops lost or flipped, gold). */
  worldEvents: number;
  worldEventsFailed: number;
  hitBy: Record<string, { events: number; troops: number; land: number; gold: number }>;
  /** Was the eventual winner the player the Fallen hit hardest (most events; ties by troops)? Null with no events. */
  winnerHitHardest: boolean | null;
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
    initiatives: 0, leadersKilled: 0, hires: 0, invests: 0, investsAt: { capital: 0, choke: 0, frontier: 0, interior: 0 }, recruitsAt: { capital: 0, barracks: 0, province: 0 }, presets: 0, decidedTurn: null, leadChanges: 0, topShareTurn10: null, leaderTurn10: null, leaderHalfway: null, resolveMs: [], planMs: [], planMsByBot: {}, winnerBot: null,
    worldEvents: 0, worldEventsFailed: 0, hitBy: {}, winnerHitHardest: null,
  };
  const leaders: (string | null)[] = [];
  const log: StepEvent[][] = [];
  let lastTurn = new Map<string, ReplayEvent[]>();
  while (!s.winner) {
    const orders: OrdersByPlayer = {};
    const p0 = performance.now();
    for (const [seat, p] of s.players.entries())
      if (p.eliminatedTurn === null) {
        const b = seatBot(seat);
        const v = viewFor(ctx, s, p.id);
        const b0 = performance.now();
        const o = b.plan(ctx, v, lastTurn.get(p.id));
        (sum.planMsByBot[b.id] ??= []).push(performance.now() - b0);
        orders[p.id] = o;
        sum.orders += o.length;
        sum.presets += o.filter((x) => x.preset).length;
      } else if (s.settings.fallen) orders[p.id] = fallenBot.plan(ctx, viewFor(ctx, s, p.id));
    const p1 = performance.now();
    const before = s;
    const r = resolveTurn(ctx, s, orders);
    const p2 = performance.now();
    sum.planMs.push(p1 - p0);
    sum.resolveMs.push(p2 - p1);
    s = r.state;
    // What each seat watched in this turn's replay: the bots see it next turn, as a person would.
    lastTurn = new Map(r.state.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, replayFor(ctx, before, r, p.id)]));
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
      if (e.type === "worldEventFailed") sum.worldEventsFailed++;
      if (e.type === "worldEvent") {
        sum.worldEvents++;
        const h = (sum.hitBy[e.against] ??= { events: 0, troops: 0, land: 0, gold: 0 });
        h.events++;
        h.troops += (e.losses ?? []).reduce((a, l) => a + l.troops, 0) + (e.flipped ? before.territories[e.target]!.troops : 0);
        if (e.flipped) h.land++;
      }
      if (e.type === "income" && e.famine) (sum.hitBy[e.player] ??= { events: 0, troops: 0, land: 0, gold: 0 }).gold += e.famine;
      if (e.type === "initiative") sum.initiatives++;
      if (e.type === "leaderKilled") sum.leadersKilled++;
      if (e.type === "hired") sum.hires++;
      if (e.type === "invested") {
        sum.invests++;
        const owner = (t: string) => before.territories[t]!.owner;
        const nbrs = idx.neighbors.get(e.territory) ?? [];
        const capital = before.players.find((p) => p.id === e.player)!.capital === e.territory;
        const choke = nbrs.some((n) => owner(n) && owner(n) !== e.player && ["pass", "sea"].includes(idx.border(e.territory, n) ?? "normal"));
        const frontier = nbrs.some((n) => owner(n) !== e.player);
        sum.investsAt[capital ? "capital" : choke ? "choke" : frontier ? "frontier" : "interior"]++;
      }
      if (e.type === "recruited") {
        const capital = before.players.find((p) => p.id === e.player)!.capital === e.territory;
        sum.recruitsAt[capital ? "capital" : before.territories[e.territory]!.building === "barracks" ? "barracks" : "province"] += e.count;
      }
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
  sum.leaderTurn10 = leaders.length > 10 ? (leaders[9] ?? null) : null;
  sum.leaderHalfway = leaders[Math.ceil(leaders.length / 2) - 1] ?? null;
  const hardest = Object.entries(sum.hitBy).sort((a, b) => b[1].events - a[1].events || b[1].troops - a[1].troops || (a[0] < b[0] ? -1 : 1))[0];
  sum.winnerHitHardest = hardest && s.winner !== "draw" ? hardest[0] === s.winner : null;
  if (keepLog) sum.log = log;
  return sum;
}

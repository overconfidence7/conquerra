import { agreedIn, fallenBot, negotiate, withAgreed, type Bot } from "@conquerra/bots";
import { createGame, indexMap, replayFor, resolveTurn, viewFor, type GameContext, type GameSettings, type GameState, type OrdersByPlayer, type PlayerId, type PlayerView, type ReplayEvent, type StepEvent, type TerritoryId } from "@conquerra/engine";

/** Timing only (never game logic): the same clock in Node and in a browser worker. */
declare const performance: { now(): number };

/**
 * One seat's play in one game, as behaviours (session 17, for learning what wins): how fast it grew, how it fought,
 * what it built and when, where its gold went, how it dealt. Worked out from the game's events and the real board.
 */
export interface SeatStats {
  seat: number;
  player: PlayerId;
  /** The bot's id ("captain", "marshal-turtle"...). */
  bot: string;
  /** Where its capital was (session 19: seat fairness by capital spot). */
  capital: TerritoryId;
  won: boolean;
  /** Turn it was knocked out (null: it lasted). */
  out: number | null;
  /** Land held after turns 5, 10 and 15 (null: the game had ended), at its peak, and lost to captures by turn 8 and in all. */
  land5: number | null;
  land8: number | null;
  land10: number | null;
  land15: number | null;
  peak: number;
  lost8: number;
  lost: number;
  /** Captures it made by turn 8, and in all. */
  took8: number;
  took: number;
  /** Battles it started, the rivals it attacked on an average turn it attacked anyone, and how many it attacked in all. */
  attacks: number;
  frontsPerTurn: number;
  rivalsAttacked: number;
  /** Its biggest army as a share of all its troops, averaged over its turns (1 = everything in one stack), and over turns 1 to 10. */
  concentration: number;
  concentration10: number;
  /** Its attacks on whoever held the most land at the time (and the share of all its attacks on players). */
  leaderAttacks: number;
  leaderShare: number;
  /** First turn it started a fort, a market, raised culture (null: never), and how many by turn 10. */
  firstFort: number | null;
  firstMarket: number | null;
  firstCulture: number | null;
  forts10: number;
  markets10: number;
  culture10: number;
  /** Gold spent on troops, buildings, culture, specialists and spies (hiring and upkeep), in all. */
  gold: { troops: number; buildings: number; culture: number; specialists: number; spies: number };
  /** The same, by turn 10 (before who's winning shapes what a seat can afford). */
  gold10: { troops: number; buildings: number; culture: number; specialists: number; spies: number };
  /** Deals it made (started), broke, joint wars it was in, truces it was in. */
  deals: number;
  broken: number;
  wars: number;
  truces: number;
}

export interface TableResult {
  seed: string;
  turns: number;
  winner: PlayerId | "draw";
  seats: SeatStats[];
  /** The three runaway measures (see report.ts): top share after turn 10, the turn-10 and halfway leaders. */
  topShareTurn10: number | null;
  leaderTurn10: PlayerId | null;
  leaderHalfway: PlayerId | null;
  /** Planning time per seat per turn (ms), by bot id. */
  planMs: Record<string, number[]>;
  /** Per turn (ms): resolving the turn, and every seat's planning together (diplomacy and the Fallen included). */
  resolveMs: number[];
  turnPlanMs: number[];
}

export interface TableOptions {
  settings?: Partial<GameSettings>;
  /** Seats that plan from the whole board (fog off for them alone): a stand-in for a sharp person piecing things together. */
  sighted?: readonly number[];
  /** Called once a turn before anyone plans (for the runaway study): the state, each living seat's view, and the bots. */
  onTurn?: (s: GameState, views: ReadonlyMap<PlayerId, PlayerView>, lastTurn: ReadonlyMap<PlayerId, readonly ReplayEvent[]>) => void;
  /** Called with each turn's events after it resolves. */
  onEvents?: (before: GameState, events: readonly StepEvent[]) => void;
  maxTurns?: number;
}

const blank = (seat: number, player: PlayerId, bot: string): SeatStats => ({
  seat, player, bot, capital: "", won: false, out: null, land5: null, land8: null, land10: null, land15: null, peak: 0, lost8: 0, lost: 0, took8: 0, took: 0,
  attacks: 0, frontsPerTurn: 0, rivalsAttacked: 0, concentration: 0, concentration10: 0, leaderAttacks: 0, leaderShare: 0,
  firstFort: null, firstMarket: null, firstCulture: null, forts10: 0, markets10: 0, culture10: 0,
  gold: { troops: 0, buildings: 0, culture: 0, specialists: 0, spies: 0 }, gold10: { troops: 0, buildings: 0, culture: 0, specialists: 0, spies: 0 }, deals: 0, broken: 0, wars: 0, truces: 0,
});

/** Play one game with one bot per seat (in seat order), and record every seat's behaviours. */
export function playTable(ctx: GameContext, seed: string, bots: readonly Bot[], opts: TableOptions = {}): TableResult {
  const idx = indexMap(ctx.map);
  const players = bots.map((_, i) => ({ id: `p${i + 1}`, name: `Bot ${i + 1}` }));
  let s = createGame(ctx, { gameId: `sim-${seed}`, seed, players, settings: opts.settings ?? {} });
  const stats = bots.map((b, i) => ({ ...blank(i, players[i]!.id, b.id), capital: s.players.find((p) => p.id === players[i]!.id)!.capital }));
  const byId = new Map(stats.map((x) => [x.player, x]));
  const sighted = new Set(opts.sighted ?? []);
  const fronts = new Map<PlayerId, { turns: number; sum: number; all: Set<PlayerId>; players: number }>();
  const conc = new Map<PlayerId, { turns: number; sum: number; turns10: number; sum10: number }>();
  const planMs: Record<string, number[]> = {};
  const resolveMs: number[] = [];
  const turnPlanMs: number[] = [];
  const leaders: (PlayerId | null)[] = [];
  let topShareTurn10: number | null = null;
  let lastTurn = new Map<PlayerId, ReplayEvent[]>();
  const level = (b: Bot) => b.diplomat ?? (b.id === "recruit" ? ("recruit" as const) : ("captain" as const));
  const viewOf = (st: GameState, p: PlayerId, seat: number) => (sighted.has(seat) && st.settings.fog ? viewFor(ctx, { ...st, settings: { ...st.settings, fog: false } }, p) : viewFor(ctx, st, p));
  while (!s.winner && (opts.maxTurns === undefined || s.turn <= opts.maxTurns)) {
    const st = s;
    const living = st.players.filter((p) => p.eliminatedTurn === null);
    const views = new Map(living.map((p) => [p.id, viewOf(st, p.id, st.players.indexOf(p))]));
    opts.onTurn?.(st, views, lastTurn);
    // The land each holds now (the truth), and its biggest army as a share of its troops.
    const held = new Map<PlayerId, number>();
    const troops = new Map<PlayerId, { all: number; top: number }>();
    for (const t of idx.ids) {
      const x = st.territories[t]!;
      if (!x.owner) continue;
      held.set(x.owner, (held.get(x.owner) ?? 0) + 1);
      const k = troops.get(x.owner) ?? { all: 0, top: 0 };
      k.all += x.troops;
      k.top = Math.max(k.top, x.troops);
      troops.set(x.owner, k);
    }
    for (const [p, k] of troops) {
      const c = conc.get(p) ?? { turns: 0, sum: 0, turns10: 0, sum10: 0 };
      c.turns++;
      c.sum += k.top / Math.max(1, k.all);
      if (st.turn <= 10) (c.turns10++, (c.sum10 += k.top / Math.max(1, k.all)));
      conc.set(p, c);
    }
    const leader = [...held].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? null;
    const tPlan = performance.now();
    const talk = st.settings.diplomacy ? negotiate(ctx, living.map((p) => ({ id: p.id, level: level(bots[st.players.indexOf(p)]!) })), (id) => views.get(id)!, (id) => lastTurn.get(id), null) : null;
    const agreed = talk ? agreedIn(talk.orders) : [];
    const orders: OrdersByPlayer = {};
    for (const [seat, p] of st.players.entries()) {
      if (p.eliminatedTurn !== null) {
        if (st.settings.fallen) orders[p.id] = fallenBot.plan(ctx, viewFor(ctx, st, p.id));
        continue;
      }
      const b = bots[seat]!;
      const t0 = performance.now();
      orders[p.id] = [...(talk?.orders[p.id] ?? []), ...b.plan(ctx, withAgreed(views.get(p.id)!, agreed), lastTurn.get(p.id))];
      (planMs[b.id] ??= []).push(performance.now() - t0);
    }
    turnPlanMs.push(performance.now() - tPlan);
    const tRes = performance.now();
    const r = resolveTurn(ctx, st, orders);
    resolveMs.push(performance.now() - tRes);
    opts.onEvents?.(st, r.events);
    const turn = st.turn;
    const attacked = new Map<PlayerId, Set<PlayerId>>();
    const spent = (x: SeatStats, k: keyof SeatStats["gold"], gold: number) => {
      x.gold[k] += gold;
      if (turn <= 10) x.gold10[k] += gold;
    };
    for (const e of r.events) {
      const me = "player" in e ? byId.get(e.player as PlayerId) : undefined;
      switch (e.type) {
        case "battle": {
          if (!me) break;
          me.attacks++;
          if (e.defender) {
            (attacked.get(e.player) ?? attacked.set(e.player, new Set()).get(e.player)!).add(e.defender);
            if (e.defender === leader) me.leaderAttacks++;
            const f = fronts.get(e.player) ?? { turns: 0, sum: 0, all: new Set(), players: 0 };
            f.players++;
            f.all.add(e.defender);
            fronts.set(e.player, f);
          }
          if (e.captured) {
            me.took++;
            if (turn <= 8) me.took8++;
            const d = e.defender ? byId.get(e.defender) : undefined;
            if (d) {
              d.lost++;
              if (turn <= 8) d.lost8++;
            }
          }
          break;
        }
        case "recruited":
          if (me) spent(me, "troops", e.cost);
          break;
        case "built":
          if (!me) break;
          spent(me, "buildings", e.cost);
          if (e.building === "fort") (me.firstFort ??= turn, turn <= 10 && me.forts10++);
          if (e.building === "market") (me.firstMarket ??= turn, turn <= 10 && me.markets10++);
          break;
        case "invested":
          if (!me) break;
          spent(me, "culture", e.cost);
          me.firstCulture ??= turn;
          if (turn <= 10) me.culture10++;
          break;
        case "hired":
          if (me) spent(me, "specialists", e.cost);
          break;
        case "spyHired":
          if (me) spent(me, "spies", e.cost);
          break;
        case "dealStarted":
          for (const p of [e.deal.a, e.deal.b]) {
            const x = byId.get(p);
            if (!x) continue;
            x.deals++;
            if (e.deal.terms.kind === "war") x.wars++;
            if (e.deal.terms.kind === "truce") x.truces++;
          }
          break;
        case "dealBroken": {
          const x = byId.get(e.by);
          if (x) x.broken++;
          break;
        }
      }
    }
    for (const [p, set] of attacked) {
      const f = fronts.get(p)!;
      f.turns++;
      f.sum += set.size;
    }
    // Spy upkeep (away from home): what the simulator's report counts too.
    for (const spy of st.spies ?? []) {
      const x = byId.get(spy.owner);
      if (x) spent(x, "spies", ctx.rules.spies.upkeep);
    }
    s = r.state;
    lastTurn = new Map(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, replayFor(ctx, st, r, p.id)]));
    const now = new Map<PlayerId, number>();
    for (const t of idx.ids) {
      const o = s.territories[t]!.owner;
      if (o) now.set(o, (now.get(o) ?? 0) + 1);
    }
    for (const x of stats) {
      const n = now.get(x.player) ?? 0;
      x.peak = Math.max(x.peak, n);
      if (turn === 5) x.land5 = n;
      if (turn === 8) x.land8 = n;
      if (turn === 10) x.land10 = n;
      if (turn === 15) x.land15 = n;
      const p = s.players.find((q) => q.id === x.player)!;
      if (p.eliminatedTurn !== null && x.out === null) x.out = p.eliminatedTurn;
    }
    const top = [...now].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? null;
    if (leaders.length === 9) topShareTurn10 = Math.max(0, ...now.values()) / idx.ids.length;
    leaders.push(top);
  }
  for (const x of stats) {
    x.won = s.winner === x.player;
    const f = fronts.get(x.player);
    x.frontsPerTurn = f && f.turns ? f.sum / f.turns : 0;
    x.rivalsAttacked = f ? f.all.size : 0;
    x.leaderShare = f && f.players ? x.leaderAttacks / f.players : 0;
    const c = conc.get(x.player);
    x.concentration = c && c.turns ? c.sum / c.turns : 0;
    x.concentration10 = c && c.turns10 ? c.sum10 / c.turns10 : 0;
  }
  return {
    seed,
    turns: s.turn,
    winner: s.winner ?? "draw",
    seats: stats,
    topShareTurn10,
    leaderTurn10: leaders.length > 10 ? (leaders[9] ?? null) : null,
    leaderHalfway: leaders[Math.ceil(leaders.length / 2) - 1] ?? null,
    planMs,
    resolveMs,
    turnPlanMs,
  };
}

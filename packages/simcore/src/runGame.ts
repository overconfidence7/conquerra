import { agreedIn, fallenBot, negotiate, recruitBot, withAgreed, type Bot, type Talk } from "@conquerra/bots";
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
  /** Specialists hired, by kind (the culture ladder's Rangers and Standard-bearers among them, session 15). */
  hiresByType: Record<string, number>;
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
  /** The card decks (session 13). Spoils sets turned in (and how many the game turned in at the hand limit). */
  spoilsSets: number;
  spoilsAuto: number;
  /** The turn the eventual winner took the lead for good was a turn it turned in a set (null: a draw, or it led from turn 1). */
  winnerLeadOnSet: boolean | null;
  /** Share of the winner's turns on which it turned in a set (what "lead on a set turn" would be by chance). */
  winnerSetTurnShare: number | null;
  /** Fate events, good and bad (on a living player's land), strong ones, and missions drawn and done. */
  fateEvents: number;
  fateGood: number;
  fateBad: number;
  fateStrong: number;
  missionsDrawn: number;
  missionsDone: number;
  /** Fate on each player's land: good minus bad events (shrugged-off ones don't count). */
  fateNet: Record<string, number>;
  /** The winner's share of the good Fate events that landed on players' land (null with none, or a draw). */
  winnerGoodShare: number | null;
  /** The share the winner would get by chance: its share of all the land players held, turn by turn. */
  winnerLandShare: number | null;
  /** The winner's Fate luck beyond what its land would draw by chance (good minus bad, in events). */
  winnerLuck: number | null;
  /** Was the winner the luckiest player with Fate (the best good-minus-bad beyond what its land would draw), alone? */
  winnerLuckiest: boolean | null;
  /** Missions the winner completed, and everyone else's average. */
  winnerMissions: number;
  othersMissions: number;
  /**
   * Diplomacy (session 14): offers between bots and how they were answered, deals that started (by kind, and how many
   * binding), deals broken, joint wars aimed at the player then holding the most land, and a few of the bots' reason
   * lines from this game.
   */
  offers: number;
  accepted: number;
  countered: number;
  dealsMade: number;
  dealsBinding: number;
  dealsByKind: Record<string, number>;
  dealsBroken: number;
  warsVsLeader: number;
  /** Right of passage (session 15): moves and attacks that marched through a partner's land. */
  marchesThrough: number;
  /**
   * Spies (session 15): hired, and how each attempt to get into a province ended (fooled counted apart, which only the
   * simulator can see: the spy's owner is told it got in). `spyGold`: gold spent on spies (hiring and upkeep).
   */
  spiesHired: number;
  spyIn: number;
  spyFooled: number;
  spyBlocked: number;
  spyKilled: number;
  spyGold: number;
  reasons: string[];
  log?: StepEvent[][];
}

/** `bot`: one bot for every seat, or one per seat (mixed tables). */
export function runGame(ctx: GameContext, seed: string, playerCount: number, settings: Partial<GameSettings>, keepLog = false, bot: Bot | Bot[] = recruitBot): GameSummary {
  const seatBot = (i: number) => (Array.isArray(bot) ? bot[i % bot.length]! : bot);
  const players = Array.from({ length: playerCount }, (_, i) => ({ id: `p${i + 1}`, name: `Bot ${i + 1}` }));
  let s = createGame(ctx, { gameId: `sim-${seed}`, seed, players, settings, startBonus: true });
  const idx = indexMap(ctx.map);
  const sum: GameSummary = {
    seed, winner: "draw", winnerSeat: null, endReason: null, turns: 0, battles: 0, captures: 0, lopsided: 0, lopsidedFailed: 0, byBorder: {}, orders: 0, fizzles: 0, hops: 0, hopCaptures: 0,
    initiatives: 0, leadersKilled: 0, hires: 0, hiresByType: {}, invests: 0, investsAt: { capital: 0, choke: 0, frontier: 0, interior: 0 }, recruitsAt: { capital: 0, barracks: 0, province: 0 }, presets: 0, decidedTurn: null, leadChanges: 0, topShareTurn10: null, leaderTurn10: null, leaderHalfway: null, resolveMs: [], planMs: [], planMsByBot: {}, winnerBot: null,
    worldEvents: 0, worldEventsFailed: 0, hitBy: {}, winnerHitHardest: null,
    spoilsSets: 0, spoilsAuto: 0, winnerLeadOnSet: null, winnerSetTurnShare: null,
    fateEvents: 0, fateGood: 0, fateBad: 0, fateStrong: 0, missionsDrawn: 0, missionsDone: 0, fateNet: {}, winnerGoodShare: null, winnerLandShare: null, winnerLuck: null, winnerLuckiest: null, winnerMissions: 0, othersMissions: 0,
    offers: 0, accepted: 0, countered: 0, dealsMade: 0, dealsBinding: 0, dealsByKind: {}, dealsBroken: 0, warsVsLeader: 0, marchesThrough: 0, spiesHired: 0, spyIn: 0, spyFooled: 0, spyBlocked: 0, spyKilled: 0, spyGold: 0, reasons: [],
  };
  const level = (b: Bot) => b.diplomat ?? (b.id === "recruit" ? ("recruit" as const) : ("captain" as const));
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? id;
  /** Turns (1-based) on which each player turned in a set; missions each completed; good Fate events each received. */
  const setTurns = new Map<string, Set<number>>();
  const missionsBy = new Map<string, number>();
  const goodBy = new Map<string, number>();
  const strong = new Set(ctx.rules.fate.events.filter((e) => e.strong).map((e) => e.id));
  /** Territories each player held at the start of each turn, summed (where a Fate event can land on them). */
  const landTurns = new Map<string, number>();
  const leaders: (string | null)[] = [];
  const log: StepEvent[][] = [];
  let lastTurn = new Map<string, ReplayEvent[]>();
  while (!s.winner) {
    const orders: OrdersByPlayer = {};
    const p0 = performance.now();
    // Diplomacy: the bots negotiate as planning starts (in seat order), then plan their moves knowing what they agreed.
    const views = new Map(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, viewFor(ctx, s, p.id)]));
    const talk = s.settings.diplomacy
      ? negotiate(ctx, s.players.flatMap((p, seat) => (p.eliminatedTurn === null ? [{ id: p.id, level: level(seatBot(seat)) }] : [])), (id) => views.get(id)!, (id) => lastTurn.get(id), null)
      : null;
    const agreed = talk ? agreedIn(talk.orders) : [];
    if (talk) noteTalks(talk.talks);
    for (const [seat, p] of s.players.entries())
      if (p.eliminatedTurn === null) {
        const b = seatBot(seat);
        const v = withAgreed(views.get(p.id)!, agreed);
        const b0 = performance.now();
        const o = [...(talk?.orders[p.id] ?? []), ...b.plan(ctx, v, lastTurn.get(p.id))];
        (sum.planMsByBot[b.id] ??= []).push(performance.now() - b0);
        orders[p.id] = o;
        sum.orders += o.length;
        sum.presets += o.filter((x) => x.preset).length;
      } else if (s.settings.fallen) orders[p.id] = fallenBot.plan(ctx, viewFor(ctx, s, p.id));
    const p1 = performance.now();
    const before = s;
    const held = new Map<string, number>();
    for (const id of idx.ids) {
      const o = s.territories[id]!.owner;
      if (o) {
        landTurns.set(o, (landTurns.get(o) ?? 0) + 1);
        held.set(o, (held.get(o) ?? 0) + 1);
      }
    }
    const landLeader = [...held].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? null;
    const r = resolveTurn(ctx, s, orders);
    const p2 = performance.now();
    sum.spyGold += (before.spies ?? []).length * ctx.rules.spies.upkeep;
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
        const kind = idx.border(e.through?.[e.through.length - 1] ?? e.from, e.to) ?? "normal";
        const b = (sum.byBorder[kind] ??= { battles: 0, captures: 0 });
        b.battles++;
        if (e.captured) b.captures++;
      }
      if (e.type === "fizzled") sum.fizzles++;
      if ((e.type === "moved" || e.type === "battle") && e.through?.length) sum.marchesThrough++;
      if (e.type === "spyHired") {
        sum.spiesHired++;
        sum.spyGold += e.cost;
      }
      if (e.type === "spy" && e.outcome !== "home") {
        if (e.outcome === "blocked") sum.spyBlocked++;
        else if (e.outcome === "killed") sum.spyKilled++;
        else if (r.state.spies.some((x) => e.spies.includes(x.id) && x.fooled)) sum.spyFooled++;
        else sum.spyIn++;
      }
      if (e.type === "dealStarted") {
        sum.dealsMade++;
        sum.dealsByKind[e.deal.terms.kind] = (sum.dealsByKind[e.deal.terms.kind] ?? 0) + 1;
        if (e.deal.bond === "binding") sum.dealsBinding++;
        if (e.deal.terms.kind === "war" && e.deal.terms.target === landLeader) sum.warsVsLeader++;
      }
      if (e.type === "dealBroken") {
        sum.dealsBroken++;
        if (e.note && sum.reasons.length < 12) sum.reasons.push(`${name(e.by)} breaks its ${e.kind} with ${name(e.by === e.a ? e.b : e.a)}: "${e.note}"`);
      }
      if (e.type === "worldEventFailed") sum.worldEventsFailed++;
      if (e.type === "worldEvent") {
        sum.worldEvents++;
        const h = (sum.hitBy[e.against] ??= { events: 0, troops: 0, land: 0, gold: 0 });
        h.events++;
        h.troops += (e.losses ?? []).reduce((a, l) => a + l.troops, 0) + (e.flipped ? before.territories[e.target]!.troops : 0);
        if (e.flipped) h.land++;
      }
      if (e.type === "income" && e.famine) (sum.hitBy[e.player] ??= { events: 0, troops: 0, land: 0, gold: 0 }).gold += e.famine;
      if (e.type === "spoilsTurnedIn") {
        sum.spoilsSets++;
        if (e.orderId === null) sum.spoilsAuto++;
        (setTurns.get(e.player) ?? setTurns.set(e.player, new Set()).get(e.player)!).add(before.turn);
      }
      if (e.type === "fate") {
        sum.fateEvents++;
        if (strong.has(e.card)) sum.fateStrong++;
        if (e.holder && !e.shrugged) {
          if (e.tone === "good") (sum.fateGood++, goodBy.set(e.holder, (goodBy.get(e.holder) ?? 0) + 1));
          else sum.fateBad++;
          sum.fateNet[e.holder] = (sum.fateNet[e.holder] ?? 0) + (e.tone === "good" ? 1 : -1);
        }
      }
      if (e.type === "missionDrawn") sum.missionsDrawn++;
      if (e.type === "missionDone") (sum.missionsDone++, missionsBy.set(e.player, (missionsBy.get(e.player) ?? 0) + 1));
      if (e.type === "initiative") sum.initiatives++;
      if (e.type === "leaderKilled") sum.leadersKilled++;
      if (e.type === "hired") {
        sum.hires++;
        sum.hiresByType[e.specialist] = (sum.hiresByType[e.specialist] ?? 0) + 1;
      }
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
  if (s.winner !== "draw") {
    const w = s.winner;
    const mine = setTurns.get(w) ?? new Set<number>();
    if (sum.decidedTurn !== null && sum.decidedTurn > 1 && sum.spoilsSets > 0) sum.winnerLeadOnSet = mine.has(sum.decidedTurn);
    if (sum.spoilsSets > 0) sum.winnerSetTurnShare = mine.size / Math.max(1, s.turn);
    const allLand = [...landTurns.values()].reduce((a, b) => a + b, 0);
    if (sum.fateGood > 0) {
      sum.winnerGoodShare = (goodBy.get(w) ?? 0) / sum.fateGood;
      sum.winnerLandShare = (landTurns.get(w) ?? 0) / Math.max(1, allLand);
    }
    if (sum.fateEvents > 0) {
      // Luck: good minus bad, beyond what each player's land would have drawn by chance.
      const perLand = (sum.fateGood - sum.fateBad) / Math.max(1, allLand);
      const luck = (id: string) => (sum.fateNet[id] ?? 0) - perLand * (landTurns.get(id) ?? 0);
      const lucks = players.map((p) => luck(p.id));
      const best = Math.max(...lucks);
      sum.winnerLuck = luck(w);
      sum.winnerLuckiest = Math.abs(luck(w) - best) < 1e-9 && lucks.filter((x) => Math.abs(x - best) < 1e-9).length === 1;
    }
    sum.winnerMissions = missionsBy.get(w) ?? 0;
    sum.othersMissions = players.filter((p) => p.id !== w).reduce((a, p) => a + (missionsBy.get(p.id) ?? 0), 0) / Math.max(1, players.length - 1);
  }
  const hardest = Object.entries(sum.hitBy).sort((a, b) => b[1].events - a[1].events || b[1].troops - a[1].troops || (a[0] < b[0] ? -1 : 1))[0];
  sum.winnerHitHardest = hardest && s.winner !== "draw" ? hardest[0] === s.winner : null;
  if (keepLog) sum.log = log;
  return sum;

  /** Count the bots' offers and answers, and keep a few of their reason lines. */
  function noteTalks(talks: readonly Talk[]) {
    for (const t of talks) {
      if (!t.answer) continue;
      sum.offers++;
      if (t.answer.accept) sum.accepted++;
      if (t.answer.counter) sum.countered++;
      if (sum.reasons.length < 12 && (sum.offers % 7 === 1 || t.answer.counter))
        sum.reasons.push(`${name(t.offer.from)} → ${name(t.offer.to)}, ${t.offer.terms.kind}: ${t.answer.accept ? "yes" : t.answer.counter ? "counter" : "no"}, "${t.answer.reason}"`);
    }
  }
}

import type { SpecialistType } from "@conquerra/content";
import { expectBattle, rollLosses, type BattleExpectation } from "./combat";
import { cultureProtection, incomeFor, investCost, scoreFor, specialistUnlocked } from "./economy";
import { indexMap, type MapIndex } from "./mapIndex";
import { expandPreset } from "./presets";
import { Rng } from "./rng";
import type {
  ArmySnapshot,
  Condition,
  GameContext,
  GameEvent,
  GameState,
  Order,
  OrderBody,
  OrdersByPlayer,
  PlayerId,
  PlayerState,
  Specialist,
  StepEvent,
  TerritoryId,
  TerritoryState,
  TurnResult,
} from "./types";
import { visibleTerritories } from "./vision";

const MAX_FALLBACK_DEPTH = 5;
const MAX_CHAIN_DEPTH = 5;

type MoveOrder = Extract<OrderBody, { kind: "move" }>;

/** What a move would send, worked out without changing anything. */
interface MovePlan {
  troops: number;
  specialists: Specialist[];
  leaderGoes: boolean;
  /** Border actually crossed into the destination (the second step for two-territory moves). */
  border: "normal" | "river" | "pass";
}

/** A queued order, plus where a follow-through is pushing on from (those troops may act again). */
interface Queued {
  order: Order;
  chainFrom?: TerritoryId;
  chainDepth?: number;
}

const snapshot = (troops: number, specialists: readonly Specialist[]): ArmySnapshot => ({
  troops,
  specialists: specialists.map((s) => s.type),
});

/** Mutable working copy for one turn's resolution. */
class Turn {
  readonly idx: MapIndex;
  readonly rng: Rng;
  readonly events: StepEvent[] = [];
  /** Troops that already moved or fought this turn, per territory; they can't move again. */
  readonly spentTroops = new Map<TerritoryId, number>();
  /** Specialists (by id) that already moved this turn. */
  readonly spentSpecialists = new Set<string>();
  /** Territories attacked so far this turn (for "Reinforce if hit"). */
  readonly attacked = new Set<TerritoryId>();
  /** Who last captured land from each player this turn (for "eliminated by"). */
  readonly lastCapturer = new Map<PlayerId, PlayerId>();
  /** Set by a move that captured its target, so `then` follow-ups know where to push from. */
  lastCapture: TerritoryId | null = null;
  /** Vision cache; bumped whenever something that affects vision changes. */
  private visionEpoch = 0;
  private visionCache = new Map<PlayerId, { epoch: number; set: Set<TerritoryId> }>();

  constructor(
    readonly ctx: GameContext,
    readonly s: GameState,
    /** The board as it stood when the turn began (for "Hold if threatened"). */
    readonly start: GameState,
  ) {
    this.idx = indexMap(ctx.map);
    this.rng = new Rng(s.rng);
  }

  emit(e: GameEvent) {
    this.events.push({ ...e, step: this.events.length } as StepEvent);
  }
  player(id: PlayerId): PlayerState {
    const p = this.s.players.find((x) => x.id === id);
    if (!p) throw new Error(`Unknown player ${id}`);
    return p;
  }
  terr(id: TerritoryId): TerritoryState | undefined {
    return this.s.territories[id];
  }
  alive(id: PlayerId) {
    return this.player(id).eliminatedTurn === null;
  }
  visionChanged() {
    this.visionEpoch++;
  }
  sees(pid: PlayerId, t: TerritoryId): boolean {
    const hit = this.visionCache.get(pid);
    if (hit && hit.epoch === this.visionEpoch) return hit.set.has(t);
    const set = visibleTerritories(this.ctx, this.s, pid);
    this.visionCache.set(pid, { epoch: this.visionEpoch, set });
    return set.has(t);
  }
  freshTroops(t: TerritoryId): number {
    return Math.max(0, (this.terr(t)?.troops ?? 0) - (this.spentTroops.get(t) ?? 0));
  }
  markSpent(t: TerritoryId, troops: number, specialists: readonly Specialist[]) {
    this.spentTroops.set(t, (this.spentTroops.get(t) ?? 0) + troops);
    for (const s of specialists) this.spentSpecialists.add(s.id);
  }
  /** Specialists can't exist without troops: an army reduced to 0 loses them. */
  settle(t: TerritoryState): Specialist[] {
    if (t.troops > 0 || t.specialists.length === 0) return [];
    const lost = t.specialists;
    t.specialists = [];
    return lost;
  }
  /** Biggest army of another player next to `t` (neutrals don't count). */
  biggestEnemyNear(state: GameState, t: TerritoryId, me: PlayerId): number {
    let max = 0;
    for (const n of this.idx.neighbors.get(t) ?? []) {
      const nt = state.territories[n]!;
      if (nt.owner && nt.owner !== me) max = Math.max(max, nt.troops);
    }
    return max;
  }
  enemyTroopsNear(state: GameState, t: TerritoryId, me: PlayerId): number {
    let sum = 0;
    for (const n of this.idx.neighbors.get(t) ?? []) {
      const nt = state.territories[n]!;
      if (nt.owner && nt.owner !== me) sum += nt.troops;
    }
    return sum;
  }

  // ---------- conditions ----------
  check(pid: PlayerId, c: Condition, order: Order): boolean {
    // No peeking through fog: a condition about a territory you can't see counts as false.
    if ("territory" in c && !this.sees(pid, c.territory)) return false;
    const terr = (id: TerritoryId) => this.terr(id);
    switch (c.kind) {
      case "owns":
        return terr(c.territory)?.owner === pid;
      case "notOwns":
        return terr(c.territory)?.owner !== pid;
      case "ownerIs":
        return terr(c.territory)?.owner === c.player;
      case "minTroops":
        return (terr(c.territory)?.troops ?? 0) >= c.count;
      case "maxTroops":
        return (terr(c.territory)?.troops ?? 0) <= c.count;
      case "goldAtLeast":
        return this.player(pid).gold >= c.amount;
      case "leaderAlive":
        return this.player(pid).leader.alive;
      case "odds": {
        if (order.kind !== "move") return true;
        const target = terr(order.to);
        if (!target || target.owner === pid) return true; // not an attack
        const plan = this.planMove(pid, order);
        if (typeof plan === "string") return true; // let the order itself report why it can't run
        const e = this.expect(pid, order.to, plan);
        return c.atLeast === "guaranteed" ? e.captureGuaranteed : e.captureLikely;
      }
      case "enemyNotGrown":
        return this.enemyTroopsNear(this.s, c.territory, pid) <= this.enemyTroopsNear(this.start, c.territory, pid);
      case "outnumbered":
        return this.biggestEnemyNear(this.s, c.territory, pid) > (terr(c.territory)?.troops ?? 0);
      case "attackedThisTurn":
        return this.attacked.has(c.territory);
      case "not":
        return !this.check(pid, c.condition, order);
    }
  }

  // ---------- running an order ----------
  /** Runs an order (and its fallbacks). Returns a follow-up to queue if it captured and has `then`. */
  run(pid: PlayerId, q: Queued, depth = 0): Queued | null {
    const order = q.order;
    if (!this.alive(pid)) {
      this.emit({ type: "fizzled", player: pid, orderId: order.id, reason: "player eliminated", usedFallback: false });
      return null;
    }
    // A follow-through army may act again: free up the troops standing where it pushes on from.
    if (q.chainFrom && depth === 0) {
      this.spentTroops.delete(q.chainFrom);
      for (const s of this.terr(q.chainFrom)?.specialists ?? []) this.spentSpecialists.delete(s.id);
    }
    this.lastCapture = null;
    const failed = (order.conditions ?? []).find((c) => !this.check(pid, c, order));
    const reason = failed ? `condition not met: ${failed.kind}` : this.apply(pid, order);
    if (reason === null) {
      const chainDepth = (q.chainDepth ?? 0) + 1;
      if (order.then && this.lastCapture && chainDepth <= MAX_CHAIN_DEPTH)
        return { order: order.then, chainFrom: this.lastCapture, chainDepth };
      return null;
    }
    if (order.fallback && depth < MAX_FALLBACK_DEPTH) {
      this.emit({ type: "fizzled", player: pid, orderId: order.id, reason, usedFallback: true });
      return this.run(pid, { order: order.fallback }, depth + 1);
    }
    this.emit({ type: "fizzled", player: pid, orderId: order.id, reason, usedFallback: false });
    return null;
  }

  canRecruitAt(p: PlayerState, t: TerritoryId): boolean {
    const terr = this.terr(t);
    return !!terr && terr.owner === p.id && (t === p.capital || terr.building === "barracks");
  }

  /** Executes the order. Returns null on success, or the reason it couldn't happen (state untouched). */
  apply(pid: PlayerId, o: Order): string | null {
    const { rules } = this.ctx;
    const p = this.player(pid);
    switch (o.kind) {
      case "recruit": {
        if (!this.canRecruitAt(p, o.territory)) return "recruit only at your capital or a barracks";
        const t = this.terr(o.territory)!;
        // Ask for more than you can afford and you get as many as you can pay for.
        const count = Math.min(Math.floor(o.count), Math.floor(p.gold / rules.troops.cost));
        if (!(Math.floor(o.count) >= 1)) return "count must be at least 1";
        if (count < 1) return "not enough gold";
        const cost = count * rules.troops.cost;
        p.gold -= cost;
        t.troops += count;
        this.emit({ type: "recruited", player: pid, orderId: o.id, territory: o.territory, count, cost });
        return null;
      }
      case "hire": {
        if (!this.canRecruitAt(p, o.territory)) return "hire only at your capital or a barracks";
        const t = this.terr(o.territory)!;
        const def = rules.specialists[o.specialist];
        if (!def) return "unknown specialist";
        if (t.specialists.length >= rules.specialists.maxPerArmy) return "this army already has the most specialists it can carry";
        if (t.troops < 1) return "specialists need troops to travel with";
        if (!specialistUnlocked(this.ctx, this.s, pid, o.territory, o.specialist)) return "not enough culture in this province";
        if (p.gold < def.cost) return "not enough gold";
        p.gold -= def.cost;
        t.specialists.push({ id: `s${this.s.nextId++}`, type: o.specialist });
        if (o.specialist === "scouts") this.visionChanged();
        this.emit({ type: "hired", player: pid, orderId: o.id, territory: o.territory, specialist: o.specialist, cost: def.cost });
        return null;
      }
      case "build": {
        const t = this.terr(o.territory);
        if (!t || t.owner !== pid) return "you don't hold that territory";
        if (t.building || t.construction) return "territory already has a building";
        const def = rules.buildings[o.building];
        if (!def) return "unknown building";
        if (p.gold < def.cost) return "not enough gold";
        p.gold -= def.cost;
        // Engineers finish any building on the spot.
        const turns = t.specialists.some((s) => s.type === "engineers") ? 0 : def.buildTurns;
        const doneAtEndOfTurn = this.s.turn + Math.max(0, turns - 1);
        if (turns === 0) {
          t.building = o.building;
          this.visionChanged();
        } else t.construction = { building: o.building, doneAtEndOfTurn };
        this.emit({ type: "built", player: pid, orderId: o.id, territory: o.territory, building: o.building, cost: def.cost, doneAtEndOfTurn: turns === 0 ? null : doneAtEndOfTurn });
        return null;
      }
      case "invest": {
        const t = this.terr(o.territory);
        if (!t || t.owner !== pid) return "you don't hold that territory";
        const cost = investCost(rules, t.culture);
        if (cost === null) return "culture is already at its highest";
        if (p.gold < cost) return "not enough gold";
        p.gold -= cost;
        t.culture += 1;
        this.emit({ type: "invested", player: pid, orderId: o.id, territory: o.territory, culture: t.culture, cost });
        return null;
      }
      case "move":
        return this.move(pid, o, o.id, false);
      case "retreat":
        return this.retreat(pid, o.from, o.id);
      case "advance":
        return this.advance(pid, o.from, o.id);
    }
    return "unknown order";
  }

  planMove(pid: PlayerId, o: MoveOrder): MovePlan | string {
    const { rules } = this.ctx;
    const p = this.player(pid);
    const from = this.terr(o.from);
    const to = this.terr(o.to);
    if (!from || !to) return "unknown territory";
    if (from.owner !== pid) return "you no longer hold the starting territory";
    if (o.from === o.to) return "can't move to the same territory";

    const adjacent = (a: TerritoryId, b: TerritoryId) => this.idx.neighbors.get(a)?.includes(b) ?? false;
    let border = this.idx.border(o.from, o.to);
    if (o.via) {
      if (!adjacent(o.from, o.via) || !adjacent(o.via, o.to)) return "path is not connected";
      if (this.terr(o.via)?.owner !== pid) return "path is blocked (you don't hold the middle territory)";
      border = this.idx.border(o.via, o.to);
    } else if (!adjacent(o.from, o.to)) return "territories are not adjacent";

    // Troops: only fresh ones, always leaving the garrison behind.
    const fresh = this.freshTroops(o.from);
    const asked = o.troops === "all" ? fresh : Math.max(0, Math.floor(Number(o.troops) || 0));
    const troops = Math.min(asked, fresh, from.troops - rules.setup.minGarrison);
    if (troops <= 0) return "no troops available to move";

    // Specialists travel with the stack: all fresh ones by default, or the listed types.
    const freshSpecs = from.specialists.filter((s) => !this.spentSpecialists.has(s.id));
    let specialists: Specialist[];
    if (o.specialists === undefined || o.specialists === "all") specialists = freshSpecs;
    else {
      const wanted: SpecialistType[] = Array.isArray(o.specialists) ? [...o.specialists] : [];
      specialists = [];
      for (const s of freshSpecs) {
        const i = wanted.indexOf(s.type);
        if (i >= 0) (specialists.push(s), wanted.splice(i, 1));
      }
    }
    // Moving into your own army: only as many as fit; the rest stay behind.
    if (to.owner === pid) specialists = specialists.slice(0, Math.max(0, rules.specialists.maxPerArmy - to.specialists.length));
    if (o.via && !specialists.some((s) => s.type === "cavalry")) return "only armies with cavalry can move two territories";

    const leaderGoes = !!o.withLeader && p.leader.alive && p.leader.territory === o.from;
    return { troops, specialists, leaderGoes, border: border ?? "normal" };
  }

  expect(pid: PlayerId, toId: TerritoryId, plan: MovePlan): BattleExpectation {
    const to = this.terr(toId)!;
    const defender = to.owner ? this.player(to.owner) : null;
    const defenderLeader = !!defender && defender.leader.alive && defender.leader.territory === toId;
    return expectBattle(this.ctx.rules, {
      attackers: plan.troops,
      attackerSpecialists: plan.specialists.map((s) => s.type),
      attackerLeader: plan.leaderGoes,
      defenders: to.troops,
      defenderSpecialists: to.specialists.map((s) => s.type),
      defenderLeader,
      terrain: this.idx.byId.get(toId)!.terrain,
      building: to.building,
      border: plan.border,
      luck: this.s.settings.luck,
    });
  }

  move(pid: PlayerId, o: MoveOrder, orderId: string, retreat: boolean): string | null {
    const plan = this.planMove(pid, o);
    if (typeof plan === "string") return plan;
    const p = this.player(pid);
    const from = this.terr(o.from)!;
    const to = this.terr(o.to)!;
    const sendIds = new Set(plan.specialists.map((s) => s.id));
    from.troops -= plan.troops;
    from.specialists = from.specialists.filter((s) => !sendIds.has(s.id));
    this.visionChanged();

    if (to.owner === pid) {
      to.troops += plan.troops;
      to.specialists.push(...plan.specialists);
      this.markSpent(o.to, plan.troops, plan.specialists);
      if (plan.leaderGoes) p.leader.territory = o.to;
      this.emit({ type: "moved", player: pid, orderId, from: o.from, to: o.to, army: snapshot(plan.troops, plan.specialists), withLeader: plan.leaderGoes, retreat });
      return null;
    }

    // ----- Battle -----
    this.attacked.add(o.to);
    const defenderId = to.owner;
    const defender = defenderId ? this.player(defenderId) : null;
    const defenderLeader = !!defender && defender.leader.alive && defender.leader.territory === o.to;
    const exp = this.expect(pid, o.to, plan);
    const luck = this.s.settings.luck;
    const defLoss = rollLosses(exp.expectedDefenderLosses, luck, to.troops, this.rng);
    const atkLoss = rollLosses(exp.expectedAttackerLosses, luck, plan.troops, this.rng);
    const attackers = snapshot(plan.troops, plan.specialists);
    const defenders = snapshot(to.troops, to.specialists);
    const survivors = plan.troops - atkLoss;
    to.troops -= defLoss;
    const specialistsLost: SpecialistType[] = [];

    const captured = to.troops === 0 && survivors > 0;
    if (captured) {
      // The defending army is gone; its specialists are lost with it. Buildings and culture stay with the land.
      specialistsLost.push(...to.specialists.map((s) => s.type));
      to.owner = pid;
      to.troops = survivors;
      to.specialists = [...plan.specialists];
      this.markSpent(o.to, survivors, plan.specialists);
      if (defenderLeader && defender) {
        defender.leader = { alive: false, territory: null };
        this.emit({ type: "leaderKilled", player: defender.id, territory: o.to });
      }
      if (plan.leaderGoes) p.leader.territory = o.to;
      if (defenderId) this.lastCapturer.set(defenderId, pid);
      this.lastCapture = o.to;
    } else {
      specialistsLost.push(...this.settle(to).map((s) => s.type));
      if (survivors > 0) {
        // Survivors fall back to where they came from and can't act again this turn.
        from.troops += survivors;
        from.specialists.push(...plan.specialists);
        this.markSpent(o.from, survivors, plan.specialists);
      } else {
        specialistsLost.push(...plan.specialists.map((s) => s.type));
        if (plan.leaderGoes) {
          p.leader = { alive: false, territory: null };
          this.emit({ type: "leaderKilled", player: pid, territory: o.from });
        }
      }
    }
    this.emit({
      type: "battle",
      player: pid,
      orderId,
      from: o.from,
      to: o.to,
      defender: defenderId,
      attackers,
      defenders,
      result: {
        attackStrength: round2(exp.attackStrength),
        defenseStrength: round2(exp.defenseStrength),
        expectedDefenderLosses: round2(exp.expectedDefenderLosses),
        expectedAttackerLosses: round2(exp.expectedAttackerLosses),
        defenderLosses: defLoss,
        attackerLosses: atkLoss,
      },
      captured,
      specialistsLost,
    });
    if (captured && defenderId) this.checkEliminated(defenderId);
    return null;
  }

  /** Pull the army back to the neighbouring territory you hold that is least threatened. */
  retreat(pid: PlayerId, fromId: TerritoryId, orderId: string): string | null {
    const from = this.terr(fromId);
    if (!from || from.owner !== pid) return "you no longer hold that territory";
    const options = (this.idx.neighbors.get(fromId) ?? []).filter((n) => this.terr(n)?.owner === pid);
    if (!options.length) return "nowhere safe to retreat to";
    const danger = (n: TerritoryId) => this.biggestEnemyNear(this.s, n, pid) - this.terr(n)!.troops;
    const best = [...options].sort((a, b) => danger(a) - danger(b) || (a < b ? -1 : 1))[0]!;
    return this.move(pid, { kind: "move", from: fromId, to: best, troops: "all" }, orderId, true);
  }

  /** Attack the neighbour of `fromId` this army is most likely to take (used by "Follow through"). */
  advance(pid: PlayerId, fromId: TerritoryId, orderId: string): string | null {
    const from = this.terr(fromId);
    if (!from || from.owner !== pid) return "you no longer hold that territory";
    let best: { to: TerritoryId; margin: number } | null = null;
    for (const n of this.idx.neighbors.get(fromId) ?? []) {
      if (this.terr(n)!.owner === pid) continue;
      const order: MoveOrder = { kind: "move", from: fromId, to: n, troops: "all" };
      const plan = this.planMove(pid, order);
      if (typeof plan === "string") return plan;
      const e = this.expect(pid, n, plan);
      if (!e.captureLikely) continue;
      const margin = e.expectedDefenderLosses - this.terr(n)!.troops + (plan.troops - e.expectedAttackerLosses);
      if (!best || margin > best.margin) best = { to: n, margin };
    }
    if (!best) return "no neighbour the army can likely take";
    return this.move(pid, { kind: "move", from: fromId, to: best.to, troops: "all" }, orderId, false);
  }

  checkEliminated(pid: PlayerId) {
    const p = this.player(pid);
    if (p.eliminatedTurn !== null) return;
    if (this.idx.ids.some((id) => this.s.territories[id]!.owner === pid)) return;
    p.eliminatedTurn = this.s.turn;
    p.eliminatedBy = this.lastCapturer.get(pid) ?? null;
    p.leader = { alive: false, territory: null };
    this.emit({ type: "eliminated", player: pid, by: p.eliminatedBy });
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Resolve one turn. Pure: the input state is not modified.
 *
 * 1. Seats are shuffled with the game's seeded RNG. Presets are expanded into conditions and fallbacks.
 * 2. "First" orders (Seize the Initiative) run, in seat order.
 * 3. Round-robin: each player's next queued order runs, one per player per round, until all queues are empty.
 *    A successful "Follow through" goes to the front of that player's queue.
 * 4. "Last" orders (Lie in Wait) run, in seat order.
 * 5. Buildings finish, income and upkeep (with unrest if you can't pay), cooldowns, victory check.
 */
export function resolveTurn(ctx: GameContext, state: GameState, orders: OrdersByPlayer): TurnResult {
  if (state.winner) throw new Error("Game is already over");
  const s: GameState = JSON.parse(JSON.stringify(state));
  const T = new Turn(ctx, s, state);
  const { rules } = ctx;

  const active = s.players.filter((p) => p.eliminatedTurn === null).map((p) => p.id);
  const seats = T.rng.shuffle(active);
  T.emit({ type: "turnStart", turn: s.turn, seats });

  const queues = new Map<PlayerId, Queued[]>();
  const firsts = new Map<PlayerId, Order>();
  const lasts = new Map<PlayerId, Order>();
  for (const pid of seats) {
    const p = T.player(pid);
    const q: Queued[] = [];
    const list = Array.isArray(orders[pid]) ? orders[pid]! : [];
    for (const raw of list) {
      const o = expandPreset(raw);
      if (o.timing === "first" && !firsts.has(pid) && p.leader.alive && p.cooldowns.seize === 0) firsts.set(pid, o);
      else if (o.timing === "last" && !lasts.has(pid) && p.leader.alive && p.cooldowns.lie === 0) lasts.set(pid, o);
      else q.push({ order: o });
    }
    queues.set(pid, q);
  }

  for (const pid of seats) {
    const o = firsts.get(pid);
    if (!o) continue;
    T.player(pid).cooldowns.seize = rules.leader.seizeInitiativeCooldown;
    T.emit({ type: "initiative", player: pid, timing: "first", orderId: o.id });
    const next = T.run(pid, { order: o });
    if (next) queues.get(pid)!.unshift(next);
  }

  let more = true;
  while (more) {
    more = false;
    for (const pid of seats) {
      const q = queues.get(pid)!;
      const item = q.shift();
      if (!item) continue;
      more = true;
      const next = T.run(pid, item);
      if (next) q.unshift(next);
    }
  }

  for (const pid of seats) {
    const o = lasts.get(pid);
    if (!o) continue;
    T.player(pid).cooldowns.lie = rules.leader.lieInWaitCooldown;
    T.emit({ type: "initiative", player: pid, timing: "last", orderId: o.id });
    let next = T.run(pid, { order: o });
    while (next) next = T.run(pid, next);
  }

  // ----- End of turn: construction -----
  for (const id of T.idx.ids) {
    const t = s.territories[id]!;
    if (t.construction && t.construction.doneAtEndOfTurn <= s.turn) {
      t.building = t.construction.building;
      t.construction = null;
      if (t.owner) T.emit({ type: "completed", player: t.owner, territory: id, building: t.building });
    }
  }

  // ----- Fallen Leaders come back for free: at the capital, or the strongest territory if it's lost -----
  for (const pid of seats) {
    const p = T.player(pid);
    if (p.eliminatedTurn !== null || p.leader.alive) continue;
    let home: TerritoryId | null = s.territories[p.capital]?.owner === pid ? p.capital : null;
    if (!home)
      for (const id of T.idx.ids) {
        const t = s.territories[id]!;
        if (t.owner === pid && (!home || t.troops > s.territories[home]!.troops)) home = id;
      }
    if (!home) continue;
    p.leader = { alive: true, territory: home };
    T.emit({ type: "leaderReturned", player: pid, territory: home });
  }

  // ----- Economy: income, upkeep, unrest -----
  for (const pid of seats) {
    const p = T.player(pid);
    if (p.eliminatedTurn !== null) continue;
    const inc = incomeFor(ctx, s, pid);
    let deserted = 0;
    p.gold += inc.net;
    if (p.gold < 0) {
      // Unrest: one troop deserts per gold short, lowest-culture land first. Culture talks some of them out of it.
      let short = -p.gold;
      p.gold = 0;
      const mine = T.idx.ids
        .filter((id) => s.territories[id]!.owner === pid)
        .sort((a, b) => {
          const ta = s.territories[a]!, tb = s.territories[b]!;
          return ta.culture - tb.culture || tb.troops - ta.troops || (a < b ? -1 : 1);
        });
      for (const id of mine) {
        if (short <= 0) break;
        const t = s.territories[id]!;
        const canLose = Math.max(0, t.troops - rules.setup.minGarrison);
        const due = Math.min(canLose, short);
        const lose = Math.floor(due * (1 - cultureProtection(rules, t.culture)));
        t.troops -= lose;
        T.settle(t);
        short -= due;
        deserted += lose;
      }
    }
    T.emit({ type: "income", player: pid, income: inc.net + inc.upkeep + inc.specialistUpkeep, upkeep: inc.upkeep + inc.specialistUpkeep, goldAfter: p.gold, deserted });
    p.cooldowns.seize = Math.max(0, p.cooldowns.seize - 1);
    p.cooldowns.lie = Math.max(0, p.cooldowns.lie - 1);
  }

  // ----- Victory -----
  const stillIn = s.players.filter((p) => p.eliminatedTurn === null);
  const finish = (reason: NonNullable<GameState["endReason"]>) => {
    const sc = Object.fromEntries(s.players.map((p) => [p.id, scoreFor(ctx, s, p.id)]));
    let winner: PlayerId | "draw";
    if (reason === "lastStanding") winner = stillIn[0]?.id ?? "draw";
    else {
      const ranked = stillIn.map((p) => p.id).sort((a, b) => sc[b]! - sc[a]!);
      winner = ranked.length && (ranked.length === 1 || sc[ranked[0]!]! > sc[ranked[1]!]!) ? ranked[0]! : "draw";
    }
    s.winner = winner;
    s.endReason = reason;
    T.emit({ type: "gameOver", winner, reason, scores: sc });
  };
  if (stillIn.length <= 1) finish("lastStanding");
  else if (s.settings.turnLimit !== null && s.turn >= s.settings.turnLimit) finish("turnLimit");
  else if (s.turn >= rules.game.maxTurnsHard) finish("turnCap");

  s.rng = T.rng.state;
  if (!s.winner) s.turn += 1;
  return { state: s, events: T.events };
}

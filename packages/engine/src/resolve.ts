import type { BorderType, SpecialistType } from "@conquerra/content";
import { fewestToTake, recruitCount, troopsFor } from "./amounts";
import { expectBattle, rollLosses, type BattleExpectation } from "./combat";
import { canRecruitAt, cultureProtection, incomeFor, investCost, provinceCulture, scoreFor, specialistUnlocked } from "./economy";
import { updateIntel } from "./intel";
import { distancesFrom, indexMap, type MapIndex } from "./mapIndex";
import { expandPreset } from "./presets";
import { Rng } from "./rng";
import type {
  ArmySnapshot,
  Condition,
  FizzleCode,
  FizzleDetail,
  FizzledOrder,
  GameContext,
  GameEvent,
  GameState,
  Instruction,
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
import { recordTurnSightings } from "./sightings";
import { visibleTerritories } from "./vision";

/** Called after every event with the live board (tests use it to check the replay against the real game). */
export type TurnObserver = (e: StepEvent, live: Readonly<GameState>) => void;

const MAX_FALLBACK_DEPTH = 5;
const MAX_CHAIN_DEPTH = 5;

type MoveOrder = Extract<OrderBody, { kind: "move" }>;

/** What a move would send, worked out without changing anything. */
interface MovePlan {
  troops: number;
  specialists: Specialist[];
  leaderGoes: boolean;
  /** A captured general (whose Leader it was) going with the army. */
  general: PlayerId | null;
  /** Border actually crossed into the destination (the second step for two-territory moves). */
  border: BorderType;
}

/** A queued order, plus where a follow-through is pushing on from. */
interface Queued {
  order: Order;
  chainFrom?: TerritoryId;
  chainDepth?: number;
}

/** The territory an order sends troops out of (moves, retreats and follow-through advances). */
const launchesFrom = (o: Order): TerritoryId | null => (o.kind === "move" || o.kind === "retreat" || o.kind === "advance" ? o.from : null);

/** Why an order couldn't happen (null = it did). */
interface Fizzle {
  code: FizzleCode;
  detail?: FizzleDetail;
}
const fz = (code: FizzleCode, detail: FizzleDetail = {}): Fizzle => ({ code, detail });

const snapshot = (troops: number, specialists: readonly Specialist[]): ArmySnapshot => ({
  troops,
  specialists: specialists.map((s) => s.type),
});

/** Mutable working copy for one turn's resolution. */
class Turn {
  readonly idx: MapIndex;
  readonly rng: Rng;
  readonly events: StepEvent[] = [];
  /**
   * Troops resting for the rest of the turn, per territory: the survivors of a failed attack, who fell back.
   * (An army that moved in or captured can go again in a later order: chained attacks.)
   */
  readonly spentTroops = new Map<TerritoryId, number>();
  /** Specialists (by id) resting with them. */
  readonly spentSpecialists = new Set<string>();
  /** Territories attacked so far this turn (for "Reinforce if hit"). */
  readonly attacked = new Set<TerritoryId>();
  /** Who last captured land from each player this turn (for "eliminated by"). */
  readonly lastCapturer = new Map<PlayerId, PlayerId>();
  /** Set by a move that captured its target, so `then` follow-ups know where to push from. */
  lastCapture: TerritoryId | null = null;
  /** The general that wrote the order now running (for the replay and the report). */
  author: PlayerId | undefined;
  /** Vision cache; bumped whenever something that affects vision changes. */
  private visionEpoch = 0;
  private visionCache = new Map<PlayerId, { epoch: number; set: Set<TerritoryId> }>();

  constructor(
    readonly ctx: GameContext,
    readonly s: GameState,
    /** The board as it stood when the turn began (for "Hold if threatened"). */
    readonly start: GameState,
    private readonly observe?: TurnObserver,
  ) {
    this.idx = indexMap(ctx.map);
    this.rng = new Rng(s.rng);
  }

  emit(e: GameEvent) {
    const step = { ...e, step: this.events.length } as StepEvent;
    this.events.push(step);
    this.observe?.(step, this.s);
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
  /** A territory changed hands: whoever stands there now is a fresh army. */
  clearSpent(t: TerritoryId) {
    this.spentTroops.delete(t);
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
        if (isFizzle(plan)) return true; // let the order itself report why it can't run
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

  /** The live facts behind a failed condition, for the turn report ("Ashfell held 14 troops"). */
  conditionDetail(pid: PlayerId, c: Condition, order: Order, negated = false): FizzleDetail {
    if (c.kind === "not") return this.conditionDetail(pid, c.condition, order, !negated);
    const d: FizzleDetail = { condition: c.kind, ...(negated ? { negated } : {}) };
    if ("territory" in c) {
      d.territory = c.territory;
      if (!this.sees(pid, c.territory)) return { ...d, fogged: true };
    }
    const troopsAt = (t: TerritoryId) => this.terr(t)?.troops ?? 0;
    switch (c.kind) {
      case "odds":
        if (order.kind === "move") {
          d.territory = order.to;
          d.troops = troopsAt(order.to);
          const plan = this.planMove(pid, order);
          if (!isFizzle(plan)) d.attackers = plan.troops;
        }
        break;
      case "minTroops":
      case "maxTroops":
        d.troops = troopsAt(c.territory);
        d.need = c.count;
        break;
      case "goldAtLeast":
        d.gold = this.player(pid).gold;
        d.need = c.amount;
        break;
      case "enemyNotGrown":
        d.before = this.enemyTroopsNear(this.start, c.territory, pid);
        d.now = this.enemyTroopsNear(this.s, c.territory, pid);
        break;
      case "outnumbered":
        d.troops = this.biggestEnemyNear(this.s, c.territory, pid);
        d.attackers = troopsAt(c.territory);
        break;
    }
    return d;
  }

  /** The order as written (without its backup or follow-up), for the fizzle event. */
  fizzledOrder(pid: PlayerId, o: Order): FizzledOrder {
    const { id: _id, conditions: _c, fallback: _f, then: _t, timing: _ti, preset, ...body } = o;
    const out = { ...body } as FizzledOrder;
    if (preset) out.preset = preset.id;
    if (o.kind === "move") out.attack = this.terr(o.to)?.owner !== pid;
    return out;
  }

  emitFizzle(pid: PlayerId, order: Order, f: Fizzle, usedFallback: boolean) {
    this.emit({ type: "fizzled", player: pid, orderId: order.id, reason: f.code, detail: f.detail ?? {}, order: this.fizzledOrder(pid, order), usedFallback });
  }

  // ---------- running an order ----------
  /** Runs an order (and its fallbacks). Returns a follow-up to queue if it captured and has `then`. */
  run(pid: PlayerId, q: Queued, depth = 0): Queued | null {
    const order = q.order;
    if (!this.alive(pid)) {
      this.emitFizzle(pid, order, fz("eliminated"), false);
      return null;
    }
    this.lastCapture = null;
    this.author = order.general;
    const failed = (order.conditions ?? []).find((c) => !this.check(pid, c, order));
    const reason = failed ? fz("condition", this.conditionDetail(pid, failed, order)) : this.apply(pid, order);
    if (reason === null) {
      const chainDepth = (q.chainDepth ?? 0) + 1;
      if (order.then && this.lastCapture && chainDepth <= MAX_CHAIN_DEPTH)
        return { order: order.then, chainFrom: this.lastCapture, chainDepth };
      return null;
    }
    if (order.fallback && depth < MAX_FALLBACK_DEPTH) {
      this.emitFizzle(pid, order, reason, true);
      return this.run(pid, { order: order.fallback }, depth + 1);
    }
    this.emitFizzle(pid, order, reason, false);
    return null;
  }

  /** Hiring specialists: your capital or a barracks. */
  canHireAt(p: PlayerState, t: TerritoryId): boolean {
    const terr = this.terr(t);
    return !!terr && terr.owner === p.id && (t === p.capital || terr.building === "barracks");
  }

  canRecruitAt(p: PlayerState, t: TerritoryId): boolean {
    return canRecruitAt(this.ctx, this.s, p.id, t);
  }

  /** Executes the order. Returns null on success, or the reason it couldn't happen (state untouched). */
  apply(pid: PlayerId, o: Order): Fizzle | null {
    const { rules } = this.ctx;
    const p = this.player(pid);
    switch (o.kind) {
      case "recruit": {
        if (this.terr(o.territory)?.owner !== pid) return fz("notHeld", { territory: o.territory });
        if (!this.canRecruitAt(p, o.territory)) return fz("recruitSite", { territory: o.territory });
        const t = this.terr(o.territory)!;
        // All, a share of the gold you have now, or a number (ask for more than you can afford and you get what you can pay for).
        if (recruitCount(o.count, Number.MAX_SAFE_INTEGER, 1) < 1) return fz("badCount");
        const count = recruitCount(o.count, p.gold, rules.troops.cost);
        if (count < 1) return fz("notEnoughGold", { gold: p.gold, cost: rules.troops.cost });
        const cost = count * rules.troops.cost;
        p.gold -= cost;
        t.troops += count;
        this.emit({ type: "recruited", player: pid, orderId: o.id, territory: o.territory, count, cost });
        return null;
      }
      case "hire": {
        if (this.terr(o.territory)?.owner !== pid) return fz("notHeld", { territory: o.territory });
        if (!this.canHireAt(p, o.territory)) return fz("hireSite", { territory: o.territory });
        const t = this.terr(o.territory)!;
        const def = rules.specialists[o.specialist];
        if (!def) return fz("invalid");
        if (t.specialists.length >= rules.specialists.maxPerArmy) return fz("armyFull", { territory: o.territory });
        if (t.troops < 1) return fz("noTroopsForSpecialist", { territory: o.territory });
        if (!specialistUnlocked(this.ctx, this.s, pid, o.territory, o.specialist))
          return fz("cultureLocked", { territory: o.territory, need: def.cultureRequired, have: provinceCulture(this.ctx, this.s, pid, o.territory) });
        if (p.gold < def.cost) return fz("notEnoughGold", { gold: p.gold, cost: def.cost });
        p.gold -= def.cost;
        t.specialists.push({ id: `s${this.s.nextId++}`, type: o.specialist });
        if (o.specialist === "scouts") this.visionChanged();
        this.emit({ type: "hired", player: pid, orderId: o.id, territory: o.territory, specialist: o.specialist, cost: def.cost });
        return null;
      }
      case "build": {
        const t = this.terr(o.territory);
        if (!t || t.owner !== pid) return fz("notHeld", { territory: o.territory });
        if (t.building || t.construction) return fz("hasBuilding", { territory: o.territory });
        const def = rules.buildings[o.building];
        if (!def) return fz("invalid");
        if (p.gold < def.cost) return fz("notEnoughGold", { gold: p.gold, cost: def.cost });
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
        if (!t || t.owner !== pid) return fz("notHeld", { territory: o.territory });
        const cost = investCost(rules, t.culture);
        if (cost === null) return fz("cultureMax", { territory: o.territory });
        if (p.gold < cost) return fz("notEnoughGold", { gold: p.gold, cost });
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
    return fz("invalid");
  }

  planMove(pid: PlayerId, o: MoveOrder): MovePlan | Fizzle {
    const { rules } = this.ctx;
    const p = this.player(pid);
    const from = this.terr(o.from);
    const to = this.terr(o.to);
    if (!from || !to) return fz("invalid");
    if (from.owner !== pid) return fz("lostStart", { territory: o.from });
    if (o.from === o.to) return fz("invalid");

    const adjacent = (a: TerritoryId, b: TerritoryId) => this.idx.neighbors.get(a)?.includes(b) ?? false;
    let border = this.idx.border(o.from, o.to);
    if (o.via) {
      if (!adjacent(o.from, o.via) || !adjacent(o.via, o.to)) return fz("notConnected");
      if (this.terr(o.via)?.owner !== pid) return fz("pathBlocked", { territory: o.via });
      border = this.idx.border(o.via, o.to);
    } else if (!adjacent(o.from, o.to)) return fz("notConnected");

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
    if (o.via && !specialists.some((s) => s.type === "cavalry")) return fz("needsCavalry", { territory: o.from });

    const leaderGoes = !!o.withLeader && p.leader.alive && p.leader.territory === o.from;
    // A captured general standing there goes along if the order says so (it adds no fighting bonus).
    const general = o.withGeneral && p.captured.some((g) => g.of === o.withGeneral && g.territory === o.from) ? o.withGeneral : null;

    // Troops: a share of the army that can act, always leaving the garrison behind.
    const fresh = this.freshTroops(o.from);
    const available = Math.min(fresh, from.troops - rules.setup.minGarrison);
    const attack = to.owner !== pid;
    const draft: MovePlan = { troops: 0, specialists, leaderGoes, general, border: border ?? "normal" };
    const enough = () => (attack ? fewestToTake((n) => this.expect(pid, o.to, { ...draft, troops: n }).captureLikely, available) : available);
    const troops = troopsFor(o.troops, fresh, available, enough);
    if (troops <= 0) {
      // Everyone but the garrison is resting after a failed attack, or only the garrison is there.
      const resting = (this.spentTroops.get(o.from) ?? 0) > 0 && from.troops > rules.setup.minGarrison;
      return fz(resting ? "resting" : "garrisonOnly", { territory: o.from, troops: from.troops });
    }
    return { ...draft, troops };
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
      culture: to.culture,
      border: plan.border,
      luck: this.s.settings.luck,
    });
  }

  move(pid: PlayerId, o: MoveOrder, orderId: string, retreat: boolean): Fizzle | null {
    const plan = this.planMove(pid, o);
    if (isFizzle(plan)) return plan;
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
      if (plan.leaderGoes) p.leader.territory = o.to;
      if (plan.general) this.generalOf(p, plan.general)!.territory = o.to;
      this.emit({
        type: "moved",
        player: pid,
        orderId,
        from: o.from,
        to: o.to,
        army: snapshot(plan.troops, plan.specialists),
        withLeader: plan.leaderGoes,
        retreat,
        ...(plan.general ? { withGeneral: plan.general } : {}),
        ...(this.author ? { general: this.author } : {}),
      });
      return null;
    }

    // ----- Battle -----
    this.attacked.add(o.to);
    const defenderId = to.owner;
    const defender = defenderId ? this.player(defenderId) : null;
    const defenderLeader = !!defender && defender.leader.alive && defender.leader.territory === o.to;
    const exp = this.expect(pid, o.to, plan);
    const luck = this.s.settings.luck;
    // Roll on the uncapped averages, then cap at each army: a "guaranteed" attack always captures.
    let defLoss = rollLosses(exp.uncappedDefenderLosses, luck, to.troops, this.rng);
    const atkLoss = rollLosses(exp.uncappedAttackerLosses, luck, plan.troops, this.rng);
    // Both sides wiped out: the last defender holds. Land is never left owned with 0 troops.
    if (to.troops > 0 && defLoss >= to.troops && atkLoss >= plan.troops) defLoss = to.troops - 1;
    const attackers = snapshot(plan.troops, plan.specialists);
    const defenders = snapshot(to.troops, to.specialists);
    const survivors = plan.troops - atkLoss;
    to.troops -= defLoss;
    const specialistsLost: SpecialistType[] = [];

    const captured = to.troops === 0 && survivors > 0;
    /** Leaders who fall in this battle. They're announced right after it, so the event log reads in order. */
    const fallen: PlayerState[] = [];
    /** Captured generals lost in this battle (the defender's on a capture; the attacker's if its army is wiped out). */
    const lost: { owner: PlayerState; of: PlayerId; by: PlayerId | null }[] = [];
    const standing = defender ? defender.captured.filter((g) => g.territory === o.to).map((g) => g.of) : [];
    if (captured) {
      // The defending army is gone; its specialists are lost with it. Buildings and culture stay with the land.
      specialistsLost.push(...to.specialists.map((s) => s.type));
      to.owner = pid;
      to.troops = survivors;
      to.specialists = [...plan.specialists];
      // The winners can push on from here in a later order (chained attacks).
      this.clearSpent(o.to);
      if (defenderLeader && defender) fallen.push(defender);
      if (plan.leaderGoes) p.leader.territory = o.to;
      if (plan.general) this.generalOf(p, plan.general)!.territory = o.to;
      if (defender) for (const of of standing) lost.push({ owner: defender, of, by: pid });
      if (defenderId) this.lastCapturer.set(defenderId, pid);
      this.lastCapture = o.to;
    } else {
      specialistsLost.push(...this.settle(to).map((s) => s.type));
      if (survivors > 0) {
        // Survivors fall back to where they came from and rest for the rest of the turn.
        from.troops += survivors;
        from.specialists.push(...plan.specialists);
        this.markSpent(o.from, survivors, plan.specialists);
      } else {
        specialistsLost.push(...plan.specialists.map((s) => s.type));
        if (plan.leaderGoes) fallen.push(p);
        if (plan.general) lost.push({ owner: p, of: plan.general, by: defenderId });
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
      withLeader: plan.leaderGoes,
      ...(plan.general ? { withGeneral: plan.general } : {}),
      ...(this.author ? { general: this.author } : {}),
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
      defense: { fort: exp.fortCounted, culture: to.culture, leader: defenderLeader, ...(standing.length ? { generals: standing } : {}) },
    });
    for (const f of fallen) {
      f.leader = { alive: false, territory: null };
      this.emit({ type: "leaderKilled", player: f.id, territory: f === p ? o.from : o.to });
    }
    for (const l of lost) {
      const at = this.generalOf(l.owner, l.of)!.territory;
      l.owner.captured = l.owner.captured.filter((g) => g.of !== l.of);
      this.emit({ type: "generalLost", player: l.owner.id, general: l.of, territory: at, by: l.by });
    }
    if (captured && defenderId) this.checkEliminated(defenderId);
    return null;
  }

  /** Pull the army back to the neighbouring territory you hold that is least threatened. */
  retreat(pid: PlayerId, fromId: TerritoryId, orderId: string): Fizzle | null {
    const from = this.terr(fromId);
    if (!from || from.owner !== pid) return fz("lostStart", { territory: fromId });
    const options = (this.idx.neighbors.get(fromId) ?? []).filter((n) => this.terr(n)?.owner === pid);
    if (!options.length) return fz("nowhereToRetreat", { territory: fromId });
    const danger = (n: TerritoryId) => this.biggestEnemyNear(this.s, n, pid) - this.terr(n)!.troops;
    const best = [...options].sort((a, b) => danger(a) - danger(b) || (a < b ? -1 : 1))[0]!;
    return this.move(pid, { kind: "move", from: fromId, to: best, troops: "all" }, orderId, true);
  }

  /** Attack the neighbour of `fromId` this army is most likely to take (used by "Follow through"). */
  advance(pid: PlayerId, fromId: TerritoryId, orderId: string): Fizzle | null {
    const from = this.terr(fromId);
    if (!from || from.owner !== pid) return fz("lostStart", { territory: fromId });
    let best: { to: TerritoryId; margin: number } | null = null;
    for (const n of this.idx.neighbors.get(fromId) ?? []) {
      if (this.terr(n)!.owner === pid) continue;
      const order: MoveOrder = { kind: "move", from: fromId, to: n, troops: "all" };
      const plan = this.planMove(pid, order);
      if (isFizzle(plan)) return plan;
      const e = this.expect(pid, n, plan);
      if (!e.captureLikely) continue;
      const margin = e.expectedDefenderLosses - this.terr(n)!.troops + (plan.troops - e.expectedAttackerLosses);
      if (!best || margin > best.margin) best = { to: n, margin };
    }
    if (!best) return fz("noTarget", { territory: fromId });
    return this.move(pid, { kind: "move", from: fromId, to: best.to, troops: "all" }, orderId, false);
  }

  checkEliminated(pid: PlayerId) {
    const p = this.player(pid);
    if (p.eliminatedTurn !== null) return;
    if (this.idx.ids.some((id) => this.s.territories[id]!.owner === pid)) return;
    p.eliminatedTurn = this.s.turn;
    p.eliminatedBy = this.lastCapturer.get(pid) ?? null;
    p.leader = { alive: false, territory: null };
    p.captured = [];
    this.emit({ type: "eliminated", player: pid, by: p.eliminatedBy });
    // Their Leader joins whoever knocked them out, as a captured general at that player's capital (or, if it's lost,
    // their strongest territory), with no army until troops are there.
    const captor = p.eliminatedBy ? this.player(p.eliminatedBy) : null;
    if (captor && captor.eliminatedTurn === null) {
      const home = this.homeOf(captor);
      if (home) {
        captor.captured.push({ of: pid, territory: home, instruction: null });
        this.emit({ type: "generalCaptured", player: captor.id, general: pid, territory: home });
      }
    }
  }

  generalOf(p: PlayerState, of: PlayerId) {
    return p.captured.find((g) => g.of === of);
  }

  /** The capital if they hold it, else their strongest territory (most troops; ties by id). */
  homeOf(p: PlayerState): TerritoryId | null {
    if (this.s.territories[p.capital]?.owner === p.id) return p.capital;
    let home: TerritoryId | null = null;
    for (const id of this.idx.ids) {
      const t = this.s.territories[id]!;
      if (t.owner === p.id && (!home || t.troops > this.s.territories[home]!.troops)) home = id;
    }
    return home;
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const isFizzle = (x: MovePlan | Fizzle): x is Fizzle => "code" in x;

/**
 * "Follow through" pushes on in the player's next slot, unless they queued their own next hop from the same place:
 * then the manual chain wins and the automatic one steps aside, so the same army is never sent twice.
 */
function queueFollowThrough(T: Turn, pid: PlayerId, q: Queued[], next: Queued) {
  if (q.some((x) => launchesFrom(x.order) === next.chainFrom)) {
    T.emitFizzle(pid, next.order, fz("manualHopFirst", { territory: next.chainFrom }), false);
    return;
  }
  q.unshift(next);
}

/** Is this a sensible instruction for `p` on this map (places exist, rivals are other players still in)? */
function validInstruction(T: Turn, p: PlayerState, i: Instruction): boolean {
  const rival = (id: PlayerId) => id !== p.id && T.s.players.some((x) => x.id === id && x.eliminatedTurn === null);
  switch (i.kind) {
    case "hold":
      return true;
    case "push":
      return T.idx.byId.has(i.territory);
    case "raid":
      return rival(i.player);
    case "defend":
      return "territory" in i ? T.idx.byId.has(i.territory) : rival(i.player);
  }
}

/**
 * As the turn starts: captured generals you chose to let go, then (if you still have more than you may keep) the
 * ones farthest from your front go, then standing instructions. A general you don't have, or an instruction that
 * makes no sense, is ignored.
 */
function commandGenerals(T: Turn, p: PlayerState, list: readonly Order[]) {
  for (const o of list)
    if (o.kind === "release" && T.generalOf(p, o.general)) {
      p.captured = p.captured.filter((g) => g.of !== o.general);
      T.emit({ type: "generalReleased", player: p.id, general: o.general });
    }
  const max = T.ctx.rules.generals.maxCaptured;
  if (p.captured.length > max) {
    // Keep the ones nearest the front: the fewest borders from land another player holds (ties: the earlier ones).
    const front = T.idx.ids.filter((t) => {
      const o = T.s.territories[t]!.owner;
      return o !== null && o !== p.id;
    });
    const far = (t: TerritoryId) => {
      const d = distancesFrom(T.idx, t);
      return front.length ? Math.min(...front.map((f) => d.get(f) ?? 1e9)) : 0;
    };
    const ranked = p.captured.map((g, i) => ({ g, i, d: far(g.territory) })).sort((a, b) => a.d - b.d || a.i - b.i);
    const keep = new Set(ranked.slice(0, max).map((r) => r.g.of));
    for (const g of p.captured.filter((g) => !keep.has(g.of))) T.emit({ type: "generalReleased", player: p.id, general: g.of });
    p.captured = p.captured.filter((g) => keep.has(g.of));
  }
  for (const o of list) {
    if (o.kind !== "instruct" || (o.instruction && !validInstruction(T, p, o.instruction))) continue;
    if (o.general === p.id) p.command = o.instruction;
    else {
      const g = T.generalOf(p, o.general);
      if (g) g.instruction = o.instruction;
    }
  }
}

/**
 * Resolve one turn. Pure: the input state is not modified.
 *
 * 1. Seats are shuffled with the game's seeded RNG. Presets are expanded into conditions and fallbacks.
 * 2. "First" orders (Seize the Initiative) run, in seat order.
 * 3. Round-robin: each player's next queued order runs, one per player per round, until all queues are empty.
 *    A successful "Follow through" goes to the front of that player's queue (unless they queued their own next hop).
 *    An army that moved in or captured can go again from there in a later order (chained attacks); each hop waits
 *    for its own slot, so rivals' orders land in between.
 * 4. "Last" orders (Lie in Wait) run, in seat order.
 * 5. Buildings finish, income and upkeep (with unrest if you can't pay), cooldowns, victory check.
 */
export function resolveTurn(ctx: GameContext, state: GameState, orders: OrdersByPlayer, observe?: TurnObserver): TurnResult {
  if (state.winner) throw new Error("Game is already over");
  const s: GameState = JSON.parse(JSON.stringify(state));
  const T = new Turn(ctx, s, state, observe);
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
    // Generals first: who to let go, then standing instructions. Neither takes a slot.
    commandGenerals(T, p, list);
    for (const raw of list) {
      if (raw.kind === "instruct" || raw.kind === "release") continue;
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
    if (next) queueFollowThrough(T, pid, queues.get(pid)!, next);
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
      if (next) queueFollowThrough(T, pid, q, next);
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
    const deserters: { territory: TerritoryId; troops: number }[] = [];
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
        if (lose > 0) deserters.push({ territory: id, troops: lose });
      }
    }
    T.emit({ type: "income", player: pid, income: inc.net + inc.upkeep + inc.specialistUpkeep, upkeep: inc.upkeep + inc.specialistUpkeep, goldAfter: p.gold, deserted, deserters });
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
  // Everything you saw during the turn goes into your memory, as it was when you saw it (land that came into view
  // as you advanced, land you watched fall). Worked out from the event log, the same way the replay is.
  if (s.settings.fog && !s.winner)
    recordTurnSightings(
      ctx,
      state,
      T.events,
      s.players.filter((p) => p.eliminatedTurn === null).map((p) => p.id),
      s,
    );
  // Then everyone remembers what they can see now; land that slips into the fog keeps its last-seen entry.
  updateIntel(ctx, s);
  return { state: s, events: T.events };
}

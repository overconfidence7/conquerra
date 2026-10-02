import { expectBattle, rollLosses } from "./combat";
import { incomeFor, scoreFor } from "./economy";
import { indexMap, type MapIndex } from "./mapIndex";
import { Rng } from "./rng";
import type {
  Condition,
  GameContext,
  GameEvent,
  GameState,
  Order,
  OrdersByPlayer,
  PlayerId,
  PlayerState,
  StepEvent,
  TerritoryId,
  TurnResult,
  Units,
} from "./types";
import { UNIT_TYPES, addUnits, emptyUnits, fromPartial, removeCasualties, subUnits, total } from "./units";

const MAX_FALLBACK_DEPTH = 5;

/** Mutable working copy for one turn's resolution. */
class Turn {
  readonly idx: MapIndex;
  readonly rng: Rng;
  readonly events: StepEvent[] = [];
  /** Units that already moved or fought this turn, per territory; they can't move again. */
  readonly spent = new Map<TerritoryId, Units>();
  /** Who captured each territory last this turn (for "eliminated by"). */
  readonly lastCapturer = new Map<PlayerId, PlayerId>();

  constructor(readonly ctx: GameContext, readonly s: GameState) {
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
  spentAt(t: TerritoryId): Units {
    return this.spent.get(t) ?? emptyUnits();
  }
  addSpent(t: TerritoryId, u: Units) {
    this.spent.set(t, addUnits(this.spentAt(t), u));
  }
  alive(id: PlayerId) {
    return this.player(id).eliminatedTurn === null;
  }

  // ---------- conditions ----------
  check(pid: PlayerId, c: Condition): boolean {
    const terr = (id: TerritoryId) => this.s.territories[id];
    switch (c.kind) {
      case "owns":
        return terr(c.territory)?.owner === pid;
      case "notOwns":
        return terr(c.territory)?.owner !== pid;
      case "ownerIs":
        return terr(c.territory)?.owner === c.player;
      case "minUnits":
        return total(terr(c.territory)?.units ?? emptyUnits()) >= c.count;
      case "maxUnits":
        return total(terr(c.territory)?.units ?? emptyUnits()) <= c.count;
      case "goldAtLeast":
        return this.player(pid).gold >= c.amount;
      case "leaderAlive":
        return this.player(pid).leader.alive;
    }
  }

  // ---------- running an order ----------
  run(pid: PlayerId, order: Order, depth = 0): void {
    if (!this.alive(pid)) {
      this.emit({ type: "fizzled", player: pid, orderId: order.id, reason: "player eliminated", usedFallback: false });
      return;
    }
    const failed = (order.conditions ?? []).find((c) => !this.check(pid, c));
    const reason = failed ? `condition not met: ${failed.kind}` : this.apply(pid, order);
    if (reason === null) return;
    if (order.fallback && depth < MAX_FALLBACK_DEPTH) {
      this.emit({ type: "fizzled", player: pid, orderId: order.id, reason, usedFallback: true });
      this.run(pid, order.fallback, depth + 1);
    } else {
      this.emit({ type: "fizzled", player: pid, orderId: order.id, reason, usedFallback: false });
    }
  }

  /** Executes the order. Returns null on success, or the reason it couldn't happen (state untouched). */
  apply(pid: PlayerId, o: Order): string | null {
    const { rules } = this.ctx;
    const p = this.player(pid);
    switch (o.kind) {
      case "recruit": {
        const t = this.s.territories[o.territory];
        if (!t || t.owner !== pid) return "you don't hold that territory";
        const canRecruit = o.territory === p.capital || (t.building && rules.buildings[t.building].allowsRecruit);
        if (!canRecruit) return "recruit only at your capital or a barracks";
        const count = Math.floor(o.count);
        if (count < 1) return "count must be at least 1";
        const cost = rules.units[o.unit].cost * count;
        if (p.gold < cost) return "not enough gold";
        p.gold -= cost;
        t.units[o.unit] += count;
        this.emit({ type: "recruited", player: pid, orderId: o.id, territory: o.territory, unit: o.unit, count, cost });
        return null;
      }
      case "build": {
        const t = this.s.territories[o.territory];
        if (!t || t.owner !== pid) return "you don't hold that territory";
        if (t.building) return "territory already has a building";
        const cost = rules.buildings[o.building].cost;
        if (p.gold < cost) return "not enough gold";
        p.gold -= cost;
        t.building = o.building;
        this.emit({ type: "built", player: pid, orderId: o.id, territory: o.territory, building: o.building, cost });
        return null;
      }
      case "raiseLeader": {
        if (p.leader.alive) return "leader is already alive";
        if (this.s.territories[p.capital]?.owner !== pid) return "you need to hold your capital";
        if (p.gold < rules.leader.raiseCost) return "not enough gold";
        p.gold -= rules.leader.raiseCost;
        p.leader = { alive: true, territory: p.capital };
        this.emit({ type: "leaderRaised", player: pid, orderId: o.id, territory: p.capital });
        return null;
      }
      case "move":
        return this.move(pid, o);
    }
  }

  move(pid: PlayerId, o: Extract<Order, { kind: "move" }>): string | null {
    const { rules } = this.ctx;
    const p = this.player(pid);
    const from = this.s.territories[o.from];
    const to = this.s.territories[o.to];
    if (!from || !to) return "unknown territory";
    if (from.owner !== pid) return "you no longer hold the starting territory";
    if (o.from === o.to) return "can't move to the same territory";

    // Path check: adjacent, or a two-step cavalry move through a territory you hold.
    const adjacent = (a: TerritoryId, b: TerritoryId) => this.idx.neighbors.get(a)?.includes(b) ?? false;
    let border = this.idx.border(o.from, o.to);
    if (o.via) {
      if (!adjacent(o.from, o.via) || !adjacent(o.via, o.to)) return "path is not connected";
      if (this.s.territories[o.via]?.owner !== pid) return "path is blocked (you don't hold the middle territory)";
      border = this.idx.border(o.via, o.to);
    } else if (!adjacent(o.from, o.to)) return "territories are not adjacent";

    // Which units go: only fresh (unspent) units, always leaving the garrison behind.
    const available = subUnits(from.units, this.spentAt(o.from));
    let sending = o.units === "all" ? { ...available } : fromPartial(o.units);
    for (const u of UNIT_TYPES) sending[u] = Math.min(sending[u], Math.max(0, available[u]));
    const mustStay = rules.setup.minGarrison;
    let excess = total(from.units) - total(sending) - mustStay;
    if (excess < 0) {
      // Trim the army so the garrison stays: keep back cheapest units first.
      const keep = removeCasualties(sending, -excess, rules.combat.casualtyOrder);
      sending = subUnits(sending, keep);
      excess = 0;
    }
    if (total(sending) <= 0) return "no units available to move";
    if (o.via && UNIT_TYPES.some((u) => sending[u] > 0 && rules.units[u].move < 2))
      return "only cavalry can move two territories";

    const leaderGoes = !!o.withLeader && p.leader.alive && p.leader.territory === o.from;

    if (to.owner === pid) {
      from.units = subUnits(from.units, sending);
      to.units = addUnits(to.units, sending);
      this.addSpent(o.to, sending);
      if (leaderGoes) p.leader.territory = o.to;
      this.emit({ type: "moved", player: pid, orderId: o.id, from: o.from, to: o.to, units: sending, withLeader: leaderGoes });
      return null;
    }

    // ----- Battle -----
    const defenderId = to.owner;
    const defender = defenderId ? this.player(defenderId) : null;
    const defenderLeader = !!defender && defender.leader.alive && defender.leader.territory === o.to;
    const def = this.ctx.map.territories.find((t) => t.id === o.to)!;
    const exp = expectBattle(rules, {
      attackers: sending,
      attackerLeader: leaderGoes,
      defenders: to.units,
      defenderLeader,
      terrain: def.terrain,
      building: to.building,
      border: border ?? "normal",
      luck: this.s.settings.luck,
    });
    const defLoss = rollLosses(exp.expectedDefenderLosses, this.s.settings.luck, total(to.units), this.rng);
    const atkLoss = rollLosses(exp.expectedAttackerLosses, this.s.settings.luck, total(sending), this.rng);
    const attackersBefore = { ...sending };
    const defendersBefore = { ...to.units };
    const atkDead = removeCasualties(sending, atkLoss, rules.combat.casualtyOrder);
    const defDead = removeCasualties(to.units, defLoss, rules.combat.casualtyOrder);
    const survivors = subUnits(sending, atkDead);
    from.units = subUnits(from.units, sending);
    to.units = subUnits(to.units, defDead);

    const captured = total(to.units) === 0 && total(survivors) > 0;
    if (captured) {
      to.owner = pid;
      to.units = survivors;
      this.addSpent(o.to, survivors);
      if (defenderLeader && defender) {
        defender.leader = { alive: false, territory: null };
        this.emit({ type: "leaderKilled", player: defender.id, territory: o.to });
      }
      if (leaderGoes) p.leader.territory = o.to;
      if (defenderId) this.lastCapturer.set(defenderId, pid);
    } else {
      // Survivors fall back to where they came from and can't act again this turn.
      from.units = addUnits(from.units, survivors);
      this.addSpent(o.from, survivors);
      if (leaderGoes && total(survivors) === 0) {
        p.leader = { alive: false, territory: null };
        this.emit({ type: "leaderKilled", player: pid, territory: o.from });
      }
    }
    this.emit({
      type: "battle",
      player: pid,
      orderId: o.id,
      from: o.from,
      to: o.to,
      defender: defenderId,
      attackers: attackersBefore,
      defenders: defendersBefore,
      result: {
        attackStrength: round2(exp.attackStrength),
        defenseStrength: round2(exp.defenseStrength),
        expectedDefenderLosses: round2(exp.expectedDefenderLosses),
        expectedAttackerLosses: round2(exp.expectedAttackerLosses),
        defenderLosses: defLoss,
        attackerLosses: atkLoss,
      },
      captured,
    });
    if (captured && defenderId) this.checkEliminated(defenderId);
    return null;
  }

  checkEliminated(pid: PlayerId) {
    const p = this.player(pid);
    if (p.eliminatedTurn !== null) return;
    const holds = this.idx.ids.some((id) => this.s.territories[id]!.owner === pid);
    if (holds) return;
    p.eliminatedTurn = this.s.turn;
    p.leader = { alive: false, territory: null };
    this.emit({ type: "eliminated", player: pid, by: this.lastCapturer.get(pid) ?? null });
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Resolve one turn. Pure: the input state is not modified.
 *
 * 1. Seats are shuffled with the game's seeded RNG.
 * 2. "First" orders (Seize the Initiative) run, in seat order.
 * 3. Round-robin: each player's next queued order runs, one per player per round, until all queues are empty.
 * 4. "Last" orders (Lie in Wait) run, in seat order.
 * 5. Income and upkeep, cooldowns, victory check.
 */
export function resolveTurn(ctx: GameContext, state: GameState, orders: OrdersByPlayer): TurnResult {
  if (state.winner) throw new Error("Game is already over");
  const s: GameState = JSON.parse(JSON.stringify(state));
  const T = new Turn(ctx, s);
  const { rules } = ctx;

  const active = s.players.filter((p) => p.eliminatedTurn === null).map((p) => p.id);
  const seats = T.rng.shuffle(active);
  T.emit({ type: "turnStart", turn: s.turn, seats });

  const queues = new Map<PlayerId, Order[]>();
  const firsts = new Map<PlayerId, Order>();
  const lasts = new Map<PlayerId, Order>();
  for (const pid of seats) {
    const p = T.player(pid);
    const q: Order[] = [];
    for (const o of orders[pid] ?? []) {
      if (o.timing === "first" && !firsts.has(pid) && p.leader.alive && p.cooldowns.seize === 0) firsts.set(pid, o);
      else if (o.timing === "last" && !lasts.has(pid) && p.leader.alive && p.cooldowns.lie === 0) lasts.set(pid, o);
      else q.push(o);
    }
    queues.set(pid, q);
  }

  for (const pid of seats) {
    const o = firsts.get(pid);
    if (!o) continue;
    T.player(pid).cooldowns.seize = rules.leader.seizeInitiativeCooldown;
    T.emit({ type: "initiative", player: pid, timing: "first", orderId: o.id });
    T.run(pid, o);
  }

  let more = true;
  while (more) {
    more = false;
    for (const pid of seats) {
      const q = queues.get(pid)!;
      const o = q.shift();
      if (!o) continue;
      more = true;
      T.run(pid, o);
    }
  }

  for (const pid of seats) {
    const o = lasts.get(pid);
    if (!o) continue;
    T.player(pid).cooldowns.lie = rules.leader.lieInWaitCooldown;
    T.emit({ type: "initiative", player: pid, timing: "last", orderId: o.id });
    T.run(pid, o);
  }

  // ----- End of turn: economy and cooldowns -----
  for (const pid of seats) {
    const p = T.player(pid);
    if (p.eliminatedTurn !== null) continue;
    const inc = incomeFor(ctx, s, pid);
    let deserted = 0;
    p.gold += inc.net;
    if (p.gold < 0) {
      // Can't pay upkeep: one unit deserts per gold short, from the biggest armies first.
      let short = -p.gold;
      p.gold = 0;
      const mine = T.idx.ids
        .filter((id) => s.territories[id]!.owner === pid)
        .sort((a, b) => total(s.territories[b]!.units) - total(s.territories[a]!.units) || (a < b ? -1 : 1));
      for (const id of mine) {
        if (short <= 0) break;
        const t = s.territories[id]!;
        const canLose = Math.max(0, total(t.units) - rules.setup.minGarrison);
        const lose = removeCasualties(t.units, Math.min(canLose, short), rules.combat.casualtyOrder);
        t.units = subUnits(t.units, lose);
        short -= total(lose);
        deserted += total(lose);
      }
    }
    T.emit({ type: "income", player: pid, income: inc.net + inc.upkeep, upkeep: inc.upkeep, goldAfter: p.gold, deserted });
    p.cooldowns.seize = Math.max(0, p.cooldowns.seize - 1);
    p.cooldowns.lie = Math.max(0, p.cooldowns.lie - 1);
  }

  // ----- Victory -----
  const stillIn = s.players.filter((p) => p.eliminatedTurn === null);
  const scores = () => Object.fromEntries(s.players.map((p) => [p.id, scoreFor(ctx, s, p.id)]));
  const finish = (reason: NonNullable<GameState["endReason"]>) => {
    const sc = scores();
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
  else if (s.turn >= rules.limits.maxTurnsHard) finish("turnCap");

  s.rng = T.rng.state;
  if (!s.winner) s.turn += 1;
  return { state: s, events: T.events };
}

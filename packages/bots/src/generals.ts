import { distancesFrom, type GameContext, type Instruction, type Order, type PlayerId, type PlayerView, type ReplayEvent, type TerritoryId } from "@conquerra/engine";
import { BREAKTHROUGH_MARGIN, CAPTAIN_CHAIN_MARGIN, chainOn, readBoard, type Board, type CaptainOptions } from "./board";

/**
 * Generals (session 12): a general leads one army, the troops in the territory where it stands, and goes with them
 * when they move. Given a standing instruction, it writes that army's orders each turn with the Captain's brain
 * (board.ts), judging only from its owner's view, and it never spends gold (one treasury: you recruit, build and
 * raise culture yourself). Like the bots, it's deterministic: the same view and instruction give the same orders.
 *
 *  - Hold here: keep this territory; if a rival army next door could take it, pull spare troops in from your land
 *    next to it. It never attacks.
 *  - Defend this border (toward a rival, or a chosen neighbouring place): march to the most threatened stretch of
 *    that border through your own land, hold it like Hold here, and hit back with any troops it doesn't need there
 *    (the general itself stays at its post).
 *  - Push toward a place: march toward it, taking whatever land is in the way (the Captain's odds and chaining, but
 *    every hop must get closer, and it never stops next to a rival army that would throw it straight back out).
 *    Blocked, it waits and gathers spare troops from your quiet land behind it, or, if a rival army next door could
 *    take the land it's waiting on, pulls back a step to land it can hold. Once there, it holds.
 *  - Raid a rival: take that rival's weakly held land next to it, chaining on through more of it, but never into
 *    land next to one of its armies big enough to throw it straight back out. Not touching that rival yet, it
 *    marches toward the rival's nearest known land (taking neutral land on the way, never a third player's).
 *
 * Its army is the troops standing with it when it plans: it moves them by number, so troops you recruit there this
 * turn stay behind and guard the place. Your own Leader as a general keeps its +20% (it goes with the attacks) and uses Seize the Initiative on its first
 * attack on a rival when it's ready. A captured general adds no bonus and has no timing tricks. A general never
 * leaves a threatened capital bare.
 */

/** Where a general stands: your Leader (while alive), or a captured general (by whose Leader it was). */
export function generalAt(view: PlayerView, general: PlayerId): TerritoryId | null {
  if (general === view.me.id) return view.me.leader.alive ? view.me.leader.territory : null;
  return view.me.captured.find((g) => g.of === general)?.territory ?? null;
}

/** Your generals and their standing instructions, as your view has them. */
export function generalsOf(view: PlayerView): { general: PlayerId; at: TerritoryId | null; instruction: Instruction | null }[] {
  return [
    { general: view.me.id, at: generalAt(view, view.me.id), instruction: view.me.command },
    ...view.me.captured.map((g) => ({ general: g.of, at: g.territory, instruction: g.instruction })),
  ];
}

/** The orders one general writes for its army this turn (empty with no instruction, or with no army to lead). */
export function planGeneral(
  ctx: GameContext,
  view: PlayerView,
  general: PlayerId,
  instruction: Instruction | null,
  lastTurn?: readonly ReplayEvent[],
  opts: CaptainOptions = { chainMargin: CAPTAIN_CHAIN_MARGIN },
): Order[] {
  if (!instruction) return [];
  const b = readBoard(ctx, view, opts, lastTurn);
  const home = generalAt(view, general);
  if (!b || !home || !b.owned(home)) return [];
  const g = new General(b, general, home, opts);
  switch (instruction.kind) {
    case "hold":
      g.hold();
      break;
    case "defend":
      g.defend(instruction);
      break;
    case "push":
      g.push(instruction.territory);
      break;
    case "raid":
      g.raid(instruction.player);
      break;
  }
  return g.orders;
}

/** Above this share of a front stack's own needs, spare troops may be pulled in (never what it needs to hold). */
class General {
  readonly orders: Order[] = [];
  private n = 0;
  private readonly isLeader: boolean;
  /** Territories other generals of ours stand in: their armies are theirs to command. */
  private readonly others: Set<TerritoryId>;
  private readonly targeted = new Set<TerritoryId>();

  constructor(
    private readonly b: Board,
    private readonly general: PlayerId,
    private readonly home: TerritoryId,
    private readonly opts: CaptainOptions,
  ) {
    this.isLeader = general === b.me.id;
    const v = b.view;
    this.others = new Set(
      [v.me.leader.alive && general !== v.me.id ? v.me.leader.territory : null, ...v.me.captured.filter((c) => c.of !== general).map((c) => c.territory)].filter((t): t is TerritoryId => !!t),
    );
  }

  private id = () => `${this.b.me.id}-t${this.b.view.turn}-g${this.general}-${this.n++}`;
  /** On every order: who wrote it. On the army's own moves: the general goes along. */
  private get tag(): Partial<Order> {
    return { general: this.general };
  }
  private get goes(): Partial<Order> {
    return this.isLeader ? { withLeader: true } : { withGeneral: this.general };
  }
  private add(o: Record<string, unknown>) {
    const order = { id: this.id(), ...o, ...this.tag } as Order;
    this.orders.push(order);
    return order;
  }

  /** What the general's own territory must keep: enough to hold a threatened capital, else the garrison. */
  private get keepHome() {
    const { b, home } = this;
    return home === b.capital && b.capThreatened ? b.holdNeed(home) : b.garrison;
  }

  /** What one of our territories can spare: everything above what it needs to hold (the garrison if it's quiet). */
  private spare(t: TerritoryId) {
    const { b } = this;
    if (this.others.has(t) || t === this.home) return 0;
    const keep = t === b.capital && b.capThreatened ? b.holdNeed(t) : b.isFrontier(t) ? Math.max(b.garrison, b.holdNeed(t)) : b.garrison;
    return Math.max(0, b.troopsAt(t) - keep);
  }

  /** Pull up to `want` spare troops into `to` from our land next to it (the most spare first). `quietOnly`: only from land with no rival next to it. */
  private pullIn(to: TerritoryId, want: number, quietOnly = false) {
    const { b } = this;
    const from = b.idx.neighbors
      .get(to)!
      .filter((t) => b.owned(t) && (!quietOnly || !b.isFrontier(t)) && !b.chokeHolder(t))
      .map((t) => ({ t, spare: this.spare(t) }))
      .filter((x) => x.spare > 0)
      .sort((x, y) => y.spare - x.spare || (x.t < y.t ? -1 : 1));
    for (const { t, spare } of from) {
      if (want <= 0) break;
      const send = Math.min(spare, want);
      this.add({ kind: "move", from: t, to, troops: send });
      want -= send;
    }
  }

  // ---------- Hold here ----------
  hold() {
    const { b, home } = this;
    const short = b.holdNeed(home) - b.troopsAt(home);
    if (short > 0) this.pullIn(home, short);
  }

  // ---------- Defend this border ----------
  defend(i: Extract<Instruction, { kind: "defend" }>) {
    const { b, home } = this;
    const rival = "player" in i ? i.player : null;
    const place = "territory" in i ? i.territory : null;
    /** The stretch of border it guards: our land next to that rival's (as far as we know), or the place and our land next to it. */
    const onBorder = (t: TerritoryId) =>
      rival ? b.idx.neighbors.get(t)!.some((x) => b.look0(x) === rival) : t === place || b.idx.neighbors.get(t)!.includes(place!);
    let front = b.mine.filter(onBorder);
    if (!front.length) {
      // Not touching it yet: the stretch of our land nearest it.
      const there = rival ? b.idx.ids.filter((t) => b.look0(t) === rival) : [place!];
      if (!there.length) return this.hold();
      const d = distancesFromMany(b, there);
      const best = Math.min(...b.mine.map((t) => d.get(t) ?? 1e9));
      front = b.mine.filter((t) => (d.get(t) ?? 1e9) === best);
    }
    if (!front.includes(home)) {
      // March to the most threatened part of it, through our own land.
      const ours = ownDistances(b, home);
      const post = [...front]
        .filter((t) => ours.has(t))
        .sort((x, y) => b.troopsAt(x) - b.holdNeed(x) - (b.troopsAt(y) - b.holdNeed(y)) || ours.get(x)! - ours.get(y)! || (x < y ? -1 : 1))[0];
      const step = post ? stepToward(b, home, post) : null;
      // (A general alone with the garrison has no army to march: it holds where it is.)
      if (step && b.troopsAt(home) - this.keepHome >= 1) {
        this.add({ kind: "move", from: home, to: step, troops: Math.max(1, b.troopsAt(home) - this.keepHome), ...this.goes });
        return;
      }
      return this.hold();
    }
    // At its post: hold, and hit back at that rival's armies next door with whatever it doesn't need to hold.
    const need = Math.max(this.keepHome, b.holdNeed(home));
    const short = need - b.troopsAt(home);
    if (short > 0) return this.pullIn(home, short);
    let spare = b.troopsAt(home) - need;
    const targets = b.idx.neighbors
      .get(home)!
      .filter((x) => {
        const r = b.rivalAt(x);
        return !!r && (rival ? r === rival : x === place || b.idx.neighbors.get(x)!.includes(place!));
      })
      .map((x) => ({ x, need: spare > 0 ? b.needFor(home, x, spare) : null }))
      .filter((c): c is { x: TerritoryId; need: number } => c.need !== null && (!b.crossing(home, c.x) || spare >= c.need * BREAKTHROUGH_MARGIN))
      .sort((p, q) => b.valueOf(q.x) / q.need - b.valueOf(p.x) / p.need || (p.x < q.x ? -1 : 1));
    for (const t of targets) {
      if (spare < t.need) continue;
      // The general stays at its post: its troops hit back without it.
      this.add({ kind: "move", from: home, to: t.x, troops: t.need, preset: { id: "onlyIfStronger" } });
      spare -= t.need;
    }
  }

  // ---------- Push toward a place ----------
  push(place: TerritoryId) {
    const { b, home } = this;
    if (home === place) return this.hold();
    this.advance(distancesFrom(b.idx, place), () => true);
  }

  // ---------- Raid a rival ----------
  raid(rival: PlayerId) {
    const { b, home } = this;
    const avail = b.troopsAt(home) - this.keepHome;
    /** The biggest army of that rival next to `t` (other than in `t`), on our best guess. */
    const strongNear = (t: TerritoryId) => b.idx.neighbors.get(t)!.reduce((m, x) => (b.look(x).owner === rival ? Math.max(m, b.look(x).troops) : m), 0);
    if (avail > 0) {
      const specs = b.specsAt(home);
      const targets = b.idx.neighbors
        .get(home)!
        .filter((x) => b.rivalAt(x) === rival)
        .flatMap((x) => {
          const need = b.needFor(home, x, avail, specs, this.isLeader);
          if (need === null || (b.crossing(home, x) && avail < need * BREAKTHROUGH_MARGIN)) return [];
          // Weakly held: what arrives must not sit next to a rival army that could throw it straight back out.
          const arrive = avail - b.expectAt(home, x, avail, specs, this.isLeader).expectedAttackerLosses;
          return strongNear(x) >= arrive ? [] : [{ x, need }];
        })
        .sort((p, q) => b.valueOf(q.x) / q.need - b.valueOf(p.x) / p.need || (p.x < q.x ? -1 : 1));
      const t = targets[0];
      if (t) return this.attack(t.x, avail, (_f, to) => b.look(to).owner === rival && strongNear(to) < avail / 2);
    }
    // Not touching that rival (or nothing weak enough next door): march toward its nearest land we know of.
    const theirs = b.idx.ids.filter((t) => b.look0(t) === rival);
    if (!theirs.length) return this.hold();
    if (b.idx.neighbors.get(home)!.some((x) => b.rivalAt(x) === rival)) return void (this.fallBack() || this.gather());
    this.advance(distancesFromMany(b, theirs), (to) => {
      const o = b.rivalAt(to);
      return o === null || o === rival;
    });
  }

  /**
   * One step along `dist` (fewer steps to the goal): march into our own land, or attack the cheapest likely-to-win
   * land on the way (that `mayAttack` allows) with the whole army and chain on closer. Blocked: wait and gather.
   */
  private advance(dist: Map<TerritoryId, number>, mayAttack: (to: TerritoryId) => boolean) {
    const { b, home } = this;
    const here = dist.get(home) ?? 1e9;
    const avail = b.troopsAt(home) - this.keepHome;
    if (avail <= 0) return;
    const specs = b.specsAt(home);
    const steps = b.idx.neighbors.get(home)!.filter((x) => (dist.get(x) ?? 1e9) < here);
    const attacks = steps
      .filter((x) => !b.owned(x) && mayAttack(x))
      .flatMap((x) => {
        const need = b.needFor(home, x, avail, specs, this.isLeader);
        if (need === null || (b.crossing(home, x) && avail < need * BREAKTHROUGH_MARGIN)) return [];
        // Never march into a spot a rival army next to it would take straight back.
        return b.exposed(x, avail - b.expectAt(home, x, avail, specs, this.isLeader).expectedAttackerLosses) ? [] : [{ x, need }];
      })
      .sort((p, q) => (dist.get(p.x) ?? 0) - (dist.get(q.x) ?? 0) || p.need - q.need || (p.x < q.x ? -1 : 1));
    const t = attacks[0];
    if (t) return this.attack(t.x, avail, (f, to) => (dist.get(to) ?? 1e9) < (dist.get(f) ?? 1e9) && mayAttack(to), (to) => -100 * (dist.get(to) ?? 0) + b.valueOf(to));
    const march = steps
      .filter((x) => b.owned(x) && !b.exposed(x, avail + b.troopsAt(x)))
      .sort((p, q) => (dist.get(p) ?? 0) - (dist.get(q) ?? 0) || (p < q ? -1 : 1))[0];
    if (march) {
      this.add({ kind: "move", from: home, to: march, troops: avail, ...this.goes });
      return;
    }
    if (!this.fallBack()) this.gather();
  }

  /**
   * Stuck somewhere a rival army next door would likely take (and not at the capital): pull the army back one step,
   * toward the nearest land of ours it could hold, rather than lose it and the general with it. True if it did.
   */
  private fallBack(): boolean {
    const { b, home } = this;
    const troops = b.troopsAt(home);
    if (home === b.capital || troops - b.garrison < 1 || !b.exposed(home, troops)) return false;
    const ours = ownDistances(b, home);
    const safe = [...ours.keys()].filter((t) => t !== home && !b.exposed(t, troops)).sort((x, y) => ours.get(x)! - ours.get(y)! || (x < y ? -1 : 1))[0];
    const step = safe ? stepToward(b, home, safe) : null;
    if (!step) return false;
    this.add({ kind: "move", from: home, to: step, troops: troops - b.garrison, ...this.goes });
    return true;
  }

  /** The whole army attacks `to` (the general with it), then chains on where `allowed` says. */
  private attack(to: TerritoryId, avail: number, allowed: (from: TerritoryId, to: TerritoryId) => boolean, value?: (t: TerritoryId) => number) {
    const { b, home } = this;
    const seize = this.isLeader && !!b.rivalAt(to) && b.me.cooldowns.seize === 0;
    const order = this.add({
      kind: "move",
      from: home,
      to,
      troops: avail,
      preset: { id: "onlyIfStronger" },
      ...this.goes,
      ...(seize ? { timing: "first" } : {}),
    });
    this.targeted.add(to);
    chainOn(b, { order, from: home, to, troops: avail }, this.targeted, this.opts.chainMargin, this.id, (o) => this.orders.push(o), {
      allowed,
      ...(value ? { value } : {}),
      leader: this.isLeader,
      extra: { ...this.goes, ...this.tag } as Partial<Order>,
      safe: (t, arriving) => !b.exposed(t, arriving),
    });
  }

  /** Waiting for a stronger army: spare troops from our quiet land next door join it. */
  private gather() {
    this.pullIn(this.home, Number.MAX_SAFE_INTEGER, true);
  }
}

/** Steps from the nearest of `from` to every territory (the whole map: passes and sea lanes count). */
function distancesFromMany(b: Board, from: readonly TerritoryId[]): Map<TerritoryId, number> {
  const d = new Map<TerritoryId, number>();
  const q = [...from];
  for (const t of q) d.set(t, 0);
  for (let h = 0; h < q.length; h++)
    for (const nb of b.idx.neighbors.get(q[h]!)!)
      if (!d.has(nb)) {
        d.set(nb, d.get(q[h]!)! + 1);
        q.push(nb);
      }
  return d;
}

/** Steps from `from` through our own land only. */
function ownDistances(b: Board, from: TerritoryId): Map<TerritoryId, number> {
  const d = new Map<TerritoryId, number>([[from, 0]]);
  const q = [from];
  for (let h = 0; h < q.length; h++)
    for (const nb of b.idx.neighbors.get(q[h]!)!)
      if (b.owned(nb) && !d.has(nb)) {
        d.set(nb, d.get(q[h]!)! + 1);
        q.push(nb);
      }
  return d;
}

/** The first step from `from` toward `to` through our own land (null if there's no such path). */
function stepToward(b: Board, from: TerritoryId, to: TerritoryId): TerritoryId | null {
  const d = ownDistances(b, to);
  const here = d.get(from);
  if (here === undefined) return null;
  return b.idx.neighbors.get(from)!.filter((x) => b.owned(x) && d.get(x) === here - 1).sort()[0] ?? null;
}

/**
 * Put generals' orders together with your own for the turn. Giving your own order to a general's army (any order out
 * of the territory it stands in) takes control back for the turn: that general's orders are all dropped. Your own
 * order out of a territory a general meant to pull troops from just drops that one order. Seize the Initiative and
 * Lie in Wait go on one order only: yours win. The generals' orders go first (they lead the main armies).
 */
export function mergeGeneralOrders(view: PlayerView, own: readonly Order[], generals: readonly Order[]): Order[] {
  const ownFrom = new Set(own.map(launchesFrom).filter((t): t is TerritoryId => !!t));
  const taken = new Set<PlayerId>();
  for (const o of generals) {
    const at = generalAt(view, o.general!);
    if (at && ownFrom.has(at)) taken.add(o.general!);
  }
  const timings = new Set(own.map((o) => o.timing).filter(Boolean));
  const kept = generals
    .filter((o) => !taken.has(o.general!) && !(launchesFrom(o) && ownFrom.has(launchesFrom(o)!)))
    .map((o) => (o.timing && timings.has(o.timing) ? (({ timing: _t, ...rest }) => rest as Order)(o) : o));
  return [...kept, ...own];
}

/** The territory an order sends troops out of (moves, retreats, advances). */
export const launchesFrom = (o: Order): TerritoryId | null => (o.kind === "move" || o.kind === "retreat" || o.kind === "advance" ? o.from : null);

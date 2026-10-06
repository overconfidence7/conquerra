import type { BuildingType, SpecialistType } from "@conquerra/content";
import {
  amountLabel,
  fewestToTake,
  indexMap,
  investCost,
  isRecruitSiteIn,
  passageFor,
  spiesOn,
  isShare,
  PRESETS,
  previewAttack,
  recruitCount,
  SHARES,
  troopsFor,
  type GameContext,
  type Order,
  type PlayerId,
  type PlayerView,
  type PresetId,
  type PresetInfo,
  type RecruitAmount,
  type TerritoryDetail,
  type TerritoryId,
  type TroopAmount,
} from "@conquerra/engine";

/**
 * Order-builder logic: everything the order screen needs to know, worked out from the player's view and
 * the orders queued so far. No React here, so it's easy to test.
 */

export type Seen = TerritoryDetail & { detail: "full" };
export const seen = (view: PlayerView, t: TerritoryId): Seen | null => {
  const v = view.territories[t];
  return v && v.detail === "full" ? v : null;
};
export const isMine = (view: PlayerView, t: TerritoryId) => seen(view, t)?.owner === view.me.id;
/** Recruit sites: your capital, any barracks, and anywhere in a province you hold completely (the engine's rule). */
export const isRecruitSite = (ctx: GameContext, view: PlayerView, t: TerritoryId) => isRecruitSiteIn(ctx, view, t);
/** Hiring specialists: your capital or a barracks only. */
export const isHireSite = (view: PlayerView, t: TerritoryId) => isMine(view, t) && (t === view.me.capital || seen(view, t)!.building === "barracks");

// ---------- Walking the queue ----------

export interface QueuePlan {
  /** Gold left after everything queued is paid for. */
  goldLeft: number;
  /** Gold each order spends, in queue order (0 for moves). */
  costs: number[];
  /** Troops that can still be sent from each territory you hold or should hold by then (the 1-troop garrison always stays). */
  free: Map<TerritoryId, number>;
  /** The army expected in each territory you hold or should hold, after the orders so far. */
  army: Map<TerritoryId, number>;
  /** Specialist types expected with each army. */
  armySpecs: Map<TerritoryId, SpecialistType[]>;
  /** Specialists each of your armies will have after queued hires. */
  specialists: Map<TerritoryId, number>;
  /** Culture level each of your territories reaches after queued raises. */
  culture: Map<TerritoryId, number>;
  /** Territories that already have a building queued. */
  building: Set<TerritoryId>;
  /** Territories with an attack queued against them. */
  targeted: Set<TerritoryId>;
  /** Land an attack earlier in the queue should capture (yours by the time later orders run, if it goes to plan). */
  captured: Set<TerritoryId>;
  /** Land an army moves into or captures earlier in the queue: it can go on from there (a chained hop). */
  arrived: Set<TerritoryId>;
  /** How many troops should arrive at each of those (before any of them push on). */
  arriving: Map<TerritoryId, number>;
  /** Armies whose size depends on a battle earlier in the queue: their numbers and odds are estimates. */
  estimated: Set<TerritoryId>;
  /** Troops each order should send (an estimate when it depends on an earlier battle); 0 for other orders. */
  sent: number[];
  /** For moves in a chain: the hop number (1 for the first). Null for everything else. */
  hop: (number | null)[];
  /** Spies queued to be hired this turn (session 15). */
  spiesHired: number;
}

/** Yours now, or should be by the time later orders run (captured earlier in the queue). */
export const isOwned = (view: PlayerView, plan: QueuePlan | null, t: TerritoryId) => isMine(view, t) || !!plan?.captured.has(t);

/**
 * Plays the queue forward the way the engine will run your orders (one after another, in order), to work out gold,
 * where armies should end up and how big they'll be. Recruits can act the same turn; an army that moves in or
 * captures can go on in a later order (chained attacks). Battles are assumed to go as expected (an average roll).
 */
export function planQueue(ctx: GameContext, view: PlayerView, queue: readonly Order[]): QueuePlan {
  const { rules } = ctx;
  const garrison = rules.setup.minGarrison;
  let gold = view.me.gold;
  const plan: QueuePlan = {
    goldLeft: 0,
    costs: [],
    free: new Map(),
    army: new Map(),
    armySpecs: new Map(),
    specialists: new Map(),
    culture: new Map(),
    building: new Set(),
    targeted: new Set(),
    captured: new Set(),
    arrived: new Set(),
    arriving: new Map(),
    estimated: new Set(),
    sent: [],
    hop: [],
    spiesHired: 0,
  };
  /** Troops resting after a failed attack can't go again (they count in the army, not in what's free). */
  const resting = new Map<TerritoryId, number>();
  const setArmy = (t: TerritoryId, n: number) => {
    plan.army.set(t, n);
    plan.free.set(t, Math.max(0, n - garrison - (resting.get(t) ?? 0)));
  };
  for (const [id, v] of Object.entries(view.territories)) {
    if (v.detail !== "full" || v.owner !== view.me.id) continue;
    setArmy(id, v.troops);
    plan.armySpecs.set(id, v.specialists.map((x) => x.type));
    plan.specialists.set(id, v.specialists.length);
    plan.culture.set(id, v.culture);
    if (v.building || v.construction) plan.building.add(id);
  }
  /** Which chain each arrival belongs to (the queue index of its first move), and its hop count so far. */
  const chainAt = new Map<TerritoryId, { root: number; hops: number }>();
  for (const [i, o] of queue.entries()) {
    let cost = 0;
    let sent = 0;
    plan.hop.push(null);
    switch (o.kind) {
      case "recruit": {
        // All, a share of the gold left by then, or an exact number (as many as you can afford).
        const count = recruitCount(o.count, gold, rules.troops.cost);
        cost = count * rules.troops.cost;
        if (count > 0) setArmy(o.territory, (plan.army.get(o.territory) ?? 0) + count);
        break;
      }
      case "hireSpy":
        cost = rules.spies.cost;
        plan.spiesHired++;
        break;
      case "hire":
        cost = rules.specialists[o.specialist].cost;
        plan.specialists.set(o.territory, (plan.specialists.get(o.territory) ?? 0) + 1);
        plan.armySpecs.set(o.territory, [...(plan.armySpecs.get(o.territory) ?? []), o.specialist]);
        break;
      case "build":
        cost = rules.buildings[o.building].cost;
        plan.building.add(o.territory);
        break;
      case "invest": {
        const level = plan.culture.get(o.territory) ?? 0;
        cost = investCost(rules, level) ?? 0;
        plan.culture.set(o.territory, level + 1);
        break;
      }
      case "move": {
        const est = expectMove(ctx, view, plan, o);
        sent = est.troops;
        if (sent <= 0) break;
        const specs = plan.armySpecs.get(o.from) ?? [];
        const estimate = plan.estimated.has(o.from);
        setArmy(o.from, (plan.army.get(o.from) ?? 0) - sent);
        const chain = chainAt.get(o.from);
        if (chain && plan.arrived.has(o.from)) {
          // A hop: number it within its chain (the move that first arrived there is hop 1).
          plan.hop[chain.root] ??= 1;
          plan.hop[i] = chain.hops + 1;
        }
        if (est.attack) plan.targeted.add(o.to);
        if (est.arrives > 0) {
          if (est.attack) plan.captured.add(o.to);
          setArmy(o.to, (est.attack ? 0 : (plan.army.get(o.to) ?? 0)) + est.arrives);
          plan.armySpecs.set(o.to, [...(est.attack ? [] : (plan.armySpecs.get(o.to) ?? [])), ...specs].slice(0, rules.specialists.maxPerArmy));
          plan.armySpecs.set(o.from, []);
          plan.arrived.add(o.to);
          plan.arriving.set(o.to, est.arrives);
          chainAt.set(o.to, chain && plan.hop[i] !== null ? { root: chain.root, hops: plan.hop[i]! } : { root: i, hops: 1 });
          if (est.attack || estimate) plan.estimated.add(o.to);
        } else if (est.attack) {
          // Expected to fail: the survivors fall back and rest.
          const back = Math.max(0, est.survivors);
          resting.set(o.from, (resting.get(o.from) ?? 0) + back);
          setArmy(o.from, (plan.army.get(o.from) ?? 0) + back);
        }
        break;
      }
      case "retreat":
        plan.free.set(o.from, 0);
        break;
      // A Spoils windfall: troops (and gold) at your capital, or a fort's garrison, from its slot on.
      case "spoils": {
        const sp = rules.spoils;
        if (o.set === "sword" || o.set === "mixed") {
          const home = view.me.capital;
          if (plan.army.has(home)) setArmy(home, plan.army.get(home)! + (o.set === "sword" ? sp.sword.troops : sp.mixed.troops));
          if (o.set === "mixed") gold += sp.mixed.gold;
        } else if (o.set === "tower" && o.territory && plan.army.has(o.territory)) {
          setArmy(o.territory, plan.army.get(o.territory)! + sp.tower.garrison);
          plan.building.add(o.territory);
        }
        break;
      }
    }
    if (cost > gold) cost = o.kind === "recruit" ? cost : 0; // the engine skips what you can't afford
    gold -= cost;
    plan.costs.push(cost);
    plan.sent.push(sent);
  }
  plan.goldLeft = gold;
  return plan;
}

/** How a queued move is expected to go: troops sent, and how many should arrive (0 if an attack is expected to fail). */
function expectMove(ctx: GameContext, view: PlayerView, plan: QueuePlan, o: Extract<Order, { kind: "move" }>) {
  const d: MoveDraft = { from: o.from, to: o.to, ...(o.via ? { via: o.via } : {}), ...(o.through?.length ? { through: o.through } : {}), amount: o.troops, preset: null, withLeader: !!o.withLeader, timing: null };
  const troops = troopsOf(ctx, view, plan, d);
  const attack = isAttack(view, d, plan);
  if (!attack) return { troops, attack, arrives: troops, survivors: troops };
  const e = expectation(ctx, view, plan, d, troops);
  // Can't see the target: assume it goes to plan, so you can still chain on (the odds say "Can't see").
  if (!e) return { troops, attack, arrives: troops, survivors: troops };
  const survivors = Math.round(troops - e.expectedAttackerLosses);
  return { troops, attack, arrives: e.captureLikely ? Math.max(1, survivors) : 0, survivors };
}

/** How many troops an order would send now (an estimate when its army depends on an earlier battle). */
export function troopsOf(ctx: GameContext, view: PlayerView, plan: QueuePlan, d: MoveDraft): number {
  const avail = plan.free.get(d.from) ?? 0;
  const army = Math.max(0, plan.army.get(d.from) ?? 0);
  return troopsFor(d.amount, army, avail, () => (isAttack(view, d, plan) ? justEnough(ctx, view, plan, d) : avail));
}

/** How many troops a recruit order defaults to: as many as the gold left buys. */
export const affordableTroops = (ctx: GameContext, plan: QueuePlan) => Math.max(0, Math.floor(plan.goldLeft / ctx.rules.troops.cost));

/** Troops a queued recruit order should buy (its gold divided by the troop cost). */
export const recruitedBy = (ctx: GameContext, plan: QueuePlan, i: number) => Math.round((plan.costs[i] ?? 0) / ctx.rules.troops.cost);

/** The recruit chips: All, then 3/4, 1/2, 1/4 of your gold (an exact number lives under More). */
export const RECRUIT_CHOICES: readonly RecruitAmount[] = ["all", ...SHARES.map((share) => ({ share }))];
export const sameRecruit = (a: RecruitAmount, b: RecruitAmount) => (isShare(a) && isShare(b) ? a.share === b.share : a === b);

// ---------- Moves and attacks ----------

export interface MoveTarget {
  to: TerritoryId;
  /** Middle step for a two-territory cavalry move. */
  via?: TerritoryId;
  /** Right of passage: the partner's land it marches through on the way. */
  through?: TerritoryId[];
}

/** Players whose land you may march through (right of passage), from the deals you see. */
export const passageOpen = (view: PlayerView): PlayerId[] =>
  passageFor(
    view.deals.filter((d) => d.terms).map((d) => ({ a: d.a, b: d.b, terms: d.terms! })),
    view.me.id,
  );

/**
 * Where an army can go: every neighbour, plus two steps through your own land if it has cavalry, plus (with right of
 * passage) land beyond a partner's land you can see, up to `rules.diplomacy.passage.maxThrough` of it on the way.
 * Works from land an earlier order should capture too (a chained hop). `open`: whose land you may pass through
 * (deals in force; the page adds the ones agreed this turn).
 */
export function moveTargets(ctx: GameContext, view: PlayerView, from: TerritoryId, plan: QueuePlan | null = null, open: readonly PlayerId[] = passageOpen(view)): MoveTarget[] {
  const idx = indexMap(ctx.map);
  if (!isOwned(view, plan, from)) return [];
  const out: MoveTarget[] = (idx.neighbors.get(from) ?? []).map((to) => ({ to }));
  if (open.length) {
    // Breadth first through the partner's land you can see: the shortest way to each place beyond it.
    const isOpen = (t: TerritoryId) => {
      const v = seen(view, t);
      return !!v && !!v.owner && open.includes(v.owner) && !plan?.captured.has(t);
    };
    const ways = new Map<TerritoryId, TerritoryId[]>();
    const q: TerritoryId[] = [];
    for (const n of idx.neighbors.get(from) ?? []) if (isOpen(n)) (ways.set(n, [n]), q.push(n));
    const max = ctx.rules.diplomacy.passage.maxThrough;
    while (q.length) {
      const t = q.shift()!;
      const way = ways.get(t)!;
      for (const n of idx.neighbors.get(t) ?? []) {
        if (n === from || ways.has(n)) continue;
        if (isOpen(n)) {
          if (way.length < max) (ways.set(n, [...way, n]), q.push(n));
          continue;
        }
        // Never into the land of a partner whose land it crossed (it doesn't fight there).
        const owner = seen(view, n)?.owner;
        if (owner && owner !== view.me.id && way.some((w) => seen(view, w)?.owner === owner)) continue;
        if (!out.some((x) => x.to === n)) out.push({ to: n, through: way });
      }
    }
  }
  const specs = plan?.armySpecs.get(from) ?? seen(view, from)?.specialists.map((s) => s.type) ?? [];
  if (specs.includes("cavalry")) {
    const near = new Set([from, ...(idx.neighbors.get(from) ?? [])]);
    for (const via of idx.neighbors.get(from) ?? []) {
      if (!isOwned(view, plan, via)) continue;
      for (const to of idx.neighbors.get(via) ?? []) if (!near.has(to) && !out.some((t) => t.to === to)) out.push({ to, via });
    }
  }
  return out;
}

export interface MoveDraft {
  from: TerritoryId;
  to: TerritoryId;
  via?: TerritoryId;
  /** Right of passage: the partner's land it marches through on the way. */
  through?: TerritoryId[];
  /** A share of the army there when the order plays, Just enough, or an exact number (under More). */
  amount: TroopAmount;
  preset: PresetId | null;
  withLeader: boolean;
  timing: "first" | "last" | null;
  /**
   * A hop pushing on from an attack that sends Just enough: that attack (this order id) is raised to All when the
   * hop is added, so there's an army to push on with.
   */
  raise?: string;
}

/** The queued attack into `from` that sends Just enough, if a hop from there should raise it to All. */
export function raiseFor(plan: QueuePlan, queue: readonly Order[], from: TerritoryId): string | undefined {
  if (!plan.captured.has(from)) return undefined;
  const into = [...queue].reverse().find((o) => o.kind === "move" && o.to === from);
  return into?.kind === "move" && into.troops === "enough" ? into.id : undefined;
}

/** The queue as it will be once this draft is added (with its Just-enough attack raised to All). */
export const queueFor = (queue: readonly Order[], d: Pick<MoveDraft, "raise"> | null): readonly Order[] =>
  d?.raise ? queue.map((o) => (o.id === d.raise && o.kind === "move" ? { ...o, troops: "all" as const } : o)) : queue;

/** The preset a new order starts with: attacks start with "Only if still stronger" switched on (one tap turns it off). */
export const defaultPreset = (view: PlayerView, to: TerritoryId, plan: QueuePlan | null = null): PresetId | null => (isAttack(view, { to }, plan) ? "onlyIfStronger" : null);

/** Is this order pushing on from land an earlier order moves into or captures (a chained hop)? */
export const isHop = (plan: QueuePlan, from: TerritoryId) => plan.arrived.has(from);

/**
 * A new move or attack with the defaults: a first attack sends Just enough (or All if even that wouldn't do);
 * a chained hop and a move send All. Attacks start with "Only if still stronger".
 */
export function newDraft(ctx: GameContext, view: PlayerView, plan: QueuePlan, target: MoveTarget & { from: TerritoryId }): MoveDraft {
  const d: MoveDraft = {
    from: target.from,
    to: target.to,
    ...(target.via ? { via: target.via } : {}),
    ...(target.through ? { through: target.through } : {}),
    amount: "all",
    preset: defaultPreset(view, target.to, plan),
    withLeader: false,
    timing: null,
  };
  if (isAttack(view, d, plan) && !isHop(plan, d.from) && justEnough(ctx, view, plan, d) !== null) d.amount = "enough";
  return d;
}

export const isAttack = (view: PlayerView, d: Pick<MoveDraft, "to">, plan: QueuePlan | null = null) => !isOwned(view, plan, d.to);

export type Odds = "guaranteed" | "likely" | "possible" | "impossible" | "unknown";
export const ODDS_LABEL: Record<Odds, string> = {
  guaranteed: "Guaranteed",
  likely: "Likely",
  possible: "Possible",
  impossible: "Impossible",
  unknown: "Can't see",
};

function expectation(ctx: GameContext, view: PlayerView, plan: QueuePlan, d: Omit<MoveDraft, "amount">, troops: number) {
  return previewAttack(ctx, view, {
    from: d.from,
    to: d.to,
    troops,
    specialists: plan.armySpecs.get(d.from) ?? [],
    withLeader: d.withLeader,
    ...(d.via ? { via: d.via } : {}),
    ...(d.through ? { through: d.through } : {}),
  });
}

/**
 * The odds badge, from the same math the engine uses, with the troops this order should send. Based on the board at
 * the start of the turn (and, for a chained hop, the army expected to arrive: see `oddsAreEstimate`).
 */
export function oddsFor(ctx: GameContext, view: PlayerView, plan: QueuePlan, d: MoveDraft, troops = troopsOf(ctx, view, plan, d)): Odds {
  if (troops <= 0) return "impossible";
  const e = expectation(ctx, view, plan, d, troops);
  if (!e) return "unknown";
  if (e.captureGuaranteed) return "guaranteed";
  if (e.captureLikely) return "likely";
  if (e.captureImpossible) return "impossible";
  return "possible";
}

/** The army for this order depends on a battle earlier in the queue, so its odds are an estimate. */
export const oddsAreEstimate = (plan: QueuePlan, d: Pick<MoveDraft, "from">) => plan.estimated.has(d.from);

/**
 * Fewest troops expected to take the target, plus a small safety margin (the same rule the engine and bots use),
 * capped at what's free. Null if even every free troop isn't likely to win, or the target is hidden.
 */
export function justEnough(ctx: GameContext, view: PlayerView, plan: QueuePlan, d: Omit<MoveDraft, "amount">): number | null {
  const max = plan.free.get(d.from) ?? 0;
  return fewestToTake((troops) => !!expectation(ctx, view, plan, d, troops)?.captureLikely, max);
}

/** The share chips, in order: Just enough (attacks only), All, 3/4, 1/2, 1/4. */
export function amountChoices(attack: boolean): TroopAmount[] {
  return [...(attack ? (["enough"] as TroopAmount[]) : []), "all", ...SHARES.map((share) => ({ share }))];
}

export const sameAmount = (a: TroopAmount, b: TroopAmount) => (isShare(a) && isShare(b) ? a.share === b.share : a === b);

/** "about 9, 3/4" ("9, All" when it isn't an estimate; just "9" for an exact number). */
export function amountPill(troops: number, amount: TroopAmount, estimate: boolean): string {
  const n = `${estimate ? "about " : ""}${troops}`;
  return typeof amount === "number" ? n : `${n}, ${amountLabel(amount)}`;
}

/** The preset chips that make sense for this order. */
export function presetsFor(view: PlayerView, d: Pick<MoveDraft, "to">, plan: QueuePlan | null = null): PresetInfo[] {
  const ids: PresetId[] = isAttack(view, d, plan)
    ? ["onlyIfStronger", "holdIfThreatened", "retreatIfOutnumbered", "followThrough"]
    : ["reinforceIfHit", "holdIfThreatened"];
  return ids.map((id) => PRESETS.find((p) => p.id === id)!);
}

/** Can the Leader go with this army? */
export const leaderCanJoin = (view: PlayerView, from: TerritoryId) => view.me.leader.alive && view.me.leader.territory === from;

/** Leader timing tricks still available this turn (one order each, and only while they're off cooldown). */
export function timingAvailable(view: PlayerView, queue: readonly Order[], timing: "first" | "last"): boolean {
  if (!view.me.leader.alive) return false;
  if ((timing === "first" ? view.me.cooldowns.seize : view.me.cooldowns.lie) > 0) return false;
  return !queue.some((o) => o.timing === timing);
}

export function draftToOrder(d: MoveDraft, id: string): Order {
  return {
    id,
    kind: "move",
    from: d.from,
    to: d.to,
    ...(d.via ? { via: d.via } : {}),
    ...(d.through?.length ? { through: d.through } : {}),
    troops: d.amount,
    ...(d.withLeader ? { withLeader: true } : {}),
    ...(d.preset ? { preset: { id: d.preset } } : {}),
    ...(d.timing ? { timing: d.timing } : {}),
  };
}

/**
 * Where the army from `from` ends up after the queued orders: follow the last queued move out of each stop that
 * should arrive. Null if nothing arrives anywhere from `from`.
 */
export function chainTip(plan: QueuePlan, queue: readonly Order[], from: TerritoryId): TerritoryId | null {
  let tip: TerritoryId | null = null;
  let at = from;
  for (let guard = 0; guard < queue.length; guard++) {
    const out = [...queue].reverse().find((o) => o.kind === "move" && o.from === at && plan.arrived.has(o.to));
    if (!out || out.kind !== "move") break;
    tip = out.to;
    at = out.to;
  }
  return tip;
}

// ---------- Tapping the map ----------

export type TapAction = { kind: "select"; territory: TerritoryId } | { kind: "deselect" } | { kind: "draft"; draft: MoveDraft };

/**
 * What a tap on the map does:
 *  - tap one of your territories to select it;
 *  - with one selected, tap a territory it can reach to start a move or attack (if it has troops to send);
 *  - tap where the selected army is heading (an arrow you queued) to select it there, then a neighbour to push on:
 *    a chained hop. Tapping a neighbour of where the army is heading starts that hop straight away;
 *  - tap the selected territory again to clear the selection; tap anything else to look at it.
 */
export function tapTerritory(
  ctx: GameContext,
  view: PlayerView,
  plan: QueuePlan,
  selected: TerritoryId | null,
  tapped: TerritoryId,
  queue: readonly Order[] = [],
  open: readonly PlayerId[] = passageOpen(view),
): TapAction {
  if (selected === tapped) return { kind: "deselect" };
  if (selected && plan.arrived.has(tapped) && queue.some((o) => o.kind === "move" && o.from === selected && o.to === tapped))
    return { kind: "select", territory: tapped };
  if (selected && isOwned(view, plan, selected)) {
    const draftFrom = (from: TerritoryId): MoveDraft | null => {
      const raise = raiseFor(plan, queue, from);
      const p = raise ? planQueue(ctx, view, queueFor(queue, { raise })) : plan;
      if ((p.free.get(from) ?? 0) <= 0) return null;
      const target = moveTargets(ctx, view, from, p, open).find((t) => t.to === tapped);
      return target ? { ...newDraft(ctx, view, p, { ...target, from }), ...(raise ? { raise } : {}) } : null;
    };
    const tip = chainTip(plan, queue, selected);
    const draft = draftFrom(selected) ?? (tip && tip !== tapped ? draftFrom(tip) : null);
    if (draft) return { kind: "draft", draft };
  }
  return { kind: "select", territory: tapped };
}

// ---------- Queue editing ----------

/** An order before it gets its id. */
export type NewOrder = Order extends infer O ? (O extends Order ? Omit<O, "id"> : never) : never;

export function removeOrder(queue: readonly Order[], id: string): Order[] {
  return queue.filter((o) => o.id !== id);
}

/** Move an order up (-1) or down (+1) in the queue. */
export function shiftOrder(queue: readonly Order[], id: string, dir: -1 | 1): Order[] {
  const i = queue.findIndex((o) => o.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= queue.length) return [...queue];
  const next = [...queue];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

// ---------- Territory actions ----------

export type HireOption = { specialist: SpecialistType; cost: number; ok: boolean; why?: string };

export function hireOptions(ctx: GameContext, view: PlayerView, plan: QueuePlan, t: TerritoryId): HireOption[] {
  const { rules } = ctx;
  const idx = indexMap(ctx.map);
  const province = idx.byId.get(t)!.province;
  const provinceCulture = (idx.provinceMembers.get(province) ?? []).reduce((a, m) => a + (isMine(view, m) ? (plan.culture.get(m) ?? 0) : 0), 0);
  const types: SpecialistType[] = ["cavalry", "scouts", "siege", "engineers", "healers", "rangers", "standardBearer"];
  return types.map((specialist) => {
    const def = rules.specialists[specialist];
    let why: string | undefined;
    if ((plan.specialists.get(t) ?? 0) >= rules.specialists.maxPerArmy) why = `An army carries at most ${rules.specialists.maxPerArmy}`;
    else if (def.cultureRequired > provinceCulture) why = `Needs ${def.cultureRequired} culture in this province`;
    else if (def.cost > plan.goldLeft) why = "Not enough gold";
    return { specialist, cost: def.cost, ok: !why, ...(why ? { why } : {}) };
  });
}

/**
 * Hiring a spy here (session 15): at your capital or a barracks, with spies in the game, up to the cap (counting the
 * ones queued this turn). Null where spies can't be hired at all.
 */
export function spyHireOption(ctx: GameContext, view: PlayerView, plan: QueuePlan, t: TerritoryId): { cost: number; ok: boolean; why?: string } | null {
  const r = ctx.rules.spies;
  if (!spiesOn(view) || !isHireSite(view, t)) return null;
  let why: string | undefined;
  if (view.spies.length + plan.spiesHired >= r.max) why = `You may have at most ${r.max} spies`;
  else if (r.cost > plan.goldLeft) why = "Not enough gold";
  return { cost: r.cost, ok: !why, ...(why ? { why } : {}) };
}

export type BuildOption = { building: BuildingType; cost: number; ok: boolean };
export function buildOptions(ctx: GameContext, plan: QueuePlan, t: TerritoryId): BuildOption[] {
  const types: BuildingType[] = ["fort", "market", "barracks", "watchtower"];
  return types.map((building) => {
    const cost = ctx.rules.buildings[building].cost;
    return { building, cost, ok: !plan.building.has(t) && cost <= plan.goldLeft };
  });
}

/** Cost of the next culture level here (after queued raises), or null if maxed. */
export const nextCultureCost = (ctx: GameContext, plan: QueuePlan, t: TerritoryId) => investCost(ctx.rules, plan.culture.get(t) ?? 0);

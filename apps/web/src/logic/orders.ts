import type { BuildingType, SpecialistType } from "@conquerra/content";
import {
  indexMap,
  investCost,
  PRESETS,
  previewAttack,
  type GameContext,
  type Order,
  type PlayerView,
  type PresetId,
  type PresetInfo,
  type TerritoryDetail,
  type TerritoryId,
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
export const isRecruitSite = (view: PlayerView, t: TerritoryId) =>
  isMine(view, t) && (t === view.me.capital || seen(view, t)!.building === "barracks");

// ---------- Walking the queue ----------

export interface QueuePlan {
  /** Gold left after everything queued is paid for. */
  goldLeft: number;
  /** Gold each order spends, in queue order (0 for moves). */
  costs: number[];
  /** Troops that can still be sent from each of your territories (the 1-troop garrison always stays). */
  free: Map<TerritoryId, number>;
  /** Specialists each of your armies will have after queued hires. */
  specialists: Map<TerritoryId, number>;
  /** Culture level each of your territories reaches after queued raises. */
  culture: Map<TerritoryId, number>;
  /** Territories that already have a building queued. */
  building: Set<TerritoryId>;
  /** Territories with an attack queued against them. */
  targeted: Set<TerritoryId>;
}

/**
 * Plays the queue forward the way the engine will run your orders (one after another, in order),
 * to work out gold and free troops. Recruits can act the same turn; troops that move in can't move again.
 */
export function planQueue(ctx: GameContext, view: PlayerView, queue: readonly Order[]): QueuePlan {
  const { rules } = ctx;
  const garrison = rules.setup.minGarrison;
  let gold = view.me.gold;
  const plan: QueuePlan = {
    goldLeft: 0,
    costs: [],
    free: new Map(),
    specialists: new Map(),
    culture: new Map(),
    building: new Set(),
    targeted: new Set(),
  };
  for (const [id, v] of Object.entries(view.territories)) {
    if (v.detail !== "full" || v.owner !== view.me.id) continue;
    plan.free.set(id, Math.max(0, v.troops - garrison));
    plan.specialists.set(id, v.specialists.length);
    plan.culture.set(id, v.culture);
    if (v.building || v.construction) plan.building.add(id);
  }
  for (const o of queue) {
    let cost = 0;
    switch (o.kind) {
      case "recruit": {
        const count = Math.min(o.count, Math.floor(gold / rules.troops.cost));
        cost = Math.max(0, count) * rules.troops.cost;
        plan.free.set(o.territory, (plan.free.get(o.territory) ?? 0) + Math.max(0, count));
        break;
      }
      case "hire":
        cost = rules.specialists[o.specialist].cost;
        plan.specialists.set(o.territory, (plan.specialists.get(o.territory) ?? 0) + 1);
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
        const avail = plan.free.get(o.from) ?? 0;
        const sent = o.troops === "all" ? avail : Math.min(o.troops, avail);
        plan.free.set(o.from, avail - sent);
        if (!isMine(view, o.to)) plan.targeted.add(o.to);
        break;
      }
      case "retreat":
        plan.free.set(o.from, 0);
        break;
    }
    if (cost > gold) cost = o.kind === "recruit" ? cost : 0; // the engine skips what you can't afford
    gold -= cost;
    plan.costs.push(cost);
  }
  plan.goldLeft = gold;
  return plan;
}

/** How many troops a recruit order defaults to: as many as the gold left buys. */
export const affordableTroops = (ctx: GameContext, plan: QueuePlan) => Math.max(0, Math.floor(plan.goldLeft / ctx.rules.troops.cost));

// ---------- Moves and attacks ----------

export interface MoveTarget {
  to: TerritoryId;
  /** Middle step for a two-territory cavalry move. */
  via?: TerritoryId;
}

/** Where an army can go: every neighbour, plus two steps through your own land if it has cavalry. */
export function moveTargets(ctx: GameContext, view: PlayerView, from: TerritoryId): MoveTarget[] {
  const idx = indexMap(ctx.map);
  const here = seen(view, from);
  if (!here || here.owner !== view.me.id) return [];
  const out: MoveTarget[] = (idx.neighbors.get(from) ?? []).map((to) => ({ to }));
  if (here.specialists.some((s) => s.type === "cavalry")) {
    const near = new Set([from, ...(idx.neighbors.get(from) ?? [])]);
    for (const via of idx.neighbors.get(from) ?? []) {
      if (!isMine(view, via)) continue;
      for (const to of idx.neighbors.get(via) ?? []) if (!near.has(to) && !out.some((t) => t.to === to)) out.push({ to, via });
    }
  }
  return out;
}

export interface MoveDraft {
  from: TerritoryId;
  to: TerritoryId;
  via?: TerritoryId;
  troops: number;
  preset: PresetId | null;
  withLeader: boolean;
  timing: "first" | "last" | null;
}

/** The preset a new order starts with: attacks start with "Only if still stronger" switched on (one tap turns it off). */
export const defaultPreset = (view: PlayerView, to: TerritoryId): PresetId | null => (isAttack(view, { to }) ? "onlyIfStronger" : null);

/** A new move or attack with the defaults: all free troops but the garrison; attacks start with "Only if still stronger". */
export function newDraft(view: PlayerView, plan: QueuePlan, target: MoveTarget & { from: TerritoryId }): MoveDraft {
  return {
    from: target.from,
    to: target.to,
    ...(target.via ? { via: target.via } : {}),
    troops: plan.free.get(target.from) ?? 0,
    preset: defaultPreset(view, target.to),
    withLeader: false,
    timing: null,
  };
}

export const isAttack = (view: PlayerView, d: Pick<MoveDraft, "to">) => !isMine(view, d.to);

export type Odds = "guaranteed" | "likely" | "possible" | "impossible" | "unknown";
export const ODDS_LABEL: Record<Odds, string> = {
  guaranteed: "Guaranteed",
  likely: "Likely",
  possible: "Possible",
  impossible: "Impossible",
  unknown: "Can't see",
};

/** The odds badge, from the same math the engine uses. Based on the board at the start of the turn. */
export function oddsFor(ctx: GameContext, view: PlayerView, d: MoveDraft): Odds {
  if (d.troops <= 0) return "impossible";
  const specialists = seen(view, d.from)?.specialists.map((s) => s.type) ?? [];
  const e = previewAttack(ctx, view, {
    from: d.from,
    to: d.to,
    troops: d.troops,
    specialists,
    withLeader: d.withLeader,
    ...(d.via ? { via: d.via } : {}),
  });
  if (!e) return "unknown";
  if (e.captureGuaranteed) return "guaranteed";
  if (e.captureLikely) return "likely";
  if (e.captureImpossible) return "impossible";
  return "possible";
}

/**
 * Fewest troops expected to take the target, plus a small safety margin (the same rule the bots use),
 * capped at what's free. Null if even every free troop isn't likely to win, or the target is hidden.
 */
export function justEnough(ctx: GameContext, view: PlayerView, plan: QueuePlan, d: MoveDraft): number | null {
  const max = plan.free.get(d.from) ?? 0;
  const likely = (troops: number) => troops > 0 && ["likely", "guaranteed"].includes(oddsFor(ctx, view, { ...d, troops }));
  if (!likely(max)) return null;
  let lo = 1, hi = max;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (likely(mid)) hi = mid;
    else lo = mid + 1;
  }
  return Math.min(max, lo + Math.max(1, Math.ceil(lo * 0.2)));
}

/** The preset chips that make sense for this order. */
export function presetsFor(view: PlayerView, d: Pick<MoveDraft, "to">): PresetInfo[] {
  const ids: PresetId[] = isAttack(view, d)
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
    troops: d.troops,
    ...(d.withLeader ? { withLeader: true } : {}),
    ...(d.preset ? { preset: { id: d.preset } } : {}),
    ...(d.timing ? { timing: d.timing } : {}),
  };
}

// ---------- Tapping the map ----------

export type TapAction = { kind: "select"; territory: TerritoryId } | { kind: "deselect" } | { kind: "draft"; draft: MoveDraft };

/**
 * What a tap on the map does:
 *  - tap one of your territories to select it;
 *  - with one selected, tap a territory it can reach to start a move or attack (if it has troops to send);
 *  - tap the selected territory again to clear the selection; tap anything else to look at it.
 */
export function tapTerritory(
  ctx: GameContext,
  view: PlayerView,
  plan: QueuePlan,
  selected: TerritoryId | null,
  tapped: TerritoryId,
): TapAction {
  if (selected === tapped) return { kind: "deselect" };
  if (selected && isMine(view, selected) && (plan.free.get(selected) ?? 0) > 0) {
    const target = moveTargets(ctx, view, selected).find((t) => t.to === tapped);
    if (target) return { kind: "draft", draft: newDraft(view, plan, { ...target, from: selected }) };
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
  const types: SpecialistType[] = ["cavalry", "scouts", "siege", "engineers", "healers"];
  return types.map((specialist) => {
    const def = rules.specialists[specialist];
    let why: string | undefined;
    if ((plan.specialists.get(t) ?? 0) >= rules.specialists.maxPerArmy) why = `An army carries at most ${rules.specialists.maxPerArmy}`;
    else if (def.cultureRequired > provinceCulture) why = `Needs ${def.cultureRequired} culture in this province`;
    else if (def.cost > plan.goldLeft) why = "Not enough gold";
    return { specialist, cost: def.cost, ok: !why, ...(why ? { why } : {}) };
  });
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

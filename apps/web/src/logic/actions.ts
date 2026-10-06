import { distancesFrom, incomeFor, indexMap, recruitSitesIn, type GameContext, type GameState, type PlayerView, type TerritoryId } from "@conquerra/engine";
import { cultureNext } from "../map/card";
import { affordableTroops, isMine, isRecruitSite, nextCultureCost, seen, type QueuePlan } from "./orders";

/**
 * What the round buttons on the action bar can do right now. Pure, so the tap count is tested without a screen.
 */
export interface ActionBarState {
  /**
   * Recruit: one tap recruits as many troops as you can afford at the selected territory if it's a recruit site (your
   * capital when nothing is selected), and opens the Recruit panel. `at` is null when the selected land can't
   * recruit: the panel then says why and offers the nearest site.
   */
  recruit: { ok: boolean; at: TerritoryId | null; count: number; why?: string };
  /** Spend (hire a specialist or build): needs one of your territories selected. */
  spend: { ok: boolean; why?: string };
  /** Culture: `next` says what one more level here adds, shown before you tap. */
  culture: { ok: boolean; cost: number | null; why?: string; next?: string };
  retreat: { ok: boolean; why?: string };
}

/** Where a tap on Recruit sends the troops: the selected territory if it can recruit; the capital if nothing is selected. */
export function recruitSite(ctx: GameContext, view: PlayerView, selected: TerritoryId | null): TerritoryId | null {
  const t = selected ?? view.me.capital;
  return isRecruitSite(ctx, view, t) ? t : null;
}

/** The recruit site nearest to `from` (fewest borders to cross; ties by name). Null if you have none. */
export function nearestRecruitSite(ctx: GameContext, view: PlayerView, from: TerritoryId | null): TerritoryId | null {
  const sites = recruitSitesIn(ctx, view);
  if (!sites.length) return null;
  const idx = indexMap(ctx.map);
  const dist = distancesFrom(idx, from ?? view.me.capital);
  const name = (t: TerritoryId) => idx.byId.get(t)?.name ?? t;
  return [...sites].sort((a, b) => (dist.get(a) ?? 1e9) - (dist.get(b) ?? 1e9) || name(a).localeCompare(name(b)))[0]!;
}

/** Why the selected land can't recruit, in one line. */
export const RECRUIT_RULE = "Recruit at your capital, a barracks, or anywhere in a province you hold completely";

export function actionBarState(ctx: GameContext, view: PlayerView, plan: QueuePlan, selected: TerritoryId | null): ActionBarState {
  const at = recruitSite(ctx, view, selected);
  const count = affordableTroops(ctx, plan);
  const anySite = recruitSitesIn(ctx, view).length > 0;
  const mine = !!selected && isMine(view, selected);
  const cost = mine ? nextCultureCost(ctx, plan, selected!) : null;
  const idx = indexMap(ctx.map);
  const ownNeighbour = mine && (idx.neighbors.get(selected!) ?? []).some((t) => isMine(view, t));
  return {
    recruit: anySite && count > 0 ? { ok: true, at, count } : { ok: false, at, count, why: !anySite ? `Nowhere to recruit: ${RECRUIT_RULE.toLowerCase()}` : "Not enough gold" },
    spend: mine ? { ok: true } : { ok: false, why: "Select one of your territories first" },
    culture: !mine ? { ok: false, cost: null, why: "Select one of your territories first" } : cost === null ? { ok: false, cost, why: "Culture is at its highest here" } : cost > plan.goldLeft ? { ok: false, cost, why: "Not enough gold" } : { ok: true, cost, next: cultureNext(ctx, view, selected!, plan.culture.get(selected!) ?? 0, plan.culture) ?? undefined },
    retreat: ownNeighbour ? { ok: true } : { ok: false, why: mine ? "No territory of yours next door to fall back to" : "Select one of your territories first" },
  };
}

/**
 * Gold you'll earn at the end of this turn (after upkeep), worked out from your own view. Your own land is always
 * in full view, which is all income depends on.
 */
export function incomeEstimate(ctx: GameContext, view: PlayerView): number {
  const territories: GameState["territories"] = {};
  for (const id of indexMap(ctx.map).ids) {
    const v = seen(view, id);
    territories[id] = v && v.owner === view.me.id
      ? { owner: v.owner, troops: v.troops, specialists: v.specialists, building: v.building, construction: v.construction, culture: v.culture }
      : { owner: null, troops: 0, specialists: [], building: null, construction: null, culture: 0 };
  }
  // Your spies (only yours are in your view) cost their upkeep while away.
  const state = { territories, players: [view.me], spies: view.spies.map((x) => ({ ...x, owner: view.me.id })) } as unknown as GameState;
  return incomeFor(ctx, state, view.me.id).net;
}

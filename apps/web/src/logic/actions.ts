import { incomeFor, indexMap, type GameContext, type GameState, type PlayerView, type TerritoryId } from "@conquerra/engine";
import { affordableTroops, isMine, isRecruitSite, nextCultureCost, seen, type QueuePlan } from "./orders";

/**
 * What the round buttons on the action bar can do right now. Pure, so the tap count is tested without a screen.
 */
export interface ActionBarState {
  /** Recruit: one tap recruits as many troops as you can afford at the selected territory if it can recruit, else at your capital. */
  recruit: { ok: boolean; at: TerritoryId | null; count: number; why?: string };
  /** Spend (hire a specialist or build): needs one of your territories selected. */
  spend: { ok: boolean; why?: string };
  culture: { ok: boolean; cost: number | null; why?: string };
  retreat: { ok: boolean; why?: string };
}

export function recruitSite(view: PlayerView, selected: TerritoryId | null): TerritoryId | null {
  if (selected && isRecruitSite(view, selected)) return selected;
  return isRecruitSite(view, view.me.capital) ? view.me.capital : null;
}

export function actionBarState(ctx: GameContext, view: PlayerView, plan: QueuePlan, selected: TerritoryId | null): ActionBarState {
  const at = recruitSite(view, selected);
  const count = affordableTroops(ctx, plan);
  const mine = !!selected && isMine(view, selected);
  const cost = mine ? nextCultureCost(ctx, plan, selected!) : null;
  const idx = indexMap(ctx.map);
  const ownNeighbour = mine && (idx.neighbors.get(selected!) ?? []).some((t) => isMine(view, t));
  return {
    recruit: at && count > 0 ? { ok: true, at, count } : { ok: false, at, count, why: !at ? "You need your capital or a barracks to recruit" : "Not enough gold" },
    spend: mine ? { ok: true } : { ok: false, why: "Select one of your territories first" },
    culture: !mine ? { ok: false, cost: null, why: "Select one of your territories first" } : cost === null ? { ok: false, cost, why: "Culture is at its highest here" } : cost > plan.goldLeft ? { ok: false, cost, why: "Not enough gold" } : { ok: true, cost },
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
  const state = { territories, players: [view.me] } as unknown as GameState;
  return incomeFor(ctx, state, view.me.id).net;
}

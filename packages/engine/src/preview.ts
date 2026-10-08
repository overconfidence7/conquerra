import type { SpecialistType } from "@conquerra/content";
import { expectBattle, type BattleExpectation } from "./combat";
import { indexMap } from "./mapIndex";
import type { GameContext, TerritoryId } from "./types";
import type { PlayerView } from "./view";

export interface AttackPlan {
  from: TerritoryId;
  to: TerritoryId;
  troops: number;
  specialists?: readonly SpecialistType[];
  withLeader?: boolean;
  via?: TerritoryId;
  /** Right of passage: the partner's land passed through on the way (the attack comes from the last of it). */
  through?: readonly TerritoryId[];
}

/**
 * Odds preview for the order screen and for bots. Works from a PlayerView (fog-safe).
 * Returns null if the target is hidden by fog.
 */
export function previewAttack(ctx: GameContext, view: PlayerView, a: AttackPlan): BattleExpectation | null {
  const target = view.territories[a.to];
  if (!target || target.detail !== "full") return null;
  const idx = indexMap(ctx.map);
  const def = idx.byId.get(a.to)!;
  const border = idx.border(a.through?.[a.through.length - 1] ?? a.via ?? a.from, a.to) ?? "normal";
  return expectBattle(ctx.rules, {
    attackers: a.troops,
    attackerSpecialists: a.specialists ?? [],
    attackerLeader: !!a.withLeader,
    // A walled target: everyone its wall would send (the wall and its garrison are visible to anyone who sees part of it).
    defenders: view.walls?.find((w) => w.territories.includes(a.to))?.defend[a.to] ?? target.troops,
    defenderSpecialists: target.specialists.map((s) => s.type),
    defenderLeader: target.owner !== null && target.leaders.includes(target.owner),
    terrain: def.terrain,
    building: target.building,
    culture: target.culture,
    border,
    luck: view.settings.luck,
  });
}

/**
 * Recruit sites from a player's own view: the capital, any barracks, and any territory in a province they hold
 * completely. Your own land is always in full view, so this matches the engine's rule exactly.
 */
export function isRecruitSiteIn(ctx: GameContext, view: PlayerView, t: TerritoryId): boolean {
  const mine = (id: TerritoryId) => {
    const v = view.territories[id];
    return !!v && v.detail === "full" && v.owner === view.me.id;
  };
  if (!mine(t)) return false;
  const v = view.territories[t]!;
  if (t === view.me.capital || (v.detail === "full" && v.building === "barracks")) return true;
  const idx = indexMap(ctx.map);
  const members = idx.provinceMembers.get(idx.byId.get(t)?.province ?? "") ?? [];
  return members.length > 0 && members.every(mine);
}

export function recruitSitesIn(ctx: GameContext, view: PlayerView): TerritoryId[] {
  return indexMap(ctx.map).ids.filter((t) => isRecruitSiteIn(ctx, view, t));
}

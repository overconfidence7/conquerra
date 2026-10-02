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
  const border = idx.border(a.via ?? a.from, a.to) ?? "normal";
  return expectBattle(ctx.rules, {
    attackers: a.troops,
    attackerSpecialists: a.specialists ?? [],
    attackerLeader: !!a.withLeader,
    defenders: target.troops,
    defenderSpecialists: target.specialists.map((s) => s.type),
    defenderLeader: target.owner !== null && target.leaders.includes(target.owner),
    terrain: def.terrain,
    building: target.building,
    border,
    luck: view.settings.luck,
  });
}

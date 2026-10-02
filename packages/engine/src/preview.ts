import type { Rules } from "@conquerra/content";
import { expectBattle, type BattleExpectation } from "./combat";
import { indexMap } from "./mapIndex";
import type { GameContext, TerritoryId, Units } from "./types";
import type { PlayerView } from "./view";

/**
 * Odds preview for the order screen and for bots. Works from a PlayerView (fog-safe).
 * Returns null if the target is hidden by fog.
 */
export function previewAttack(
  ctx: GameContext,
  view: PlayerView,
  from: TerritoryId,
  to: TerritoryId,
  attackers: Units,
  withLeader = false,
  via?: TerritoryId,
): BattleExpectation | null {
  const target = view.territories[to];
  if (!target || !target.visible) return null;
  const idx = indexMap(ctx.map);
  const def = idx.byId.get(to)!;
  const border = idx.border(via ?? from, to) ?? "normal";
  return expectBattle(ctx.rules as Rules, {
    attackers,
    attackerLeader: withLeader,
    defenders: target.units,
    defenderLeader: target.owner !== null && target.leaders.includes(target.owner),
    terrain: def.terrain,
    building: target.building,
    border,
    luck: view.settings.luck,
  });
}

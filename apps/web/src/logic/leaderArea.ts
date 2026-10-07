import { distancesFrom, indexMap, leaderAt, type GameContext, type Instruction, type PlayerView, type TerritoryId } from "@conquerra/engine";
import { refFromKey } from "./generals";

/**
 * What a leader's command covers, to outline on the map while that leader is open in the Leaders panel (session 18):
 * its target (glowing) and the provinces it works in (outlined). Expand our empire in this direction outlines the
 * provinces on the way, as the leader judges them (within a step of a shortest way from where it stands).
 */
export function commandArea(ctx: GameContext, view: PlayerView, key: string, command: Instruction | null, picking?: { kind: string; provinces?: string[] } | null): { glow: TerritoryId[]; provinces: string[] } {
  const idx = indexMap(ctx.map);
  const provinceOf = (t: TerritoryId) => idx.byId.get(t)?.province;
  if (picking?.kind === "front") return { glow: [], provinces: picking.provinces ?? [] };
  if (!command) return { glow: [], provinces: [] };
  switch (command.kind) {
    case "push":
      return { glow: [command.territory], provinces: [provinceOf(command.territory)!].filter(Boolean) };
    case "defend":
      return "territory" in command ? { glow: [command.territory], provinces: [] } : { glow: [], provinces: [] };
    case "expand": {
      const at = leaderAt(view.me, refFromKey(key));
      if (!at) return { glow: [command.territory], provinces: [] };
      return { glow: [command.territory], provinces: [...expandWay(ctx, at, command.territory)] };
    }
    case "front":
      return { glow: [], provinces: [...command.provinces] };
    case "buildUp":
    case "culture":
      return { glow: [], provinces: [command.province] };
    default:
      return { glow: [], provinces: [] };
  }
}

/** The provinces on the way from `from` to `target` (a step either side of a shortest way), as the planner sees them. */
export function expandWay(ctx: GameContext, from: TerritoryId, target: TerritoryId, width = 1): Set<string> {
  const idx = indexMap(ctx.map);
  const a = distancesFrom(idx, from), b = distancesFrom(idx, target);
  const total = a.get(target) ?? 0;
  const out = new Set<string>();
  for (const t of idx.ids) if ((a.get(t) ?? 1e9) + (b.get(t) ?? 1e9) <= total + width) out.add(idx.byId.get(t)!.province);
  return out;
}

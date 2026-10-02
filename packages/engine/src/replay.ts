import { indexMap } from "./mapIndex";
import type { GameContext, GameState, PlayerId, StepEvent, TerritoryId, TurnResult } from "./types";
import { visibleTerritories } from "./vision";

/**
 * "Surface details": what reaches you about something that happened in the fog.
 * Only the kind of thing and the province it happened in (province names are public map data).
 */
export interface SurfaceEvent {
  type: "surface";
  step: number;
  what: "battle" | "leaderFell";
  province: string;
}

export type ReplayEvent = StepEvent | SurfaceEvent;

/**
 * Trim a turn's events to what one player may watch in the shared replay:
 *  - everything they did themselves, and every battle they were in;
 *  - full detail for anything touching a territory they could see at the start or end of the turn;
 *  - fogged battles and fallen leaders as surface details ("a battle in Northreach");
 *  - quiet actions in the fog (moves, recruiting, building, culture) are left out entirely;
 *  - eliminations and the end of the game are public.
 */
export function replayFor(ctx: GameContext, before: GameState, result: TurnResult, player: PlayerId): ReplayEvent[] {
  const idx = indexMap(ctx.map);
  const visBefore = visibleTerritories(ctx, before, player);
  const visAfter = visibleTerritories(ctx, result.state, player);
  const sees = (t: TerritoryId) => visBefore.has(t) || visAfter.has(t);
  const surface = (e: StepEvent, what: SurfaceEvent["what"], t: TerritoryId): SurfaceEvent => ({
    type: "surface",
    step: e.step,
    what,
    province: idx.byId.get(t)?.province ?? "unknown",
  });

  return result.events.flatMap((e): ReplayEvent[] => {
    switch (e.type) {
      case "turnStart":
      case "eliminated":
      case "gameOver":
        return [e];
      case "income":
      case "initiative":
      case "fizzled":
        return e.player === player ? [e] : [];
      case "battle":
        if (e.player === player || e.defender === player || sees(e.from) || sees(e.to)) return [e];
        return [surface(e, "battle", e.to)];
      case "moved":
        return e.player === player || sees(e.from) || sees(e.to) ? [e] : [];
      case "leaderKilled":
        return e.player === player || sees(e.territory) ? [e] : [surface(e, "leaderFell", e.territory)];
      case "recruited":
      case "hired":
      case "built":
      case "completed":
      case "invested":
      case "leaderRaised":
        return e.player === player || sees(e.territory) ? [e] : [];
    }
  });
}

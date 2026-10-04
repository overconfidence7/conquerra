import type { LastSeen } from "./intel";
import { indexMap } from "./mapIndex";
import { sightingOf, TurnVision } from "./sightings";
import type { GameContext, GameState, PlayerId, StepEvent, TerritoryId, TurnResult } from "./types";
import { trueDetail, type TerritoryView } from "./view";
import { visionFor } from "./vision";

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

export type SeenTerritory = Extract<TerritoryView, { detail: "full" }>;

/**
 * Your vision changed at this step (the fog lifts during the replay): land that just came into view, exactly as it is
 * at that moment (the same detail `viewFor` gives), and land that just fogged over, with what you last saw there
 * (which is also what your memory keeps). Only ever what you could really see then.
 */
export interface VisionEvent {
  type: "vision";
  step: number;
  revealed: Record<TerritoryId, SeenTerritory>;
  fogged: Record<TerritoryId, LastSeen>;
}

export type ReplayEvent = StepEvent | SurfaceEvent | VisionEvent;

/**
 * Trim a turn's events to what one player may watch in the shared replay. Vision is worked out step by step
 * through the turn (sightings.ts), and:
 *  - everything they did themselves, and every battle they were in, shows;
 *  - any other event shows in full if they could see its territory at the moment it happened (just before or
 *    just after it). Land that only came into view later in the turn doesn't count;
 *  - otherwise fogged battles and fallen Leaders become surface details ("a battle in Northreach"), and quiet
 *    actions in the fog (moves, recruiting, building, culture) are left out entirely;
 *  - eliminations and the end of the game are public;
 *  - after each step where their vision changes, a "vision" event says what came into view and what fogged over.
 */
export function replayFor(ctx: GameContext, before: GameState, result: TurnResult, player: PlayerId): ReplayEvent[] {
  const idx = indexMap(ctx.map);
  const tv = new TurnVision(ctx, before, result.events, [player]);
  const surface = (e: StepEvent, what: SurfaceEvent["what"], t: TerritoryId): SurfaceEvent => ({
    type: "surface",
    step: e.step,
    what,
    province: idx.byId.get(t)?.province ?? "unknown",
  });
  const out: ReplayEvent[] = [];

  for (const e of result.events) {
    const where = placesSeen(e);
    const sawBefore = new Set(where.filter((t) => tv.sees(player, t)));
    const changes = tv.step(e).get(player);
    const sees = (t: TerritoryId) => sawBefore.has(t) || tv.sees(player, t);
    const mine = "player" in e && e.player === player;

    switch (e.type) {
      case "turnStart":
      case "eliminated":
      case "gameOver":
        out.push(e);
        break;
      case "income":
      case "initiative":
      case "fizzled":
        if (mine) out.push(e);
        break;
      case "battle":
        if (mine || e.defender === player || sees(e.from) || sees(e.to)) out.push(e);
        else out.push(surface(e, "battle", e.to));
        break;
      case "moved":
        if (mine || sees(e.from) || sees(e.to)) out.push(e);
        break;
      case "leaderKilled":
        out.push(mine || sees(e.territory) ? e : surface(e, "leaderFell", e.territory));
        break;
      case "recruited":
      case "hired":
      case "built":
      case "completed":
      case "invested":
      case "leaderReturned":
        if (mine || sees(e.territory)) out.push(e);
        break;
    }
    if (changes) out.push(visionEvent(ctx, tv.board, player, e.step, before.turn, changes));
  }
  return out;
}

/** The territories whose visibility decides whether an event shows. */
function placesSeen(e: StepEvent): TerritoryId[] {
  switch (e.type) {
    case "moved":
    case "battle":
      return [e.from, e.to];
    case "leaderKilled":
    case "recruited":
    case "hired":
    case "built":
    case "completed":
    case "invested":
    case "leaderReturned":
      return [e.territory];
    default:
      return [];
  }
}

function visionEvent(ctx: GameContext, board: GameState, player: PlayerId, step: number, turn: number, d: { revealed: TerritoryId[]; fogged: TerritoryId[] }): VisionEvent {
  const vision = d.revealed.length ? visionFor(ctx, board, player) : null;
  const revealed: Record<TerritoryId, SeenTerritory> = {};
  for (const t of d.revealed) revealed[t] = { detail: "full", seenBy: [...(vision?.get(t) ?? [])], ...trueDetail(board, t) };
  const fogged: Record<TerritoryId, LastSeen> = {};
  for (const t of d.fogged) fogged[t] = sightingOf(board, t, turn);
  return { type: "vision", step, revealed, fogged };
}

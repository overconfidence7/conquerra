import type { LastSeen } from "./intel";
import { indexMap } from "./mapIndex";
import { sightingOf, TurnVision } from "./sightings";
import type { GameContext, GameState, PlayerId, StepEvent, TerritoryId, TurnResult } from "./types";
import { politicalOf, seesPolitically, trueDetail, type TerritoryView } from "./view";
import { visionFor } from "./vision";

/**
 * "Surface details": what reaches you about something that happened in the fog.
 * Only the kind of thing and the province it happened in (province names are public map data).
 */
export interface SurfaceEvent {
  type: "surface";
  step: number;
  /** "fate": a Fate event in the fog ("something stirs in Northreach"). */
  what: "battle" | "leaderFell" | "fate";
  province: string;
  /** A Fate card you drew, landing out of your sight. */
  yours?: boolean;
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
 *  - eliminations and the end of the game are public; a knocked-out Leader joining whoever knocked them out (a
 *    captured general) shows to that player and to anyone who can see where it appears; a captured general lost shows
 *    to its owner, to whoever took it, and to anyone who could see it happen;
 *  - after each step where their vision changes, a "vision" event says what came into view and what fogged over.
 */
export function replayFor(ctx: GameContext, before: GameState, result: TurnResult, player: PlayerId): ReplayEvent[] {
  // The Fallen (political map): the public events and the world events, then who holds what at the end. No battles.
  if (seesPolitically(before, player) && !result.state.winner) return fallenReplay(ctx, result, player);
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
      case "generalCaptured":
        if (mine || sees(e.territory)) out.push(e);
        break;
      // Your own general lost always shows, and so does one you took from them; others only where you could see.
      case "generalLost":
        if (mine || e.by === player || sees(e.territory)) out.push(e);
        break;
      case "generalReleased":
      case "worldEventFailed":
      case "spoilsEarned":
      case "missionDrawn":
      case "missionFailed":
        if (mine) out.push(e);
        break;
      // A mission's reward shows to whoever could see the land it changed (the mission itself only to its owner).
      case "missionDone":
        if (mine || placesSeen(e).some(sees)) out.push(e);
        break;
      // A Fate event: the holder of the land always sees it; anyone else in full only if they could see it, otherwise
      // a surface detail ("something stirs in Northreach"), even for whoever drew it.
      case "fate":
        if (e.holder === player || placesSeen(e).some(sees)) out.push(e);
        else out.push({ ...surface(e, "fate", e.at), ...(e.drawer === player ? { yours: true } : {}) });
        break;
      // A windfall shows to whoever could see the land it changed (the set itself only to its owner).
      case "spoilsTurnedIn":
        if (mine || placesSeen(e).some(sees)) out.push(e);
        break;
      // Events on your own land always show; anyone else's only if you could see where it happened.
      case "worldEvent":
        if (e.against === player || placesSeen(e).some(sees)) out.push(e);
        break;
    }
    if (changes) out.push(visionEvent(ctx, tv.board, player, e.step, before.turn, changes));
  }
  // Knocked out this turn with the Fallen on: the replay ends on the political map you'll see from now on.
  if (seesPolitically(result.state, player) && !seesPolitically(before, player)) {
    const fogged: Record<TerritoryId, LastSeen> = {};
    for (const id of idx.ids) fogged[id] = { ...politicalOf(result.state, id), turn: before.turn };
    out.push({ type: "vision", step: result.events[result.events.length - 1]?.step ?? 0, revealed: {}, fogged });
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
    case "generalCaptured":
    case "generalLost":
      return [e.territory];
    case "worldEvent":
      return [e.target, ...(e.border ?? []), ...(e.at ? [e.at] : [])];
    case "spoilsTurnedIn":
      return [e.at, ...e.land.map((l) => l.territory)];
    case "fate":
      return [e.at, ...(e.border ?? []), ...e.land.map((l) => l.territory)];
    case "missionDone":
      return e.land.map((l) => l.territory);
    default:
      return [];
  }
}

/** The Fallen's replay: what's public, every world event, and the political map as the turn ends. */
function fallenReplay(ctx: GameContext, result: TurnResult, player: PlayerId): ReplayEvent[] {
  const out: ReplayEvent[] = [];
  for (const e of result.events) {
    if (e.type === "turnStart" || e.type === "eliminated" || e.type === "gameOver" || e.type === "worldEvent") out.push(e);
    else if (e.type === "worldEventFailed" && e.player === player) out.push(e);
  }
  const last = result.events[result.events.length - 1]?.step ?? 0;
  const fogged: Record<TerritoryId, LastSeen> = {};
  // (The turn has moved on in the result; the map is stamped with the turn just played, like any sighting.)
  for (const id of indexMap(ctx.map).ids) fogged[id] = { ...politicalOf(result.state, id), turn: result.state.turn - 1 };
  out.push({ type: "vision", step: last, revealed: {}, fogged });
  return out;
}

function visionEvent(ctx: GameContext, board: GameState, player: PlayerId, step: number, turn: number, d: { revealed: TerritoryId[]; fogged: TerritoryId[] }): VisionEvent {
  const vision = d.revealed.length ? visionFor(ctx, board, player) : null;
  const revealed: Record<TerritoryId, SeenTerritory> = {};
  for (const t of d.revealed) revealed[t] = { detail: "full", seenBy: [...(vision?.get(t) ?? [])], ...trueDetail(board, t) };
  const fogged: Record<TerritoryId, LastSeen> = {};
  for (const t of d.fogged) fogged[t] = sightingOf(board, t, turn);
  return { type: "vision", step, revealed, fogged };
}

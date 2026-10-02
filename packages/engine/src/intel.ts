import type { BuildingType } from "@conquerra/content";
import { indexMap } from "./mapIndex";
import type { GameContext, GameState, PlayerId, TerritoryId } from "./types";
import { visionFor } from "./vision";

/**
 * "Last seen" intel (design v0.2 §8): what a player remembers about a territory they saw before but can't see now.
 * Shown on fogged land, marked "?" with its age.
 */
export interface LastSeen {
  owner: PlayerId | null;
  troops: number;
  building: BuildingType | null;
  /** The turn it was seen: the turn number the player was planning when they saw it. */
  turn: number;
}

/** Each player's memory, kept in the game state: player -> territory -> what they last saw there. */
export type Intel = Record<PlayerId, Record<TerritoryId, LastSeen>>;

/**
 * The one way anything gets into a player's memory. Today only real sightings use it (`updateIntel`).
 * A fooled spy (M3) calls this with forged values: the entry looks exactly like a real one, because the
 * memory doesn't record where it came from, so the fooled player can't tell.
 */
export function recordSighting(state: GameState, player: PlayerId, territory: TerritoryId, seen: LastSeen): void {
  const mem = (state.intel[player] ??= {});
  mem[territory] = { owner: seen.owner, troops: seen.troops, building: seen.building, turn: seen.turn };
}

/**
 * Refresh every player's memory from what they can see right now. Runs when the game starts and at the end of
 * each turn (after the turn number moves on), so entries are stamped with the turn the player was planning.
 * With fog off, or once a player is out or the game is over, everything is visible and nothing is remembered.
 */
export function updateIntel(ctx: GameContext, state: GameState): void {
  if (!state.settings.fog || state.winner) return;
  const idx = indexMap(ctx.map);
  for (const p of state.players) {
    if (p.eliminatedTurn !== null) continue;
    const vision = visionFor(ctx, state, p.id);
    for (const id of idx.ids) {
      if (!vision.has(id)) continue;
      const t = state.territories[id]!;
      recordSighting(state, p.id, id, { owner: t.owner, troops: t.troops, building: t.building, turn: state.turn });
    }
  }
}

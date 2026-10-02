import type { BuildingType } from "@conquerra/content";
import { indexMap } from "./mapIndex";
import type { GameContext, GameSettings, GameState, PlayerId, PlayerState, StepEvent, TerritoryId, Units } from "./types";

export type TerritoryView =
  | { visible: true; owner: PlayerId | null; units: Units; building: BuildingType | null; leaders: PlayerId[] }
  | { visible: false };

export interface PlayerView {
  gameId: string;
  mapId: string;
  turn: number;
  me: PlayerState;
  players: { id: PlayerId; name: string; eliminatedTurn: number | null }[];
  territories: Record<TerritoryId, TerritoryView>;
  settings: GameSettings;
  seedCommitment: string;
  winner: GameState["winner"];
}

/** Which territories a player can currently see. Eliminated players and fog-off games see everything. */
export function visibleTerritories(ctx: GameContext, state: GameState, player: PlayerId): Set<TerritoryId> {
  const idx = indexMap(ctx.map);
  const me = state.players.find((p) => p.id === player);
  if (!state.settings.fog || !me || me.eliminatedTurn !== null || state.winner) return new Set(idx.ids);
  const seen = new Set<TerritoryId>();
  for (const id of idx.ids) {
    const t = state.territories[id]!;
    if (t.owner !== player) continue;
    const radius = ctx.rules.vision.base + (t.building ? ctx.rules.buildings[t.building].vision : 0);
    let frontier = [id];
    seen.add(id);
    for (let r = 0; r < radius; r++) {
      const next: TerritoryId[] = [];
      for (const f of frontier)
        for (const n of idx.neighbors.get(f) ?? [])
          if (!seen.has(n)) (seen.add(n), next.push(n));
      frontier = next;
    }
  }
  return seen;
}

/** The only thing a client is ever sent: the game as this player is allowed to see it. */
export function viewFor(ctx: GameContext, state: GameState, player: PlayerId): PlayerView {
  const idx = indexMap(ctx.map);
  const vis = visibleTerritories(ctx, state, player);
  const me = state.players.find((p) => p.id === player);
  if (!me) throw new Error(`Unknown player ${player}`);
  const territories: Record<TerritoryId, TerritoryView> = {};
  for (const id of idx.ids) {
    if (!vis.has(id)) {
      territories[id] = { visible: false };
      continue;
    }
    const t = state.territories[id]!;
    territories[id] = {
      visible: true,
      owner: t.owner,
      units: { ...t.units },
      building: t.building,
      leaders: state.players.filter((p) => p.leader.alive && p.leader.territory === id).map((p) => p.id),
    };
  }
  return {
    gameId: state.gameId,
    mapId: state.mapId,
    turn: state.turn,
    me: structuredCloneLite(me),
    players: state.players.map((p) => ({ id: p.id, name: p.name, eliminatedTurn: p.eliminatedTurn })),
    territories,
    settings: { ...state.settings },
    seedCommitment: state.seedCommitment,
    winner: state.winner,
  };
}

/**
 * Trim a turn's replay log to what a player could see: their own actions, plus anything
 * touching a territory they could see at the start or end of the turn.
 */
export function eventsFor(
  events: StepEvent[],
  player: PlayerId,
  visibleBefore: Set<TerritoryId>,
  visibleAfter: Set<TerritoryId>,
): StepEvent[] {
  const sees = (t: TerritoryId) => visibleBefore.has(t) || visibleAfter.has(t);
  return events.flatMap((e): StepEvent[] => {
    switch (e.type) {
      case "turnStart":
      case "eliminated":
      case "gameOver":
        return [e];
      case "income":
        return e.player === player ? [e] : [];
      case "initiative":
      case "fizzled":
        return e.player === player ? [e] : [];
      case "moved":
      case "battle":
        return e.player === player || sees(e.from) || sees(e.to) ? [e] : [];
      case "recruited":
      case "built":
      case "leaderRaised":
      case "leaderKilled":
        return e.player === player || sees(e.territory) ? [e] : [];
    }
  });
}

function structuredCloneLite<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

import type { BuildingType } from "@conquerra/content";
import type { LastSeen } from "./intel";
import { indexMap } from "./mapIndex";
import type { GameContext, GameSettings, GameState, PlayerId, PlayerState, Specialist, TerritoryId, TerritoryState } from "./types";
import { visionFor, type VisionSource } from "./vision";

/** What a player sees on a territory they have vision of. */
export interface TerritoryDetail {
  owner: PlayerId | null;
  troops: number;
  specialists: Specialist[];
  building: BuildingType | null;
  construction: TerritoryState["construction"];
  culture: number;
  /** Leaders standing here. */
  leaders: PlayerId[];
  /** Whose capital this is, while its own House holds it. You learn a rival's capital by seeing it. */
  capitalOf: PlayerId | null;
}

/**
 * A fogged territory carries nothing current: its outline, terrain, province and holding bonuses are all public
 * map data (MapDef + Rules), which every client already has. Owner, troops and culture stay hidden.
 * `lastSeen` is the player's own memory of it (owner, troops, building and when), if they ever saw it.
 */
export type TerritoryView = ({ detail: "full"; seenBy: VisionSource[] } & TerritoryDetail) | { detail: "fogged"; lastSeen?: LastSeen };

export interface PlayerView {
  gameId: string;
  mapId: string;
  turn: number;
  me: PlayerState;
  /** Public facts about every player (no gold, no capital location). */
  players: { id: PlayerId; name: string; eliminatedTurn: number | null; eliminatedBy: PlayerId | null }[];
  territories: Record<TerritoryId, TerritoryView>;
  settings: GameSettings;
  seedCommitment: string;
  winner: GameState["winner"];
}

/** The true detail of a territory. Spies' forged intel (M3) will be produced by an alternative to this. */
function trueDetail(state: GameState, id: TerritoryId): TerritoryDetail {
  const t = state.territories[id]!;
  return {
    owner: t.owner,
    troops: t.troops,
    specialists: t.specialists.map((s) => ({ ...s })),
    building: t.building,
    construction: t.construction ? { ...t.construction } : null,
    culture: t.culture,
    leaders: state.players.filter((p) => p.leader.alive && p.leader.territory === id).map((p) => p.id),
    capitalOf: state.players.find((p) => p.eliminatedTurn === null && p.capital === id && t.owner === p.id)?.id ?? null,
  };
}

/** The only thing a client is ever sent: the game as this player is allowed to see it. */
export function viewFor(ctx: GameContext, state: GameState, player: PlayerId): PlayerView {
  const idx = indexMap(ctx.map);
  const me = state.players.find((p) => p.id === player);
  if (!me) throw new Error(`Unknown player ${player}`);
  const vision = visionFor(ctx, state, player);
  const memory = state.intel[player] ?? {};
  const territories: Record<TerritoryId, TerritoryView> = {};
  for (const id of idx.ids) {
    const seenBy = vision.get(id);
    const last = memory[id];
    territories[id] = seenBy
      ? { detail: "full", seenBy: [...seenBy], ...trueDetail(state, id) }
      : last
        ? { detail: "fogged", lastSeen: { ...last } }
        : { detail: "fogged" };
  }
  return {
    gameId: state.gameId,
    mapId: state.mapId,
    turn: state.turn,
    me: JSON.parse(JSON.stringify(me)) as PlayerState,
    players: state.players.map((p) => ({ id: p.id, name: p.name, eliminatedTurn: p.eliminatedTurn, eliminatedBy: p.eliminatedBy })),
    territories,
    settings: { ...state.settings },
    seedCommitment: state.seedCommitment,
    winner: state.winner,
  };
}

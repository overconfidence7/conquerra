import type { LastSeen } from "./intel";
import { indexMap } from "./mapIndex";
import { coveredBorders, isParty, passageFor } from "./diplomacy";
import type { Bond, Deal, DealKind, DealRecord, DealTerms, GameContext, GameSettings, GameState, PlayerId, PlayerState, SpyStatus, TerritoryDetail, TerritoryId, WorldEventKind } from "./types";
import { visionFor, type VisionSource } from "./vision";

export type { TerritoryDetail };

/**
 * A fogged territory carries nothing current: its outline, terrain, province and holding bonuses are all public
 * map data (MapDef + Rules), which every client already has. Owner, troops and culture stay hidden.
 * `lastSeen` is the player's own memory of it (owner, troops, building and when), if they ever saw it.
 */
export type TerritoryView = ({ detail: "full"; seenBy: VisionSource[] } & TerritoryDetail) | { detail: "fogged"; lastSeen?: LastSeen };

/**
 * A deal as one player sees it (session 14). Everyone knows who has which deal with whom, for how long, and a joint
 * war's target; the two sides also see the terms (a trade's terms reach nobody else). `borders`: the borders a truce
 * (or a joint war's truce) covers right now, only where this player can see both sides.
 */
export interface DealView {
  id: string;
  kind: DealKind;
  bond: Bond;
  a: PlayerId;
  b: PlayerId;
  start: number;
  last: number;
  /** A truce until this player is knocked out. */
  until?: PlayerId;
  /** A joint war's target. */
  target?: PlayerId;
  /** A truce's scope, without its named borders (those are in `borders`, where you can see them). */
  scope?: "all" | "province" | "borders";
  province?: string;
  /** Right of passage both ways (public, like the rest of who-and-what). */
  mutual?: boolean;
  /** Right of passage: the land an army may pass through under it, only where this player can see it. */
  passage?: TerritoryId[];
  /** The full terms, for the two sides only. */
  terms?: DealTerms;
  /** How big it is (the two sides only): what breaking it would cost. */
  size?: number;
  borders: [TerritoryId, TerritoryId][];
}

export interface PlayerView {
  gameId: string;
  mapId: string;
  turn: number;
  me: PlayerState;
  /**
   * Public facts about every player (no gold, no capital location). `spoils`: how many Spoils cards they hold (never
   * which). `oathbreaker`: the turn their Oathbreaker mark lasts through (0: none showing).
   */
  players: { id: PlayerId; name: string; eliminatedTurn: number | null; eliminatedBy: PlayerId | null; spoils: number; oathbreaker: number; house: number }[];
  territories: Record<TerritoryId, TerritoryView>;
  settings: GameSettings;
  seedCommitment: string;
  winner: GameState["winner"];
  /** Turns until each world event can be played again (public: the Fallen plan with it, the living can see it). */
  eventCooldowns: Record<WorldEventKind, number>;
  /** Crossings a Fate event closed for a coming turn, where you can see either side. */
  closures: GameState["closures"];
  /** Every deal in force (public), with its terms only for its two sides. */
  deals: DealView[];
  /** How past deals ended: your own, and every broken one (Oathbreakers are public). */
  record: DealRecord[];
  /** Your own spies (session 15). Never anyone else's. */
  spies: SpyView[];
  /**
   * The game's record (session 16): land each House held turn by turn, and what each did. Only once the game is over
   * (everything is revealed then); during play nobody is shown land counts.
   */
  history?: GameState["history"];
  stats?: GameState["stats"];
}

/** One of your own spies, as you see it (nobody else ever does). A fooled spy looks exactly like one that got in. */
export interface SpyView {
  id: string;
  at: TerritoryId;
  /** The province it's heading for (null: it stays). */
  target: string | null;
  /** Called home: back at your capital as the next turn starts. */
  recalled: boolean;
  status: SpyStatus;
}

/** One deal as `player` sees it, given what they can see. */
export function dealView(ctx: GameContext, state: GameState, d: Deal, player: PlayerId, sees: (t: TerritoryId) => boolean): DealView {
  const idx = indexMap(ctx.map);
  const mine = isParty(d, player);
  const t = d.terms;
  const borders = coveredBorders(idx, d, (x) => state.territories[x]?.owner ?? null).filter(([x, y]) => mine || (sees(x) && sees(y)));
  return {
    id: d.id,
    kind: t.kind,
    bond: d.bond,
    a: d.a,
    b: d.b,
    start: d.start,
    last: d.last,
    ...(t.kind === "truce" && t.until ? { until: t.until } : {}),
    ...(t.kind === "war" ? { target: t.target } : {}),
    ...(t.kind === "truce" ? { scope: t.scope.kind, ...(t.scope.kind === "province" ? { province: t.scope.province } : {}) } : {}),
    ...(t.kind === "passage" ? { mutual: t.mutual, passage: passageLand(idx, state, d, sees) } : {}),
    ...(mine ? { terms: JSON.parse(JSON.stringify(t)) as DealTerms, size: d.size } : {}),
    borders,
  };
}

/** The land armies may pass through under a passage deal (the grantor's land, both sides' if mutual), where seen. */
function passageLand(idx: ReturnType<typeof indexMap>, state: GameState, d: Deal, sees: (t: TerritoryId) => boolean): TerritoryId[] {
  const grantors = new Set([...passageFor([d], d.a), ...passageFor([d], d.b)]);
  return idx.ids.filter((t) => sees(t) && grantors.has(state.territories[t]?.owner ?? ""));
}

/**
 * Is `player` one of the Fallen with the political map? Knocked out while the game goes on, with fog and the Fallen
 * on: they see who holds what everywhere, but no troop numbers (so nothing about armies reaches living friends).
 */
export function seesPolitically(state: GameState, player: PlayerId): boolean {
  const p = state.players.find((x) => x.id === player);
  return !!p && p.eliminatedTurn !== null && state.settings.fallen && state.settings.fog && !state.winner;
}

/** The political map: every territory's owner now, as a "last seen" with no troop number. */
export const politicalOf = (state: GameState, id: TerritoryId) => ({
  owner: state.territories[id]!.owner,
  troops: 0,
  building: null,
  turn: state.turn,
  political: true,
  capitalOf: state.players.find((p) => p.eliminatedTurn === null && p.capital === id && state.territories[id]!.owner === p.id)?.id ?? null,
});

/** The true detail of a territory. Spies' forged intel (M3) will be produced by an alternative to this. */
export function trueDetail(state: GameState, id: TerritoryId): TerritoryDetail {
  const t = state.territories[id]!;
  return {
    owner: t.owner,
    troops: t.troops,
    specialists: t.specialists.map((s) => ({ ...s })),
    building: t.building,
    construction: t.construction ? { ...t.construction } : null,
    culture: t.culture,
    leaders: state.players.filter((p) => p.leader.alive && p.leader.territory === id).map((p) => p.id),
    generals: (state.players.find((p) => p.id === t.owner)?.captured ?? []).filter((g) => g.territory === id).map((g) => g.of),
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
  const political = seesPolitically(state, player);
  // What your spies report (session 15): land they lift the fog from, as they saw it as the last turn ended. Never land
  // you see yourself (that always shows as it truly is).
  const spied = (!political && state.spyIntel?.[player]) || {};
  for (const id of idx.ids) {
    if (political) {
      territories[id] = { detail: "fogged", lastSeen: politicalOf(state, id) };
      continue;
    }
    const seenBy = vision.get(id);
    const last = memory[id];
    const report = spied[id];
    territories[id] = seenBy
      ? { detail: "full", seenBy: [...seenBy], ...trueDetail(state, id) }
      : report
        ? { detail: "full", seenBy: ["spy"], ...copyDetail(report) }
        : last
        ? { detail: "fogged", lastSeen: { ...last } }
        : { detail: "fogged" };
  }
  return {
    gameId: state.gameId,
    mapId: state.mapId,
    turn: state.turn,
    me: JSON.parse(JSON.stringify(me)) as PlayerState,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      eliminatedTurn: p.eliminatedTurn,
      eliminatedBy: p.eliminatedBy,
      spoils: p.spoils.length,
      oathbreaker: (p.oathbreaker ?? 0) >= state.turn ? p.oathbreaker : 0,
      house: p.house,
    })),
    territories,
    settings: { ...state.settings },
    seedCommitment: state.seedCommitment,
    winner: state.winner,
    eventCooldowns: { ...state.eventCooldowns },
    closures: state.closures.filter((c) => c.turn >= state.turn && (!state.settings.fog || vision.has(c.a) || vision.has(c.b) || political)).map((c) => ({ ...c })),
    deals: (state.deals ?? []).map((d) => dealView(ctx, state, d, player, (t) => !state.settings.fog || political || vision.has(t))),
    record: (state.record ?? []).filter((r) => r.how === "broken" || isParty(r, player)).map((r) => ({ ...r })),
    spies: (state.spies ?? []).filter((x) => x.owner === player).map((x) => ({ id: x.id, at: x.at, target: x.target, recalled: x.recalled, status: x.status })),
    ...(state.winner ? { history: JSON.parse(JSON.stringify(state.history ?? [])) as GameState["history"], stats: JSON.parse(JSON.stringify(state.stats ?? {})) as GameState["stats"] } : {}),
  };
}

/** A territory detail, copied (same shape and order as `trueDetail`). */
export const copyDetail = (d: TerritoryDetail): TerritoryDetail => ({
  owner: d.owner,
  troops: d.troops,
  specialists: d.specialists.map((s) => ({ ...s })),
  building: d.building,
  construction: d.construction ? { ...d.construction } : null,
  culture: d.culture,
  leaders: [...d.leaders],
  generals: [...d.generals],
  capitalOf: d.capitalOf,
});

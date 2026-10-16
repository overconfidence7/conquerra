import type { BorderType, MapDef } from "@conquerra/content";
import type { GameContext, PlayerView, TerritoryId } from "@conquerra/engine";

/**
 * The known map (session 32): the map as one seat has seen it, so a bot under blackout fog reads exactly what a person
 * in that seat is shown. Land the seat has never seen (`unknown` in its view) has no terrain, no name, no province and
 * no borders of its own here. What a person does see at the cloud's edge is kept, without anything about the far side:
 * a known territory's borders into the cloud (the page draws each one, with its pass or sea lane) as their kinds only,
 * never which territory is across.
 *
 * With standard fog nothing is unknown, so the known map IS the map (the same object): every bot gives exactly the
 * orders it always has.
 */
export interface KnownExtras {
  /** How many territories the whole map has: public (the lobby's map card says it), so it's the true count. */
  size: number;
  /** Each known territory's borders into the cloud, by kind (sorted). Empty with standard fog. */
  cloud: ReadonlyMap<TerritoryId, readonly BorderType[]>;
  /**
   * Provinces that may reach into the cloud: one of their known members borders it. (Provinces are joined up, so a
   * province with a member we haven't seen always has one of these; we can't tell more than "maybe" from here.)
   */
  open: ReadonlySet<string>;
}

const NONE: KnownExtras = { size: 0, cloud: new Map(), open: new Set() };
/** A known map -> the full map it was cut from, and what's known at its edge. */
const baseOf = new WeakMap<MapDef, MapDef>();
const extrasOf = new WeakMap<MapDef, KnownExtras>();
/** Per full map, the known maps made lately (keyed by the unknown land), so a turn's many readers share one. */
const made = new WeakMap<MapDef, Map<string, MapDef>>();
const KEEP = 48;

const isUnknown = (view: PlayerView, t: TerritoryId) => {
  const v = view.territories[t];
  return !v || (v.detail === "fogged" && !!v.unknown);
};

/** The map as `view`'s seat knows it (the map itself when nothing is unknown). */
export function knownMap(map: MapDef, view: PlayerView): MapDef {
  const full = baseOf.get(map) ?? map;
  const unknown = full.territories.filter((t) => isUnknown(view, t.id)).map((t) => t.id);
  if (!unknown.length) return full;
  const key = unknown.join("|");
  let list = made.get(full);
  if (!list) made.set(full, (list = new Map()));
  const hit = list.get(key);
  if (hit) return hit;
  const dark = new Set(unknown);
  const known = (t: TerritoryId) => !dark.has(t);
  const cloud = new Map<TerritoryId, BorderType[]>();
  for (const b of full.borders) {
    if (known(b.a) === known(b.b)) continue;
    const at = known(b.a) ? b.a : b.b;
    (cloud.get(at) ?? cloud.set(at, []).get(at)!).push(b.type);
  }
  const territories = full.territories.filter((t) => known(t.id));
  // In the map's own order (never the order of borders we can't see), each one's kinds sorted.
  const edges = new Map(territories.filter((t) => cloud.has(t.id)).map((t) => [t.id, cloud.get(t.id)!.sort()] as const));
  const provinceOf = new Map(territories.map((t) => [t.id, t.province]));
  const seenProvinces = new Set(territories.map((t) => t.province));
  const open = new Set([...edges.keys()].map((t) => provinceOf.get(t)!));
  const out: MapDef = {
    id: full.id,
    name: full.name,
    minPlayers: full.minPlayers,
    maxPlayers: full.maxPlayers,
    recommendedPlayers: full.recommendedPlayers,
    territories,
    provinces: full.provinces.filter((p) => seenProvinces.has(p.id)),
    borders: full.borders.filter((b) => known(b.a) && known(b.b)),
    capitalSlots: full.capitalSlots.filter(known),
  };
  baseOf.set(out, full);
  extrasOf.set(out, { size: full.territories.length, cloud: edges, open });
  list.set(key, out);
  if (list.size > KEEP) list.delete(list.keys().next().value!);
  return out;
}

/** The game's context with the known map in place of the map (the context itself when nothing is unknown). */
export function knownCtx(ctx: GameContext, view: PlayerView): GameContext {
  const map = knownMap(ctx.map, view);
  return map === ctx.map ? ctx : { ...ctx, map };
}

/** What's known at a map's edge (for a full map: its size, and no cloud). */
export function knownExtras(map: MapDef): KnownExtras {
  return extrasOf.get(map) ?? { ...NONE, size: map.territories.length };
}

/** How many territories the whole map has (public). */
export const mapSize = (map: MapDef): number => extrasOf.get(map)?.size ?? map.territories.length;

/**
 * A province the seat can't yet see all of ("you hold 2 of ?"): one of its known members borders the cloud. Counted as
 * one more member missing, never as any particular territory (always false with standard fog, and for a province we
 * hold all the known land of: we see round all our land).
 */
export const provinceOpen = (map: MapDef, province: string): boolean => extrasOf.get(map)?.open.has(province) ?? false;

/** How many of `t`'s borders lead into the cloud (0 with standard fog, and for land we hold: we always see round it). */
export const cloudBorders = (map: MapDef, t: TerritoryId): number => extrasOf.get(map)?.cloud.get(t)?.length ?? 0;

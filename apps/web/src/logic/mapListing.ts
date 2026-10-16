import { mapCatalog, type MapListing } from "@conquerra/content";
import { parseRandomId, randomPlayers, RANDOM_PREFIX, RANDOM_SHAPE_A, type RandomMapId } from "@conquerra/mapgen/randomId";

/**
 * Session 30: what the lobby and the lists say about a game's map, an official one or a random one (from its id
 * alone, so nothing has to be built). In the start-up bundle: only the id reading (`@conquerra/mapgen/randomId`).
 */
export interface Listing extends MapListing {
  random?: RandomMapId;
}

export function listingOf(mapId: string): Listing | null {
  if (mapId.startsWith(RANDOM_PREFIX)) {
    const r = parseRandomId(mapId);
    if (!r) return null;
    const p = randomPlayers(r.size, r.shape);
    return { id: mapId, name: "Random map", territories: r.size, minPlayers: p.min, maxPlayers: p.max, recommendedPlayers: p.recommended, random: r };
  }
  return mapCatalog.find((m) => m.id === mapId) ?? null;
}

/** "80 territories, a crescent, seed quiet-heron". */
export const randomLine = (r: RandomMapId) => `${r.size} territories, ${RANDOM_SHAPE_A[r.shape]}, seed ${r.seed}`;

/** A map's name in a list: "Embervale", or "Random, 80 territories (quiet-heron)". */
export function mapNameOf(mapId: string, fallback = mapId): string {
  const l = listingOf(mapId);
  if (!l) return fallback;
  return l.random ? `Random, ${l.random.size} territories (${l.random.seed})` : l.name;
}

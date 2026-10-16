import { listingOf } from "./mapListing";

/** Session 30: a map's name in a list: "Embervale", or "Random, 80 territories (quiet-heron)". (Not in the start-up bundle.) */
export function mapNameOf(mapId: string, fallback = mapId): string {
  const l = listingOf(mapId);
  if (!l) return fallback;
  return l.random ? `Random, ${l.random.size} territories (${l.random.seed})` : l.name;
}

import { MapDef } from "./schemas";

/**
 * Each built-in map's data as its own file, fetched only when a game on that map starts (so the game's start-up
 * stays small however many maps there are). A new official map needs one line here as well as in `maps.ts`.
 */
const LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  embervale: () => import("../data/maps/embervale.json"),
  greatmarch: () => import("../data/maps/greatmarch.json"),
  "shattered-isles": () => import("../data/maps/shattered-isles.json"),
  "twin-realms": () => import("../data/maps/twin-realms.json"),
  "moon-coast": () => import("../data/maps/moon-coast.json"),
  ringsea: () => import("../data/maps/ringsea.json"),
  crownlands: () => import("../data/maps/crownlands.json"),
  wyrmland: () => import("../data/maps/wyrmland.json"),
};

export const loadableMaps = Object.keys(LOADERS);

export async function loadMap(id: string): Promise<MapDef> {
  const load = LOADERS[id];
  if (!load) throw new Error(`Unknown map ${id}`);
  return MapDef.parse((await load()).default);
}

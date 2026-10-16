import { defaultRules, type MapDef } from "@conquerra/content";
import { RANDOM_PREFIX } from "@conquerra/mapgen/randomId";

/**
 * Session 30: a game's map from its id. An official map is fetched (each its own file); a random map is built by the
 * map maker from its id, here, the first time it's asked for (the map maker loads only then), and kept for the next
 * ask (the lobby's picture, then the game). `version`: the map maker version a save or a game was made at; a random
 * map from another version can't be rebuilt the same, and says so.
 */
const built = new Map<string, Promise<MapDef>>();

export async function loadGameMap(id: string, version?: number | null): Promise<MapDef> {
  if (!id.startsWith(RANDOM_PREFIX)) return (await import("@conquerra/content/loadMap")).loadMap(id);
  const gen = await import("@conquerra/mapgen");
  if (version !== undefined && version !== gen.MAPGEN_VERSION) throw new Error(gen.RANDOM_TEXT.oldVersion(version));
  let p = built.get(id);
  if (!p) {
    p = Promise.resolve().then(() => gen.randomMap(id, defaultRules).map);
    built.set(id, p);
    // (A failed seed isn't kept: the next ask tries it again, and says the same plain line.)
    p.catch(() => built.delete(id));
    // A few at most: big maps are a few MB each.
    if (built.size > 4) built.delete(built.keys().next().value!);
  }
  return p;
}

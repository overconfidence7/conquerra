import { defaultRules, type MapDef } from "@conquerra/content";
import { RANDOM_PREFIX } from "@conquerra/mapgen/randomId";

/**
 * Session 30: a game's map from its id. An official map is fetched (each its own file); a random map is built by the
 * map maker from its id, here, the first time it's asked for (the map maker loads only then), and kept for the next
 * ask (the lobby's picture, then the game). `version`: the map maker version a save or a game was made at; a random
 * map from another version can't be rebuilt the same, and says so. `onProgress` (session 31): how far the build is, as
 * tries done plus this try's share (1.4 is 40% into the second try), for the one who asked first.
 */
const built = new Map<string, Promise<MapDef>>();

export async function loadGameMap(id: string, version?: number | null, onProgress?: (done: number) => void, attempt?: number | null): Promise<MapDef> {
  if (!id.startsWith(RANDOM_PREFIX)) return (await import("@conquerra/content/loadMap")).loadMap(id);
  const gen = await import("@conquerra/mapgen");
  // Session 31: a random map is built at the version its game pinned (each version this build knows), else the newest.
  const v = version ?? gen.RANDOM_VERSION;
  if (!gen.isRandomVersion(v)) throw new Error(gen.RANDOM_TEXT.oldVersion(v));
  const key = `${id}@${v}`;
  let p = built.get(key);
  if (!p) {
    // Session 31: progress for the "Making the map…" line (0 to 1 a try; a reroll starts again).
    const watch = onProgress ? (step: number, attempt: number) => onProgress(Math.min(1, step / gen.MAP_STEPS) + attempt - 1) : undefined;
    // (Session 33b: `attempt`, the try the room says passed: one try instead of all of them; the same map either way.)
    p = Promise.resolve().then(() => gen.randomMap(id, defaultRules, { version: v, attempt, ...(watch ? { onProgress: watch } : {}) }).map);
    built.set(key, p);
    // (A failed seed isn't kept: the next ask tries it again, and says the same plain line.)
    p.catch(() => built.delete(key));
    // A few at most: big maps are a few MB each.
    if (built.size > 4) built.delete(built.keys().next().value!);
  }
  return p;
}

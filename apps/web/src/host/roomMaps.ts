import { defaultRules } from "@conquerra/content";
import { MapDef } from "@conquerra/content/schemas";
import type { RoomStore } from "./roomCore";

/**
 * Session 30: the room's maps, a random one too. A random map is made by the map maker from its id (loaded only for
 * one), slimmed (no drawing data, as the official ones are on the server), and kept in the room's own storage: from
 * then on the room reads its copy, so a later deploy (even one with a newer map maker) never changes a game already
 * made. Without a copy, a game made at another map maker version can't be rebuilt here, and says so.
 */
export function roomMapsWith(store: RoomStore, official: (id: string) => Promise<MapDef>): (id: string, version?: number | null, attempt?: number | null) => Promise<MapDef> {
  return async (id, version, attempt) => {
    if (!id.startsWith("random:")) return official(id);
    const kept = (await store.get("randomMap")) as { id: string; map: unknown } | null;
    if (kept && kept.id === id) return MapDef.parse(kept.map);
    const gen = await import("@conquerra/mapgen");
    // Session 31: built at the version the game pinned (each version this build knows), else the newest.
    const v = version ?? gen.RANDOM_VERSION;
    if (!gen.isRandomVersion(v)) throw new Error(gen.RANDOM_TEXT.oldVersion(v));
    // (Session 33b: `attempt`, the try the host's page says passed: made in one try, or every try if it doesn't pass.)
    const { geometry: _drawing, ...slim } = gen.randomMap(id, defaultRules, { version: v, attempt }).map;
    await store.put("randomMap", { id, map: slim });
    return MapDef.parse(slim);
  };
}

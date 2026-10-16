import { MapDef } from "@conquerra/content";
import slimMaps from "./maps.json";

const maps = slimMaps as unknown as Record<string, unknown>;

/** The maps the room plays on: the slim ones (no drawing data), checked as the page's are. Loaded only in a room. */
export async function loadSlimMap(id: string): Promise<MapDef> {
  const raw = maps[id];
  if (!raw) throw new Error(`Unknown map ${id}`);
  return MapDef.parse(raw);
}

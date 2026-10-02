import embervaleJson from "../data/maps/embervale.json";
import greatmarchJson from "../data/maps/greatmarch.json";
import { MapDef } from "./schemas";

/**
 * The full built-in maps, drawing data included (several hundred KB each). Import from "@conquerra/content/maps"
 * only where a game is actually hosted or simulated; the page's lobby uses the small `mapCatalog` instead.
 */
export const maps: Record<string, MapDef> = {
  embervale: MapDef.parse(embervaleJson),
  greatmarch: MapDef.parse(greatmarchJson),
};

import crownlandsJson from "../data/maps/crownlands.json";
import embervaleJson from "../data/maps/embervale.json";
import greatmarchJson from "../data/maps/greatmarch.json";
import moonCoastJson from "../data/maps/moon-coast.json";
import ringseaJson from "../data/maps/ringsea.json";
import shatteredIslesJson from "../data/maps/shattered-isles.json";
import twinRealmsJson from "../data/maps/twin-realms.json";
import wyrmlandJson from "../data/maps/wyrmland.json";
import ashwingJson from "../data/maps/ashwing.json";
import sunderedCrownsJson from "../data/maps/sundered-crowns.json";
import krakenmereJson from "../data/maps/krakenmere.json";
import rootholmJson from "../data/maps/rootholm.json";
import { MapDef } from "./schemas";
import { withBigTables } from "./bigTables";

/**
 * Every built-in map in full, drawing data included (up to about 2 MB each). For Node only (tests, the simulator):
 * the game itself loads one map at a time with `loadMap` from "@conquerra/content/loadMap", and the lobby uses the
 * small `mapCatalog`.
 */
export const mapFiles: Record<string, MapDef> = {
  embervale: MapDef.parse(embervaleJson),
  greatmarch: MapDef.parse(greatmarchJson),
  "shattered-isles": MapDef.parse(shatteredIslesJson),
  "twin-realms": MapDef.parse(twinRealmsJson),
  "moon-coast": MapDef.parse(moonCoastJson),
  ringsea: MapDef.parse(ringseaJson),
  crownlands: MapDef.parse(crownlandsJson),
  wyrmland: MapDef.parse(wyrmlandJson),
  ashwing: MapDef.parse(ashwingJson),
  "sundered-crowns": MapDef.parse(sunderedCrownsJson),
  krakenmere: MapDef.parse(krakenmereJson),
  rootholm: MapDef.parse(rootholmJson),
};

/**
 * The maps games are played on (session 34): the files above with their big tables joined (Krakenmere and Rootholm
 * seat up to 20; `bigTables.ts`), and (session 34b) their later layout versions. `mapFiles` is exactly what the map
 * maker makes (its tests and fingerprints read it).
 */
export const maps: Record<string, MapDef> = Object.fromEntries(Object.entries(mapFiles).map(([id, m]) => [id, withBigTables(m) === m ? m : MapDef.parse(withBigTables(m))]));

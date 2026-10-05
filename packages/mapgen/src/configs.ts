import type { MapGenOptions } from "./index";

/** The recipes for the built-in maps. `pnpm build-maps` makes them; the tests check the committed files match. */
export const MAP_CONFIGS: MapGenOptions[] = [
  {
    id: "embervale",
    name: "Embervale",
    // Map maker v1 took the second try of "embervale"; v2 starts from that seed so the island keeps its shape.
    seed: "embervale#2",
    territories: 40,
    provinces: 8,
    players: { min: 2, max: 6, recommended: { min: 4, max: 6 } },
    water: 0.38,
    seas: 1,
    lakes: 2,
    islandChains: 1,
    mountainRanges: 2,
    seaLanes: 2,
    minSeaLanes: 2,
    rivers: 3,
    minChokePoints: 5,
  },
  {
    id: "greatmarch",
    name: "Greatmarch",
    seed: "greatmarch",
    territories: 80,
    provinces: 20,
    players: { min: 2, max: 10, recommended: { min: 8, max: 10 } },
    water: 0.36,
    seas: 1,
    lakes: 3,
    islandChains: 2,
    mountainRanges: 3,
    seaLanes: 3,
    minSeaLanes: 3,
    rivers: 5,
    minChokePoints: 8,
  },
];

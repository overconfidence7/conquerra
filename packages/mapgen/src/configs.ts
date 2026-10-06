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
  // Session 10 candidates, made official in session 11 (Nate, Oct 5). Recipes exactly as in docs/maps/candidates.md.
  {id: "shattered-isles", name: "The Shattered Isles", seed: "archipelago-60-5", shape: "archipelago", territories: 60, provinces: 13, players: {min: 2, max: 6, recommended: {min: 4, max: 6}}, seas: 0, lakes: 0, islandChains: 0, islands: 9, mountainRanges: 1, seaLanes: 5, minSeaLanes: 8, rivers: 3, minChokePoints: 5, roughness: 0.6},
  {id: "twin-realms", name: "The Twin Realms", seed: "twinContinents-80-2", shape: "twinContinents", territories: 80, provinces: 18, players: {min: 2, max: 8, recommended: {min: 4, max: 8}}, seas: 0, lakes: 2, islandChains: 1, mountainRanges: 3, seaLanes: 3, minSeaLanes: 2, rivers: 4, minChokePoints: 7, roughness: 0.6},
  {id: "moon-coast", name: "The Moon Coast", seed: "crescent-80-2", shape: "crescent", territories: 80, provinces: 18, players: {min: 2, max: 8, recommended: {min: 4, max: 8}}, seas: 0, lakes: 2, islandChains: 0, mountainRanges: 3, seaLanes: 3, minSeaLanes: 2, rivers: 4, minChokePoints: 7, roughness: 0.6, laneReach: 20},
  {id: "ringsea", name: "The Ringsea", seed: "inlandSea-100-6", shape: "inlandSea", territories: 100, provinces: 22, players: {min: 2, max: 10, recommended: {min: 6, max: 10}}, seas: 0, lakes: 3, islandChains: 0, mountainRanges: 3, seaLanes: 4, minSeaLanes: 2, rivers: 5, minChokePoints: 8, roughness: 0.6, laneReach: 20},
  {id: "crownlands", name: "The Crownlands", seed: "mask-100-9", shape: "mask", mask: "crown", territories: 100, provinces: 22, players: {min: 2, max: 10, recommended: {min: 6, max: 10}}, seas: 0, lakes: 3, islandChains: 1, mountainRanges: 3, seaLanes: 4, minSeaLanes: 2, rivers: 5, minChokePoints: 8, roughness: 0.38},
  {id: "wyrmland", name: "Wyrmland", seed: "mask-120-6", shape: "mask", mask: "dragon", territories: 120, provinces: 27, players: {min: 2, max: 10, recommended: {min: 6, max: 8}}, seas: 0, lakes: 3, islandChains: 1, mountainRanges: 2, seaLanes: 5, minSeaLanes: 2, rivers: 6, minChokePoints: 10, roughness: 0.38},
];

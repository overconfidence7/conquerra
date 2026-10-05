import type { MapGenOptions } from "./index";
import type { LandShape } from "./shapes";

/** A full recipe: everything `generateMap` needs. The lab copies one of these into `configs.ts`. */
export type Recipe = Omit<MapGenOptions, "log" | "debug">;

/** Map sizes the lab offers (territories). Embervale (40) stays the quick map; new maps are 60–120. */
export const SIZES = [40, 60, 80, 100, 120] as const;

/** Who a map of this size suits: everyone 2 up to `max` gets a fair capital layout; `recommended` is the lobby's hint. */
function playersFor(t: number): MapGenOptions["players"] {
  if (t <= 50) return { min: 2, max: 6, recommended: { min: 4, max: 6 } };
  if (t <= 70) return { min: 2, max: 6, recommended: { min: 4, max: 6 } };
  if (t <= 90) return { min: 2, max: 8, recommended: { min: 4, max: 8 } };
  if (t <= 110) return { min: 2, max: 10, recommended: { min: 6, max: 10 } };
  return { min: 2, max: 10, recommended: { min: 8, max: 10 } };
}

/**
 * Sensible knobs for a shape and size. Anything in `over` wins. Provinces scale with size (about 4.5 territories
 * each, like Embervale's 5 and Greatmarch's 4), and so do lakes, rivers, ranges, sea lanes and the choke points asked for.
 */
export function recipeFor(shape: LandShape, territories: number, seed: string, over: Partial<Recipe> = {}): Recipe {
  const T = territories;
  const islands = shape === "archipelago" ? Math.max(4, Math.round(T / 6.5)) : undefined;
  const base: Recipe = {
    id: `${shape === "twinContinents" ? "twins" : shape === "inlandSea" ? "inland" : shape}-${T}-${seed}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
    name: `${shape === "mask" ? "Silhouette" : shape[0]!.toUpperCase() + shape.slice(1).replace(/([A-Z])/g, " $1").toLowerCase()} ${T}`,
    seed,
    shape,
    territories: T,
    provinces: Math.round(T / 4.5),
    players: playersFor(T),
    seas: shape === "continent" ? 1 : 0,
    lakes: shape === "archipelago" ? 0 : Math.max(1, Math.round(T / 40)),
    islandChains: shape === "continent" ? Math.max(1, Math.round(T / 50)) : shape === "twinContinents" || shape === "mask" ? 1 : 0,
    mountainRanges: shape === "archipelago" ? Math.max(1, Math.round(T / 60)) : Math.max(2, Math.round(T / 30)),
    seaLanes: shape === "archipelago" ? Math.round(islands! * 0.5) : shape === "continent" ? Math.max(2, Math.round(T / 30)) : Math.max(3, Math.round(T / 25)),
    minSeaLanes: shape === "archipelago" ? islands! - 1 : 2,
    rivers: Math.max(2, Math.round(T / 20)),
    minChokePoints: Math.max(5, Math.round(T / 12)),
    ...(shape === "continent" ? { water: 0.37 } : { roughness: shape === "mask" ? 0.38 : 0.6 }),
    ...(islands !== undefined ? { islands } : {}),
    ...(shape === "mask" ? { mask: "dragon" } : {}),
    ...(shape === "inlandSea" || shape === "crescent" ? { laneReach: 20 } : {}),
  };
  return { ...base, ...over };
}

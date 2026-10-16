import type { Biome, SpecialistType } from "./schemas";

/**
 * Session 32: the content's plain constants, with no Zod behind them, so the lobby's start-up code can use them (the
 * schemas load with what checks a map or a file, never with the first paint). `schemas.ts` re-exports them.
 */

export const SPECIALIST_TYPES: readonly SpecialistType[] = ["cavalry", "siege", "scouts", "engineers", "healers", "rangers", "standardBearer"] as const;

/** One character per biome in the biome grid. */
export const BIOME_CODES: Record<Biome, string> = {
  grass: "g",
  farmland: "a",
  forest: "f",
  hills: "h",
  rock: "r",
  snow: "s",
  swamp: "w",
  sand: "d",
  shallow: "o",
  deep: "O",
};

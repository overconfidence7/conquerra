import rulesJson from "../data/rules.json";
import catalogJson from "../data/maps/catalog.json";
import personalitiesJson from "../data/personalities.json";
import leaderNamesJson from "../data/leader-names.json";
import type { LeaderNames, Rules } from "./schemas";
import type { MarshalData } from "./personalities";

// Session 32: the types only. The schemas themselves (Zod) are `@conquerra/content/schemas`, for code that checks a
// map, a file or a tweak; the data below is already exactly what its schema makes (a test checks every file), so the
// lobby's start-up code carries no Zod.
export type * from "./schemas";
export type * from "./personalities";
export * from "./plain";

/**
 * The victory mode the lobby suggests for a table of this size (the host can change it).
 * Big tables get Conquest (a turn limit, highest score wins) so games don't drag on; everyone else gets Classic.
 */
export function suggestedMode(playerCount: number, rules: Rules = defaultRules): "classic" | "conquest" {
  return playerCount >= rules.game.conquestSuggestedFromPlayers ? "conquest" : "classic";
}

export const defaultRules: Rules = rulesJson as unknown as Rules;

/** The Marshal's personalities and shared judgement (session 17): `data/personalities.json`. */
export const marshalData: MarshalData = personalitiesJson as unknown as MarshalData;

/**
 * Names for leaders (session 18): bots' Leaders and Stewards are dealt from these by the game's seed, and the lobby
 * suggests one for yours. `data/leader-names.json`.
 */
export const leaderNames: LeaderNames = leaderNamesJson as unknown as LeaderNames;

/** What the lobby needs to list the built-in maps, without loading them. (`pnpm build-maps` writes it.) */
export interface MapListing {
  id: string;
  name: string;
  territories: number;
  minPlayers: number;
  maxPlayers: number;
  recommendedPlayers: { min: number; max: number };
}
export const mapCatalog: MapListing[] = catalogJson;

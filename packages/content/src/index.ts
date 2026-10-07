import rulesJson from "../data/rules.json";
import catalogJson from "../data/maps/catalog.json";
import personalitiesJson from "../data/personalities.json";
import leaderNamesJson from "../data/leader-names.json";
import { LeaderNames, Rules } from "./schemas";
import { MarshalData } from "./personalities";

export * from "./schemas";
export * from "./personalities";

/**
 * The victory mode the lobby suggests for a table of this size (the host can change it).
 * Big tables get Conquest (a turn limit, highest score wins) so games don't drag on; everyone else gets Classic.
 */
export function suggestedMode(playerCount: number, rules: Rules = defaultRules): "classic" | "conquest" {
  return playerCount >= rules.game.conquestSuggestedFromPlayers ? "conquest" : "classic";
}

export const defaultRules: Rules = Rules.parse(rulesJson);

/** The Marshal's personalities and shared judgement (session 17): `data/personalities.json`. */
export const marshalData: MarshalData = MarshalData.parse(personalitiesJson);

/**
 * Names for leaders (session 18): bots' Leaders and Stewards are dealt from these by the game's seed, and the lobby
 * suggests one for yours. `data/leader-names.json`.
 */
export const leaderNames: LeaderNames = LeaderNames.parse(leaderNamesJson);

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

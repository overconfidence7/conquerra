import rulesJson from "../data/rules.json";
import catalogJson from "../data/maps/catalog.json";
import { Rules } from "./schemas";

export * from "./schemas";

/**
 * The victory mode the lobby suggests for a table of this size (the host can change it).
 * Big tables get Conquest (a turn limit, highest score wins) so games don't drag on; everyone else gets Classic.
 */
export function suggestedMode(playerCount: number, rules: Rules = defaultRules): "classic" | "conquest" {
  return playerCount >= rules.game.conquestSuggestedFromPlayers ? "conquest" : "classic";
}

export const defaultRules: Rules = Rules.parse(rulesJson);

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

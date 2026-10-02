import rulesJson from "../data/rules.json";
import embervaleJson from "../data/maps/embervale.json";
import greatmarchJson from "../data/maps/greatmarch.json";
import { MapDef, Rules } from "./schemas";

export * from "./schemas";

/**
 * The victory mode the lobby suggests for a table of this size (the host can change it).
 * Big tables get Conquest (a turn limit, highest score wins) so games don't drag on; everyone else gets Classic.
 */
export function suggestedMode(playerCount: number, rules: Rules = defaultRules): "classic" | "conquest" {
  return playerCount >= rules.game.conquestSuggestedFromPlayers ? "conquest" : "classic";
}

export const defaultRules: Rules = Rules.parse(rulesJson);
export const maps: Record<string, MapDef> = {
  embervale: MapDef.parse(embervaleJson),
  greatmarch: MapDef.parse(greatmarchJson),
};

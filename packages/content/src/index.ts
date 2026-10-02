import rulesJson from "../data/rules.json";
import embervaleJson from "../data/maps/embervale.json";
import { MapDef, Rules } from "./schemas";

export * from "./schemas";

export const defaultRules: Rules = Rules.parse(rulesJson);
export const maps: Record<string, MapDef> = {
  embervale: MapDef.parse(embervaleJson),
};

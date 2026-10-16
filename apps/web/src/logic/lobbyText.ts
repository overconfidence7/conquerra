import type { LobbySettings } from "../host/protocol";
import { DEFAULT_HOUSE, HOUSE_PLAIN, HOUSES } from "../map/houses";
import { styleLabel } from "./text";
import { timerLabel } from "./timer";

/** The lobby's words (session 25b): the luck choices and the folded blocks' one-line summaries. */
export const LUCK = [
  { value: 0, label: "None", word: "no luck" },
  { value: 0.15, label: "Low", word: "low luck" },
  { value: 0.3, label: "Normal", word: "normal luck" },
  { value: 0.5, label: "High", word: "high luck" },
];

/** The Rules block's one line ("normal luck, fog on, Fate on, diplomacy on, classic, 5 min"). */
export function rulesSummary(l: LobbySettings): string {
  const luck = LUCK.find((x) => x.value === l.luck)?.word ?? `luck ${l.luck}`;
  return [luck, l.fog === "blackout" ? "blackout fog" : `fog ${l.fog ? "on" : "off"}`, `Fate ${l.fate === false ? "off" : "on"}`, `diplomacy ${l.diplomacy === false ? "off" : "on"}`, l.mode, timerLabel(l.turnSeconds).replace("No timer", "no timer")].join(", ");
}

/** The Your House block's one line ("Gules (red), Leader Osric (Neutral), Steward Fulk (Turtle)"). */
export function houseSummary(l: LobbySettings, stewardSuggestion: string): string {
  const h = l.house ?? DEFAULT_HOUSE;
  const leader = l.leaderName?.trim() || "unnamed";
  const steward = l.stewardName?.trim() || stewardSuggestion;
  return `${HOUSES[h]!.name} (${HOUSE_PLAIN[h]}), Leader ${leader} (${styleLabel(l.leaderPersonality ?? null)}), Steward ${steward} (${styleLabel(l.stewardPersonality ?? null)})`;
}


import type { ReplayEvent } from "@conquerra/engine";
import type { TurnReport } from "../host/protocol";

/*
 * What the Chronicle (session 16) keeps of each turn's report. On its own, so the game host and the store can trim
 * reports without loading the Chronicle's wording (that loads with the Chronicle).
 */

/** The events the Chronicle keeps (the host keeps only these from each report, so saves stay small). */
export function keepForChronicle(e: ReplayEvent): boolean {
  switch (e.type) {
    case "battle":
    case "fate":
    case "worldEvent":
    case "dealStarted":
    case "dealBroken":
    case "dealEnded":
    case "spy":
    case "spyCaught":
    case "governed":
    case "generalCaptured":
    case "generalLost":
    case "leaderKilled":
    case "eliminated":
    case "missionDone":
    case "missionFailed":
    case "spoilsTurnedIn":
    case "gameOver":
      return true;
    // Fogged: only the kind of thing and the province ("a battle in Northreach", "something stirs").
    case "surface":
      return true;
    // A general's own marches (your leaders' work).
    case "moved":
      return !!e.general;
    default:
      return false;
  }
}

/** A turn's report, trimmed to what the Chronicle keeps. */
export const chronicleOf = (r: TurnReport): TurnReport => ({ turn: r.turn, events: r.events.filter(keepForChronicle) });


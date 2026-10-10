import type { SlotInfo } from "../host/saves";

/** "Embervale · 4 players · turn 12". */
export function slotLine(info: SlotInfo): string {
  const s = info.summary;
  return `${s.mapName} · ${s.players.length} players · turn ${s.turn}${s.fallen ? " · one of the Fallen" : ""}`;
}

/** "Today 14:05", "Yesterday 09:12", "3 Oct 18:40". */
export function savedWhen(at: number, now = Date.now()): string {
  const d = new Date(at);
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(new Date(now)) - day(d)) / 86_400_000);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`;
}

/** The last game played on this device that ended (its autosave is gone then: Continue only offers games in progress). */
const FINISHED_KEY = "conquerra.lastFinished";
export interface FinishedGame {
  mapName: string;
  turn: number;
  at: number;
}

export function rememberFinished(game: FinishedGame) {
  try {
    localStorage.setItem(FINISHED_KEY, JSON.stringify(game));
  } catch {
    // A private window: nothing to remember.
  }
}

export function forgetFinished() {
  try {
    localStorage.removeItem(FINISHED_KEY);
  } catch {
    // As above.
  }
}

export function lastFinished(): FinishedGame | null {
  try {
    const g = JSON.parse(localStorage.getItem(FINISHED_KEY) ?? "null") as FinishedGame | null;
    return g && typeof g.mapName === "string" && typeof g.turn === "number" ? g : null;
  } catch {
    return null;
  }
}

/** What the empty Autosave line says: "Last game finished (Embervale, turn 14)" right after a game ends. */
export function emptyAutosaveLine(finished: FinishedGame | null): string {
  return finished ? `Last game finished (${finished.mapName}, turn ${finished.turn}). A new game saves itself every turn.` : "Nothing saved yet. The game saves itself every turn, so you don't have to.";
}

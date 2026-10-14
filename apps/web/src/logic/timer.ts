/**
 * The turn timer, as the page shows it. The game host keeps the real deadline (and locks your orders in when it
 * passes); the page only counts down to it. M4 swaps the host for the server, which does the same.
 */

/** Timer choices in the lobby (seconds; null = No timer, for relaxed solo play). */
export const TIMER_CHOICES: readonly (number | null)[] = [60, 180, 300, 600, null];
export const DEFAULT_TIMER = 300;
/**
 * Online timers (Nate, Oct 12): 3, 5 and 10 minutes, and long turns of 1, 8 and 24 hours for games played across days.
 * No "No timer" online (the table would wait forever on someone who left).
 */
export const ONLINE_TIMER_CHOICES: readonly number[] = [180, 300, 600, 3600, 8 * 3600, 24 * 3600];

/** The timer turns gold at one minute left, and red at fifteen seconds. */
export const GOLD_AT_MS = 60_000;
export const RED_AT_MS = 15_000;

export interface TurnClock {
  /** When your orders lock in automatically (ms, the host's clock). */
  endsAt: number;
  /** The full turn length (the countdown never shows more, even while the replay is still playing). */
  turnMs: number;
  /** Paused (single player): the time left when the clock stopped. Nothing locks in until it's resumed. */
  pausedLeft?: number;
}

export type TimerTone = "calm" | "gold" | "red";

export function remainingMs(clock: TurnClock, now: number): number {
  if (clock.pausedLeft !== undefined) return Math.max(0, Math.min(clock.turnMs, clock.pausedLeft));
  return Math.max(0, Math.min(clock.turnMs, clock.endsAt - now));
}

export function timerTone(remaining: number): TimerTone {
  return remaining <= RED_AT_MS ? "red" : remaining <= GOLD_AT_MS ? "gold" : "calm";
}

/** "4:59", "0:07", "10:00"; a long turn "7:59:59". */
export function formatClock(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s >= 3600) return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const timerLabel = (seconds: number | null) => (seconds === null ? "No timer" : seconds >= 3600 ? `${seconds / 3600} h` : `${seconds / 60} min`);

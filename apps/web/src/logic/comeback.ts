import type { PlayerView } from "@conquerra/engine";

/**
 * The comeback (Nate, Oct 10): when your own House falls to a quarter of the most land it ever held and later climbs
 * back above half of it, a title card plays, once a game. Yours only: a rival's land size is hidden (the Players
 * panel shows no territory counts), so a card about a rival's comeback would give away what the fog hides.
 *
 * Worked out by the host after each turn from your own land (always known exactly), kept in the save.
 */
export interface ComebackMemory {
  /** The most territories your House has held at the end of a turn. */
  peak: number;
  /** You've been down to a quarter of `peak` or less. */
  low?: true;
  /** The turn the card played (it plays once a game). */
  shown?: number;
}

/** Below this many territories at its height, a House is too small for a fall and a comeback to mean anything. */
export const COMEBACK_MIN_PEAK = 8;

/** Your own territories in your view. */
export function ownLand(view: PlayerView): number {
  let n = 0;
  for (const t of Object.values(view.territories)) if (t.detail !== "fogged" && t.owner === view.me.id) n++;
  return n;
}

/** After a turn: the memory, and whether the comeback card plays this turn. */
export function comebackStep(memory: ComebackMemory | undefined, land: number, turn: number): { memory: ComebackMemory; card: boolean } {
  const m: ComebackMemory = { ...(memory ?? { peak: 0 }) };
  if (m.shown !== undefined) return { memory: m, card: false };
  if (m.low && land * 2 > m.peak) return { memory: { ...m, shown: turn }, card: true };
  if (!m.low) m.peak = Math.max(m.peak, land);
  if (!m.low && m.peak >= COMEBACK_MIN_PEAK && land * 4 <= m.peak) m.low = true;
  return { memory: m, card: false };
}

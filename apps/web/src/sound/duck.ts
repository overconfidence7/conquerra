/**
 * The music's dip under big moments (session 24): a capital falling, a House knocked out, the Fallen. Shared by the
 * sound effects (which ask for it) and the music (which follows it), with nothing else in it, so the title music can
 * use it without loading the effects.
 */
/** The music under a big moment, as a share of its volume. */
export const DUCK_TO = 0.35;
/** How long it takes to come back up (ms). */
export const DUCK_BACK_MS = 600;
let until = 0;

/** The music dips for `ms` from now. */
export function duck(ms: number, now = performance.now()): void {
  until = Math.max(until, now + ms);
}
/** The music's share of its volume now: DUCK_TO while ducked, easing back after. */
export function duckLevel(now = performance.now()): number {
  if (now < until) return DUCK_TO;
  return Math.min(1, DUCK_TO + ((now - until) / DUCK_BACK_MS) * (1 - DUCK_TO));
}

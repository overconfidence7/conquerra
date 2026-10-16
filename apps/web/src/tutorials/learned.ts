/**
 * Lessons you've finished, remembered on this device (session 31): the tick beside each under Learn. Tiny and in the
 * start-up bundle (the Learn fold's line counts them); the lessons themselves load only when Learn is opened.
 */
const KEY = "conquerra.learned";
/** How many tutorials there are (the fold's line says "3 of 7 done" without loading them; a test keeps it true). */
export const LESSON_COUNT = 7;

export function learned(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function markLearned(id: string) {
  const all = learned();
  if (all.includes(id)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify([...all, id]));
  } catch {
    // A private window: remembered for this visit only (the tick shows until the page closes).
  }
}

/** The Learn fold's line: how many lessons are done. */
export const learnSummary = (done: number) => (done === 0 ? `${LESSON_COUNT} short lessons, about 5 minutes each` : done >= LESSON_COUNT ? `all ${LESSON_COUNT} lessons done` : `${done} of ${LESSON_COUNT} lessons done`);

/**
 * The guided first game (session 31): a new player's first single-player game (no saved games on this device, no
 * lesson done, the guide never shown) gets three prompts on turn 1. Once it starts, the device remembers it, and it
 * never shows again (Learn can start it on purpose).
 */
const GUIDED_KEY = "conquerra.guided";
export function guideSeen(): boolean {
  try {
    return !!localStorage.getItem(GUIDED_KEY);
  } catch {
    return true;
  }
}
export function markGuideSeen() {
  try {
    localStorage.setItem(GUIDED_KEY, "1");
  } catch {
    // A private window: it won't come back this visit anyway.
  }
}
/** A brand-new player here: no saved games, no lesson done, the guide never shown. */
export const shouldGuide = (savedGames: number) => savedGames === 0 && learned().length === 0 && !guideSeen();

/** The next game that starts gets the guide (the lobby's Start for a new player, or Learn's line). */
let armed = false;
export const armGuide = () => void (armed = true);
export function takeArmedGuide(): boolean {
  const was = armed;
  armed = false;
  return was;
}

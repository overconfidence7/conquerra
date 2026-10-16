/**
 * Lessons you've finished, remembered on this device (session 31): the tick beside each under Learn. Tiny and in the
 * start-up bundle (the Learn fold's line counts them); the lessons themselves load only when Learn is opened.
 */
const KEY = "conquerra.learned";
/** How many tutorials there are (the fold's line says "3 of 7 done" without loading them; a test keeps it true). */
export const LESSON_COUNT = 3;

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

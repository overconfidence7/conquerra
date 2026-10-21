/**
 * Random maps' ids (session 30), apart from the map maker so the lobby can read one at start-up without loading it:
 * "80-crescent-quiet-heron" is 80 territories, a crescent and the seed "quiet-heron"; a game's map id puts
 * "random:" in front. Nothing here draws a map or a random number.
 */

/** The sizes the lobby offers (territories). Session 33b: 300 and 400, for the big tables (session 34) and later the battle royale. */
export const RANDOM_SIZES = [40, 80, 120, 200, 300, 400] as const;
export type RandomSize = (typeof RANDOM_SIZES)[number];

/** The shapes, as the id spells them (see `RANDOM_SHAPES` for the map maker's own). */
export type RandomShape = "island" | "archipelago" | "twins" | "crescent" | "inland";

/**
 * Who each size suits: every count from `min` to `max` gets a fair capital layout (the lobby's Opponents follow it).
 * Fewer than the official maps' ten at 120: each count is one more layout that must pass.
 */
/**
 * The most seats a random map has a layout for (session 33b: 10, the Houses' count), up to random map version 5.
 * Session 34 (version 6): the big sizes seat more (each version's `seats` caps it, so a version 5 map, and a game
 * pinned to it, is made exactly as before): the 400 up to 16 and the 300 up to 12, where about 7 seeds in 10 still
 * make a fair map (`scripts/try-random.ts --seats N --paper 10`: 400 at 16 passes 35 of 50, at 20 25 of 50; 300 at 12
 * 36 of 50, at 16 24 of 50, at 20 9 of 50).
 * Session 34b: `RANDOM_PLAYERS` holds the most any version seats (20 on the big sizes); each version's `seats` caps
 * it (`versionSeats`), and the lobby reads the current version's. Version 7 seats the 400 up to 20 and the 300 up to 16,
 * judging the layouts above 12 by the band 5.5 (`try-random.ts --band-above 12:5.5`: the 400 at 20 passes 40 of 50
 * seeds, the 300 at 16 40 of 50, at 20 32 of 50; archipelagos stay at 10).
 */
export const RANDOM_MAX_SEATS = 10;
export const RANDOM_BIG_SEATS = 20;
export const RANDOM_PLAYERS: Record<RandomSize, { min: number; max: number; recommended: { min: number; max: number } }> = {
  40: players(6, 3, 5),
  80: players(8, 4, 6),
  120: players(8, 5, 8),
  200: players(10, 7, 10),
  // (Session 33b: the big sizes start at 4 and 6 players: a map maker's layout for every count from the smallest is one
  // more way for a seed to fail, and two or three Houses on 400 territories isn't a game anyone asked for.)
  300: players(RANDOM_BIG_SEATS, 8, 10, 4),
  400: players(RANDOM_BIG_SEATS, 10, 10, 6),
};
function players(max: number, low: number, high: number, min = 2) {
  return { min, max, recommended: { min: low, max: high } };
}

/** What each shape is called in a sentence ("80 territories, a crescent"). */
export const RANDOM_SHAPE_A: Record<RandomShape, string> = { island: "one island", archipelago: "an archipelago", twins: "twin continents", crescent: "a crescent", inland: "an inland sea" };

/**
 * The most seats a random map version gives a size (session 34b): a version's `seats` is one number for both big sizes
 * up to version 6 (and version 6's 300 stopped at 12, its ceiling then), or the most by size from version 7; 10 when
 * left out.
 */
export function versionSeats(seats: number | Partial<Record<"300" | "400", number>> | undefined, size: RandomSize): number {
  if (seats && typeof seats === "object") return seats[String(size) as "300" | "400"] ?? RANDOM_MAX_SEATS;
  return Math.min(seats ?? RANDOM_MAX_SEATS, size === 300 ? 12 : Infinity);
}

/**
 * The players a random map suits, by size and shape (a small archipelago has room for five Houses at most). `seats`
 * (session 34): the most a random map version seats (10 up to version 5); left out, the current version's.
 */
/**
 * The current random map version's most seats by size, as `versionSeats` reads its `seats` (a test checks they agree).
 * Written out here so the lobby reads it at start-up without loading the versions' file.
 */
export const RANDOM_SEATS_NOW: Partial<Record<RandomSize, number>> = { 300: 16, 400: 20 };

export function randomPlayers(size: RandomSize, shape: RandomShape, seats: number = RANDOM_SEATS_NOW[size] ?? RANDOM_MAX_SEATS): (typeof RANDOM_PLAYERS)[RandomSize] {
  const p = RANDOM_PLAYERS[size];
  if (size === 40 && shape === "archipelago") return players(5, 3, 5);
  // (Session 34: a big archipelago stays at 10: at 16 seats no seed of ten made a fair one, and a map carries a layout
  // for every count it seats, so it would fail a 10-player game too.)
  const most = Math.min(p.max, seats, shape === "archipelago" ? RANDOM_MAX_SEATS : p.max);
  return most < p.max ? { ...p, max: most } : p;
}



/** A seed made of two words, a hyphen between ("quiet-heron"). Any two words of letters work; the lists are for the dice. */
export const WORD = /^[a-z]{2,12}$/;

export interface RandomMapId {
  size: RandomSize;
  shape: RandomShape;
  seed: string;
}

/** "80-crescent-quiet-heron" → its parts, or null if it isn't one. Upper case and spaces are forgiven ("Quiet Heron"). */
export function parseRandomId(id: string): RandomMapId | null {
  const parts = id.trim().toLowerCase().replace(/^random:/, "").split("-");
  if (parts.length !== 4) return null;
  const [size, shape, a, b] = parts as [string, string, string, string];
  if (!RANDOM_SIZES.includes(Number(size) as RandomSize) || !(shape in RANDOM_SHAPE_A) || !WORD.test(a) || !WORD.test(b)) return null;
  return { size: Number(size) as RandomSize, shape: shape as RandomShape, seed: `${a}-${b}` };
}

/** A random map's id as a game's map id ("random:80-crescent-quiet-heron"), beside the twelve's own ids. */
export const RANDOM_PREFIX = "random:";


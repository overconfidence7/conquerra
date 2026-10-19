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
 * The most seats a random map has a layout for (session 33b: 10, the Houses' count; session 34 lifts the big sizes to
 * 20 seats here, and only here).
 */
export const RANDOM_MAX_SEATS = 10;
export const RANDOM_PLAYERS: Record<RandomSize, { min: number; max: number; recommended: { min: number; max: number } }> = {
  40: players(6, 3, 5),
  80: players(8, 4, 6),
  120: players(8, 5, 8),
  200: players(10, 7, 10),
  // (Session 33b: the big sizes start at 4 and 6 players: a map maker's layout for every count from the smallest is one
  // more way for a seed to fail, and two or three Houses on 400 territories isn't a game anyone asked for.)
  300: players(RANDOM_MAX_SEATS, 8, 10, 4),
  400: players(RANDOM_MAX_SEATS, 10, 10, 6),
};
function players(max: number, low: number, high: number, min = 2) {
  return { min, max, recommended: { min: low, max: high } };
}

/** What each shape is called in a sentence ("80 territories, a crescent"). */
export const RANDOM_SHAPE_A: Record<RandomShape, string> = { island: "one island", archipelago: "an archipelago", twins: "twin continents", crescent: "a crescent", inland: "an inland sea" };

/** The players a random map suits, by size and shape (a small archipelago has room for five Houses at most). */
export function randomPlayers(size: RandomSize, shape: RandomShape): (typeof RANDOM_PLAYERS)[RandomSize] {
  const p = RANDOM_PLAYERS[size];
  return size === 40 && shape === "archipelago" ? players(5, 3, 5) : p;
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


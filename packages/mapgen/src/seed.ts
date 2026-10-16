import { SEED_WORDS } from "@conquerra/content/seedWords";
import type { LandShape } from "./shapes";
import { RANDOM_PREFIX, WORD, type RandomShape, type RandomSize } from "./randomId";

/**
 * Session 30: random maps' seeds as two words ("quiet-heron"), and the random map's words for the lobby. Apart from
 * the map maker: the lobby's random map choices need only this (and none of it loads at start-up).
 */

/** The `i`-th seed in a fixed run through every pair of words (each pair once), for the sim's "n seeds in a row". */
export function seedWords(i: number): string {
  const A = SEED_WORDS.first.length, N = SEED_WORDS.second.length, all = A * N;
  // A step coprime with the number of pairs walks through all of them, the neighbours far apart.
  let step = 7919;
  while (gcd(step, all) !== 1) step++;
  const k = (((i % all) + all) % all * step) % all;
  return `${SEED_WORDS.first[k % A]}-${SEED_WORDS.second[Math.floor(k / A)]}`;
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** A fresh seed from any source of numbers in [0, 1) (the page's dice; the map maker itself never draws one). */
export function newSeedWords(random: () => number): string {
  const pick = (xs: readonly string[]) => xs[Math.min(xs.length - 1, Math.floor(random() * xs.length))]!;
  return `${pick(SEED_WORDS.first)}-${pick(SEED_WORDS.second)}`;
}


/** The shapes, as the id spells them, and the map maker's own. The picture silhouettes (the dragon...) stay official-only. */
export const RANDOM_SHAPES = { island: "continent", archipelago: "archipelago", twins: "twinContinents", crescent: "crescent", inland: "inlandSea" } as const satisfies Record<RandomShape, LandShape>;
export const RANDOM_SHAPE_IDS = Object.keys(RANDOM_SHAPES) as RandomShape[];

/** What each shape is called in the lobby's list. */
export const RANDOM_SHAPE_NAMES: Record<RandomShape, string> = {
  island: "One island",
  archipelago: "Archipelago",
  twins: "Twin continents",
  crescent: "Crescent",
  inland: "Inland sea",
};

export { RANDOM_TEXT } from "./randomText";

/** Tries a seed gets: the first, then up to five rerolls ("seed#2" ... "seed#6"), then the plain line above. */
export const RANDOM_TRIES = 6;

/**
 * The fairness bar at generation, beyond the map maker's own (every capital about as far from its nearest rival, gold
 * within 30%): no capital spot more than this many times as exposed as the safest (`exposureOf`): no worse than the
 * worst of the twelve official maps' own layouts (5.54, Embervale 6; their median is 2.3, nine in ten within 4.0).
 */
export const RANDOM_EXPOSURE_BAND = 5.5;

/** A seed as typed ("Quiet Heron", "quiet heron", "quiet-heron") → "quiet-heron", or null. */
export function cleanSeed(typed: string): string | null {
  const w = typed.trim().toLowerCase().split(/[\s\-_.,]+/).filter(Boolean);
  return w.length === 2 && w.every((x) => WORD.test(x)) ? `${w[0]}-${w[1]}` : null;
}


/** The id itself, without "random:" ("80-crescent-quiet-heron"). */
export const randomMapId = (size: RandomSize, shape: RandomShape, seed: string) => `${size}-${shape}-${seed}`;
export const isRandomMapId = (mapId: string) => mapId.startsWith(RANDOM_PREFIX);

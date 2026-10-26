import type { RandomGrade, RandomStart } from "@conquerra/content";
import { randomMaps } from "@conquerra/content/randomMaps";
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
 * Random maps' own version (session 31), the number a game pins as its map's `generator.version`. The map maker
 * itself is unchanged (`MAPGEN_VERSION` 2, which the twelve keep); what a random map's version changes is the fairness
 * band at generation (which seeds and rerolls pass) and the start bonus on its spots. Every version listed in
 * `RANDOM_VERSIONS` can still be built, so a game made before a change rebuilds its own map exactly. The values are
 * content (`data/random-maps.json`, session 33), and a shipped version never changes: a new balance is a new version.
 *  - 2 (session 30): the band 5.5, no start bonus.
 *  - 3 (session 31, the orchestrator's call from the sim): the band 4.0, and +4 troops on each harder spot.
 *  - 4 (session 33, Nate's call): the band 4.0, and a head start graded by exposure (`grade`): every spot more
 *    exposed than the safest gets extra troops, the most exposed the most (up to 6).
 *  - 5 (session 33b, Nate's call): version 4's grade, and an income head start (`start`): the more exposed spots
 *    start with a market at their capital.
 *  - 6 (session 34): version 5, and the big sizes (300 and 400) seat up to 20 (`seats`; a layout for every count).
 *  - 7 (session 34b, Nate's call): version 6, more seats on the big sizes (by size), and a looser exposure band for
 *    the layouts above 12 players (`bandAbove`).
 *  - 8 (session 35, Nate's call): version 7 with the band above 12 players at 6.0 (not 5.5), so the 300 seats up
 *    to 20 as the 400 does.
 */
export interface RandomVersionDef {
  band: number;
  bonus: number;
  /** Session 34: the most seats on the big sizes (10 when left out); from version 7 by size (`versionSeats`). */
  seats?: number | Partial<Record<"300" | "400", number>>;
  /** Session 34: above this many players a layout needs only the exposure band, not the paper check (every count when left out). */
  paperUpTo?: number;
  grade?: RandomGrade;
  start?: RandomStart;
  /** Session 34b: above this many players a layout is judged by its own, looser band. */
  bandAbove?: { players: number; band: number };
}
export type RandomVersion = number;
export const RANDOM_VERSIONS: Readonly<Record<RandomVersion, RandomVersionDef>> = Object.fromEntries(Object.entries(randomMaps.versions).map(([v, d]) => [Number(v), d as RandomVersionDef]));
export const RANDOM_VERSION: RandomVersion = randomMaps.current;
export const isRandomVersion = (v: number | null | undefined): v is RandomVersion => v != null && Object.prototype.hasOwnProperty.call(RANDOM_VERSIONS, v);
/** A version's values (one this build can make: check with `isRandomVersion`). */
export function randomVersionDef(v: RandomVersion): RandomVersionDef {
  const d = RANDOM_VERSIONS[v];
  if (!d) throw new Error(`No random map version ${v}`);
  return d;
}

/**
 * The fairness bar at generation, beyond the map maker's own (every capital about as far from its nearest rival, gold
 * within 30%): no capital spot more than this many times as exposed as the safest (`exposureOf`). Session 30's 5.5 was
 * the worst of the twelve official maps' own layouts (5.54, Embervale 6; their median is 2.3, nine in ten within 4.0);
 * session 31 tightens it to 4.0.
 */
export const RANDOM_EXPOSURE_BAND: number = randomVersionDef(RANDOM_VERSION).band;

/** A seed as typed ("Quiet Heron", "quiet heron", "quiet-heron") → "quiet-heron", or null. */
export function cleanSeed(typed: string): string | null {
  const w = typed.trim().toLowerCase().split(/[\s\-_.,]+/).filter(Boolean);
  return w.length === 2 && w.every((x) => WORD.test(x)) ? `${w[0]}-${w[1]}` : null;
}


/** The id itself, without "random:" ("80-crescent-quiet-heron"). */
export const randomMapId = (size: RandomSize, shape: RandomShape, seed: string) => `${size}-${shape}-${seed}`;
export const isRandomMapId = (mapId: string) => mapId.startsWith(RANDOM_PREFIX);

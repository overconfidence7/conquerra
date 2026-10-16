import words from "../data/seed-words.json";

/**
 * Session 30: the words random maps' seeds are made of ("quiet-heron": one from each list). Its own entry point, so
 * the lists load with the map maker, never with the game's start-up.
 */
export const SEED_WORDS: { first: readonly string[]; second: readonly string[] } = { first: words.first, second: words.second };

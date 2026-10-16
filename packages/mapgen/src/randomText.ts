/** Session 30: random maps' plain lines, on their own (the Worker's API reads them without the word lists). */

/** What the player reads when no try made a fair map. */
export const RANDOM_TEXT = {
  failed: "That seed didn't make a fair map. Try another.",
  badId: "That isn't a random map's seed. It's two words, like quiet-heron.",
  oldVersion: (v: number | null) => `This game's random map was made by an older map maker (version ${v ?? "unknown"}), and this one makes a different map from the same seed. It can't be rebuilt here.`,
} as const;

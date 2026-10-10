/**
 * Seeded numbers for the replay's effects (session 21). Every particle's every number comes from here, from a seed
 * made of the game, the turn and the event, so "Watch again" looks exactly the same and a frame can be drawn for any
 * moment (pause, scrub, Skip). Never Math.random().
 *
 * The seed is the game's public id, not its dice seed: the dice seed must never reach a player's screen.
 */

/** A 32-bit hash of a string (FNV-1a). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mix numbers into one 32-bit value (a few rounds of a murmur-style finaliser). */
function mix(a: number, b: number): number {
  let h = Math.imul(a ^ (b + 0x9e3779b9 + (a << 6) + (a >>> 2)), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** A number in [0, 1) for this seed and these indices: the same inputs always give the same number. */
export function rand(seed: number, a: number, b = 0, c = 0): number {
  return mix(mix(mix(seed, a + 1), b + 7), c + 13) / 4294967296;
}

/** The seed for one effect: the game, the turn, the event and which effect of it. */
export function fxSeed(gameId: string, turn: number, event: number, part: string): number {
  return hashString(`${gameId}|${turn}|${event}|${part}`);
}

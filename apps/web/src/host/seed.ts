/** A new game's seed: 128 random bits as hex (the API's and the room's; the engine itself never draws randomness). */
export function newSeed(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

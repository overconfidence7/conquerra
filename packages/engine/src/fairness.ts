import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

/**
 * Provably fair luck: when a game starts we publish sha256(seed) (the "commitment").
 * The seed stays secret on the server until the game ends, then it is revealed.
 * Anyone can check that sha256(revealedSeed) matches the commitment, and replay
 * the whole game from the seed + everyone's orders to confirm every roll.
 */
export function seedCommitment(seed: string): string {
  return bytesToHex(sha256(utf8ToBytes(seed)));
}

export function verifySeed(seed: string, commitment: string): boolean {
  return seedCommitment(seed) === commitment;
}

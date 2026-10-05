import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import type { Rules } from "@conquerra/content";
import { resolveTurn } from "./resolve";
import { createGame, type NewGameOptions } from "./setup";
import type { GameContext, GameState, OrdersByPlayer, TurnResult } from "./types";

/**
 * "Save this game": a small file with everything needed to play a single-player game again exactly, turn by turn:
 * the setup (including the secret seed), the rules it was played with, and every turn's orders (bots' too).
 * `pnpm sim --replay <file>` plays it back and prints what happened. Only for single-player games, where the
 * player may see everything.
 */
export interface SavedGame {
  format: "conquerra-save";
  version: 1;
  mapId: string;
  /** The map maker version the map was made with. A different version is a different map, so the replay warns. */
  mapVersion: number | null;
  rules: Rules;
  setup: NewGameOptions;
  /** Every resolved turn's orders for every player, in order. */
  turns: OrdersByPlayer[];
  /** Fingerprint of the game after the last saved turn, so a replay can prove it ended up in the same place. */
  fingerprint: string;
  /** Free notes for a bug report: the app version, the bot level, ... */
  notes?: Record<string, string>;
}

export function stateFingerprint(s: GameState): string {
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify(s)))).slice(0, 16);
}

export function saveGame(ctx: GameContext, setup: NewGameOptions, turns: OrdersByPlayer[], state: GameState, notes?: Record<string, string>): SavedGame {
  return {
    format: "conquerra-save",
    version: 1,
    mapId: ctx.map.id,
    mapVersion: ctx.map.generator?.version ?? null,
    rules: ctx.rules,
    setup,
    turns,
    fingerprint: stateFingerprint(state),
    ...(notes ? { notes } : {}),
  };
}

/** Play a saved game back, calling `onTurn` after each turn. `matches` says whether it ended exactly where the save did. */
export function replaySavedGame(ctx: GameContext, save: SavedGame, onTurn?: (r: TurnResult, before: GameState) => void): { state: GameState; matches: boolean } {
  let s = createGame(ctx, save.setup);
  for (const orders of save.turns) {
    if (s.winner) break;
    const r = resolveTurn(ctx, s, orders);
    onTurn?.(r, s);
    s = r.state;
  }
  return { state: s, matches: stateFingerprint(s) === save.fingerprint };
}

import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import type { Rules } from "@conquerra/content";
import { resolveTurn } from "./resolve";
import { createGame, type NewGameOptions } from "./setup";
import type { GameContext, GameState, OrdersByPlayer, PlayerId, TurnResult } from "./types";

/**
 * Saved games (session 13).
 *
 * A save is a **snapshot of the game as it stands** (the whole GameState, which is plain data), with a format version.
 * Loading it needs no replaying, so it keeps working when the rules or the bots change: the game simply carries on
 * under the new rules. When the game's own shape changes (a new field, as the card decks add), a small migration
 * brings older snapshots up to date, and a save we can't bring up to date says so in plain words.
 *
 * The turn history (the setup with its secret seed, and every turn's orders) rides along when we have it, so
 * `pnpm sim --replay` can still play a game back move by move for a bug report. Single player only: a save holds
 * the secret seed and everything about every player.
 *
 * Tutorials and scenarios (M5) will be save files shipped with the game: a snapshot, no history needed.
 */

export const SAVE_FORMAT = "conquerra-save";
/** The save file's own layout. 1 = setup + every turn's orders (sessions 5–12, replay only); 2 = a snapshot. */
export const SAVE_VERSION = 2;

/** One line about a save, for the Continue button and the save slots. */
export interface SaveSummary {
  mapName: string;
  /** Everyone at the table, in seat-list order. */
  players: string[];
  /** Whose save it is (the human's name). */
  you: string;
  turn: number;
  /** You've been knocked out (one of the Fallen), still watching. */
  fallen: boolean;
}

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  version: typeof SAVE_VERSION;
  /** When it was saved (ms since 1970, the host's clock; the engine never reads a clock). */
  savedAt: number;
  mapId: string;
  /** The map maker version the map was made with. A different version is a different map, so it can't be loaded. */
  mapVersion: number | null;
  /** Whose seat this is (the human player). */
  you: PlayerId;
  summary: SaveSummary;
  /** The game as it stands, at the start of a turn's planning. `state.version` says which shape it has. */
  state: GameState;
  /** What the host keeps between turns (bot level, the timer, what each seat watched last turn). Up to the host. */
  host?: Record<string, unknown>;
  /** The game from the start, for `pnpm sim --replay`. Missing once a game has carried on under changed rules. */
  history?: { setup: NewGameOptions; rules: Rules; turns: OrdersByPlayer[] };
  /** Free notes for a bug report: the app version, the bot level, ... */
  notes?: Record<string, string>;
}

/** The old "Save this game" file (version 1): replay only. `pnpm sim --replay` still reads it. */
export interface SavedGameV1 {
  format: typeof SAVE_FORMAT;
  version: 1;
  mapId: string;
  mapVersion: number | null;
  rules: Rules;
  setup: NewGameOptions;
  turns: OrdersByPlayer[];
  fingerprint: string;
  notes?: Record<string, string>;
}

/** The game state's current shape. Bump it (and add a migration below) whenever GameState changes. */
export const STATE_VERSION: GameState["version"] = 3;

/**
 * How to bring an older game state up to date, one version at a time: `STATE_MIGRATIONS[n]` turns a version-n
 * state into version n+1. Each is small and only adds what's new, with the value an old game would have had.
 */
export const STATE_MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {};

export function stateFingerprint(s: GameState): string {
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify(s)))).slice(0, 16);
}

export function saveSummary(ctx: GameContext, s: GameState, you: PlayerId): SaveSummary {
  const me = s.players.find((p) => p.id === you);
  return { mapName: ctx.map.name, players: s.players.map((p) => p.name), you: me?.name ?? you, turn: s.turn, fallen: !!me && me.eliminatedTurn !== null };
}

export function makeSave(
  ctx: GameContext,
  state: GameState,
  you: PlayerId,
  savedAt: number,
  extra: { host?: Record<string, unknown>; history?: SaveFile["history"]; notes?: Record<string, string> } = {},
): SaveFile {
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    savedAt,
    mapId: ctx.map.id,
    mapVersion: ctx.map.generator?.version ?? null,
    you,
    summary: saveSummary(ctx, state, you),
    // A deep copy, so the save never changes with the game after it.
    state: JSON.parse(JSON.stringify(state)) as GameState,
    ...(extra.host ? { host: JSON.parse(JSON.stringify(extra.host)) as Record<string, unknown> } : {}),
    ...(extra.history ? { history: JSON.parse(JSON.stringify(extra.history)) as SaveFile["history"] } : {}),
    ...(extra.notes ? { notes: extra.notes } : {}),
  };
}

export type ReadSave = { ok: true; save: SaveFile; migrated: boolean } | { ok: false; why: string };

/** The plain-words reasons a save can't be loaded. */
export const SAVE_PROBLEMS = {
  notASave: "This file isn't a Conquerra save.",
  older: "This save is from an older version of Conquerra and can't be loaded.",
  newer: "This save is from a newer version of Conquerra. Update the game (reload the page) to load it.",
  damaged: "This save is damaged and can't be loaded.",
} as const;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/**
 * Read a save (parsed JSON from a slot or a file): check it's ours, bring an older game state up to date, or say in
 * plain words why it can't be loaded. Never throws.
 */
export function readSave(raw: unknown): ReadSave {
  if (!isObj(raw) || raw.format !== SAVE_FORMAT || typeof raw.version !== "number") return { ok: false, why: SAVE_PROBLEMS.notASave };
  if (raw.version < SAVE_VERSION) return { ok: false, why: SAVE_PROBLEMS.older };
  if (raw.version > SAVE_VERSION) return { ok: false, why: SAVE_PROBLEMS.newer };
  if (!isObj(raw.state) || typeof raw.state.version !== "number" || !isObj(raw.summary) || typeof raw.mapId !== "string") return { ok: false, why: SAVE_PROBLEMS.damaged };
  let state = raw.state;
  let v = state.version as number;
  if (v > STATE_VERSION) return { ok: false, why: SAVE_PROBLEMS.newer };
  const migrated = v < STATE_VERSION;
  while (v < STATE_VERSION) {
    const step = STATE_MIGRATIONS[v];
    if (!step) return { ok: false, why: SAVE_PROBLEMS.older };
    try {
      state = { ...step(JSON.parse(JSON.stringify(state)) as Record<string, unknown>), version: v + 1 };
    } catch {
      return { ok: false, why: SAVE_PROBLEMS.damaged };
    }
    v++;
  }
  if (!isObj(state.territories) || !Array.isArray(state.players) || typeof state.turn !== "number") return { ok: false, why: SAVE_PROBLEMS.damaged };
  const save = { ...raw, state } as unknown as SaveFile;
  return { ok: true, save, migrated };
}

/**
 * Play a game back from its setup and orders, calling `onTurn` after each turn. `matches` says whether it ended
 * exactly at `fingerprint` (the saved snapshot's, or a version-1 file's).
 */
export function replaySavedGame(
  ctx: GameContext,
  game: { setup: NewGameOptions; turns: OrdersByPlayer[] },
  fingerprint: string,
  onTurn?: (r: TurnResult, before: GameState) => void,
): { state: GameState; matches: boolean } {
  let s = createGame(ctx, game.setup);
  for (const orders of game.turns) {
    if (s.winner) break;
    const r = resolveTurn(ctx, s, orders);
    onTurn?.(r, s);
    s = r.state;
  }
  return { state: s, matches: stateFingerprint(s) === fingerprint };
}

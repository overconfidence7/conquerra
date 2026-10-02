import type { MapDef, Rules } from "@conquerra/content";
import type { GameMode, Order, PlayerView, ReplayEvent } from "@conquerra/engine";

/**
 * The contract between the UI and whatever runs the game.
 * Today that's a Web Worker in the same browser (local single player); in M4 it becomes the Cloudflare server.
 * The UI only ever gets what a server would send: the map and rules once at the start, then this player's
 * fogged view and fog-trimmed replay each turn.
 */
export interface LobbySettings {
  mapId: string;
  bots: number;
  /** 0..1 share of combat that is luck. */
  luck: number;
  fog: boolean;
  mode: GameMode;
}

export interface TurnReport {
  /** The turn these events happened on. */
  turn: number;
  events: ReplayEvent[];
}

export interface HostUpdate {
  /** The human player's id in this game. */
  playerId: string;
  view: PlayerView;
  /** What happened on the turn that just resolved (null right after the game starts). */
  report: TurnReport | null;
  /** Turns the bots played on their own when you skipped to the end after being knocked out. */
  fastForwarded: number;
}

/**
 * Sent once, when the game starts: the map (with its drawing data) and the rules, alongside the first view.
 * The page never imports map geometry itself, so a server can later trim what it sends (blackout fog).
 */
export interface HostStart extends HostUpdate {
  map: MapDef;
  rules: Rules;
}

export interface GameHost {
  start(settings: LobbySettings): Promise<HostStart>;
  /** Send this turn's orders. Bots plan their own, the turn resolves, and you get your new view. */
  lockIn(orders: Order[]): Promise<HostUpdate>;
  /** Once you're knocked out: the bots play one more turn, and you see the whole map and that turn's report. */
  watchNext(): Promise<HostUpdate>;
  /** Once you're knocked out: the bots play on to the end. */
  finish(): Promise<HostUpdate>;
  dispose(): void;
}

/** Messages over the worker boundary. */
export type HostRequest =
  | { id: number; type: "start"; settings: LobbySettings; seed: string }
  | { id: number; type: "lockIn"; orders: Order[] }
  | { id: number; type: "watchNext" }
  | { id: number; type: "finish" };

export type HostResponse = { id: number; ok: true; update: HostUpdate | HostStart } | { id: number; ok: false; error: string };

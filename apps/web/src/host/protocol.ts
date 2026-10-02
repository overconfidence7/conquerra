import type { GameMode, Order, PlayerView, ReplayEvent } from "@conquerra/engine";

/**
 * The contract between the UI and whatever runs the game.
 * Today that's a Web Worker in the same browser (local single player); in M4 it becomes the Cloudflare server.
 * The UI only ever gets what a server would send: this player's fogged view and fog-trimmed replay.
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
  /** Turns the bots played on their own after you were knocked out. */
  fastForwarded: number;
}

export interface GameHost {
  start(settings: LobbySettings): Promise<HostUpdate>;
  /** Send this turn's orders. Bots plan their own, the turn resolves, and you get your new view. */
  lockIn(orders: Order[]): Promise<HostUpdate>;
  dispose(): void;
}

/** Messages over the worker boundary. */
export type HostRequest =
  | { id: number; type: "start"; settings: LobbySettings; seed: string }
  | { id: number; type: "lockIn"; orders: Order[] };

export type HostResponse = { id: number; ok: true; update: HostUpdate } | { id: number; ok: false; error: string };

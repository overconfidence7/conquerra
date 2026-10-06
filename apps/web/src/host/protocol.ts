import type { MapDef, Rules } from "@conquerra/content";
import type { GameMode, Instruction, Order, PlayerId, PlayerView, ReplayEvent, SavedGame } from "@conquerra/engine";
import type { TurnClock } from "../logic/timer";

/**
 * The contract between the UI and whatever runs the game.
 * Today that's a Web Worker in the same browser (local single player); in M4 it becomes the Cloudflare server.
 * The UI only ever gets what a server would send: the map and rules once at the start, then this player's
 * fogged view and fog-trimmed replay each turn.
 */
/** How the bots play: Recruit (easy) or Captain (the default). */
export type BotLevel = "recruit" | "captain";

export interface LobbySettings {
  mapId: string;
  bots: number;
  botLevel: BotLevel;
  /** 0..1 share of combat that is luck. */
  luck: number;
  fog: boolean;
  mode: GameMode;
  /** Turn timer in seconds (1, 3, 5 or 10 minutes), or null for No timer. */
  turnSeconds: number | null;
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
  /** The turn timer: when your orders lock in automatically. Null with No timer, while watching, or at the end. */
  clock: TurnClock | null;
  /** Set when this update came from the timer running out (your saved orders were locked in for you). */
  autoLocked?: boolean;
  /** Your generals' orders for the turn now being planned, from their standing instructions (shown in your queue). */
  generalOrders: Order[];
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
  /**
   * Send this turn's orders. Bots plan their own, the turn resolves, and you get your new view.
   * `turn` is the turn the orders are for: if the timer already locked that turn in, nothing happens and you get
   * the current view.
   */
  lockIn(orders: Order[], turn: number): Promise<HostUpdate>;
  /** Keep the host up to date with your orders as you build them: they're what locks in when time runs out. */
  saveOrders(orders: Order[], turn: number): void;
  /** Called when the timer runs out and the host locks your saved orders in for you. */
  onAutoLock(listener: (update: HostUpdate) => void): void;
  /** Once you're knocked out: the bots play one more turn (with your world events, as one of the Fallen), and you see that turn's report. */
  watchNext(orders?: Order[]): Promise<HostUpdate>;
  /** Once you're knocked out: the bots play on to the end. */
  finish(): Promise<HostUpdate>;
  /** Your generals' orders for this turn with these instructions (the ones you haven't changed keep theirs). */
  planGenerals(instructions: Record<PlayerId, Instruction | null>): Promise<Order[]>;
  /** What a bot of this game's level would order for you this turn (for testing; maybe an "auto-orders" button later). */
  suggest(): Promise<Order[]>;
  /** "Save this game": everything needed to replay it exactly (single player only). */
  save(notes?: Record<string, string>): Promise<SavedGame>;
  dispose(): void;
}

/** Messages over the worker boundary. */
export type HostRequest =
  | { id: number; type: "start"; settings: LobbySettings; seed: string }
  | { id: number; type: "lockIn"; orders: Order[]; turn: number }
  | { id: number; type: "saveOrders"; orders: Order[]; turn: number }
  | { id: number; type: "watchNext"; orders?: Order[] }
  | { id: number; type: "finish" }
  | { id: number; type: "suggest" }
  | { id: number; type: "planGenerals"; instructions: Record<PlayerId, Instruction | null> }
  | { id: number; type: "save"; notes?: Record<string, string> };

export type HostResponse =
  | { id: number; ok: true; update: HostUpdate | HostStart }
  /** Not an answer: the timer ran out and the host locked your orders in (id is 0). */
  | { id: 0; ok: true; pushed: HostUpdate }
  | { id: number; ok: true; orders: Order[] }
  | { id: number; ok: true; save: SavedGame }
  | { id: number; ok: false; error: string };

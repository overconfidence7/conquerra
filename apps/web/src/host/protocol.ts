import type { MapDef, Rules } from "@conquerra/content";
import type { Answer } from "@conquerra/bots";
import type { GameMode, Instruction, Offer, Order, PlayerId, PlayerView, ReplayEvent, SaveFile } from "@conquerra/engine";
import type { TurnClock } from "../logic/timer";
import type { SlotId, SlotInfo } from "./saves";

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
  /** The Fate deck (one draw a turn: events and missions). On unless the host turns it off. */
  fate?: boolean;
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
  /**
   * Continue: the orders you'd queued on this turn but not locked in (with your instruction changes and generals you
   * let go), and the generals whose army you'd taken back. Only on the first update after loading a save.
   */
  queued?: { orders: Order[]; paused: PlayerId[] };
  /** Deals the bots offered you this turn (session 14): accept, counter or decline before you lock in, or they lapse. */
  offers?: Offer[];
}

/**
 * Sent once, when the game starts: the map (with its drawing data) and the rules, alongside the first view.
 * The page never imports map geometry itself, so a server can later trim what it sends (blackout fog).
 */
export interface HostStart extends HostUpdate {
  map: MapDef;
  rules: Rules;
}

/** Where to load a saved game from: a slot on this device ("auto" is Continue), or a save file's text. */
export type LoadSource = { slot: SlotId } | { file: string };

export interface GameHost {
  start(settings: LobbySettings): Promise<HostStart>;
  /** Carry on from a saved game. Rejects with a plain sentence if it can't be loaded. */
  load(source: LoadSource): Promise<HostStart>;
  /**
   * Send this turn's orders. Bots plan their own, the turn resolves, and you get your new view.
   * `turn` is the turn the orders are for: if the timer already locked that turn in, nothing happens and you get
   * the current view.
   */
  lockIn(orders: Order[], turn: number): Promise<HostUpdate>;
  /**
   * Keep the host up to date with your orders as you build them: they're what locks in when time runs out, and the
   * autosave keeps them for Continue. `paused`: generals whose army you took back. `now`: save them at once (the tab
   * is closing) instead of once the queue has been still for a moment.
   */
  saveOrders(orders: Order[], turn: number, paused?: PlayerId[], now?: boolean): void;
  /** Called when the timer runs out and the host locks your saved orders in for you. */
  onAutoLock(listener: (update: HostUpdate) => void): void;
  /** Once you're knocked out: the bots play one more turn (with your world events, as one of the Fallen), and you see that turn's report. */
  watchNext(orders?: Order[]): Promise<HostUpdate>;
  /** Once you're knocked out: the bots play on to the end. */
  finish(): Promise<HostUpdate>;
  /** Your generals' orders for this turn with these instructions (the ones you haven't changed keep theirs). */
  planGenerals(instructions: Record<PlayerId, Instruction | null>): Promise<Order[]>;
  /**
   * Offer a bot a deal (session 14). It answers at once, from its own view, with one plain reason (and maybe a
   * counteroffer). Add the `propose` order to your orders so the deal starts if it said yes.
   */
  propose(offer: Offer): Promise<Answer>;
  /** What a bot of this game's level would order for you this turn (for testing; maybe an "auto-orders" button later). */
  suggest(): Promise<Order[]>;
  /** Save the game as it stands into one of your slots on this device. */
  saveTo(slot: SlotId): Promise<SlotInfo>;
  /** "Save to a file": the save itself (single player only; it also plays back with `pnpm sim --replay`). */
  exportSave(notes?: Record<string, string>): Promise<SaveFile>;
  /** Pause / resume the turn timer (single player; M4 wraps it in a pause by vote). The update carries the clock. */
  pause(): Promise<HostUpdate>;
  resume(): Promise<HostUpdate>;
  /** Something went wrong in the background (an autosave couldn't be written): a sentence for the player. */
  onNotice(listener: (message: string) => void): void;
  dispose(): void;
}

/** Messages over the worker boundary. */
export type HostRequest =
  | { id: number; type: "start"; settings: LobbySettings; seed: string }
  | { id: number; type: "load"; source: LoadSource }
  | { id: number; type: "saveTo"; slot: SlotId }
  | { id: number; type: "pause" }
  | { id: number; type: "resume" }
  | { id: number; type: "lockIn"; orders: Order[]; turn: number }
  | { id: number; type: "saveOrders"; orders: Order[]; turn: number; paused?: PlayerId[]; now?: boolean }
  | { id: number; type: "watchNext"; orders?: Order[] }
  | { id: number; type: "finish" }
  | { id: number; type: "suggest" }
  | { id: number; type: "planGenerals"; instructions: Record<PlayerId, Instruction | null> }
  | { id: number; type: "exportSave"; notes?: Record<string, string> }
  | { id: number; type: "propose"; offer: Offer };

export type HostResponse =
  | { id: number; ok: true; update: HostUpdate | HostStart }
  /** Not an answer: the timer ran out and the host locked your orders in (id is 0). */
  | { id: 0; ok: true; pushed: HostUpdate }
  | { id: number; ok: true; orders: Order[] }
  | { id: number; ok: true; save: SaveFile }
  | { id: number; ok: true; slot: SlotInfo }
  | { id: number; ok: true; answer: Answer }
  /** Not an answer: something for the player to know (id is 0). */
  | { id: 0; ok: true; notice: string }
  | { id: number; ok: false; error: string };

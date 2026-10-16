import type { MapDef, Rules } from "@conquerra/content";
import type { VoiceLine } from "../logic/voices";
import type { LeaderNote, Answer } from "@conquerra/bots";
import type { Budget, GameMode, Instruction, LeaderStyle, Offer, Order, PlayerId, PlayerView, ReplayEvent, SaveFile } from "@conquerra/engine";
import type { TurnClock } from "../logic/timer";
import type { SlotId, SlotInfo } from "./slots";
import type { MapThumb } from "../logic/mapThumb";

/**
 * The contract between the UI and whatever runs the game.
 * Today that's a Web Worker in the same browser (local single player); in M4 it becomes the Cloudflare server.
 * The UI only ever gets what a server would send: the map and rules once at the start, then this player's
 * fogged view and fog-trimmed replay each turn.
 */
/** How a bot plays: Recruit (easy), Captain (medium) or Marshal (hard, with a personality, the default; session 17). */
export type BotLevel = "recruit" | "captain" | "marshal";
/** The lobby's choice: one level for every bot, or a mixed table (some Marshals, the rest Captains). */
export type BotChoice = BotLevel | "mixed";

/** One bot seat as the game-over screen (or "Show personalities") tells it: its level, and a Marshal's personality. */
export interface SeatInfo {
  level: BotLevel;
  /** A Marshal's personality ("the Turtle"). */
  personality?: string;
}

export interface LobbySettings {
  mapId: string;
  bots: number;
  botLevel: BotChoice;
  /** A mixed table: how many of the bots are Marshals (the rest are Captains). */
  marshals?: number;
  /** Show each Marshal's personality during the game (off by default: you learn them by how they play; revealed at the end). */
  showPersonalities?: boolean;
  /** 0..1 share of combat that is luck. */
  luck: number;
  fog: boolean;
  mode: GameMode;
  /** Turn timer in seconds (1, 3, 5 or 10 minutes), or null for No timer. */
  turnSeconds: number | null;
  /** The Fate deck (one draw a turn: events and missions). On unless the host turns it off. */
  fate?: boolean;
  /** Diplomacy (deals between players). On unless the host turns it off: off means no Propose, no offers, no deals. */
  diplomacy?: boolean;
  /** Your House colour (session 16): an index into the ten Houses; Gules (red) by default. The bots take the rest. */
  house?: number;
  /** What you named your Leader and (optionally) your Steward (session 18); a sensible name is filled in. */
  leaderName?: string;
  stewardName?: string;
  /** Session 20c: their personalities (Neutral when left out): war-minded for the Leader, building-minded for the Steward. */
  leaderPersonality?: LeaderStyle | null;
  stewardPersonality?: LeaderStyle | null;
  /** Online (session 26, Nate's call): "If I miss a turn with no orders, my leaders run my House" (on unless turned off). */
  leadersRun?: boolean;
}

/**
 * Session 28: an offer between two people this turn, as the room relayed it. Only its two sides are ever sent it (a
 * deal both sides agreed is public once the turn plays, as a bot's is). `counter`: the one counteroffer it may get.
 */
export interface PeopleOffer {
  offer: Offer;
  state: "open" | "accepted" | "declined" | "countered" | "withdrawn" | "lapsed";
  counter?: Offer;
  counterState?: "open" | "accepted" | "declined" | "withdrawn" | "lapsed";
}

// ---------- Session 28: chat for people ----------

/** Someone in a chat, as the others in it see them: a name, a House colour, a seat once the game has started. */
export interface ChatPerson {
  name: string;
  house: number;
  seat?: PlayerId;
  you?: true;
  /** Session 29: a bot at the table. */
  bot?: true;
}

/**
 * Session 29: a deal a bot's line comes with, ready to send (a bot in a group joins a scheme only through a deal): to
 * the bot, of this kind (a joint war on `target`), for the member who asked (`for`; only they see the button).
 */
export interface ChatPropose {
  to: PlayerId;
  kind: "war" | "truce";
  target?: PlayerId;
  for: PlayerId;
}

/** A chat you're in. The table is everyone sitting there; a one-to-one or a group says who's in it, nothing more. */
export interface ChatView {
  id: string;
  kind: "table" | "pair" | "group";
  /** A group's name, if a member gave it one (else the page names it after its members). */
  name?: string;
  members?: ChatPerson[];
  /** Session 29, a one-to-one with a bot: your three lines for "Say something" this turn. */
  say?: string[];
  /** Session 29: how many more of your messages the bot (each bot, in a group) answers this turn. */
  free?: number;
  /** Session 29: the bot doesn't chat at all (the Recruit): deals only. */
  quiet?: true;
}

/** One message: plain text, as its writer wrote it. */
export interface ChatLine {
  id: number;
  chat: string;
  from: ChatPerson;
  text: string;
  at: number;
  /** Session 29: a deal to send, ready made (only `propose.for` sees the button). */
  propose?: ChatPropose;
  /** Session 29: the turn a bot's line is about (the page holds it until that turn's replay has played). */
  turn?: number;
  /** Session 30: the line is an offer's note (the offer's sender and id), and what became of an offer nobody answered. */
  offer?: string;
  ended?: OfferEnd;
}

/** Session 30: an offer whose note is in a chat ended without an answer: it lapsed at lock-in, or its sender withdrew it. */
export type OfferEnd = "lapsed" | "withdrawn";

/**
 * Chat for one person: the chats they're in and messages they lack (after `after`, the last id their page had), or,
 * as a push, what just changed. `canWrite`: false once they've left the game (they still read).
 */
export interface ChatSync {
  chats: ChatView[];
  lines: ChatLine[];
  canWrite: boolean;
  after?: number;
  /** Session 30: offers (sender and id, as `ChatLine.offer`) that ended unanswered since the page's lines came. */
  ended?: Record<string, OfferEnd>;
}

/** What a page does in chat: write, open a one-to-one, make a group, add people to one, rename one. */
export type ChatAct =
  | { do: "send"; chat: string; text: string }
  | { do: "pair"; with: PlayerId }
  | { do: "group"; with: PlayerId[]; name?: string }
  | { do: "add"; chat: string; with: PlayerId[] }
  | { do: "rename"; chat: string; name: string }
  /** Session 29, a one-to-one with a bot: say the line you picked (0 to 2 of the chat's `say`); the bot answers. */
  | { do: "say"; chat: string; pick: number }
  /** Session 29, a group with bots: "Join us against {rival}?" or "Peace among us?"; each bot answers. */
  | { do: "ask"; chat: string; ask: "war" | "peace"; target?: PlayerId }
  /** Session 29: you accepted or declined a bot's offer in your chat with it; it answers in a line. */
  | { do: "answered"; chat: string; offer: string; accept: boolean };

/**
 * Session 28: pause by vote, as everyone at the table is told it: who asked, who has agreed (or is ready), when the vote
 * or pause ends (the room's clock), and how many pauses you have left. `news`: what just happened.
 */
export interface PauseView {
  vote?: { by: PlayerId; endsAt: number; yes: PlayerId[]; waiting: PlayerId[] };
  paused?: { by: PlayerId; endsAt: number; ready: PlayerId[]; waiting: PlayerId[] };
  /** Pauses you may still ask for this game. */
  left: number;
  news?: { kind: "asked" | "started" | "ready" } | { kind: "failed"; why: "no" | "time"; who: PlayerId[] } | { kind: "ended"; early: boolean };
}

/** Session 28: a person's note with an offer, at most this many characters (their own words: the game never rewrites them). */
export const NOTE_MAX = 120;

/** Session 28: a bot's answer to an offer (at once), or, offered to a person, `waiting`: the room relayed it to them. */
export type ProposeAnswer = Answer & { waiting?: true };

export interface TurnReport {
  /** The turn these events happened on. */
  turn: number;
  events: ReplayEvent[];
  /** What your leaders said about it (session 22), in their own voices. */
  voices?: VoiceLine[];
  /** Your House came back from a quarter of its most land to over half of it (session 23): the comeback card plays. */
  comeback?: true;
  /** Online (session 26): the people who missed this turn and whose leaders ran their House for it (the card says so). */
  ranByLeaders?: PlayerId[];
  /** Session 29: a question from one of your leaders (your council), answered by multiple choice before you lock in. */
  ask?: CouncilAsk;
  /** Session 29, single player: what the bots said to you about this turn (the table chat; online it comes as chat). */
  table?: { bot: PlayerId; name: string; house: number; text: string }[];
}

/**
 * Session 29: a question from one of your leaders. Each choice is an ordinary game action: a command (`instruct`, set
 * through the Leaders panel's own path, null for none), a budget, or neither (it stays as it is).
 */
export interface CouncilAsk {
  /** "<turn>:<leader key>". */
  id: string;
  leader: string;
  name: string;
  style: LeaderStyle | null;
  text: string;
  situation: "grudge" | "capital" | "steward" | "purse";
  choices: { label: string; instruct?: Instruction | null; budget?: Budget }[];
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
  /** What each leader is up to this turn, in a line for the Leaders panel (session 20), by leader key. */
  leaderNotes?: Record<string, LeaderNote>;
  /**
   * Continue: the orders you'd queued on this turn but not locked in (with your instruction changes and generals you
   * let go), and the generals whose army you'd taken back. Only on the first update after loading a save.
   */
  queued?: { orders: Order[]; paused: PlayerId[] };
  /** Deals the bots offered you this turn (session 14): accept, counter or decline before you lock in, or they lapse. */
  offers?: Offer[];
  /** Each bot seat's level and personality: once the game is over, or all along with "Show personalities" on. */
  seats?: Record<PlayerId, SeatInfo>;
  /**
   * Online (session 26): provably fair. The room commits to its secret seed's SHA-256 in the game's first message and
   * reveals the seed itself when the game is over (anyone can then replay every roll).
   */
  fair?: { seedHash: string; seed?: string };
  /** Online: your view before the turn in `report` (a player coming back after missing turns replays it from there). */
  before?: PlayerView;
  /** Online: who at the table is a person playing their seat (the players panel marks them; everyone else is a bot). */
  people?: PlayerId[];
  /**
   * Online (session 27): seats a Marshal plays now because their person resigned or missed three turns in a row, with
   * why and from which turn (the players panel says "(bot)"; your own means you're watching).
   */
  leftSeats?: Record<PlayerId, { why: "resigned" | "taken"; turn: number }>;
  /**
   * Online (session 27): back after a turn your leaders ran for you, the orders that put your own commands and budgets
   * back (the page shows them as changes of yours this turn; they apply when your orders go in).
   */
  leadersBack?: Order[];
  /** Online (session 28): the offers between people this turn that you're a side of (and their answers so far). */
  talks?: PeopleOffer[];
}

/**
 * Sent once, when the game starts: the map (with its drawing data) and the rules, alongside the first view.
 * The page never imports map geometry itself, so a server can later trim what it sends (blackout fog).
 */
export interface HostStart extends HostUpdate {
  map: MapDef;
  rules: Rules;
  /** The Chronicle so far (session 16): your report of every turn played (a loaded game brings its own). */
  chronicle?: TurnReport[];
  /**
   * Online (session 26): the last turn's replay as you saw it, for a player coming back; `play`: you haven't watched
   * it yet (or the table's replay is still on), so the game opens in it.
   */
  replay?: { before: PlayerView; report: TurnReport; play: boolean };
  /** Online: you've locked in this turn and the table is waiting on someone else. */
  lockedIn?: boolean;
  /** Online (session 27): who at the table has locked in this turn (the players panel ticks them). */
  ready?: PlayerId[];
}

/** Where to load a saved game from: a slot on this device ("auto" is Continue), or a save file's text; or an online game (its id). */
export type LoadSource = { slot: SlotId } | { file: string } | { online: string; code?: string };

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
  /**
   * Your leaders' orders for this turn with these commands (by leader key, "leader:you" / "steward:you"; the ones you
   * haven't changed keep theirs), and their purses as they'll be once gold you take back is home.
   */
  planGenerals(instructions: Record<string, Instruction | null>, purses?: Record<string, number>): Promise<LeaderOrders>;
  /**
   * Offer a bot a deal (session 14). It answers at once, from its own view, with one plain reason (and maybe a
   * counteroffer). Add the `propose` order to your orders so the deal starts if it said yes.
   */
  propose(offer: Offer): Promise<ProposeAnswer>;
  /** Online (session 28): answer another person's offer (or their counter): the room tells them at once. */
  answerPerson?(from: PlayerId, offer: string, accept: boolean): Promise<void>;
  /** Online (session 28): take back an offer you made a person (before you lock in): the room tells them. */
  withdrawOffer?(offer: string): Promise<void>;
  /** Online (session 28): the offers between people you're a side of, as they change. */
  onTalks?(listener: (talks: PeopleOffer[]) => void): void;
  /** Session 30, single player's host: build a random map (the lobby's picture of it), or say why it can't be. */
  randomMap?(mapId: string): Promise<RandomPreview>;
  /** What a bot of this game's level would order for you this turn (for testing; maybe an "auto-orders" button later). */
  suggest(): Promise<Order[]>;
  /** Save the game as it stands into one of your slots on this device. */
  saveTo(slot: SlotId): Promise<SlotInfo>;
  /** "Save to a file": the save itself (single player only; it also plays back with `pnpm sim --replay`). */
  exportSave(notes?: Record<string, string>): Promise<SaveFile>;
  /** Pause / resume the turn timer (single player; M4 wraps it in a pause by vote). The update carries the clock. */
  pause(): Promise<HostUpdate>;
  resume(): Promise<HostUpdate>;
  /**
   * Something for the player to know: something went wrong in the background (an autosave couldn't be written), or,
   * `calm`, just news (online: "Reconnected").
   */
  onNotice(listener: (message: string, calm?: boolean) => void): void;
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
  | { id: number; type: "planGenerals"; instructions: Record<string, Instruction | null>; purses?: Record<string, number> }
  | { id: number; type: "exportSave"; notes?: Record<string, string> }
  | { id: number; type: "propose"; offer: Offer }
  /** Session 30: build a random map (the lobby's picture of it; the game then starts on it at once). */
  | { id: number; type: "randomMap"; mapId: string };

/** Session 30: a random map, as the lobby shows it: its picture, and which try of its seed passed the checks. */
export interface RandomPreview {
  thumb: MapThumb;
  attempt: number;
}

/** Your leaders' orders for the turn, and what each is up to (session 20). */
export interface LeaderOrders {
  orders: Order[];
  notes: Record<string, LeaderNote>;
}

export type HostResponse =
  | { id: number; ok: true; update: HostUpdate | HostStart }
  /** Not an answer: the timer ran out and the host locked your orders in (id is 0). */
  | { id: 0; ok: true; pushed: HostUpdate }
  | { id: number; ok: true; orders: Order[] }
  | { id: number; ok: true; plan: LeaderOrders }
  | { id: number; ok: true; save: SaveFile }
  | { id: number; ok: true; slot: SlotInfo }
  | { id: number; ok: true; answer: ProposeAnswer }
  | { id: number; ok: true; random: RandomPreview }
  /** Not an answer: something for the player to know (id is 0). */
  | { id: 0; ok: true; notice: string; calm?: boolean }
  | { id: number; ok: false; error: string };

// ---------- Online (session 26): the same contract over a WebSocket to the game's room ----------

/**
 * What the page sends a game room. The local worker's requests that make sense online, plus "hello" (where are we?),
 * sent on every (re)connect. Starting a game is the API's job; saves, files and pause are single player only.
 */
export type RoomRequest =
  | Extract<HostRequest, { type: "lockIn" | "saveOrders" | "watchNext" | "finish" | "suggest" | "planGenerals" | "propose" }>
  | { id: number; type: "hello"; have?: number; chatHave?: number }
  /** Session 28: chat (the table screen's, and the game's). */
  | { id: number; type: "chat"; act: ChatAct }
  /** Session 28: pause by vote: ask, agree or not, and say you're ready to go on. */
  | { id: number; type: "pause"; act: "ask" | "yes" | "no" | "ready" }
  | { id: number; type: "table"; act: TableAct }
  /** Session 27: leave the game for good: a Marshal plays the seat from now on (you can still watch). */
  | { id: number; type: "resign" }
  /** Session 27: a finished game's turn, to watch again (your own view of it). */
  | { id: number; type: "turnReplay"; turn: number }
  /** Session 28: answer another person's offer (or counter), and take back one of your own. */
  | { id: number; type: "answer"; from: PlayerId; offer: string; accept: boolean }
  | { id: number; type: "withdraw"; offer: string };

/**
 * Session 27: what someone at the table screen can do before the game starts. Sit down (with a House colour and their
 * own House's names and choices), change colour, get up again; the host can take someone off the table (before the
 * start, never after), start the game (empty seats become bots; `withBots`: start alone, for testing), or cancel it.
 */
export type TableAct =
  | { do: "sit"; house: number; leadersRun: boolean; name?: string; leaderName?: string; stewardName?: string; leaderPersonality?: LeaderStyle | null; stewardPersonality?: LeaderStyle | null }
  | { do: "colour"; house: number }
  | { do: "leave" }
  | { do: "remove"; seat: number }
  | { do: "start"; withBots?: boolean }
  | { do: "cancel" };

/**
 * The table screen (session 27), as the room sends it to everyone there. Only what the players panel shows of anyone
 * (a name, a House colour, who's the host, a person or an empty seat): never an email, an account or anything of the
 * game. Each person gets their own copy (`you`, and which seat is theirs).
 */
export interface TableView {
  gameId: string;
  /** The invite code (the link is `/?join=<code>`). */
  code: string;
  status: "waiting" | "started" | "cancelled";
  mapId: string;
  /** The game's settings, as the host chose them (the table's size is `seats.length`). */
  botLevel: BotChoice;
  turnSeconds: number;
  luck: number;
  fog: boolean;
  mode: GameMode;
  fate: boolean;
  diplomacy: boolean;
  /** The seats in order (the host's first); null: empty (a bot if the game starts so). */
  seats: ({ name: string; house: number; host: boolean; you: boolean } | null)[];
  /** You: sitting (your seat's index), the host, or taken off this table by the host. */
  you: { seat: number | null; host: boolean; removed?: true };
}

/** A room request without its id (each kind keeps its own fields). */
export type RoomBody = RoomRequest extends infer R ? (R extends { id: number } ? Omit<R, "id"> : never) : never;

/**
 * The room's answer to "hello": this person's game as it stands. Like `HostStart`, but the map travels as its id and
 * version (the page has the map with its drawing data; the room only the slim one it plays on).
 */
export interface RoomStart extends Omit<HostStart, "map"> {
  gameId: string;
  /**
   * Session 27: the page said it has the Chronicle up to this turn, so `chronicle` holds only the turns after it
   * (the whole Chronicle used to travel with every hello: 104 KB by turn 31 on Rootholm).
   */
  chronicleAfter?: number;
  /** Session 28: your chats and the messages your page lacks. */
  chat?: ChatSync;
  /** Session 28: a pause vote or a pause going on (and your pauses left). */
  pause?: PauseView;
  mapId: string;
  mapVersion: number | null;
}

/** Everything the room sends: the local host's answers (or the start), each with the room's clock so the page's countdown matches it. */
export type RoomMessage = { now: number } & (
  | HostResponse
  | { id: number; ok: true; start: RoomStart }
  | { id: number; ok: true; table: TableView }
  /** Not an answer (session 27): who at the table has locked in this turn (id is 0). */
  | { id: 0; ok: true; ready: PlayerId[] }
  /** Session 27: a finished game's turn as you saw it (your view before it, and its events from your seat). */
  | { id: number; ok: true; turnReplay: { before: PlayerView; report: TurnReport } }
  /** Session 28: the offers between people you're a side of, as they changed (a push, id 0), or done (an answer). */
  | { id: number; ok: true; talks: PeopleOffer[] }
  /** Session 28: chat: what changed in your chats (a push, id 0), or the answer to something you did there. */
  | { id: number; ok: true; chat: ChatSync }
  /** Session 28: a pause vote or pause changed (a push, or the answer to asking): the table's view of it, and your clock. */
  | { id: number; ok: true; pause: PauseView; clock: TurnClock | null }
);

/** The game list (the lobby's "Your online games"), from the database. */
export interface OnlineGameInfo {
  id: string;
  mapId: string;
  mapName: string;
  turn: number;
  /** Session 27: "waiting" for players (a table not started yet). */
  status: "waiting" | "playing" | "over";
  /** Session 27: a table waiting to start: how many seats, and how many are taken; you're its host. */
  seats?: number;
  seated?: number;
  host?: boolean;
  /** The invite code (a waiting table's link), for its host. */
  code?: string;
  /** Session 27: your seat left the game (resigned, or a Marshal took it after missed turns). It's under Finished. */
  left?: "resigned" | "taken";
  /** Session 28: the turn your seat was left on. */
  leftTurn?: number;
  /** Who the table is waiting on this turn, by name ("you" for you). */
  waitingOn: string[];
  /** When the turn's clock runs out (ms), or null. */
  deadline: number | null;
  /** Each person and bot at the table, in seat order. */
  players: { name: string; bot: boolean; you: boolean }[];
  created: number;
  /** Your seat's choice: "If I miss a turn with no orders, my leaders run my House". */
  leadersRun: boolean;
  winner?: string | null;
}

/** Making an online game (the API's body): the lobby's settings and your seat's choice. */
export interface NewOnlineGame {
  settings: LobbySettings;
  leadersRun: boolean;
}

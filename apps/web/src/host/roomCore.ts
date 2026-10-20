import type { MapDef } from "@conquerra/content";
import { readSave, type LeaderStyle, type Offer, type Order, type PlayerId, type SaveFile } from "@conquerra/engine";
import { PEOPLE_HOUSES } from "../map/houses";

/** Session 34: the most people at one table (up to 20 seats; the rest are bots). */
export const MAX_PEOPLE = 10;
import { LocalGame, PAUSES_EACH, PEOPLE_DEAL_TEXT, type PauseNews, type PersonSeat, type SeatLeft } from "./localGame";
import { cleanName } from "./names";
import { TABLE_TEXT } from "./roomText";
import { CHAT_TEXT, ChatRoom, type ChatBotSeat, type ChatSeat } from "./chatRoom";
import { ASK_TEXT, botReply, groupAnswer, offerAnswered, sayOptions, tableTalk, youAndBot } from "./botChat";
import { lines } from "@conquerra/content/lines";
import type { ChatAct, ChatSync, ChatView, HostUpdate, OfferEnd, LobbySettings, PauseView, RoomMessage, RoomRequest, RoomStart, TableAct, TableView } from "./protocol";

/**
 * Everything an online game's room does (session 26), in one place and with no Cloudflare in it: the game (the same
 * `LocalGame`, engine and bots as single player), its clock, lock-in, missed turns, saving every turn, and "where are
 * we" for a player who (re)connects. The `GameRoom` Durable Object forwards its WebSocket messages and its alarm here;
 * tests run it in-process with a memory store and a fake clock.
 *
 * Only `viewFor` leaves the room: every message to a seat is built from that seat's view and replay alone.
 */

/** Where the room keeps its game (the Durable Object's own SQLite storage; a map in tests). */
export interface RoomStore {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
}

/** What the game list shows (written to the database after every turn). */
export interface RoomInfo {
  gameId: string;
  turn: number;
  status: "playing" | "over";
  /** People still to lock in this turn. */
  waitingOn: PlayerId[];
  deadline: number | null;
  winner: PlayerId | null;
  /** Revealed at game over (provably fair). */
  seed?: string;
  seedHash: string;
}

export interface RoomIO {
  /** Send a message to a seat if it's connected (the room never sends one seat's message to another). Was it sent? */
  send(seat: PlayerId, msg: RoomMessage): boolean;
  /** Session 27: send a message to an account's page (someone at the table screen, seated or not). Was it sent? */
  sendUser(user: string, msg: RoomMessage): boolean;
  /** Session 27: the accounts with a page open on this room now. */
  users(): string[];
  /** Session 27: the table changed (seats, colours, started, cancelled): the game list's copy in the database. */
  tableChanged(mirror: TableMirror): void;
  /** Wake the room at this time (its alarm), or never. */
  wakeAt(at: number | null): void;
  /** The game list's line for this game changed. */
  listed(info: RoomInfo): void;
  /** A line for the logs (`wrangler tail`). */
  log(line: string): void;
  /**
   * Session 29: "your turn" for these accounts (their page isn't open as the window opens): a push, and in a long game
   * an email if they asked. The room's shell sends it in the background (never holding up a turn).
   */
  notify?(n: { gameId: string; turn: number; map: string; users: string[]; turnSeconds: number }): void;
}

/** A new online game, as the API makes it. */
export interface RoomSetup {
  gameId: string;
  settings: LobbySettings;
  people: PersonSeat[];
  /** The secret seed (the room makes it; only its hash is shown until the game ends). */
  seed: string;
}

/** Session 27: someone who opened the room (the Worker checked their sign-in): their account, name and usual colour. */
export interface Who {
  user: string;
  name: string;
  /** Their usual House colour (the default when they sit), if they have one. */
  colour: number | null;
  /** A game from before session 27 (no table): their seat, from the database. */
  seat?: PlayerId | null;
}

/** Someone sitting at the table: their account and how they'll play (their House's names and choices). */
export interface Sitter {
  user: string;
  name: string;
  house: number;
  leadersRun: boolean;
  leaderName?: string;
  stewardName?: string;
  leaderPersonality?: LeaderStyle | null;
  stewardPersonality?: LeaderStyle | null;
  /** Their seat in the game, once it starts ("p1", the host, then the others in the order they sat). */
  seat?: PlayerId;
}

/** A new table, as the API makes it: the host's settings and seat. */
export interface TableSetup {
  gameId: string;
  /** The invite code (the link). */
  code: string;
  settings: LobbySettings;
  /** The secret seed (only its hash is ever shown, until the game ends). */
  seed: string;
  host: Sitter;
}

/** The table, as the room keeps it (the room is the authority; the database has a copy for the lists). */
interface TableRecord {
  gameId: string;
  code: string;
  /** The host's account. */
  host: string;
  settings: LobbySettings;
  seed: string;
  status: "waiting" | "started" | "cancelled";
  /** How many seats (the host and the opponents the lobby asked for). */
  size: number;
  /** The people sitting, in seat order: the host first. */
  sitters: Sitter[];
  /** Accounts the host took off this table (they can't sit again). */
  removed: string[];
}

/** The database's copy of the table: its state and who sits where (people, and bots once it starts). */
export interface TableMirror {
  gameId: string;
  status: "waiting" | "playing" | "cancelled";
  size: number;
  seats: { seat: PlayerId; user: string | null; bot: string | null; colour: number; name: string; leadersRun: boolean; state?: "in" | "resigned" | "taken"; leftTurn?: number }[];
}

export { TABLE_TEXT } from "./roomText";

interface Meta {
  gameId: string;
  seed: string;
  seedHash: string;
  /** The last turn each seat was sent the report of (so someone coming back replays only what they missed). */
  seen: Record<PlayerId, number>;
  /** Session 29: the last turn each seat was told "your turn" (once a turn). */
  notified?: Record<PlayerId, number>;
}

/** Session 29: what the bots in the chat answer when they can't (the voice guide applies). */
export const BOT_CHAT_TEXT = {
  nothingMore: (bot: string) => `${bot} has nothing more to say this turn.`,
  quiet: (bot: string) => `${bot} doesn't chat. Deals only.`,
  gone: "That bot is out of the game.",
  notNow: "Bots chat while the game is on.",
  noTarget: "Pick a rival who's still in the game and not in this chat.",
} as const;

/** Session 28: what a lock-in during a pause is told. */
export const PAUSED_LOCK = "The game is paused. Your orders are kept: press Ready to go on.";

/** The orders a page may send: at most this many, each an object with an id and a kind. */
const MAX_ORDERS = 400;
/** How long a seat's queue must be still before the room saves it (ms). */
const QUEUE_SAVE_MS = 1500;

/** SHA-256 of a string, as hex (WebCrypto: the same in the browser, Node and Workers). */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export { newSeed } from "./seed";

/** Session 30: an offer as a chat line knows it (`ChatLine.offer`): its sender and id. */
export const offerKey = (o: Pick<Offer, "from" | "id">) => `${o.from}:${o.id}`;

/** A page's orders, checked for shape (the engine ignores orders that can't be carried out; this keeps out junk). */
function ordersOk(orders: unknown): orders is Order[] {
  return Array.isArray(orders) && orders.length <= MAX_ORDERS && orders.every((o) => !!o && typeof o === "object" && typeof (o as Order).id === "string" && typeof (o as Order).kind === "string");
}

export class RoomCore {
  private game: LocalGame | null = null;
  private meta: Meta | null = null;
  /** The game's save being written (tests wait for it). */
  private writing: Promise<void> = Promise.resolve();
  /** A seat's queue changed: the save is written again once it's been still for a moment. */
  private queuedTimer: ReturnType<typeof setTimeout> | null = null;
  /** Requests waiting for the turn to resolve (a lock-in while someone else is still planning), by seat. */
  private pending = new Map<PlayerId, number>();
  /** How long the last turn's resolution and planning took (ms), for the logs. */
  lastTurnMs = 0;
  /** Session 27: the table (null: not loaded yet; undefined: loaded, and there is none, a game from session 26). */
  private tableRec: TableRecord | null | undefined = null;
  /** Session 28: the table's chats (its people only; a game from session 26 has none). */
  readonly chat: ChatRoom;

  constructor(
    private readonly store: RoomStore,
    /**
     * A map by its id (session 30: and, for a game being loaded, the map maker version it was made at; a random map's
     * room keeps its slim copy in its own storage, so a deploy with a newer map maker never changes a running game).
     */
    private readonly loadMap: (id: string, version?: number | null, attempt?: number | null) => Promise<MapDef>,
    private readonly io: RoomIO,
    private readonly now: () => number = () => Date.now(),
    /** A clock for timing the work (Workers only move it on I/O; `wrangler tail` has the real CPU time). */
    private readonly timer: () => number = () => performance.now(),
  ) {
    this.chat = new ChatRoom(
      store,
      () => this.chatSeats(),
      now,
      () => this.chatBotSeats(),
      (c, user) => this.botChatExtra(c, user),
    );
  }

  /**
   * Session 29: the bots at the table, as chat knows them (a table's game only). One knocked out keeps its name in
   * its chats (found on the preview: a one-to-one with a finished bot read "A chat"), but can't be added to one.
   */
  private chatBotSeats(): ChatBotSeat[] {
    const g = this.game;
    if (!g || !this.tableRec) return [];
    return g.fullState.players.filter((p) => !g.peopleIds.includes(p.id)).map((p) => ({ seat: p.id, name: p.name, house: p.house, ...(p.eliminatedTurn !== null ? { out: true } : {}) }));
  }

  /** Session 29: what a chat with bots adds for one person: three lines for "Say something", and messages left. */
  private botChatExtra(c: { kind: string; bots: PlayerId[] }, user: string): Partial<ChatView> {
    const g = this.game;
    const seat = this.seatOf(user);
    if (!g || !seat || g.over) return {};
    const bots = g.chatBots().filter((b) => c.bots.includes(b.id));
    if (!bots.length) return {};
    const max = lines.limits.chatFree;
    const free = Math.max(...bots.map((b) => this.chat.freeLeft(user, b.id, g.turn, max)));
    if (c.kind !== "pair") return { free };
    const b = bots[0]!;
    if (!b.voice) return { quiet: true };
    return { say: sayOptions(this.meta!.gameId, g.turn, seat, b, this.between(seat, b.id)), free };
  }

  /** Session 29: what's between a person and a bot (from their own last replay and the deals they can see). */
  private between(seat: PlayerId, bot: PlayerId) {
    const g = this.g;
    return youAndBot(seat, bot, g.viewOf(seat), g.lastReplay(seat)?.report.events ?? [], g.ctx);
  }

  /**
   * Session 29: a multiple-choice line to a bot ("Say something", a group's prompt, an answer to its offer). The bot
   * answers in character, at most `chatFree` times a turn for each person, and commits to nothing: a deal is the only
   * way it ever agrees to anything.
   */
  private botAct(user: string, a: Extract<ChatAct, { do: "say" | "ask" | "answered" }>): { tell: Map<string, ChatSync> } | { error: string } {
    const g = this.game;
    const seat = this.seatOf(user);
    if (!g || !seat || g.over) return { error: BOT_CHAT_TEXT.notNow };
    if (this.chatSeats().find((s) => s.user === user)?.left) return { error: CHAT_TEXT.left };
    const c = this.chat.find(user, a.chat);
    if (!c || !c.bots.length) return { error: CHAT_TEXT.notMember };
    const bots = g.chatBots().filter((b) => c.bots.includes(b.id));
    const turn = g.turn;
    const max = lines.limits.chatFree;
    const gameId = this.meta!.gameId;
    const tell = new Map<string, ChatSync>();
    const merge = (m: Map<string, ChatSync>) => {
      for (const [u, s] of m) {
        const t = tell.get(u);
        if (t) (t.lines.push(...s.lines), t.chats.push(...s.chats));
        else tell.set(u, { ...s, lines: [...s.lines], chats: [...s.chats] });
      }
    };
    const seatOfBot = (id: PlayerId) => this.chat.bot(id)!;
    switch (a.do) {
      case "say": {
        const b = bots[0];
        if (c.kind !== "pair") return { error: CHAT_TEXT.notMember };
        if (!b) return { error: BOT_CHAT_TEXT.gone };
        if (!b.voice) return { error: BOT_CHAT_TEXT.quiet(b.name) };
        if (this.chat.freeLeft(user, b.id, turn, max) <= 0) return { error: BOT_CHAT_TEXT.nothingMore(b.name) };
        const between = this.between(seat, b.id);
        const options = sayOptions(gameId, turn, seat, b, between);
        const pick = Number.isInteger(a.pick) && a.pick >= 0 && a.pick < options.length ? a.pick : 0;
        merge(this.chat.write(c.id, { user }, options[pick]!));
        this.chat.useFree(user, b.id, turn);
        const reply = botReply(gameId, turn, seat, b, between, pick);
        if (reply) merge(this.chat.write(c.id, { bot: seatOfBot(b.id) }, reply));
        break;
      }
      case "ask": {
        if (c.kind !== "group") return { error: CHAT_TEXT.notMember };
        let rival: string | null = null;
        if (a.ask === "war") {
          const inChat = new Set([...c.bots, ...(this.chat.sync(user).chats.find((x) => x.id === c.id)?.members ?? []).flatMap((p) => (p.seat ? [p.seat] : []))]);
          const target = g.fullState.players.find((p) => p.id === a.target && p.eliminatedTurn === null && !inChat.has(p.id));
          if (!target) return { error: BOT_CHAT_TEXT.noTarget };
          rival = target.name;
        }
        merge(this.chat.write(c.id, { user }, a.ask === "war" ? ASK_TEXT.war(rival!) : ASK_TEXT.peace));
        for (const b of bots) {
          if (!b.voice || this.chat.freeLeft(user, b.id, turn, max) <= 0) continue;
          this.chat.useFree(user, b.id, turn);
          const line = groupAnswer(gameId, turn, b, a.ask === "war" ? "war" : "peace", rival, `${seat}|${a.ask}|${a.target ?? ""}`);
          // (Its words never bind it: the deal comes ready to send, for the member who asked.)
          if (line) merge(this.chat.write(c.id, { bot: seatOfBot(b.id) }, line, { propose: { to: b.id, kind: a.ask === "war" ? "war" : "truce", ...(a.ask === "war" ? { target: a.target! } : {}), for: seat } }));
        }
        break;
      }
      case "answered": {
        const b = bots[0];
        if (c.kind !== "pair" || !b) return { error: CHAT_TEXT.notMember };
        const offer = g.botOffersTo(seat).find((o) => o.id === a.offer && o.from === b.id);
        const key = `${user}|${a.offer}`;
        if (!offer || this.answered.has(key)) return { tell };
        this.answered.add(key);
        const line = offerAnswered(gameId, turn, seat, b, offer.terms.kind, a.accept === true);
        if (line) merge(this.chat.write(c.id, { bot: seatOfBot(b.id) }, line));
        break;
      }
    }
    // (Your messages left with the bot changed: the chat comes again, as you see it now.)
    merge(new Map([[user, { chats: this.chat.botChats(user).filter((v) => v.id === c.id), lines: [], canWrite: true }]]));
    return { tell };
  }

  /** Session 29: the bots' offers already answered in chat (one line from the bot each). */
  private answered = new Set<string>();

  /**
   * Session 29: after a turn, the bots speak in the table chat, each line written for one reader from that reader's
   * own replay and view (`tableTalk`), and each bot's offers to a person show in their one-to-one with it. Everyone's
   * chats with bots come again (their lines for "Say something" change each turn).
   */
  private async botsTalk() {
    const g = this.game;
    if (!g || !this.tableRec || !this.meta) return;
    await this.chat.load();
    const bots = g.chatBots();
    // Session 30: a bot's offer you locked in without answering: its note in your chat says it lapsed.
    const lapsed = new Map<string, OfferEnd>();
    const isBot = new Set(bots.map((b) => b.id));
    for (const seat of g.peopleIds)
      for (const e of g.lastReplay(seat)?.report.events ?? [])
        if (e.type === "offerLapsed" && e.why === "unanswered" && e.offer.to === seat && isBot.has(e.offer.from)) lapsed.set(offerKey(e.offer), "lapsed");
    const ended = this.chat.endOffers(lapsed);
    for (const seat of g.peopleIds) {
      const user = this.userOf(seat);
      if (!user) continue;
      const out: ChatSync = { chats: [], lines: [], canWrite: true };
      const add = (m: Map<string, ChatSync>) => {
        const s = m.get(user);
        if (s) (out.lines.push(...s.lines), out.chats.push(...s.chats), s.ended && (out.ended = { ...out.ended, ...s.ended }));
      };
      add(ended);
      const playing = !g.isOut(seat) && !g.leftSeats[seat] && !g.over;
      const last = g.lastReplay(seat);
      if (playing && last) {
        const said = tableTalk({ ctx: g.ctx, game: this.meta.gameId, reader: seat, before: last.before, after: g.viewOf(seat), events: last.report.events, bots, last: this.chat.botLast(user), cloud: g.cloudLifted });
        for (const s of said) {
          const b = this.chat.bot(s.bot);
          if (!b) continue;
          this.chat.spoke(user, s.bot, last.report.turn);
          add(this.chat.write("table", { bot: b }, s.text, { to: [user], turn: last.report.turn }));
        }
      }
      // A bot's offer to you shows in your one-to-one with it too (made if need be), with its own words.
      if (playing)
        for (const o of g.botOffersTo(seat)) {
          const made = this.chat.act(user, { do: "pair", with: o.from });
          const chat = made && "tell" in made ? made.tell.get(user)?.chats[0] : undefined;
          const b = this.chat.bot(o.from);
          if (chat && b) add(this.chat.write(chat.id, { bot: b }, o.note ?? "", { to: [user], offer: offerKey(o), ...(last ? { turn: last.report.turn } : {}) }));
        }
      out.chats.push(...this.chat.botChats(user));
      out.canWrite = !this.chatSeats().find((s) => s.user === user)?.left;
      if (out.lines.length || out.chats.length || out.ended) this.io.sendUser(user, { id: 0, ok: true, chat: out, now: this.now() });
    }
    await this.chat.flush();
  }

  /** Session 28: everyone sitting at the table, as chat knows them (who has left reads, but doesn't write). */
  private chatSeats(): ChatSeat[] {
    const t = this.tableRec;
    if (!t) return [];
    const left = this.game?.leftSeats ?? {};
    return t.sitters.map((x) => ({ user: x.user, name: x.name, house: x.house, ...(x.seat ? { seat: x.seat } : {}), ...(x.seat && left[x.seat] ? { left: true } : {}) }));
  }

  /** Session 28: something done in chat. The page that did it gets the answer; everyone else concerned, a push. */
  private async chatMessage(who: Who, req: Extract<RoomRequest, { type: "chat" }>) {
    await this.chat.load();
    // Session 29: once the game has started, chat knows its bots (a room that woke from hibernation loads it first).
    const a = req.act;
    if (this.tableRec?.status === "started") await this.ensureLoaded();
    const done = a && typeof a === "object" && (a.do === "say" || a.do === "ask" || a.do === "answered") ? this.botAct(who.user, a) : this.chat.act(who.user, req.act);
    if (done && "error" in done) {
      this.io.sendUser(who.user, { id: req.id, ok: false, error: done.error, now: this.now() });
      return;
    }
    const mine = done?.tell.get(who.user) ?? { chats: [], lines: [], canWrite: true };
    this.io.sendUser(who.user, { id: req.id, ok: true, chat: mine, now: this.now() });
    for (const [user, sync] of done?.tell ?? []) if (user !== who.user) this.io.sendUser(user, { id: 0, ok: true, chat: sync, now: this.now() });
    await this.chat.flush();
  }

  /** Make the game: the people in their seats, bots in the rest, the seed committed to. */
  async create(setup: RoomSetup): Promise<RoomInfo> {
    if (await this.store.get("meta")) throw new Error("This game already exists");
    const map = await this.loadMap(setup.settings.mapId, null, setup.settings.mapAttempt);
    this.meta = { gameId: setup.gameId, seed: setup.seed, seedHash: await sha256Hex(setup.seed), seen: {} };
    await this.store.put("meta", this.meta);
    const t0 = this.timer();
    this.game = new LocalGame(map, setup.settings, setup.seed, this.now, { table: { gameId: setup.gameId, people: setup.people }, autosave: this.autosave });
    this.io.log(`game ${setup.gameId}: made on ${map.id} with ${setup.people.length} people, opening plans in ${(this.timer() - t0).toFixed(1)} ms`);
    await this.flush();
    this.afterChange();
    return this.info();
  }

  // ---------- Session 27: the table, before the game starts ----------

  /** Make a table: the host in the first seat, the rest empty until friends sit down or the host starts. */
  async createTable(setup: TableSetup): Promise<TableView> {
    if ((await this.store.get("table")) || (await this.store.get("meta"))) throw new Error("This game already exists");
    const size = Math.max(2, Math.floor(setup.settings.bots) + 1);
    // Session 30: a random map is made now (the room keeps it), so a seed that makes no fair map says so before anyone sits.
    // (Session 33b: from the try the host's page says passed, so a big map's six tries aren't all made again here.)
    if (setup.settings.mapId.startsWith("random:")) await this.loadMap(setup.settings.mapId, null, setup.settings.mapAttempt);
    const table: TableRecord = { gameId: setup.gameId, code: setup.code, host: setup.host.user, settings: setup.settings, seed: setup.seed, status: "waiting", size, sitters: [setup.host], removed: [] };
    this.tableRec = table;
    this.saveTable();
    this.mirror();
    this.io.log(`table ${setup.gameId}: made on ${setup.settings.mapId} with ${size} seats`);
    await this.flush();
    return this.tableView(table, setup.host.user);
  }

  /** The table, if this game has one (a game from session 26 doesn't). */
  private async loadTable(): Promise<TableRecord | undefined> {
    if (this.tableRec === null) this.tableRec = ((await this.store.get("table")) as TableRecord | null) ?? undefined;
    return this.tableRec;
  }

  private saveTable() {
    const t = this.tableRec;
    if (!t) return;
    this.writing = this.writing.then(() => this.store.put("table", t)).catch((e) => this.io.log(`table save failed: ${e instanceof Error ? e.message : String(e)}`));
  }

  /** The table as one person sees it: names, colours, the host, empty seats. Nothing else about anyone. */
  private tableView(t: TableRecord, user: string): TableView {
    const s = t.settings;
    const mine = t.sitters.findIndex((x) => x.user === user);
    return {
      gameId: t.gameId,
      code: t.code,
      status: t.status,
      mapId: s.mapId,
      botLevel: s.botLevel,
      turnSeconds: s.turnSeconds ?? 300,
      luck: s.luck,
      fog: s.fog,
      mode: s.mode,
      fate: s.fate !== false,
      diplomacy: s.diplomacy !== false,
      seats: Array.from({ length: t.size }, (_, i) => {
        const x = t.sitters[i];
        return x ? { name: x.name, house: x.house, host: i === 0, you: x.user === user } : null;
      }),
      you: { seat: mine >= 0 ? mine : null, host: t.host === user, ...(t.removed.includes(user) ? { removed: true as const } : {}) },
    };
  }

  /** The account sitting in a seat (once the game has started), or null (a bot, or a game from session 26). */
  userOf(seat: PlayerId): string | null {
    return (this.tableRec && this.tableRec.sitters.find((x) => x.seat === seat)?.user) ?? null;
  }

  /** The seat an account sits in (once the game has started), or null. */
  seatOf(user: string): PlayerId | null {
    return (this.tableRec && this.tableRec.sitters.find((x) => x.user === user)?.seat) ?? null;
  }

  /** The database's copy of the table. */
  private mirror() {
    const t = this.tableRec;
    if (!t) return;
    const left = this.game?.leftSeats ?? {};
    const people = t.sitters.map((x, i) => {
      const gone = x.seat ? left[x.seat] : undefined;
      return { seat: x.seat ?? `p${i + 1}`, user: x.user, bot: gone ? "marshal" : null, colour: x.house, name: x.name, leadersRun: x.leadersRun, state: gone ? (gone.why === "taken" ? ("taken" as const) : ("resigned" as const)) : ("in" as const), ...(gone ? { leftTurn: gone.turn } : {}) };
    });
    const bots =
      t.status === "started" && this.game
        ? this.game.fullState.players.filter((p) => !t.sitters.some((x) => x.seat === p.id)).map((p) => ({ seat: p.id, user: null, bot: t.settings.botLevel, colour: p.house, name: p.name, leadersRun: false }))
        : [];
    this.io.tableChanged({ gameId: t.gameId, status: t.status === "started" ? "playing" : t.status, size: t.size, seats: [...people, ...bots] });
  }

  /** Everyone at the table screen (but `except`) gets the table as it is now, each their own copy. */
  private broadcast(t: TableRecord, except?: string) {
    for (const user of this.io.users()) if (user !== except) this.io.sendUser(user, { id: 0, ok: true, table: this.tableView(t, user), now: this.now() });
  }

  /**
   * A message from someone's page. Before the game starts, the table screen's; once it has, a seated person's game
   * (anyone else is told it has started). A game from before session 27 has no table: its seats are in the database.
   */
  async receive(who: Who, req: RoomRequest): Promise<void> {
    if (!req || typeof req !== "object" || typeof req.id !== "number") return;
    const table = await this.loadTable();
    // Session 28: chat, at the table screen and in the game alike.
    if (table && req.type === "chat") return this.chatMessage(who, req);
    if (!table) {
      if (who.seat) return this.message(who.seat, req);
      this.io.sendUser(who.user, { id: req.id, ok: false, error: TABLE_TEXT.noSeat, now: this.now() });
      return;
    }
    if (table.status !== "started" || req.type === "table") return this.tableMessage(who, table, req);
    const seat = table.sitters.find((x) => x.user === who.user)?.seat;
    if (seat) return this.message(seat, req);
    this.io.sendUser(who.user, { id: req.id, ok: false, error: TABLE_TEXT.started, now: this.now() });
  }

  private async tableMessage(who: Who, t: TableRecord, req: RoomRequest): Promise<void> {
    const answer = (msg: { ok: true; table: TableView } | { ok: false; error: string }) => this.io.sendUser(who.user, { ...msg, id: req.id, now: this.now() } as RoomMessage);
    if (req.type === "hello") {
      answer({ ok: true, table: this.tableView(t, who.user) });
      await this.sendChat(who.user, req.chatHave);
      return;
    }
    if (req.type !== "table" || !req.act || typeof req.act !== "object") {
      answer({ ok: false, error: t.status === "cancelled" ? TABLE_TEXT.cancelled : t.status === "started" ? TABLE_TEXT.started : TABLE_TEXT.notYet });
      return;
    }
    const error = t.status === "started" ? TABLE_TEXT.started : t.status === "cancelled" ? TABLE_TEXT.cancelled : this.act(who, t, req.act);
    if (error) {
      answer({ ok: false, error });
      return;
    }
    if (req.act.do === "start") await this.begin(t);
    this.saveTable();
    this.mirror();
    await this.flush();
    answer({ ok: true, table: this.tableView(t, who.user) });
    this.broadcast(t, who.user);
    // Session 28: someone who just sat down reads the table chat from its start.
    if (req.act.do === "sit") await this.sendChat(who.user);
  }

  /** Session 28: an account's chats and the messages its page lacks (only if it sits at the table). */
  private async sendChat(user: string, have?: number) {
    if (!this.tableRec || !this.tableRec.sitters.some((x) => x.user === user)) return;
    await this.chat.load();
    this.io.sendUser(user, { id: 0, ok: true, chat: this.chat.sync(user, typeof have === "number" ? have : 0), now: this.now() });
  }

  /** One change to the table, or the sentence saying why not. (The start itself is `begin`.) */
  private act(who: Who, t: TableRecord, a: TableAct): string | null {
    const host = who.user === t.host;
    const mine = t.sitters.findIndex((x) => x.user === who.user);
    const free = (h: unknown, except = -1) => Number.isInteger(h) && (h as number) >= 0 && (h as number) < PEOPLE_HOUSES && !t.sitters.some((x, i) => i !== except && x.house === h);
    const style = (v: unknown) => (typeof v === "string" ? (v as LeaderStyle) : null);
    const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 40) : undefined);
    switch (a.do) {
      case "sit": {
        if (t.removed.includes(who.user)) return TABLE_TEXT.removed;
        if (mine >= 0) return this.act(who, t, { do: "colour", house: a.house });
        if (t.sitters.length >= t.size) return TABLE_TEXT.full;
        if (t.sitters.length >= MAX_PEOPLE) return TABLE_TEXT.peopleFull;
        if (!free(a.house)) return TABLE_TEXT.colourTaken;
        const leaderName = text(a.leaderName);
        const stewardName = text(a.stewardName);
        t.sitters.push({
          user: who.user,
          // The name they gave on the table screen (also saved as their name), else their account's.
          name: cleanName(a.name) ?? who.name,
          house: a.house,
          leadersRun: a.leadersRun !== false,
          ...(leaderName ? { leaderName } : {}),
          ...(stewardName ? { stewardName } : {}),
          leaderPersonality: style(a.leaderPersonality),
          stewardPersonality: style(a.stewardPersonality),
        });
        return null;
      }
      case "colour":
        if (mine < 0) return TABLE_TEXT.notSeated;
        if (!free(a.house, mine)) return TABLE_TEXT.colourTaken;
        t.sitters[mine]!.house = a.house;
        return null;
      case "leave":
        if (host) return TABLE_TEXT.hostLeaves;
        if (mine >= 0) t.sitters.splice(mine, 1);
        return null;
      case "remove": {
        if (!host) return TABLE_TEXT.notHost;
        const gone = t.sitters[a.seat];
        if (!gone || a.seat === 0) return null;
        t.sitters.splice(a.seat, 1);
        t.removed.push(gone.user);
        return null;
      }
      case "start":
        if (!host) return TABLE_TEXT.notHost;
        if (t.sitters.length < 2 && !a.withBots) return TABLE_TEXT.noFriend;
        return null;
      case "cancel":
        if (!host) return TABLE_TEXT.notHost;
        t.status = "cancelled";
        this.io.log(`table ${t.gameId}: cancelled`);
        return null;
      default:
        return "That can't be done at the table.";
    }
  }

  /**
   * The host pressed Start: the people sit in seat order ("p1" the host, then the others as they sat down), the empty
   * seats become bots at the table's level, the capitals are dealt with the seat rule (harder spots to bots first), and
   * everyone seated goes straight into turn 1.
   */
  private async begin(t: TableRecord) {
    t.sitters.forEach((x, i) => (x.seat = `p${i + 1}`));
    const people: PersonSeat[] = t.sitters.map((x) => ({
      id: x.seat!,
      name: x.name,
      house: x.house,
      ...(x.leaderName ? { leaderName: x.leaderName } : {}),
      ...(x.stewardName ? { stewardName: x.stewardName } : {}),
      leaderPersonality: x.leaderPersonality ?? null,
      stewardPersonality: x.stewardPersonality ?? null,
      leadersRun: x.leadersRun,
    }));
    const { house: _h, leaderName: _l, stewardName: _s, leaderPersonality: _lp, stewardPersonality: _sp, ...rules } = t.settings;
    const bots = t.size - people.length;
    const marshals = rules.botLevel === "mixed" ? { marshals: Math.min(bots, rules.marshals ?? Math.ceil(bots / 2)) } : {};
    await this.create({ gameId: t.gameId, settings: { ...rules, bots, ...marshals }, people, seed: t.seed });
    t.status = "started";
    await this.chat.load();
    // Session 29: the bots' first offers show in each person's one-to-one with them.
    await this.botsTalk();
    // Everyone seated goes into turn 1 (a page at the table screen is waiting for exactly this).
    for (const x of t.sitters) this.reply(x.seat!, { id: 0, ok: true, start: this.hello(x.seat!) });
  }

  /** The room woke up (after sleeping between turns): load the game from storage. */
  async ensureLoaded(): Promise<LocalGame> {
    if (this.game) return this.game;
    const meta = (await this.store.get("meta")) as Meta | null;
    const raw = await this.store.get("game");
    if (!meta || !raw) throw new Error("This game doesn't exist");
    const read = readSave(raw);
    if (!read.ok) throw new Error(read.why);
    const map = await this.loadMap(read.save.mapId, read.save.mapVersion);
    this.meta = meta;
    this.game = LocalGame.restore(map, read.save, this.now, this.autosave);
    // The clock again (session 27): if the alarm was lost (a restart between a turn and its alarm), a deadline that has
    // passed fires at once and the turn resolves as it would have.
    this.io.wakeAt(this.game.over ? null : this.game.alarmAt);
    return this.game;
  }

  private get g(): LocalGame {
    if (!this.game) throw new Error("No game loaded");
    return this.game;
  }

  /** The game saves itself at the start of every turn's planning, as single player's autosave does. */
  private autosave = (save: SaveFile) => {
    this.writing = this.writing.then(() => this.store.put("game", save)).catch((e) => this.io.log(`save failed: ${e instanceof Error ? e.message : String(e)}`));
  };

  /** Write the game as it stands now (a lock-in, a queue that's been still for a moment). */
  private saveNow() {
    if (this.queuedTimer) clearTimeout(this.queuedTimer);
    this.queuedTimer = null;
    if (this.game && !this.game.over) this.autosave(this.game.snapshot());
  }

  /** Wait for the save being written (tests; the Durable Object also waits before answering), and chat's. */
  async flush(): Promise<void> {
    await this.writing;
    await this.chat.flush();
  }

  /** The game list's line. */
  info(): RoomInfo {
    const g = this.g;
    const winner = g.winner;
    return {
      gameId: this.meta!.gameId,
      turn: g.turn,
      status: g.over ? "over" : "playing",
      waitingOn: g.waitingOn,
      deadline: g.nextDeadline,
      winner,
      seedHash: this.meta!.seedHash,
      ...(g.over ? { seed: this.meta!.seed } : {}),
    };
  }

  /** After anything that changes the turn or the clock: set the alarm and update the game list. */
  private afterChange() {
    this.notifyDue();
    this.io.wakeAt(this.game?.over ? null : this.wakeTime());
    if (this.game) this.io.listed(this.info());
  }

  /** The room's next alarm: the turn's (deadline, vote, pause), or sooner the window opening, if someone may need telling. */
  private wakeTime(): number | null {
    const g = this.game;
    if (!g) return null;
    const opens = g.windowOpensAt;
    const due = this.io.notify && opens !== null && opens > this.now() && g.playingIds.some((s) => (this.meta?.notified?.[s] ?? 0) < g.turn);
    const at = g.alarmAt;
    return due ? (at === null ? opens : Math.min(at, opens)) : at;
  }

  /**
   * Session 29: the window is open: everyone still playing whose page isn't open, and who hasn't been told this turn
   * and hasn't locked in, gets a "your turn" (once a turn, for every timer).
   */
  private notifyDue() {
    const g = this.game;
    const meta = this.meta;
    if (!g || !meta || g.over || !this.io.notify || !this.tableRec) return;
    const opens = g.windowOpensAt;
    if (opens !== null && this.now() < opens) return;
    const open = new Set(this.io.users());
    const users: string[] = [];
    for (const seat of g.playingIds) {
      const user = this.userOf(seat);
      if (!user || g.isOut(seat) || g.lockedIn(seat) || open.has(user) || (meta.notified?.[seat] ?? 0) >= g.turn) continue;
      (meta.notified ??= {})[seat] = g.turn;
      users.push(user);
    }
    if (!users.length) return;
    this.writing = this.writing.then(() => this.store.put("meta", meta)).catch(() => undefined);
    this.io.log(`game ${meta.gameId}: "your turn" (turn ${g.turn}) for ${users.length} ${users.length === 1 ? "person" : "people"}`);
    this.io.notify({ gameId: meta.gameId, turn: g.turn, map: g.ctx.map.name, users, turnSeconds: g.turnSeconds ?? 0 });
  }

  /** The seed's hash, and the seed itself once the game is over. */
  private fair() {
    return { seedHash: this.meta!.seedHash, ...(this.game?.over ? { seed: this.meta!.seed } : {}) };
  }

  private reply(seat: PlayerId, msg: Omit<Extract<RoomMessage, { ok: false }>, "now"> | Record<string, unknown>): boolean {
    return this.io.send(seat, { ...(msg as object), now: this.now() } as RoomMessage);
  }

  /** "Where are we": this seat's game as it stands (planning with their queue, or the replay they missed). */
  hello(seat: PlayerId, have = 0, chatHave = 0): RoomStart {
    const g = this.g;
    const { map, queued: _restored, chronicle, ...start } = g.start(seat);
    // Session 27: the page keeps its own Chronicle and says which turns it has: only the ones it lacks travel.
    const after = Number.isInteger(have) && have > 0 ? have : 0;
    const last = g.lastReplay(seat);
    const opens = g.windowOpensAt;
    const unseen = !!last && (this.meta!.seen[seat] ?? 0) < last.report.turn;
    const queued = g.queuedFor(seat);
    return {
      ...start,
      chronicle: after ? (chronicle ?? []).filter((r) => r.turn > after) : (chronicle ?? []),
      ...(after ? { chronicleAfter: after } : {}),
      gameId: this.meta!.gameId,
      mapId: map.id,
      mapVersion: map.generator?.version ?? null,
      ...(map.id.startsWith("random:") && map.generator ? { mapAttempt: map.generator.attempt } : {}),
      fair: this.fair(),
      people: g.playingIds,
      ...this.leftInfo(),
      ...(g.readyIds.length ? { ready: g.readyIds } : {}),
      ...(queued ? { queued } : {}),
      ...(g.lockedIn(seat) && !g.over ? { lockedIn: true } : {}),
      ...(last ? { replay: { before: last.before, report: last.report, play: unseen || (opens !== null && this.now() < opens) } } : {}),
      // Session 28: your chats (once chat has loaded: a room wakes it with the first hello).
      ...(this.chatFor(seat, chatHave) ?? {}),
      // Session 28: a pause vote or a pause going on, and your pauses left.
      ...(g.pauseInfo.vote || g.pauseInfo.paused || g.pauseInfo.used[seat] ? { pause: this.pauseView(seat) } : {}),
    };
  }

  /** Session 28: the chat part of a seat's "where are we". */
  private chatFor(seat: PlayerId, have: number): { chat: ReturnType<ChatRoom["sync"]> } | null {
    const user = this.userOf(seat);
    if (!user) return null;
    try {
      return { chat: this.chat.sync(user, have) };
    } catch {
      return null;
    }
  }

  /** A message from a seat's page. */
  async message(seat: PlayerId, req: RoomRequest): Promise<void> {
    if (!req || typeof req !== "object" || typeof req.id !== "number") return;
    try {
      const g = await this.ensureLoaded();
      if (!g.peopleIds.includes(seat)) throw new Error("You don't have a seat in this game");
      switch (req.type) {
        case "hello": {
          await this.loadTable();
          if (this.tableRec) await this.chat.load();
          const start = this.hello(seat, typeof req.have === "number" ? req.have : 0, typeof req.chatHave === "number" ? req.chatHave : 0);
          if (this.reply(seat, { id: req.id, ok: true, start }) && start.replay) this.markSeen(seat, start.replay.report.turn);
          return;
        }
        case "saveOrders":
          if (!ordersOk(req.orders) || typeof req.turn !== "number") return;
          if (!g.saveOrders(req.orders, req.turn, Array.isArray(req.paused) ? req.paused.filter((x) => typeof x === "string") : [], seat)) return;
          // Kept once the queue has been still for a moment (or at once: the tab is closing).
          if (this.queuedTimer) clearTimeout(this.queuedTimer);
          if (req.now) this.saveNow();
          else this.queuedTimer = setTimeout(() => this.saveNow(), QUEUE_SAVE_MS);
          return;
        case "lockIn": {
          if (!ordersOk(req.orders) || typeof req.turn !== "number") throw new Error("Those orders couldn't be read.");
          // Session 28: paused, orders are kept but not locked in (the page presses Ready instead).
          if (g.isPausedOnline) {
            g.saveOrders(req.orders, req.turn, [], seat);
            throw new Error(PAUSED_LOCK);
          }
          if (req.turn !== g.turn) {
            this.reply(seat, { id: req.id, ok: true, update: this.withFair(g.update(null, 0, seat)) });
            return;
          }
          const resolved = this.timed(() => g.lockInFor(seat, req.orders, req.turn));
          if (resolved) this.deliver(resolved, new Map([[seat, req.id]]));
          else {
            // Waiting on someone else: the answer comes when the turn resolves. Their lock-in is kept now.
            this.pending.set(seat, req.id);
            this.saveNow();
            this.afterChange();
            // Everyone at the table sees who has locked in (session 27: a tick in the players panel, nothing more).
            this.tellReady();
            // Session 28: offers that waited on their answer lapse, and their proposers are told.
            this.tellTalks();
          }
          return;
        }
        case "watchNext":
        case "finish": {
          const resolved = this.timed(() => g.playOnline(req.type === "finish" ? Infinity : 1));
          this.deliver(resolved, new Map([[seat, req.id]]));
          return;
        }
        case "suggest":
          this.reply(seat, { id: req.id, ok: true, orders: g.suggest(seat) });
          return;
        case "planGenerals":
          this.reply(seat, { id: req.id, ok: true, plan: g.leaderOrders(req.instructions ?? {}, req.purses, seat) });
          return;
        case "turnReplay": {
          // A finished game only (while it goes on, "Watch again" has the last turn).
          if (!g.over) throw new Error("You can watch any turn again once the game is over.");
          const r = g.turnReplay(seat, req.turn);
          if (!r) throw new Error("That turn can't be shown again.");
          this.reply(seat, { id: req.id, ok: true, turnReplay: r });
          return;
        }
        case "resign":
          if (!(await this.resign(seat, req.id))) throw new Error("You can't resign from this game now.");
          return;
        case "pause": {
          const done = req.act === "ask" ? g.askPause(seat) : req.act === "ready" ? g.readyPause(seat) : req.act === "yes" || req.act === "no" ? g.answerPause(seat, req.act === "yes") : { error: "That can't be done with a pause." };
          if ("error" in done) throw new Error(done.error);
          this.saveNow();
          this.reply(seat, { id: req.id, ok: true, pause: this.pauseView(seat, done.news), clock: g.update(null, 0, seat).clock });
          this.tellPause(done.news, seat);
          return;
        }
        case "propose": {
          // Session 28: to a person, the room relays it (they answer in their own time); to a bot, it answers at once.
          const to = req.offer && typeof req.offer === "object" ? req.offer.to : undefined;
          if (to && g.peopleIds.includes(to)) {
            const why = g.offerToPerson(req.offer, seat);
            if (why) throw new Error(why);
            this.reply(seat, { id: req.id, ok: true, answer: { accept: false, reason: "", waiting: true } });
            this.tellTalks();
            // Session 30: a note with it goes in your one-to-one too, as a bot's does (and says so if it lapses).
            await this.offerNote(seat, req.offer);
            return;
          }
          this.reply(seat, { id: req.id, ok: true, answer: g.propose(req.offer, seat) });
          return;
        }
        case "answer": {
          const why = typeof req.offer === "string" && typeof req.from === "string" ? g.answerPerson(req.from, req.offer, req.accept === true, seat) : PEOPLE_DEAL_TEXT.notOpen;
          if (why) throw new Error(why);
          this.reply(seat, { id: req.id, ok: true, talks: g.peopleOffersFor(seat) });
          this.tellTalks(seat);
          return;
        }
        case "withdraw": {
          const why = typeof req.offer === "string" ? g.withdrawOffer(req.offer, seat) : PEOPLE_DEAL_TEXT.notOpen;
          if (why) throw new Error(why);
          this.reply(seat, { id: req.id, ok: true, talks: g.peopleOffersFor(seat) });
          this.tellTalks(seat);
          return;
        }
        default:
          throw new Error("An online game can't do that.");
      }
    } catch (err) {
      this.reply(seat, { id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  /** The alarm: if the clock has run out, the turn resolves with everyone's orders as they stand. */
  async alarm(): Promise<void> {
    const g = await this.ensureLoaded();
    // (Session 29: a room the alarm woke knows who sits where before it tells anyone it's their turn.)
    await this.loadTable();
    // Session 28: a vote's 60 s, or a pause's 15 minutes, may be what woke the room.
    const news = g.tickPause();
    if (news) {
      this.saveNow();
      this.tellPause(news);
    }
    const resolved = this.timed(() => g.expireTable());
    if (resolved) this.deliver(resolved, new Map());
    // (Session 29: or the window opened: "your turn" for anyone not here, then the alarm for the deadline.)
    else this.afterChange();
  }

  /** Run a turn's resolution (and everyone's planning for the next), logging how long it took. */
  private timed<T>(work: () => T): T {
    const t0 = this.timer();
    const turn = this.g.turn;
    const out = work();
    if (this.g.turn !== turn || this.g.over) {
      this.lastTurnMs = this.timer() - t0;
      // (On Cloudflare the clock stands still while code runs: there, the request's own CPU time in `wrangler tail`
      // or the dashboard is the measure, and this says nothing.)
      const took = this.lastTurnMs > 0 ? ` in ${this.lastTurnMs.toFixed(1)} ms` : "";
      this.io.log(`game ${this.meta!.gameId}: turn ${turn} resolved${this.g.over ? "" : ` and turn ${this.g.turn} planned`}${took} (${this.g.peopleIds.length} people)`);
    }
    return out;
  }

  /**
   * A turn resolved: each seat gets its own update (an answer to its waiting lock-in, or a push), with the seed
   * revealed if the game is over. Saved first.
   */
  private deliver(updates: Map<PlayerId, HostUpdate>, answering: Map<PlayerId, number>) {
    for (const [seat, id] of this.pending) if (!answering.has(seat)) answering.set(seat, id);
    this.pending.clear();
    // (Last turn's offers between people went with it: each update carries this turn's, if any.)
    this.g.takeTalkChanges();
    for (const [seat, update] of updates) {
      const u = this.withFair(update);
      const id = answering.get(seat);
      const sent = id !== undefined ? this.reply(seat, { id, ok: true, update: u }) : this.reply(seat, { id: 0, ok: true, pushed: u });
      if (sent && u.report) this.markSeen(seat, u.report.turn);
    }
    if (this.game?.over) this.io.log(`game ${this.meta!.gameId}: over on turn ${this.game.turn}, seed revealed`);
    this.announceLeft();
    this.afterChange();
    // Session 29: the bots have their say about the turn (each reader their own lines), once it's sent.
    this.writing = this.writing.then(() => this.botsTalk()).catch((e) => this.io.log(`bots' chat failed: ${e instanceof Error ? e.message : String(e)}`));
  }

  private withFair(u: HostUpdate): HostUpdate {
    return { ...u, fair: this.fair(), people: this.g.playingIds, ...this.leftInfo() };
  }

  /**
   * Session 28: each seat whose offers between people changed gets them again (only the offers it's a side of). The
   * seat that asked (`answered`) has its own copy in the answer.
   */
  private tellTalks(answered?: PlayerId) {
    const changed = this.g.takeTalkChanges();
    for (const seat of changed) if (seat !== answered) this.reply(seat, { id: 0, ok: true, talks: this.g.peopleOffersFor(seat) });
    // Session 30: an offer between people that lapsed or was withdrawn: its note in chat says so.
    const ended = new Map<string, OfferEnd>();
    for (const seat of changed)
      for (const r of this.g.peopleOffersFor(seat)) {
        if (r.state === "lapsed" || r.state === "withdrawn") ended.set(offerKey(r.offer), r.state);
        if (r.counter && (r.counterState === "lapsed" || r.counterState === "withdrawn")) ended.set(offerKey(r.counter), r.counterState);
      }
    if (ended.size) this.chatEnded(ended);
  }

  /** Session 30: a person's offer with a note: the note goes in the two people's one-to-one, from its writer. */
  private async offerNote(seat: PlayerId, offer: Offer) {
    const note = typeof offer.note === "string" ? offer.note.trim() : "";
    const from = this.userOf(seat), to = this.userOf(offer.to);
    if (!note || !from || !to || !this.tableRec) return;
    await this.chat.load();
    const made = this.chat.act(from, { do: "pair", with: offer.to });
    const chat = made && "tell" in made ? made.tell.get(from)?.chats[0] : undefined;
    if (!chat) return;
    if (made && "tell" in made) for (const [u, s] of made.tell) this.io.sendUser(u, { id: 0, ok: true, chat: s, now: this.now() });
    for (const [u, s] of this.chat.write(chat.id, { user: from }, note, { offer: offerKey(offer) })) this.io.sendUser(u, { id: 0, ok: true, chat: s, now: this.now() });
    await this.chat.flush();
  }

  private chatEnded(ended: ReadonlyMap<string, OfferEnd>) {
    if (!this.tableRec) return;
    this.writing = this.writing
      .then(async () => {
        await this.chat.load();
        for (const [u, s] of this.chat.endOffers(ended)) this.io.sendUser(u, { id: 0, ok: true, chat: s, now: this.now() });
        await this.chat.flush();
      })
      .catch((e) => this.io.log(`chat failed: ${e instanceof Error ? e.message : String(e)}`));
  }

  /** Session 28: the pause as one seat is told it (the same for everyone, but for their own pauses left). */
  private pauseView(seat: PlayerId, news?: PauseNews | null): PauseView {
    const s = this.g.pauseInfo;
    const playing = this.g.playingIds.filter((id) => !this.g.isOut(id));
    return {
      ...(s.vote ? { vote: { by: s.vote.by, endsAt: s.vote.endsAt, yes: [...s.vote.yes], waiting: playing.filter((id) => !s.vote!.yes.includes(id)) } } : {}),
      ...(s.paused ? { paused: { by: s.paused.by, endsAt: s.paused.endsAt, ready: [...s.paused.ready], waiting: playing.filter((id) => !s.paused!.ready.includes(id)) } } : {}),
      left: Math.max(0, PAUSES_EACH - (s.used[seat] ?? 0)),
      ...(news ? { news } : {}),
    };
  }

  /** Session 28: everyone at the table (but `except`, who got an answer) hears what happened to the pause, with their clock. */
  private tellPause(news: PauseNews | null, except?: PlayerId) {
    if (news) this.io.log(`game ${this.meta!.gameId}: pause ${news.kind}${"why" in news ? ` (${news.why})` : ""}`);
    for (const seat of this.g.peopleIds) if (seat !== except) this.reply(seat, { id: 0, ok: true, pause: this.pauseView(seat, news), clock: this.g.update(null, 0, seat).clock });
    this.afterChange();
  }

  /** Who has locked in this turn, to everyone at the table (session 27). */
  private tellReady() {
    const ready = this.g.readyIds;
    for (const seat of this.g.peopleIds) this.reply(seat, { id: 0, ok: true, ready });
  }

  /** The seats people left to a Marshal (session 27; public, as the players panel shows it). */
  private leftInfo(): { leftSeats?: Record<PlayerId, SeatLeft> } {
    const left = this.g.leftSeats;
    return Object.keys(left).length ? { leftSeats: left } : {};
  }

  /**
   * Seats that just left their person (a resignation, or a third missed turn): everyone else at the table is told
   * ("Kit's seat is a Marshal's now."), and the database's copy marks the seat. Session 27.
   */
  private announceLeft(except?: PlayerId) {
    const gone = this.g.takeLeftNow();
    if (!gone.length) return;
    for (const { id, why } of gone) {
      const name = this.g.fullState.players.find((p) => p.id === id)?.name ?? "A player";
      const notice = why === "resigned" ? `${name} resigned. ${name}'s seat is a Marshal's now.` : `${name} missed three turns in a row. ${name}'s seat is a Marshal's now.`;
      this.io.log(`game ${this.meta!.gameId}: ${id} ${why === "resigned" ? "resigned" : "taken over after three missed turns"} on turn ${this.g.turn}`);
      for (const seat of this.g.peopleIds) if (seat !== id && seat !== except) this.reply(seat, { id: 0, ok: true, notice, calm: true });
    }
    this.mirror();
  }

  /**
   * Someone resigns (in the game, or from the lobby's list). A Marshal plays their seat from now on; if everyone still
   * playing had locked in, the turn resolves now. Their own page is answered with where the game stands.
   */
  async resign(seat: PlayerId, id = 0): Promise<boolean> {
    const g = await this.ensureLoaded();
    if (!g.peopleIds.includes(seat) || g.over || g.isOut(seat) || g.leftSeats[seat]) return false;
    const resolved = this.timed(() => g.resign(seat));
    this.announceLeft(seat);
    if (!resolved) this.tellTalks(seat);
    // Session 28: a vote or a pause that waited on them moves on.
    const settled = resolved ? null : g.tickPause();
    if (settled) this.tellPause(settled);
    if (resolved) this.deliver(resolved, id ? new Map([[seat, id]]) : new Map());
    else {
      this.saveNow();
      this.afterChange();
      if (id) this.reply(seat, { id, ok: true, update: this.withFair(g.update(null, 0, seat)) });
    }
    await this.flush();
    return true;
  }

  /** The lobby's "Leave this game": the account resigns its seat (session 27). */
  async resignUser(user: string, legacySeat: PlayerId | null = null): Promise<boolean> {
    await this.loadTable();
    const seat = this.seatOf(user) ?? legacySeat;
    return seat ? this.resign(seat) : false;
  }

  /** This seat's page was sent this turn's report (one that wasn't connected replays it when it says hello). */
  private markSeen(seat: PlayerId, turn: number) {
    if (!this.meta) return;
    this.meta.seen[seat] = Math.max(this.meta.seen[seat] ?? 0, turn);
    const meta = this.meta;
    this.writing = this.writing.then(() => this.store.put("meta", meta)).catch(() => undefined);
  }

  /** A seat's page went away: its waiting lock-in (if any) is answered by the next hello instead. */
  disconnected(seat: PlayerId) {
    this.pending.delete(seat);
  }

  /** The room's game, as the room sees it (tests: the fog-on-the-wire test compares every message with it). */
  get table(): LocalGame | null {
    return this.game;
  }

  /** The secret seed (tests: the fog test checks it never leaves the room before the game ends). */
  get secretSeed(): string {
    return this.meta?.seed ?? "";
  }
}

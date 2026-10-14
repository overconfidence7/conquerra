import type { MapDef } from "@conquerra/content";
import { readSave, type Order, type PlayerId, type SaveFile } from "@conquerra/engine";
import { LocalGame, type PersonSeat } from "./localGame";
import type { HostUpdate, LobbySettings, RoomMessage, RoomRequest, RoomStart } from "./protocol";

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
  /** Wake the room at this time (its alarm), or never. */
  wakeAt(at: number | null): void;
  /** The game list's line for this game changed. */
  listed(info: RoomInfo): void;
  /** A line for the logs (`wrangler tail`). */
  log(line: string): void;
}

/** A new online game, as the API makes it. */
export interface RoomSetup {
  gameId: string;
  settings: LobbySettings;
  people: PersonSeat[];
  /** The secret seed (the room makes it; only its hash is shown until the game ends). */
  seed: string;
}

interface Meta {
  gameId: string;
  seed: string;
  seedHash: string;
  /** The last turn each seat was sent the report of (so someone coming back replays only what they missed). */
  seen: Record<PlayerId, number>;
}

/** The orders a page may send: at most this many, each an object with an id and a kind. */
const MAX_ORDERS = 400;
/** How long a seat's queue must be still before the room saves it (ms). */
const QUEUE_SAVE_MS = 1500;

/** SHA-256 of a string, as hex (WebCrypto: the same in the browser, Node and Workers). */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A fresh secret seed for the game's dice (the room makes it; the engine never makes randomness). */
export function newSeed(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

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

  constructor(
    private readonly store: RoomStore,
    private readonly loadMap: (id: string) => Promise<MapDef>,
    private readonly io: RoomIO,
    private readonly now: () => number = () => Date.now(),
    /** A clock for timing the work (Workers only move it on I/O; `wrangler tail` has the real CPU time). */
    private readonly timer: () => number = () => performance.now(),
  ) {}

  /** Make the game: the people in their seats, bots in the rest, the seed committed to. */
  async create(setup: RoomSetup): Promise<RoomInfo> {
    if (await this.store.get("meta")) throw new Error("This game already exists");
    const map = await this.loadMap(setup.settings.mapId);
    this.meta = { gameId: setup.gameId, seed: setup.seed, seedHash: await sha256Hex(setup.seed), seen: {} };
    await this.store.put("meta", this.meta);
    const t0 = this.timer();
    this.game = new LocalGame(map, setup.settings, setup.seed, this.now, { table: { gameId: setup.gameId, people: setup.people }, autosave: this.autosave });
    this.io.log(`game ${setup.gameId}: made on ${map.id} with ${setup.people.length} people, opening plans in ${(this.timer() - t0).toFixed(1)} ms`);
    await this.flush();
    this.afterChange();
    return this.info();
  }

  /** The room woke up (after sleeping between turns): load the game from storage. */
  async ensureLoaded(): Promise<LocalGame> {
    if (this.game) return this.game;
    const meta = (await this.store.get("meta")) as Meta | null;
    const raw = await this.store.get("game");
    if (!meta || !raw) throw new Error("This game doesn't exist");
    const read = readSave(raw);
    if (!read.ok) throw new Error(read.why);
    const map = await this.loadMap(read.save.mapId);
    this.meta = meta;
    this.game = LocalGame.restore(map, read.save, this.now, this.autosave);
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

  /** Wait for the save being written (tests; the Durable Object also waits before answering). */
  flush(): Promise<void> {
    return this.writing;
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
    this.io.wakeAt(this.game?.over ? null : (this.game?.nextDeadline ?? null));
    if (this.game) this.io.listed(this.info());
  }

  /** The seed's hash, and the seed itself once the game is over. */
  private fair() {
    return { seedHash: this.meta!.seedHash, ...(this.game?.over ? { seed: this.meta!.seed } : {}) };
  }

  private reply(seat: PlayerId, msg: Omit<Extract<RoomMessage, { ok: false }>, "now"> | Record<string, unknown>): boolean {
    return this.io.send(seat, { ...(msg as object), now: this.now() } as RoomMessage);
  }

  /** "Where are we": this seat's game as it stands (planning with their queue, or the replay they missed). */
  hello(seat: PlayerId): RoomStart {
    const g = this.g;
    const { map, queued: _restored, ...start } = g.start(seat);
    const last = g.lastReplay(seat);
    const opens = g.windowOpensAt;
    const unseen = !!last && (this.meta!.seen[seat] ?? 0) < last.report.turn;
    const queued = g.queuedFor(seat);
    return {
      ...start,
      gameId: this.meta!.gameId,
      mapId: map.id,
      mapVersion: map.generator?.version ?? null,
      fair: this.fair(),
      people: g.peopleIds,
      ...(queued ? { queued } : {}),
      ...(g.lockedIn(seat) && !g.over ? { lockedIn: true } : {}),
      ...(last ? { replay: { before: last.before, report: last.report, play: unseen || (opens !== null && this.now() < opens) } } : {}),
    };
  }

  /** A message from a seat's page. */
  async message(seat: PlayerId, req: RoomRequest): Promise<void> {
    if (!req || typeof req !== "object" || typeof req.id !== "number") return;
    try {
      const g = await this.ensureLoaded();
      if (!g.peopleIds.includes(seat)) throw new Error("You don't have a seat in this game");
      switch (req.type) {
        case "hello": {
          const start = this.hello(seat);
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
        case "propose":
          this.reply(seat, { id: req.id, ok: true, answer: g.propose(req.offer, seat) });
          return;
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
    const resolved = this.timed(() => g.expireTable());
    if (resolved) this.deliver(resolved, new Map());
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
    for (const [seat, update] of updates) {
      const u = this.withFair(update);
      const id = answering.get(seat);
      const sent = id !== undefined ? this.reply(seat, { id, ok: true, update: u }) : this.reply(seat, { id: 0, ok: true, pushed: u });
      if (sent && u.report) this.markSeen(seat, u.report.turn);
    }
    if (this.game?.over) this.io.log(`game ${this.meta!.gameId}: over on turn ${this.game.turn}, seed revealed`);
    this.afterChange();
  }

  private withFair(u: HostUpdate): HostUpdate {
    return { ...u, fair: this.fair(), people: this.g.peopleIds };
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

import { captainBot, fallenBot, generalsOf, planGeneral, recruitBot, type Bot } from "@conquerra/bots";
import { defaultRules, type MapDef } from "@conquerra/content";
import {
  createGame,
  makeSave,
  replayFor,
  resolveTurn,
  viewFor,
  type GameContext,
  type GameState,
  type Instruction,
  type NewGameOptions,
  type PlayerId,
  type Order,
  type OrdersByPlayer,
  type ReplayEvent,
  type SaveFile,
} from "@conquerra/engine";
import { buildTimeline } from "../replay/timeline";
import { BOT_NAMES } from "./names";
import type { BotLevel, HostStart, HostUpdate, LobbySettings } from "./protocol";
import type { TurnClock } from "../logic/timer";

export { BOT_NAMES };

export const HUMAN_ID = "you";

/** The bot for each lobby level. */
export const BOTS: Record<BotLevel, Bot> = { recruit: recruitBot, captain: captainBot };

/**
 * A whole single-player game: the full state, the bots and turn resolution.
 * Lives inside the Web Worker, so the UI never holds the full state (it only gets `viewFor` + `replayFor`),
 * exactly as it will when a server runs the game.
 */
/** After the replay, a moment to read the turn report before the countdown starts. */
export const REPORT_GRACE_MS = 3000;

/** What this host keeps in a save besides the game itself (`SaveFile.host`). */
export interface LocalHostData {
  botLevel: BotLevel;
  /** The turn timer in seconds, or null for No timer. */
  turnSeconds: number | null;
  /** What each seat watched in the last replay (its own view), for the bots' and your generals' next plans. */
  lastTurn: Record<PlayerId, ReplayEvent[]>;
  /**
   * The orders you'd queued but not locked in (Nate, Oct 6: Continue keeps them), with the generals whose army you
   * took back. Only used if the save is still on that turn.
   */
  queued?: { turn: number; orders: Order[]; paused: PlayerId[] };
}

export interface LocalGameOptions {
  /** Carry on from a save instead of starting a new game (`settings` and `seed` are then ignored). */
  restore?: SaveFile;
  /** Called with a fresh save at the start of every turn's planning (the worker writes it to the device). */
  autosave?: (save: SaveFile) => void;
}

export class LocalGame {
  readonly ctx: GameContext;
  private state: GameState;
  private turnMs: number | null;
  /** When the current turn's orders lock in automatically (null: no timer, nothing to lock, or paused). */
  private deadline: number | null = null;
  /** Paused: the time that was left on the clock (null: not paused). */
  private pausedLeft: number | null = null;
  /** Your orders as you build them (the page keeps sending them), locked in when time runs out. */
  private saved: Order[] = [];
  /** Generals whose army you took back this turn (the page sends them with your orders; kept for Continue). */
  private savedPaused: PlayerId[] = [];
  /** Your queue as a save brought it back (Continue), sent to the page once with the first update. */
  private restored: { orders: Order[]; paused: PlayerId[] } | null = null;
  private bot: Bot;
  private readonly botLevel: BotLevel;
  /** How the game was set up, the rules and every turn's orders, so `pnpm sim --replay` can play a save back. */
  private history: { setup: NewGameOptions; rules: typeof defaultRules; turns: OrdersByPlayer[] } | null;
  private readonly autosave?: (save: SaveFile) => void;
  /** What each seat watched in the last replay (from its own seat): the bots', and yours for your generals. */
  private lastTurn = new Map<string, ReplayEvent[]>();

  constructor(
    /** The map to play on (the worker loads it with `loadMap`; tests pass it straight from `maps`). */
    map: MapDef,
    settings: LobbySettings,
    seed: string,
    /** The host's clock (ms). Injected so tests can move time; the engine itself never reads a clock. */
    private now: () => number = () => Date.now(),
    opts: LocalGameOptions = {},
  ) {
    this.ctx = { map, rules: defaultRules };
    this.autosave = opts.autosave;
    const restore = opts.restore;
    if (restore) {
      // Carry on from a save: the game as it stood, under today's rules.
      if (restore.mapId !== map.id || restore.mapVersion !== (map.generator?.version ?? null))
        throw new Error("This save's map has changed since it was saved, so it can't be loaded.");
      const host = (restore.host ?? {}) as Partial<LocalHostData>;
      this.botLevel = host.botLevel && host.botLevel in BOTS ? host.botLevel : "captain";
      this.state = restore.state;
      const seconds = host.turnSeconds === undefined ? null : host.turnSeconds;
      this.turnMs = seconds === null ? null : seconds * 1000;
      this.lastTurn = new Map(Object.entries(host.lastTurn ?? {}));
      // The history only replays exactly under the rules it was played with; a game carried on under new ones drops it.
      const h = restore.history;
      this.history = h && JSON.stringify(h.rules) === JSON.stringify(defaultRules) ? h : null;
    } else {
      this.botLevel = settings.botLevel in BOTS ? settings.botLevel : "captain";
      const bots = Math.max(1, Math.min(map.maxPlayers - 1, BOT_NAMES.length, Math.floor(settings.bots)));
      const players = [
        { id: HUMAN_ID, name: "You" },
        ...BOT_NAMES.slice(0, bots).map((name, i) => ({ id: `bot${i + 1}`, name })),
      ];
      const setup: NewGameOptions = {
        gameId: `local-${seed.slice(0, 8)}`,
        seed,
        players,
        settings: {
          mode: settings.mode,
          luck: settings.luck,
          fog: settings.fog,
          // The engine just stores the timer; "No timer" is stored as the longest allowed.
          turnTimerSeconds: settings.turnSeconds ?? defaultRules.game.turnTimerSecondsMax,
          fate: settings.fate ?? true,
        },
      };
      this.state = createGame(this.ctx, setup);
      this.history = { setup, rules: defaultRules, turns: [] };
      this.turnMs = settings.turnSeconds === null || settings.turnSeconds === undefined ? null : settings.turnSeconds * 1000;
    }
    this.bot = BOTS[this.botLevel];
    // A game just loaded doesn't save itself again until its next turn starts.
    this.startClock(0, !restore);
    // Continue puts back the orders you'd queued on this turn.
    const queued = (restore?.host as Partial<LocalHostData> | undefined)?.queued;
    if (queued && queued.turn === this.state.turn && Array.isArray(queued.orders) && !this.state.winner && !this.knockedOut) {
      this.saved = queued.orders;
      this.savedPaused = Array.isArray(queued.paused) ? queued.paused : [];
      this.restored = { orders: queued.orders, paused: this.savedPaused };
    }
  }

  /** Carry on from a save (already read and brought up to date with `readSave`). */
  static restore(map: MapDef, save: SaveFile, now: () => number = () => Date.now(), autosave?: (save: SaveFile) => void): LocalGame {
    // (The lobby settings and seed aren't used: everything comes from the save.)
    const unused: LobbySettings = { mapId: map.id, bots: 1, botLevel: "captain", luck: 0, fog: true, mode: "classic", turnSeconds: null };
    return new LocalGame(map, unused, "", now, { restore: save, ...(autosave ? { autosave } : {}) });
  }

  /**
   * A new turn's planning starts: start the countdown (after `replayMs` of replay plus a moment for the report), and
   * save the game on the device (Continue in the lobby picks it up).
   */
  private startClock(replayMs: number, autosave = true) {
    // Your generals' orders go in even if you never touch the turn.
    this.saved = this.generalOrders();
    this.savedPaused = [];
    this.pausedLeft = null;
    this.deadline = this.turnMs !== null && !this.state.winner && !this.knockedOut ? this.now() + replayMs + (replayMs ? REPORT_GRACE_MS : 0) + this.turnMs : null;
    if (autosave && !this.state.winner) this.autosave?.(this.snapshot());
  }

  /** The current turn's clock, for the page's countdown (with the time left while paused). */
  get clock(): TurnClock | null {
    if (this.turnMs === null) return null;
    if (this.pausedLeft !== null) return { endsAt: this.now() + this.pausedLeft, turnMs: this.turnMs, pausedLeft: this.pausedLeft };
    return this.deadline === null ? null : { endsAt: this.deadline, turnMs: this.turnMs };
  }

  /**
   * Pause the turn timer (single player). Planning goes on; nothing locks in until you resume. A host action, so
   * M4's pause by vote can wrap it. With no timer running there's nothing to pause.
   */
  pause(): HostUpdate {
    if (this.deadline !== null) {
      this.pausedLeft = Math.max(0, this.deadline - this.now());
      this.deadline = null;
    }
    return this.update();
  }

  resume(): HostUpdate {
    if (this.pausedLeft !== null) {
      this.deadline = this.now() + this.pausedLeft;
      this.pausedLeft = null;
    }
    return this.update();
  }

  get isPaused(): boolean {
    return this.pausedLeft !== null;
  }

  get over(): boolean {
    return this.state.winner !== null;
  }

  /** The first message: the map and rules, plus your opening view. */
  start(): HostStart {
    const restored = this.restored;
    this.restored = null;
    return { ...this.update(), map: this.ctx.map, rules: this.ctx.rules, ...(restored ? { queued: restored } : {}) };
  }

  update(report: HostUpdate["report"] = null, fastForwarded = 0): HostUpdate {
    return { playerId: HUMAN_ID, view: viewFor(this.ctx, this.state, HUMAN_ID), report, fastForwarded, clock: this.clock, generalOrders: this.generalOrders() };
  }

  /**
   * Your generals' orders for this turn, written from your view as planning starts (and again when you change an
   * instruction: `instructions` overrides the standing ones). The same view and instructions always give the same
   * orders, so it doesn't matter whether they're worked out here, on the page, or (M4) on the server.
   */
  generalOrders(instructions: Record<PlayerId, Instruction | null> = {}): Order[] {
    if (this.state.winner || this.knockedOut) return [];
    const view = viewFor(this.ctx, this.state, HUMAN_ID);
    return generalsOf(view).flatMap((g) =>
      planGeneral(this.ctx, view, g.general, g.general in instructions ? instructions[g.general]! : g.instruction, this.lastTurn.get(HUMAN_ID)),
    );
  }

  private get knockedOut(): boolean {
    return this.state.players.find((p) => p.id === HUMAN_ID)!.eliminatedTurn !== null;
  }

  private botOrders(): OrdersByPlayer {
    const orders: OrdersByPlayer = {};
    for (const p of this.state.players) {
      if (p.id === HUMAN_ID) continue;
      if (p.eliminatedTurn === null) orders[p.id] = this.bot.plan(this.ctx, viewFor(this.ctx, this.state, p.id), this.lastTurn.get(p.id));
      // Knocked-out bots are the Fallen: they play world events against whoever leads.
      else if (this.state.settings.fallen) orders[p.id] = fallenBot.plan(this.ctx, viewFor(this.ctx, this.state, p.id));
    }
    return orders;
  }

  /** Resolve one turn and return your report of it. */
  private play(humanOrders: Order[] | null): HostUpdate["report"] {
    const before = this.state;
    const orders = humanOrders ? { ...this.botOrders(), [HUMAN_ID]: humanOrders } : this.botOrders();
    const result = resolveTurn(this.ctx, before, orders);
    this.history?.turns.push(orders);
    this.state = result.state;
    // What each bot watched in this turn's replay (only its own view), for its next plan.
    this.lastTurn = new Map(this.state.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, replayFor(this.ctx, before, result, p.id)]));
    const report = { turn: before.turn, events: this.lastTurn.get(HUMAN_ID) ?? replayFor(this.ctx, before, result, HUMAN_ID) };
    this.startClock(buildTimeline(report.events).total);
    return report;
  }

  /** Lock in your orders for `turn`. If that turn has already been locked in (the timer beat you to it), nothing changes. */
  lockIn(humanOrders: Order[], turn: number = this.state.turn): HostUpdate {
    if (this.state.winner) throw new Error("The game is over");
    if (this.knockedOut) throw new Error("You've been knocked out");
    if (turn !== this.state.turn) return this.update();
    return this.update(this.play(humanOrders));
  }

  /**
   * The page's latest orders for this turn; these lock in if time runs out, and Continue puts them back. Returns
   * whether they were for this turn (so the host knows to save them).
   */
  saveOrders(orders: Order[], turn: number, paused: PlayerId[] = []): boolean {
    if (turn !== this.state.turn || this.state.winner || this.knockedOut) return false;
    this.saved = orders;
    this.savedPaused = paused;
    return true;
  }

  /** When the timer should next be checked (ms, host clock), or null if there's no countdown. */
  get nextDeadline(): number | null {
    return this.deadline;
  }

  /**
   * Time's up? Then lock in your saved orders, exactly as if you had pressed Lock in, and return the result for
   * the page. Otherwise null.
   */
  expireIfDue(): HostUpdate | null {
    if (this.deadline === null || this.now() < this.deadline || this.state.winner || this.knockedOut) return null;
    return { ...this.update(this.play(this.saved)), autoLocked: true };
  }

  /**
   * Knocked out and watching: the bots play one turn. As one of the Fallen you see the political map, and `orders`
   * are your world events for the turn (Influence put toward them).
   */
  watchNext(orders: Order[] = []): HostUpdate {
    if (this.state.winner) throw new Error("The game is over");
    if (!this.knockedOut) throw new Error("You're still in the game");
    return this.update(this.play(orders.filter((o) => o.kind === "worldEvent")));
  }

  /**
   * The game as it stands, as a save: the snapshot (it loads under future rules), what this host keeps between turns,
   * and the history so `pnpm sim --replay` can play it back. Single player only (it holds the secret seed and
   * everyone's orders).
   */
  snapshot(notes?: Record<string, string>): SaveFile {
    const host: LocalHostData = {
      botLevel: this.botLevel,
      turnSeconds: this.turnMs === null ? null : this.turnMs / 1000,
      lastTurn: Object.fromEntries(this.lastTurn),
      queued: { turn: this.state.turn, orders: this.saved, paused: this.savedPaused },
    };
    return makeSave(this.ctx, this.state, HUMAN_ID, this.now(), {
      host: host as unknown as Record<string, unknown>,
      ...(this.history ? { history: this.history } : {}),
      notes: { bots: this.bot.id, ...notes },
    });
  }

  /** A bot's orders for you this turn (the game's level), planned from your own view only. */
  suggest(): Order[] {
    if (this.state.winner || this.knockedOut) return [];
    return this.bot.plan(this.ctx, viewFor(this.ctx, this.state, HUMAN_ID));
  }

  /** Knocked out: the bots play on to the end (the engine's turn cap guarantees one). */
  finish(): HostUpdate {
    if (!this.knockedOut && !this.state.winner) throw new Error("You're still in the game");
    let report: HostUpdate["report"] = null;
    let turns = 0;
    while (!this.state.winner) {
      report = this.play(null);
      turns++;
    }
    return this.update(report, turns);
  }
}

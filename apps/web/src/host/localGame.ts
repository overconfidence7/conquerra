import { captainBot, fallenBot, generalsOf, planGeneral, recruitBot, type Bot } from "@conquerra/bots";
import { defaultRules, type MapDef } from "@conquerra/content";
import {
  createGame,
  replayFor,
  resolveTurn,
  saveGame,
  viewFor,
  type GameContext,
  type GameState,
  type Instruction,
  type NewGameOptions,
  type PlayerId,
  type Order,
  type OrdersByPlayer,
  type ReplayEvent,
  type SavedGame,
} from "@conquerra/engine";
import { buildTimeline } from "../replay/timeline";
import { BOT_NAMES } from "./names";
import type { BotLevel, HostStart, HostUpdate, LobbySettings } from "./protocol";

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

export class LocalGame {
  readonly ctx: GameContext;
  private state: GameState;
  private turnMs: number | null;
  /** When the current turn's orders lock in automatically (null: no timer, or nothing to lock). */
  private deadline: number | null = null;
  /** Your orders as you build them (the page keeps sending them), locked in when time runs out. */
  private saved: Order[] = [];
  private bot: Bot;
  /** How the game was set up and every turn's orders, for "Save this game". */
  private readonly setup: NewGameOptions;
  private readonly history: OrdersByPlayer[] = [];
  /** What each seat watched in the last replay (from its own seat): the bots', and yours for your generals. */
  private lastTurn = new Map<string, ReplayEvent[]>();

  constructor(
    /** The map to play on (the worker loads it with `loadMap`; tests pass it straight from `maps`). */
    map: MapDef,
    settings: LobbySettings,
    seed: string,
    /** The host's clock (ms). Injected so tests can move time; the engine itself never reads a clock. */
    private now: () => number = () => Date.now(),
  ) {
    this.ctx = { map, rules: defaultRules };
    this.bot = BOTS[settings.botLevel] ?? captainBot;
    const bots = Math.max(1, Math.min(map.maxPlayers - 1, BOT_NAMES.length, Math.floor(settings.bots)));
    const players = [
      { id: HUMAN_ID, name: "You" },
      ...BOT_NAMES.slice(0, bots).map((name, i) => ({ id: `bot${i + 1}`, name })),
    ];
    this.setup = {
      gameId: `local-${seed.slice(0, 8)}`,
      seed,
      players,
      settings: {
        mode: settings.mode,
        luck: settings.luck,
        fog: settings.fog,
        // The engine just stores the timer; "No timer" is stored as the longest allowed.
        turnTimerSeconds: settings.turnSeconds ?? defaultRules.game.turnTimerSecondsMax,
      },
    };
    this.state = createGame(this.ctx, this.setup);
    this.turnMs = settings.turnSeconds === null || settings.turnSeconds === undefined ? null : settings.turnSeconds * 1000;
    this.startClock(0);
  }

  /** Start the countdown for the turn now being planned, after `replayMs` of replay plus a moment for the report. */
  private startClock(replayMs: number) {
    // Your generals' orders go in even if you never touch the turn.
    this.saved = this.generalOrders();
    this.deadline = this.turnMs !== null && !this.state.winner && !this.knockedOut ? this.now() + replayMs + (replayMs ? REPORT_GRACE_MS : 0) + this.turnMs : null;
  }

  /** The current turn's clock, for the page's countdown. */
  get clock() {
    return this.deadline === null || this.turnMs === null ? null : { endsAt: this.deadline, turnMs: this.turnMs };
  }

  /** The first message: the map and rules, plus your opening view. */
  start(): HostStart {
    return { ...this.update(), map: this.ctx.map, rules: this.ctx.rules };
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
    this.history.push(orders);
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

  /** The page's latest orders for this turn; these lock in if time runs out. */
  saveOrders(orders: Order[], turn: number) {
    if (turn === this.state.turn) this.saved = orders;
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
   * "Save this game": the setup, the seed and every turn's orders, so `pnpm sim --replay` can play it again exactly.
   * Single player only (it holds the secret seed and everyone's orders).
   */
  save(notes?: Record<string, string>): SavedGame {
    return saveGame(this.ctx, this.setup, this.history, this.state, { bots: this.bot.id, ...notes });
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

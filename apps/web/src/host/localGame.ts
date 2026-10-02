import { recruitBot } from "@conquerra/bots";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import {
  createGame,
  replayFor,
  resolveTurn,
  viewFor,
  type GameContext,
  type GameState,
  type Order,
  type OrdersByPlayer,
} from "@conquerra/engine";
import { BOT_NAMES } from "./names";
import type { HostStart, HostUpdate, LobbySettings } from "./protocol";

export { BOT_NAMES };

export const HUMAN_ID = "you";

/**
 * A whole single-player game: the full state, the bots and turn resolution.
 * Lives inside the Web Worker, so the UI never holds the full state (it only gets `viewFor` + `replayFor`),
 * exactly as it will when a server runs the game.
 */
export class LocalGame {
  readonly ctx: GameContext;
  private state: GameState;

  constructor(settings: LobbySettings, seed: string) {
    const map = maps[settings.mapId];
    if (!map) throw new Error(`Unknown map ${settings.mapId}`);
    this.ctx = { map, rules: defaultRules };
    const bots = Math.max(1, Math.min(map.maxPlayers - 1, BOT_NAMES.length, Math.floor(settings.bots)));
    const players = [
      { id: HUMAN_ID, name: "You" },
      ...BOT_NAMES.slice(0, bots).map((name, i) => ({ id: `bot${i + 1}`, name })),
    ];
    this.state = createGame(this.ctx, {
      gameId: `local-${seed.slice(0, 8)}`,
      seed,
      players,
      settings: { mode: settings.mode, luck: settings.luck, fog: settings.fog },
    });
  }

  /** The first message: the map and rules, plus your opening view. */
  start(): HostStart {
    return { ...this.update(), map: this.ctx.map, rules: this.ctx.rules };
  }

  update(report: HostUpdate["report"] = null, fastForwarded = 0): HostUpdate {
    return { playerId: HUMAN_ID, view: viewFor(this.ctx, this.state, HUMAN_ID), report, fastForwarded };
  }

  private get knockedOut(): boolean {
    return this.state.players.find((p) => p.id === HUMAN_ID)!.eliminatedTurn !== null;
  }

  private botOrders(): OrdersByPlayer {
    const orders: OrdersByPlayer = {};
    for (const p of this.state.players)
      if (p.id !== HUMAN_ID && p.eliminatedTurn === null) orders[p.id] = recruitBot.plan(this.ctx, viewFor(this.ctx, this.state, p.id));
    return orders;
  }

  /** Resolve one turn and return your report of it. */
  private play(humanOrders: Order[] | null): HostUpdate["report"] {
    const before = this.state;
    const orders = humanOrders ? { ...this.botOrders(), [HUMAN_ID]: humanOrders } : this.botOrders();
    const result = resolveTurn(this.ctx, before, orders);
    this.state = result.state;
    return { turn: before.turn, events: replayFor(this.ctx, before, result, HUMAN_ID) };
  }

  lockIn(humanOrders: Order[]): HostUpdate {
    if (this.state.winner) throw new Error("The game is over");
    if (this.knockedOut) throw new Error("You've been knocked out");
    return this.update(this.play(humanOrders));
  }

  /** Knocked out and watching: the bots play one turn. You see the whole board (the engine's spectator view). */
  watchNext(): HostUpdate {
    if (this.state.winner) throw new Error("The game is over");
    if (!this.knockedOut) throw new Error("You're still in the game");
    return this.update(this.play(null));
  }

  /** The Recruit bot's orders for you this turn, planned from your own view only. */
  suggest(): Order[] {
    if (this.state.winner || this.knockedOut) return [];
    return recruitBot.plan(this.ctx, viewFor(this.ctx, this.state, HUMAN_ID));
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

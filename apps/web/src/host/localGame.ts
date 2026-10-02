import { recruitBot } from "@conquerra/bots";
import { defaultRules, maps } from "@conquerra/content";
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
import type { HostUpdate, LobbySettings } from "./protocol";

export const HUMAN_ID = "you";
export const BOT_NAMES = ["Lady Morwen", "Baron Krell", "Queen Isolde", "Warlord Rusk", "Duke Varric"];

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
    const bots = Math.max(1, Math.min(map.maxPlayers - 1, Math.floor(settings.bots)));
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

  update(report: HostUpdate["report"] = null, fastForwarded = 0): HostUpdate {
    return { playerId: HUMAN_ID, view: viewFor(this.ctx, this.state, HUMAN_ID), report, fastForwarded };
  }

  private botOrders(): OrdersByPlayer {
    const orders: OrdersByPlayer = {};
    for (const p of this.state.players)
      if (p.id !== HUMAN_ID && p.eliminatedTurn === null) orders[p.id] = recruitBot.plan(this.ctx, viewFor(this.ctx, this.state, p.id));
    return orders;
  }

  lockIn(humanOrders: Order[]): HostUpdate {
    if (this.state.winner) throw new Error("The game is over");
    const before = this.state;
    const result = resolveTurn(this.ctx, before, { ...this.botOrders(), [HUMAN_ID]: humanOrders });
    this.state = result.state;
    const report = { turn: before.turn, events: replayFor(this.ctx, before, result, HUMAN_ID) };

    // Knocked out? The bots play on by themselves to find the winner (the engine's turn cap guarantees an end).
    let fastForwarded = 0;
    while (!this.state.winner && this.state.players.find((p) => p.id === HUMAN_ID)!.eliminatedTurn !== null) {
      this.state = resolveTurn(this.ctx, this.state, this.botOrders()).state;
      fastForwarded++;
    }
    return this.update(report, fastForwarded);
  }
}

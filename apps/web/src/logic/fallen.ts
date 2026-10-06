import type { GameContext, PlayerView } from "@conquerra/engine";

/** Influence each of the Fallen earns a turn, with this many Fallen. */
export const influencePerTurn = (ctx: GameContext, view: PlayerView) =>
  ctx.rules.fallen.influenceBase + ctx.rules.fallen.influencePerOtherFallen * Math.max(0, view.players.filter((p) => p.eliminatedTurn !== null).length - 1);

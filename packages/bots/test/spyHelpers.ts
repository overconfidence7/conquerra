import { CAPTAIN_CHAIN_MARGIN } from "../src";
import { readBoard } from "../src/board";
import type { GameContext, PlayerView } from "@conquerra/engine";
export { captainBot, recruitBot } from "../src";
export const readBoardFor = (ctx: GameContext, view: PlayerView) => readBoard(ctx, view, { chainMargin: CAPTAIN_CHAIN_MARGIN });

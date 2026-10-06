/**
 * Generals in the simulator (session 12): one seat plays as the Captain but hands its Leader's army a standing
 * instruction; the others are plain Captains. Seats rotate each game. For each instruction it prints the general
 * seat's win share (fair = 1 / players) and what the general did: its attacks and how many took their target, how
 * often its Leader fell, how many of its orders didn't happen, and game length.
 *
 *   pnpm --filter @conquerra/sim exec tsx scripts/generals.ts --games 200 --players 4,6 [--kinds push,raid] [--map embervale]
 */
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import type { GameContext, InstructionKind } from "@conquerra/engine";
import { captainBot, makeGeneralSeat, type Bot } from "@conquerra/bots";
import { runGame } from "@conquerra/simcore";

const args = process.argv.slice(2);
const arg = (name: string, dflt: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : dflt;
};
const games = Number(arg("games", "200"));
const playerCounts = arg("players", "4,6").split(",").map(Number);
const kinds = arg("kinds", "none,hold,defend,push,raid").split(",") as (InstructionKind | "none")[];

for (const players of playerCounts) {
  const map = maps[arg("map", players > 6 ? "greatmarch" : "embervale")]!;
  const ctx: GameContext = { map, rules: defaultRules };
  console.log(`\n=== ${players} players on ${map.name}, ${games} games each, one general seat against Captains (fair share ${(100 / players).toFixed(1)}%) ===`);
  console.log("instruction | win share | turns | general attacks/game (took %) | its Leader fell /game (Captain seat) | general orders that didn't happen");
  for (const kind of kinds) {
    const seat: Bot = kind === "none" ? { ...captainBot, id: "general-none" } : makeGeneralSeat(kind);
    let wins = 0, turns = 0, attacks = 0, took = 0, fell = 0, fellCaptain = 0, gOrders = 0, gFizzled = 0;
    for (let i = 0; i < games; i++) {
      const at = i % players;
      const bots = Array.from({ length: players }, (_, k) => (k === at ? seat : captainBot));
      const g = runGame(ctx, `gen-${players}-${i}`, players, {}, true, bots);
      const pid = `p${at + 1}`, other = `p${((at + 1) % players) + 1}`;
      if (g.winnerSeat === at) wins++;
      turns += g.turns;
      for (const turn of g.log ?? [])
        for (const e of turn) {
          if (e.type === "battle" && e.player === pid && e.general) {
            attacks++;
            if (e.captured) took++;
          }
          if ((e.type === "battle" || e.type === "moved") && e.player === pid && e.general) gOrders++;
          if (e.type === "fizzled" && e.player === pid && e.orderId.includes(`-g${pid}-`)) (gFizzled++, gOrders++);
          if (e.type === "leaderKilled" && e.player === pid) fell++;
          if (e.type === "leaderKilled" && e.player === other) fellCaptain++;
        }
    }
    const pc = (k: number, n: number) => `${((100 * k) / Math.max(1, n)).toFixed(1)}%`;
    console.log(
      `${kind.padEnd(11)} | ${pc(wins, games).padStart(9)} | ${(turns / games).toFixed(1).padStart(5)} | ${(attacks / games).toFixed(1)} (${pc(took, attacks)})`.padEnd(62) +
        ` | ${(fell / games).toFixed(2)} (${(fellCaptain / games).toFixed(2)}) | ${pc(gFizzled, gOrders)}`,
    );
  }
}

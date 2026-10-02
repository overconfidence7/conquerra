import { defaultRules, Rules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { runGame } from "./runGame";

/**
 * Balance helper: try rule changes without editing rules.json, then copy the winners into rules.json.
 *   pnpm tsx apps/sim/src/tune.ts '{"troops":{"cost":2}}' 200 2,4,6
 * The patch is deep-merged into the default rules and validated with the same schema.
 */
const [patchJson = "{}", gamesArg = "200", playersArg = "2,4,6"] = process.argv.slice(2);
const merge = (a: unknown, b: unknown): unknown => {
  if (Array.isArray(b) || typeof b !== "object" || b === null) return b;
  const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
  for (const [k, v] of Object.entries(b)) out[k] = merge(out[k], v);
  return out;
};
const rules = Rules.parse(merge(JSON.parse(JSON.stringify(defaultRules)), JSON.parse(patchJson)));
const games = Number(gamesArg);
const line: string[] = [];
for (const players of playersArg.split(",").map(Number)) {
  const ctx = { map: maps[players > 6 ? "greatmarch" : "embervale"]!, rules };
  const res = Array.from({ length: games }, (_, i) => runGame(ctx, `tune-${players}-${i}`, players, {}));
  const turns = res.map((g) => g.turns).sort((a, b) => a - b);
  const avg = turns.reduce((a, b) => a + b, 0) / turns.length;
  const band = res.filter((g) => g.turns >= 15 && g.turns <= 25).length / res.length;
  const cap = res.filter((g) => g.endReason !== "lastStanding").length / res.length;
  const wins = Array.from({ length: players }, (_, i) => res.filter((g) => g.winnerSeat === i).length / res.length);
  const decided = res.filter((g) => g.decidedTurn).reduce((a, g) => a + g.decidedTurn! / g.turns, 0) / res.length;
  line.push(
    `${players}p avg ${avg.toFixed(1)} med ${turns[turns.length >> 1]} p10 ${turns[Math.floor(turns.length * 0.1)]} p90 ${turns[Math.floor(turns.length * 0.9)]}` +
      ` | in 15-25: ${(band * 100).toFixed(0)}% | cap ${(cap * 100).toFixed(0)}% | seats ${wins.map((w) => (w * 100).toFixed(0)).join("/")} | locked ${(decided * 100).toFixed(0)}% | leadchg ${(res.reduce((a, g) => a + g.leadChanges, 0) / res.length).toFixed(1)}`,
  );
}
console.log(patchJson);
for (const l of line) console.log("  " + l);

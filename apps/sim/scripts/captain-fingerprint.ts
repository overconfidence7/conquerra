/**
 * A fingerprint of the Captain's play: every order it gives in a fixed set of games, hashed. Refactoring the Captain
 * (for example to share its brain with generals) must not change it:
 *   pnpm --filter @conquerra/sim exec tsx scripts/captain-fingerprint.ts
 */
import { createHash } from "node:crypto";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, replayFor, resolveTurn, viewFor, type GameContext, type OrdersByPlayer, type ReplayEvent } from "@conquerra/engine";
import { captainBot } from "@conquerra/bots";

const h = createHash("sha256");
let orders = 0;
for (const [mapId, players, games] of [["embervale", 4, 12], ["greatmarch", 8, 4], ["ringsea", 6, 3]] as const) {
  const ctx: GameContext = { map: maps[mapId]!, rules: defaultRules };
  for (let g = 0; g < games; g++) {
    let s = createGame(ctx, { gameId: `fp-${g}`, seed: `fp-${mapId}-${g}`, players: Array.from({ length: players }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` })) });
    let last = new Map<string, ReplayEvent[]>();
    while (!s.winner && s.turn <= 40) {
      const o: OrdersByPlayer = {};
      for (const p of s.players) if (p.eliminatedTurn === null) o[p.id] = captainBot.plan(ctx, viewFor(ctx, s, p.id), last.get(p.id));
      const before = s;
      const r = resolveTurn(ctx, s, o);
      s = r.state;
      last = new Map(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, replayFor(ctx, before, r, p.id)]));
      for (const k of Object.keys(o).sort()) (h.update(JSON.stringify(o[k])), (orders += o[k]!.length));
    }
  }
}
console.log(`Captain fingerprint ${h.digest("hex").slice(0, 16)} (${orders} orders)`);

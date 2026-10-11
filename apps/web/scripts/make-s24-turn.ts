// The sound bench's recorded turn (session 24): bots on Embervale with the fog on, from P1's side, the busiest of the
// first 24 turns (battles, captures and things in the fog). Saved as the replay's events and what the sound plan
// needs to know, so the bench plays a real replay's sounds without loading the engine.
//   pnpm --filter web exec tsx scripts/make-s24-turn.ts
import { writeFileSync } from "node:fs";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, resolveTurn, replayFor, viewFor, type GameContext, type GameState, type ReplayEvent } from "@conquerra/engine";
import { recruitBot } from "@conquerra/bots";

const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
let s = createGame(ctx, { gameId: "sound-bench", seed: "sound-bench-1", players: [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` })), settings: { fog: true } as never });
let best: { state: GameState; events: ReplayEvent[]; n: number } | null = null;
for (let turn = 0; turn < 24 && !s.winner; turn++) {
  const orders = Object.fromEntries(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, recruitBot.plan(ctx, viewFor(ctx, s, p.id))]));
  const r = resolveTurn(ctx, s, orders);
  const events = replayFor(ctx, s, r, "p1");
  const fogged = events.filter((e) => e.type === "surface").length;
  const n = events.filter((e) => e.type === "battle").length * 2 + (fogged ? 12 + Math.min(fogged, 6) : 0) + (events.some((e) => e.type === "battle" && e.captured) ? 3 : 0);
  if (!best || n > best.n) best = { state: s, events, n };
  s = r.state;
}
const v = viewFor(ctx, best!.state, "p1");
const capitals = [v.me.capital, ...Object.entries(v.territories).flatMap(([id, t]) => (t.detail === "full" && t.capitalOf ? [id] : []))];
const forts = Object.entries(v.territories).flatMap(([id, t]) => (t.detail === "full" && t.building === "fort" ? [id] : []));
const out = { map: "embervale", gameId: v.gameId, turn: v.turn, me: "p1", capitals: [...new Set(capitals)], forts, events: best!.events };
writeFileSync(new URL("../src/lab/sound/recorded-turn.json", import.meta.url), `${JSON.stringify(out)}\n`);
console.log(`turn ${v.turn}: ${best!.events.length} events, ${best!.events.filter((e) => e.type === "battle").length} battles, ${best!.events.filter((e) => e.type === "surface").length} in the fog`);

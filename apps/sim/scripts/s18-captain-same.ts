// Session 18 check: does the Captain play exactly as in session 17 (with Govern switched off there, since session 18
// removes it)? Run this script in both checkouts and compare the outputs: the board, gold, deals and dice must match.
// Usage: pnpm tsx apps/sim/scripts/s18-captain-same.ts [old]
import { createHash } from "node:crypto";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, replayFor, resolveTurn, viewFor, type OrdersByPlayer, type PlayerView, type ReplayEvent } from "@conquerra/engine";
import * as bots from "@conquerra/bots";

const old = process.argv[2] === "old";
const ctx = { map: maps.embervale!, rules: defaultRules };
const bot = old ? bots.makeCaptainBot({ chainMargin: bots.CAPTAIN_CHAIN_MARGIN, off: ["govern" as never] }) : bots.captainBot;

function play(seed: string, diplomacy: boolean, turns: number, spies: boolean) {
  let s = createGame(ctx, { gameId: "fp", seed, players: ["p1", "p2", "p3", "p4"].map((id) => ({ id, name: id })), settings: { diplomacy, spies } });
  let last = new Map<string, ReplayEvent[]>();
  for (let i = 0; i < turns && !s.winner; i++) {
    const living = s.players.filter((p) => p.eliminatedTurn === null);
    const views = new Map<string, PlayerView>(living.map((p) => [p.id, viewFor(ctx, s, p.id)]));
    const talk = diplomacy ? bots.negotiate(ctx, living.map((p) => ({ id: p.id, level: "captain" as const })), (id) => views.get(id)!, (id) => last.get(id), null) : null;
    const agreed = talk ? bots.agreedIn(talk.orders) : [];
    const orders: OrdersByPlayer = {};
    for (const p of living) orders[p.id] = [...(talk?.orders[p.id] ?? []), ...bot.plan(ctx, bots.withAgreed(views.get(p.id)!, agreed), last.get(p.id))];
    const before = s;
    const r = resolveTurn(ctx, s, orders);
    s = r.state;
    last = new Map(s.players.map((p) => [p.id, replayFor(ctx, before, r, p.id)]));
  }
  // Everything but the leaders' own bookkeeping (session 18 changes its shape on purpose).
  const players = s.players.map((p) => {
    const { leaders: _l, command: _c, purse: _p, captured, ...rest } = p as unknown as Record<string, unknown> & { captured: { of: string }[] };
    return { ...rest, captured: captured.map((g) => g.of) };
  });
  const core = { ...s, players, version: 0, history: s.history, stats: s.stats };
  const h = createHash("sha256").update(JSON.stringify(core)).digest("hex").slice(0, 16);
  return `${seed}: turn ${s.turn} winner ${s.winner} captured ${JSON.stringify(players.map((p) => p.captured))} ${h}`;
}

console.log(play("captain-fingerprint", false, 25, false));
console.log(play("captain-s16", true, 30, true));
console.log(play("deals-1", true, 30, true));

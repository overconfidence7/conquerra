/**
 * Session 23, Part 1: what a Steward with nothing worth building hands back, on a real save.
 *   npx tsx apps/sim/scripts/s23-handout.ts [save=docs/art/screens/s20c-save.json] [turns=3]
 * Loads the save, plans your leaders from your own view (as the game does), plays `turns` turns with the bots (your
 * leaders' orders only, nothing of yours), and prints each turn: the Steward's purse, what it bought, what it handed
 * back and what it kept.
 */
import { readFileSync } from "node:fs";
import { defaultRules, marshalData, type PersonalityId } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { findLeader, readSave, replayFor, resolveTurn, viewFor, type GameContext, type OrdersByPlayer, type ReplayEvent } from "@conquerra/engine";
import { makeMarshalBot, planLeaders, think } from "@conquerra/bots";

const [file = "docs/art/screens/s20c-save.json", turnsArg = "3"] = process.argv.slice(2);
const raw = JSON.parse(readFileSync(file, "utf8")) as { mapId: string; you: string; host: { lastTurn?: Record<string, ReplayEvent[]>; leaderMemory?: unknown; seats?: Record<string, { personality?: PersonalityId }> } };
const read = readSave(raw);
if (!read.ok) throw new Error(read.why);
const ctx: GameContext = { map: maps[raw.mapId]!, rules: defaultRules };
let s = read.save.state;
const me = raw.you;
let last = new Map<string, ReplayEvent[]>(Object.entries(raw.host.lastTurn ?? {}));
const bots = new Map(Object.entries(raw.host.seats ?? {}).map(([id, x]) => [id, makeMarshalBot(x.personality ?? "conqueror")]));
let memory = undefined as Parameters<typeof planLeaders>[0]["memory"];
for (let i = 0; i < Number(turnsArg) && !s.winner; i++) {
  const view = viewFor(ctx, s, me);
  memory = think(ctx, view, marshalData.judgement, memory ?? (raw.host.leaderMemory as never), last.get(me)).memory;
  const plan = planLeaders({ ctx, view, memory, ...(last.get(me) ? { lastTurn: last.get(me)! } : {}) });
  const st = findLeader(s.players.find((p) => p.id === me)!, { kind: "steward", of: me })!;
  const bought = plan.orders.filter((o) => o.steward === me && (o.kind === "build" || o.kind === "invest"));
  const hb = plan.orders.find((o) => o.kind === "budget" && o.handBack);
  const orders: OrdersByPlayer = { [me]: plan.orders };
  for (const p of s.players) if (p.id !== me && p.eliminatedTurn === null) orders[p.id] = (bots.get(p.id) ?? makeMarshalBot("conqueror")).plan(ctx, viewFor(ctx, s, p.id), last.get(p.id));
  const before = s;
  const r = resolveTurn(ctx, s, orders);
  s = r.state;
  last = new Map(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, replayFor(ctx, before, r, p.id)]));
  const back = r.events.find((e) => e.type === "purseTaken" && e.handout && e.player === me);
  const after = findLeader(s.players.find((p) => p.id === me)!, { kind: "steward", of: me })!;
  const paid = r.events.find((e) => e.type === "purses" && e.player === me);
  const into = paid?.type === "purses" ? (paid.paid.find((x) => x.kind === "steward" && x.of === me)?.gold ?? 0) : 0;
  console.log(
    `turn ${before.turn}: Steward ${st.name} (${JSON.stringify(st.command)}, budget ${JSON.stringify(st.budget)}) started with ${st.purse}g; bought ${bought.length} (${bought.map((o) => (o.kind === "build" ? `${o.building} at ${o.territory}` : `culture at ${o.territory}`)).join(", ") || "nothing"}); ` +
      `${hb && hb.kind === "budget" ? `keeps ${hb.handBack!.keep}g, ` : "no handout planned, "}handed back ${back?.type === "purseTaken" ? back.gold : 0}g; ${into}g of budget paid in; purse now ${after.purse}g; treasury ${s.players.find((p) => p.id === me)!.gold}g; note: ${JSON.stringify(plan.notes[`steward:${me}`] ?? null)}`,
  );
}

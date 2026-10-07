/**
 * Session 18: does "Expand toward" write orders in a real game's opening? Plays a person's seat on Wyrmland (6 players,
 * Marshals), and from turn 2 tries Expand toward each of 12 targets at different distances; prints the orders it writes.
 *   npx tsx apps/sim/scripts/s18-expand-check.ts
 */
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { distancesFrom, indexMap, createGame, resolveTurn, viewFor } from "@conquerra/engine";
import { makeMarshalBot, planLeaders } from "@conquerra/bots";

const ctx = { map: maps.wyrmland!, rules: defaultRules };
let s = createGame(ctx, { gameId: "x", seed: "expand-check", players: ["you", "b1", "b2", "b3", "b4", "b5"].map((id, i) => ({ id, name: id, ...(i === 0 ? { delegate: true } : {}) })) });
const bot = makeMarshalBot("conqueror");
for (let t = 0; t < 4; t++) s = resolveTurn(ctx, s, Object.fromEntries(s.players.map((p) => [p.id, bot.plan(ctx, viewFor(ctx, s, p.id))]))).state;
const view = viewFor(ctx, s, "you");
const idx = indexMap(ctx.map);
const d = distancesFrom(idx, view.me.capital);
const targets = idx.ids.filter((t) => [3, 5, 8].includes(d.get(t) ?? 0)).slice(0, 12);
for (const t of targets) {
  const p = planLeaders({ ctx, view, commands: { "leader:you": { kind: "expand", territory: t } }, only: ["leader:you"] });
  console.log(`expand toward ${t} (${d.get(t)} away): ${p.orders.length} orders: ${p.orders.map((o) => (o.kind === "move" ? `${o.from}>${o.to}${o.withLeader ? "*" : ""}` : o.kind)).join(" ")}`);
}
console.log("capital", view.me.capital, "troops", view.territories[view.me.capital]);

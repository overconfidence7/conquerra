/**
 * Session 18: the worst case for speed. Wyrmland, 10 Marshals play 20 turns; then one player gets 3 captured Leaders and
 * 3 captured Stewards (8 leaders in all), every one with a command and a purse, and we time planning all of them, at
 * every living seat, over turns 20 to 30.
 *   npx tsx apps/sim/scripts/s18-speed.ts
 */
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, resolveTurn, viewFor, type GameState, type Instruction } from "@conquerra/engine";
import { dealPersonalities, makeMarshalBot, planLeaders } from "@conquerra/bots";

declare const performance: { now(): number };
const ctx = { map: maps.wyrmland!, rules: defaultRules };
const ids = Array.from({ length: 10 }, (_, i) => `p${i + 1}`);
let s: GameState = createGame(ctx, { gameId: "speed", seed: "s18-speed", players: ids.map((id) => ({ id, name: id })) });
const dealt = dealPersonalities("s18-speed", ids);
const bots = new Map(ids.map((id) => [id, makeMarshalBot(dealt[id]!)]));
const times: number[] = [];
let most = 0;
for (let turn = 1; turn <= 30 && !s.winner; turn++) {
  if (turn >= 20)
    for (const p of s.players.filter((x) => x.eliminatedTurn === null)) {
      const st = structuredClone(s);
      const me = st.players.find((x) => x.id === p.id)!;
      const land = Object.entries(st.territories).filter(([, t]) => t.owner === p.id).map(([t]) => t);
      const provinces = [...new Set(land.map((t) => ctx.map.territories.find((x) => x.id === t)!.province))];
      const far = ctx.map.territories[(turn * 7) % ctx.map.territories.length]!.id;
      const military: Instruction[] = [{ kind: "expand", territory: far }, { kind: "front", provinces: provinces.slice(0, 2) }, { kind: "military" }, { kind: "push", territory: far }];
      const steward: Instruction[] = [{ kind: "realm" }, { kind: "economy" }, { kind: "buildUp", province: provinces[0]! }, { kind: "fortify" }];
      me.leaders = [
        ...military.map((c, i) => ({ kind: "leader" as const, of: i === 0 ? p.id : `x${i}`, name: `L${i}`, command: c, budget: { share: 0.1 }, purse: 20 })),
        ...steward.map((c, i) => ({ kind: "steward" as const, of: i === 0 ? p.id : `x${i}`, name: `S${i}`, command: c, budget: { share: 0.1 }, purse: 20 })),
      ];
      me.captured = [1, 2, 3].map((i) => ({ of: `x${i}`, territory: land[i % land.length]! }));
      const view = viewFor(ctx, st, p.id);
      const t0 = performance.now();
      const plan = planLeaders({ ctx, view });
      times.push(performance.now() - t0);
      most = Math.max(most, plan.orders.length);
    }
  s = resolveTurn(ctx, s, Object.fromEntries(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, bots.get(p.id)!.plan(ctx, viewFor(ctx, s, p.id))]))).state;
}
times.sort((a, b) => a - b);
console.log(`8 leaders, every one commanded, Wyrmland 10 players, turns 20-30 (${times.length} plans): average ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)} ms, 95th ${times[Math.floor(times.length * 0.95)]!.toFixed(1)} ms, worst ${times[times.length - 1]!.toFixed(1)} ms; most orders in one plan ${most}`);

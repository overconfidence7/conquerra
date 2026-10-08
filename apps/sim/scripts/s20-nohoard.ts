/**
 * Session 20: a delegating seat's Leader on Run the military, turn by turn: the gold left in its purse once its orders
 * have run, and the reason it named (if any). Prints the turns it kept a troop's worth or more.
 *   npx tsx apps/sim/scripts/s20-nohoard.ts <map:players> <games>
 */
import { defaultRules, marshalData } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { agreedIn, freshMemory, makeMarshalBot, negotiate, planLeaders, withAgreed, type MarshalMemory } from "@conquerra/bots";
import { createGame, leaderKey, resolveTurn, viewFor, type GameContext, type OrdersByPlayer } from "@conquerra/engine";

const [table = "wyrmland:6", games = "10"] = process.argv.slice(2);
const [map, n] = table.split(":") as [string, string];
const ctx: GameContext = { map: maps[map]!, rules: defaultRules };
let turns = 0, kept = 0, named = 0;
for (let g = 0; g < Number(games); g++) {
  const players = Array.from({ length: Number(n) }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, ...(i === 0 ? { delegate: true } : {}) }));
  let s = createGame(ctx, { gameId: `nh-${g}`, seed: `nohoard-${g}`, players });
  const bots = players.map((_, i) => makeMarshalBot(marshalData.personalities[i % marshalData.personalities.length]!.id));
  let mem: MarshalMemory = freshMemory();
  const key = leaderKey({ kind: "leader", of: "p1" });
  while (!s.winner && s.turn <= 40) {
    const views = new Map(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, viewFor(ctx, s, p.id)]));
    if (!views.has("p1")) break;
    const talk = negotiate(ctx, [...views.keys()].map((id) => ({ id, level: id === "p1" ? ("captain" as const) : bots[Number(id.slice(1)) - 1]!.diplomat })), (id) => views.get(id)!, () => undefined, null);
    const agreed = agreedIn(talk.orders);
    const orders: OrdersByPlayer = {};
    for (const [id, v] of views) {
      if (id !== "p1") {
        orders[id] = [...(talk.orders[id] ?? []), ...bots[Number(id.slice(1)) - 1]!.plan(ctx, withAgreed(v, agreed))];
        continue;
      }
      const me = withAgreed(v, agreed);
      const cmd = s.turn === 1 ? [{ id: "c", kind: "instruct" as const, general: "p1", instruction: { kind: "military" as const } }, { id: "b", kind: "budget" as const, general: "p1", budget: { share: 0.8 } }] : [];
      const plan = planLeaders({ ctx, view: me, memory: mem, commands: { [key]: { kind: "military" } } });
      if (process.env.SHOW === `${g}:${s.turn}`) console.log("PLAN", plan.orders.map((o) => `${o.kind}${o.kind === "recruit" ? `@${o.territory}(${String(o.count)})${o.fallback ? "+fb" : ""}` : o.kind === "hire" ? `@${o.territory}:${o.specialist}` : o.kind === "build" ? `@${o.territory}:${o.building}` : ""}${o.general ? "[L]" : o.steward ? "[S]" : ""}`).join(" "), "sites", Object.entries(me.territories).filter(([t, v]) => v.detail === "full" && v.owner === "p1").length, "leader at", me.me.leader.territory);
      mem = plan.memory;
      orders[id] = [...(talk.orders[id] ?? []), ...cmd, ...plan.orders];
      (orders as Record<string, unknown>)[`note-${id}`] = plan.notes[key];
    }
    const note = (orders as Record<string, unknown>)["note-p1"] as { kind: string } | undefined;
    delete (orders as Record<string, unknown>)["note-p1"];
    const purse = s.players[0]!.leaders.find((l) => l.kind === "leader" && l.of === "p1")!.purse;
    const r = resolveTurn(ctx, s, orders);
    const spent = r.events.filter((e) => "by" in e && e.by && (e.by as { kind: string; of: string }).kind === "leader" && (e.by as { of: string }).of === "p1").reduce((a, e) => a + ((e as { cost?: number }).cost ?? 0), 0);
    const left = purse - spent;
    turns++;
    if (left >= ctx.rules.troops.cost) {
      kept++;
      if (note?.kind === "saving") named++;
      else console.log(`game ${g} turn ${s.turn}: purse ${purse}, spent ${spent}, left ${left}; fizzles ${r.events.filter((e) => e.type === "fizzled" && e.player === "p1" && (e as { orderId: string }).orderId.includes("-lp1-")).map((e) => (e as { reason: string }).reason).join(",")}`);
    }
    s = r.state;
  }
}
console.log(`${turns} turns: kept a troop's worth or more on ${kept} (${named} with a named reason)`);

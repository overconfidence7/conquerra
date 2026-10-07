import { leaderKey, type Budget, type Instruction, type Order, type PlayerView } from "@conquerra/engine";
import { makeCaptainBot } from "./captain";
import { freshMemory, type MarshalMemory } from "./marshal/memory";
import { planLeaders } from "./marshal/leaders";
import type { Bot } from "./recruit";

/**
 * For the simulator (session 18): seats played the way a person who delegates would.
 *
 *  - A delegating player (`makeDelegateSeat`): hands everything to its leaders: its Leader runs the military, its
 *    Steward runs the realm, with budgets that share all its income between them. Its own orders are only what a person
 *    would still do: spend the treasury it starts with (and any small change the budgets round off) on troops at its
 *    capital. Every other order is its leaders'.
 *  - A Captain with the default Steward (`makeStewardSeat`): plays like the Captain from its treasury, while its Steward
 *    runs the realm on its 20% (what a person who never opens the Leaders panel gets).
 *
 * Both keep their leaders' memory per seat, like the Marshal.
 */

const instruct = (view: PlayerView, kind: "leader" | "steward", instruction: Instruction): Order => ({
  id: `${view.me.id}-t${view.turn}-cmd-${kind}`,
  kind: "instruct",
  general: view.me.id,
  ...(kind === "steward" ? { role: "steward" as const } : {}),
  instruction,
});
const budget = (view: PlayerView, kind: "leader" | "steward", b: Budget): Order => ({
  id: `${view.me.id}-t${view.turn}-budget-${kind}`,
  kind: "budget",
  general: view.me.id,
  ...(kind === "steward" ? { role: "steward" as const } : {}),
  budget: b,
});

function seatMemory() {
  const memories = new Map<string, MarshalMemory>();
  const key = (v: PlayerView) => `${v.gameId}|${v.me.id}`;
  return {
    recall: (v: PlayerView) => memories.get(key(v)) ?? freshMemory(),
    keep: (v: PlayerView, m: MarshalMemory) => {
      memories.set(key(v), m);
      if (memories.size > 64) memories.delete(memories.keys().next().value!);
    },
  };
}

/** What the seat wants its leaders to have, and the orders that set it (only what differs from now). */
function setUp(view: PlayerView, want: { leader?: { command: Instruction; budget: Budget }; steward?: { command: Instruction; budget: Budget } }) {
  const orders: Order[] = [];
  const commands: Record<string, Instruction | null> = {};
  for (const kind of ["leader", "steward"] as const) {
    const w = want[kind];
    if (!w) continue;
    const ref = { kind, of: view.me.id };
    const now = view.me.leaders.find((l) => l.kind === kind && l.of === view.me.id);
    commands[leaderKey(ref)] = w.command;
    if (JSON.stringify(now?.command) !== JSON.stringify(w.command)) orders.push(instruct(view, kind, w.command));
    if (JSON.stringify(now?.budget) !== JSON.stringify(w.budget)) orders.push(budget(view, kind, w.budget));
  }
  return { orders, commands };
}

/** A delegating player: its Leader runs the military on `leaderShare` of its income, its Steward the realm on the rest. */
export function makeDelegateSeat(leaderShare = 0.8): Bot {
  const mem = seatMemory();
  return {
    id: `delegate-${Math.round(leaderShare * 100)}`,
    name: `Delegates everything (Leader ${Math.round(leaderShare * 100)}%, Steward ${Math.round((1 - leaderShare) * 100)}%)`,
    plan(ctx, view, lastTurn) {
      const { orders: setup, commands } = setUp(view, { leader: { command: { kind: "military" }, budget: { share: leaderShare } }, steward: { command: { kind: "realm" }, budget: { share: Math.round((1 - leaderShare) * 100) / 100 } } });
      const plan = planLeaders({ ctx, view, memory: mem.recall(view), commands, ...(lastTurn ? { lastTurn } : {}) });
      mem.keep(view, plan.memory);
      // The treasury it holds (its starting gold, and what budgets round off): troops at its capital, as a person would.
      const own: Order[] = view.me.gold >= ctx.rules.troops.cost && view.territories[view.me.capital]?.detail === "full" && (view.territories[view.me.capital] as { owner: string | null }).owner === view.me.id
        ? [{ id: `${view.me.id}-t${view.turn}-treasury`, kind: "recruit", territory: view.me.capital, count: "all" }]
        : [];
      return [...setup, ...own, ...plan.orders];
    },
  };
}

/** A Captain whose Steward runs the realm on `share` of its income (the default a person gets). */
export function makeStewardSeat(share = 0.2): Bot {
  const captain = makeCaptainBot();
  const mem = seatMemory();
  return {
    id: `captain-steward-${Math.round(share * 100)}`,
    name: `Captain with the default Steward (${Math.round(share * 100)}%)`,
    plan(ctx, view, lastTurn) {
      const { orders: setup, commands } = setUp(view, { steward: { command: { kind: "realm" }, budget: { share } } });
      const plan = planLeaders({ ctx, view, memory: mem.recall(view), commands, only: [leaderKey({ kind: "steward", of: view.me.id })], ...(lastTurn ? { lastTurn } : {}) });
      mem.keep(view, plan.memory);
      // The Steward's purchases first, then the Captain's own play (its places take precedence: it never builds where the Steward is).
      const mine = captain.plan(ctx, view, lastTurn);
      const places = new Set(mine.flatMap((o) => (o.kind === "build" || o.kind === "invest" ? [o.territory] : [])));
      return [...setup, ...plan.orders.filter((o) => !((o.kind === "build" || o.kind === "invest") && places.has(o.territory))), ...mine];
    },
  };
}

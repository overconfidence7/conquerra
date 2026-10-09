import type { MarshalJudgement } from "@conquerra/content";
import { leaderKey, type Budget, type Instruction, type Order, type PlayerView } from "@conquerra/engine";
import { makeCaptainBot } from "./captain";
import { freshMemory, type MarshalMemory } from "./marshal/memory";
import { planLeaders } from "./marshal/leaders";
import type { Diplomat } from "./diplomacy";
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

/**
 * One-change tests (session 19, why a delegating player beat the Marshals): how it talks (as a Captain, the
 * simulator's default for a seat with no diplomat, or as a Marshal in the leaders' style), whether its Leader goes
 * with its attacks, and whether its Steward's purchases come before its Leader's orders in the queue.
 */
export interface DelegateOptions {
  diplomat?: Diplomat;
  leaderStays?: boolean;
  stewardFirst?: boolean;
  /** Session 20: once it holds `rules.leaders.cleanUpShare` of the map, every military leader of its own goes on Clean up. */
  cleanUp?: boolean;
  /** Session 20: the leaders it captures report to its own (Leaders to its Leader, Stewards to its Steward). */
  report?: boolean;
  /** Its leaders plan with this judgement (one-change tests; the shared one by default). */
  judgement?: MarshalJudgement;
  /** Session 20b: its Steward finishes walls with at most this much gold left (0: never). */
  walls?: number;
  /** Session 20d: the Steward's share (default: the rest of the income after the Leader's). */
  stewardShare?: number;
  /** Session 20d's purse trace: each turn's view and its leaders' plan. */
  trace?: (view: PlayerView, plan: ReturnType<typeof planLeaders>) => void;
  id?: string;
}

/** A delegating player: its Leader runs the military on `leaderShare` of its income, its Steward the realm on the rest. */
export function makeDelegateSeat(leaderShare = 0.8, opts: DelegateOptions = {}): Bot {
  const mem = seatMemory();
  return {
    ...(opts.diplomat ? { diplomat: opts.diplomat } : {}),
    id: opts.id ?? `delegate-${Math.round(leaderShare * 100)}`,
    name: `Delegates everything (Leader ${Math.round(leaderShare * 100)}%, Steward ${Math.round((1 - leaderShare) * 100)}%)`,
    plan(ctx, view, lastTurn) {
      const held = Object.values(view.territories).filter((t) => t.detail === "full" && t.owner === view.me.id).length;
      const cleaning = !!opts.cleanUp && held >= ctx.rules.leaders.cleanUpShare * ctx.map.territories.length;
      const { orders: setup, commands } = setUp(view, { leader: { command: cleaning ? { kind: "cleanup" } : { kind: "military" }, budget: { share: leaderShare } }, steward: { command: { kind: "realm" }, budget: { share: opts.stewardShare ?? Math.round((1 - leaderShare) * 100) / 100 } } });
      // Its captured leaders: on Clean up too, or reporting to its own.
      for (const l of view.me.leaders) {
        if (l.of === view.me.id) continue;
        const want: Instruction | null = cleaning && l.kind === "leader" ? { kind: "cleanup" } : opts.report ? { kind: "report", to: view.me.id } : null;
        if (!want) continue;
        commands[leaderKey(l)] = want;
        if (JSON.stringify(l.command) !== JSON.stringify(want)) setup.push({ ...instruct(view, l.kind, want), id: `${view.me.id}-t${view.turn}-cmd-${l.kind}-${l.of}`, general: l.of });
      }
      const plan = planLeaders({ ctx, view, memory: mem.recall(view), commands, ...(opts.judgement ? { judgement: opts.judgement } : {}), ...(opts.walls !== undefined ? { walls: opts.walls } : {}), ...(lastTurn ? { lastTurn } : {}) });
      mem.keep(view, plan.memory);
      opts.trace?.(view, plan);
      // The treasury it holds (its starting gold, and what budgets round off): troops at its capital, as a person would.
      const own: Order[] = view.me.gold >= ctx.rules.troops.cost && view.territories[view.me.capital]?.detail === "full" && (view.territories[view.me.capital] as { owner: string | null }).owner === view.me.id
        ? [{ id: `${view.me.id}-t${view.turn}-treasury`, kind: "recruit", territory: view.me.capital, count: "all" }]
        : [];
      let leaders = plan.orders;
      if (opts.leaderStays) leaders = leaders.map((o) => (o.kind === "move" && o.withLeader ? (({ withLeader: _w, ...rest }) => rest as Order)(o) : o));
      if (opts.stewardFirst) leaders = [...leaders.filter((o) => o.steward), ...leaders.filter((o) => !o.steward)];
      return [...setup, ...own, ...leaders];
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

/**
 * For the simulator (session 19's one-change tests): a seat that plans its whole turn the way a Leader on "Run the
 * military" does (`planLeaders` with that command), paid from its treasury, with no Steward, no Spoils turned in by
 * hand and no spies. Talks with `diplomat` (a Captain's talk without one).
 */
export function makeLeaderPathSeat(id: string, diplomat?: Diplomat, opts: { homeGuard?: number } = {}): Bot {
  const mem = seatMemory();
  return {
    id,
    name: "Plans like a Leader running the military",
    ...(diplomat ? { diplomat } : {}),
    plan(ctx, view, lastTurn) {
      const key = leaderKey({ kind: "leader", of: view.me.id });
      // `homeGuard`: the first turns' gold goes to troops that stay at the capital (as a delegating player's does).
      const guard = opts.homeGuard && view.turn <= opts.homeGuard;
      const plan = planLeaders({ ctx, view, memory: mem.recall(view), commands: { [key]: { kind: "military" } }, purses: { [key]: guard ? 0 : view.me.gold }, only: [key], ...(lastTurn ? { lastTurn } : {}) });
      mem.keep(view, plan.memory);
      const home: Order[] = guard && view.me.gold >= ctx.rules.troops.cost ? [{ id: `${view.me.id}-t${view.turn}-home`, kind: "recruit", territory: view.me.capital, count: "all" }] : [];
      // Paid from the treasury, not a purse.
      return [...home, ...plan.orders.map((o) => (({ general: _g, ...rest }) => rest as Order)(o))];
    },
  };
}

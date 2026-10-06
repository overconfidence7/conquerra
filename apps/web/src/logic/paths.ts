import { indexMap, type GameContext, type Order, type PlayerId, type PlayerView, type TerritoryId } from "@conquerra/engine";
import { typicalTerritorySize } from "../map/zoom";
import { attackCheck, type PageDeal } from "./deals";
import { isOwned, planQueue, type NewOrder, type QueuePlan } from "./orders";

/**
 * Orders along a path (session 16, Nate #8): pick where an army sets out from and a place further away, and the game
 * writes the chain of orders to get there, one hop per order, as you'd write them by hand:
 *  - **Shortest way:** the fewest steps (through your own land where it can, then the weakest land it knows of).
 *  - **Full sweep:** every territory it can take between the two, in a corridor along the line between them, taken in
 *    an order that moves steadily toward the destination (never doubling back further than it must), then on to it.
 * It works from your own view only (what you see and remember; land you've never seen counts as lightly held). Your
 * own land, and land taken earlier on the path, is walked through (a move); a partner's land you have right of passage
 * through is marched through on the way (a move's `through`, at most `rules.diplomacy.passage.maxThrough` of it); a
 * path never attacks across a deal of yours (a binding pact, or a handshake one it would break). Pure: no React.
 */

export type PathKind = "shortest" | "sweep";

export interface PathPlan {
  kind: PathKind;
  from: TerritoryId;
  to: TerritoryId;
  /** Every territory the army walks, in order (starting with `from`). */
  steps: TerritoryId[];
  /** The orders it adds, one per hop (each from where the last one should leave the army). */
  orders: NewOrder[];
  /** Territories it would take (attacks). */
  takes: number;
  /** Null when it can't get there at all. */
  ok: boolean;
}

/** How wide the full sweep's corridor is, each side of the line, in typical territory widths. */
export const SWEEP_WIDTH = 1.1;
/** At most this many orders in one path (a long one is cut short; the box says so). */
export const MAX_PATH_ORDERS = 24;
/** Land never seen, counted as this many troops when choosing the weakest way. */
const UNSEEN_TROOPS = 3;

interface Ctx {
  ctx: GameContext;
  view: PlayerView;
  deals: readonly PageDeal[];
  open: readonly PlayerId[];
  plan: QueuePlan;
  /** Players you have a truce or a joint war with (a path never attacks them). */
  dealt: Set<PlayerId>;
}

function makeCtx(ctx: GameContext, view: PlayerView, queue: readonly Order[], deals: readonly PageDeal[], open: readonly PlayerId[]): Ctx {
  const me = view.me.id;
  const dealt = new Set(deals.filter((d) => (d.kind === "truce" || d.kind === "war") && (d.a === me || d.b === me)).map((d) => (d.a === me ? d.b : d.a)));
  return { ctx, view, deals, open, plan: planQueue(ctx, view, queue), dealt };
}

/** Who you believe holds a territory: what you see, else what you last saw (null: neutral or never seen). */
function ownerOf(view: PlayerView, t: TerritoryId): PlayerId | null {
  const v = view.territories[t];
  if (!v) return null;
  if (v.detail === "full") return v.owner;
  return v.lastSeen?.owner ?? null;
}
function troopsOf(view: PlayerView, t: TerritoryId): number {
  const v = view.territories[t];
  if (v?.detail === "full") return v.troops;
  return v?.lastSeen?.troops ?? UNSEEN_TROOPS;
}

/** What stepping onto `t` is: your own land (or taken earlier), a partner's land to march through, land to take, or closed. */
function stepKind(c: Ctx, from: TerritoryId, t: TerritoryId, taken: ReadonlySet<TerritoryId>): "own" | "through" | "take" | null {
  if (taken.has(t) || isOwned(c.view, c.plan, t)) return "own";
  const owner = ownerOf(c.view, t);
  if (owner && owner !== c.view.me.id && c.open.includes(owner)) return "through";
  // Never across a deal of yours (a binding pact blocks it; a handshake one would break): a path never attacks the land
  // of anyone you have a truce or a joint war with, wherever it is (land the path took counts as yours, which the
  // deal check on the attack panel can't know yet).
  if (owner && c.dealt.has(owner)) return null;
  if (!taken.has(from) && attackCheck(c.ctx, c.view, c.deals, from, t)) return null;
  return "take";
}

/**
 * The cheapest ways out from `from` (Dijkstra): each step costs 1, plus a little for the troops in land to take, so
 * ties go through your own land, then the weakest. `taken`: land the path has already taken (walked as your own).
 * `onward`: whether the army may go on from land it takes (the shortest way), or each piece of land to take is only
 * an end (the sweep, which takes one more at a time).
 */
function explore(c: Ctx, from: TerritoryId, taken: ReadonlySet<TerritoryId>, onward: boolean) {
  const idx = indexMap(c.ctx.map);
  const dist = new Map<TerritoryId, number>([[from, 0]]);
  const prev = new Map<TerritoryId, TerritoryId>();
  const kind = new Map<TerritoryId, "own" | "through" | "take">();
  const done = new Set<TerritoryId>();
  for (;;) {
    let t: TerritoryId | null = null;
    for (const [x, d] of dist) if (!done.has(x) && (t === null || d < dist.get(t)! || (d === dist.get(t)! && x < t))) t = x;
    if (t === null) break;
    done.add(t);
    if (t !== from && kind.get(t) === "take" && !onward) continue;
    for (const n of idx.neighbors.get(t) ?? []) {
      if (done.has(n)) continue;
      const k = stepKind(c, t, n, taken);
      if (!k) continue;
      const cost = dist.get(t)! + 1 + (k === "take" ? 0.05 + troopsOf(c.view, n) * 0.01 : k === "through" ? 0.02 : 0);
      if (cost < (dist.get(n) ?? Infinity)) {
        dist.set(n, cost);
        prev.set(n, t);
        kind.set(n, k);
      }
    }
  }
  const way = (to: TerritoryId): TerritoryId[] | null => {
    if (!dist.has(to)) return null;
    const path = [to];
    while (path[0] !== from) path.unshift(prev.get(path[0]!)!);
    return path;
  };
  return { dist, kind, way };
}

/** The cheapest way from `from` to `to` (see `explore`). */
function route(c: Ctx, from: TerritoryId, to: TerritoryId, taken: ReadonlySet<TerritoryId>): TerritoryId[] | null {
  return explore(c, from, taken, true).way(to);
}

/** The orders for walking `steps` (one move or attack per hop; a partner's land is folded into a move's `through`). */
function ordersFor(c: Ctx, steps: readonly TerritoryId[]): { orders: NewOrder[]; takes: number; walked: TerritoryId[] } {
  const maxThrough = c.ctx.rules.diplomacy.passage.maxThrough;
  const orders: NewOrder[] = [];
  const taken = new Set<TerritoryId>();
  let takes = 0;
  let at = steps[0]!;
  let through: TerritoryId[] = [];
  const walked = [at];
  // The Leader goes along if it starts with the army (session 16: it carries on through the chain).
  const leader = c.plan.leaderAt === at;
  for (let i = 1; i < steps.length; i++) {
    const t = steps[i]!;
    const k = stepKind(c, through.length ? through[through.length - 1]! : at, t, taken);
    if (!k) break;
    if (k === "through") {
      if (through.length >= maxThrough) break;
      through.push(t);
      continue;
    }
    if (orders.length >= MAX_PATH_ORDERS) break;
    const attack = k === "take";
    orders.push({
      kind: "move",
      from: at,
      to: t,
      ...(through.length ? { through: [...through] } : {}),
      troops: "all",
      ...(leader ? { withLeader: true } : {}),
      ...(attack ? { preset: { id: "onlyIfStronger" as const } } : {}),
    } as NewOrder);
    walked.push(...through, t);
    through = [];
    if (attack) (taken.add(t), takes++);
    at = t;
  }
  return { orders, takes, walked };
}

/** The fewest steps from `from` to `to`. */
export function shortestPath(ctx: GameContext, view: PlayerView, queue: readonly Order[], deals: readonly PageDeal[], open: readonly PlayerId[], from: TerritoryId, to: TerritoryId): PathPlan {
  const c = makeCtx(ctx, view, queue, deals, open);
  const steps = route(c, from, to, new Set());
  return finish(c, "shortest", from, to, steps);
}

/**
 * The full sweep: every territory it can take in a corridor along the line from `from` to `to` (within SWEEP_WIDTH
 * territory widths of it), visited nearest first with a penalty for heading back toward the start, then on to `to`.
 */
export function sweepPath(ctx: GameContext, view: PlayerView, queue: readonly Order[], deals: readonly PageDeal[], open: readonly PlayerId[], from: TerritoryId, to: TerritoryId): PathPlan {
  const c = makeCtx(ctx, view, queue, deals, open);
  const idx = indexMap(ctx.map);
  const pos = (t: TerritoryId) => idx.byId.get(t)!;
  const a = pos(from), b = pos(to);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const width = SWEEP_WIDTH * typicalTerritorySize(ctx.map);
  /** How far along the line (0 at the start, 1 at the end) and how far off it a territory is. */
  const along = (t: TerritoryId) => ((pos(t).x - a.x) * (b.x - a.x) + (pos(t).y - a.y) * (b.y - a.y)) / (len * len);
  const off = (t: TerritoryId) => {
    const u = Math.max(0, Math.min(1, along(t)));
    const px = a.x + (b.x - a.x) * u, py = a.y + (b.y - a.y) * u;
    return Math.hypot(pos(t).x - px, pos(t).y - py);
  };
  const corridor = new Set(idx.ids.filter((t) => t !== from && t !== to && along(t) > -0.15 && along(t) < 1.15 && off(t) <= width));
  const taken = new Set<TerritoryId>();
  const targets = new Set([...corridor].filter((t) => !isOwned(view, c.plan, t) && stepKind(c, from, t, taken) !== "through"));
  // A step along the line, in the same units as a hop (for the "doubling back" penalty).
  const hop = typicalTerritorySize(ctx.map) / len;
  const steps: TerritoryId[] = [from];
  let at = from;
  let mark = along(from);
  for (let guard = 0; targets.size && guard < MAX_PATH_ORDERS * 2; guard++) {
    // The nearest target reachable through land already yours (or taken), with a penalty for heading back.
    let best: { way: TerritoryId[]; score: number; t: TerritoryId } | null = null;
    const out = explore(c, at, taken, false);
    // The rearmost land still to take: running far ahead of it would mean coming back for it later.
    const rear = Math.min(...[...targets].map(along));
    for (const t of targets) {
      const way = out.kind.get(t) === "take" ? out.way(t) : null;
      if (!way) continue;
      const back = Math.max(0, mark - along(t)) / hop;
      const ahead = Math.max(0, along(t) - rear - hop * 0.5) / hop;
      const score = way.length - 1 + back * 1.5 + ahead * 1.2 + along(t) * 0.01;
      if (!best || score < best.score || (score === best.score && t < best.t)) best = { way, score, t };
    }
    if (!best) break;
    // Each leg walks through land already yours (or taken) and takes one more.
    steps.push(...best.way.slice(1));
    targets.delete(best.t);
    taken.add(best.t);
    at = best.t;
    mark = Math.max(mark, along(at));
    if (steps.length - 1 > MAX_PATH_ORDERS) break;
  }
  // Then on to the destination.
  const last = at === to ? [to] : route(c, at, to, taken);
  return finish(c, "sweep", from, to, last ? [...steps, ...last.slice(1)] : steps.length > 1 ? steps : null, !!last);
}

function finish(c: Ctx, kind: PathKind, from: TerritoryId, to: TerritoryId, steps: TerritoryId[] | null, reached = true): PathPlan {
  if (!steps || steps.length < 2) return { kind, from, to, steps: [from], orders: [], takes: 0, ok: false };
  const { orders, takes, walked } = ordersFor(c, steps);
  return { kind, from, to, steps: walked, orders, takes, ok: reached && walked[walked.length - 1] === to && orders.length > 0 };
}

/** The path the box shows: the shortest way or the full sweep. */
export function planPath(ctx: GameContext, view: PlayerView, queue: readonly Order[], deals: readonly PageDeal[], open: readonly PlayerId[], p: { from: TerritoryId; to: TerritoryId; kind: PathKind }): PathPlan {
  return (p.kind === "sweep" ? sweepPath : shortestPath)(ctx, view, queue, deals, open, p.from, p.to);
}

/** "7 orders: take 6 territories, end at Old March" (or why it can't). */
export function pathSummary(p: PathPlan, place: (t: TerritoryId) => string): string {
  if (!p.orders.length) return `No way to ${place(p.to)} from here: deals, the sea or the mountains are in the way.`;
  const n = p.orders.length;
  const head = `${n} ${n === 1 ? "order" : "orders"}: ${p.takes ? `take ${p.takes} ${p.takes === 1 ? "territory" : "territories"}` : "no fighting"}`;
  const end = p.steps[p.steps.length - 1]!;
  return p.ok ? `${head}, end at ${place(end)}` : `${head}, then it stops at ${place(end)} (it can't get to ${place(p.to)} in one turn's path)`;
}

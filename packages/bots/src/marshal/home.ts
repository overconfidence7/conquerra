import type { Order, PlayerId, TerritoryId } from "@conquerra/engine";
import type { Board } from "../board";

/**
 * A sweep of our own land before the attack (session 20c, Nate's second note). If a rival army we can see could get
 * behind our front this turn (chaining through land of ours held by a troop or two), transfers from land it can't
 * reach bring a few troops into each territory of ours behind the front it could take. Each transfer attacks only if
 * still stronger, so a rival that stepped in is taken straight back by the troops arriving, and one too big for them
 * is left alone. The troops stay there for the turn and march on to the front with the next reinforcements.
 *
 * Where their armies could go is worked out from the map, what we see of them and our own troops: nothing hidden.
 */
export interface HomeSweepOptions {
  /** Troops brought into each exposed territory. */
  troops: number;
  /** Their armies are reckoned to chain at most this many hops. */
  reach: number;
  /** Our territories whose troops it may move (a leader's command; the Marshal: all). */
  commands?(t: TerritoryId): boolean;
  /** Rivals it has a deal with (their armies won't come). */
  atPeace(r: PlayerId): boolean;
}

/** The transfers (shallowest first), and the territories behind our front a rival army could reach. Troops it moves come out of `free`. */
export function planHomeSweep(b: Board, free: Map<TerritoryId, number>, id: () => string, opt: HomeSweepOptions): { orders: Order[]; exposed: TerritoryId[] } {
  const { idx, owned, rivalAt, troopsAt, look, garrison } = b;
  const may = (t: TerritoryId) => owned(t) && (!opt.commands || opt.commands(t));
  const shut = new Set((b.view.closures ?? []).filter((c) => c.turn === b.view.turn).flatMap((c) => [`${c.a}|${c.b}`, `${c.b}|${c.a}`]));
  const closed = (x: TerritoryId, y: TerritoryId) => shut.has(`${x}|${y}`);
  // Where each rival army it can see could get to: hop by hop through our land or empty land while what's left of it
  // would likely take the next (1 left behind each hop).
  const danger = new Set<TerritoryId>();
  const best = new Map<TerritoryId, number>();
  const q: [TerritoryId, number, number][] = [];
  for (const x of idx.ids) {
    const r = rivalAt(x);
    if (r && !opt.atPeace(r) && troopsAt(x) >= 3) q.push([x, troopsAt(x) - garrison, 0]);
  }
  for (let h = 0; h < q.length; h++) {
    const [cur, strength, hops] = q[h]!;
    if (hops >= opt.reach) continue;
    for (const nb of idx.neighbors.get(cur)!) {
      const o = look(nb).owner;
      if ((o && o !== b.me.id) || closed(cur, nb) || b.blocked(cur, nb)) continue;
      const rest = Math.floor(strength - look(nb).troops * 1.2) - garrison;
      if (rest <= 0 || (best.get(nb) ?? -1) >= rest) continue;
      best.set(nb, rest);
      if (owned(nb)) danger.add(nb);
      q.push([nb, rest, hops + 1]);
    }
  }
  // Behind the front: land of ours it could take that doesn't face anyone else's land.
  const exposed = [...danger].filter((t) => may(t) && !b.isFrontier(t)).sort();
  if (!exposed.length) return { orders: [], exposed };
  // One flow: a tree from the land they can't reach inward, each exposed territory drawing its troops along it from
  // its own root; one order a step, carrying everything that passes.
  const parent = new Map<TerritoryId, TerritoryId | null>();
  const root = new Map<TerritoryId, TerritoryId>();
  const depth = new Map<TerritoryId, number>();
  const bfs: TerritoryId[] = [];
  for (const t of b.mine) if (may(t) && !danger.has(t) && (free.get(t) ?? 0) > 0) (parent.set(t, null), root.set(t, t), depth.set(t, 0), bfs.push(t));
  for (let h = 0; h < bfs.length; h++)
    for (const nb of [...idx.neighbors.get(bfs[h]!)!].sort())
      if (may(nb) && !parent.has(nb) && !closed(bfs[h]!, nb)) (parent.set(nb, bfs[h]!), root.set(nb, root.get(bfs[h]!)!), depth.set(nb, depth.get(bfs[h]!)! + 1), bfs.push(nb));
  const flow = new Map<TerritoryId, number>();
  for (const t of exposed) {
    const r = root.get(t);
    if (!r || r === t) continue;
    const n = Math.min(opt.troops, free.get(r) ?? 0);
    if (n <= 0) continue;
    free.set(r, free.get(r)! - n);
    for (let x: TerritoryId = t; parent.get(x); x = parent.get(x)!) flow.set(x, (flow.get(x) ?? 0) + n);
  }
  const orders: Order[] = [...flow]
    .sort((a, c) => depth.get(a[0])! - depth.get(c[0])! || (a[0] < c[0] ? -1 : 1))
    .map(([t, n]) => ({ id: id(), kind: "move", from: parent.get(t)!, to: t, troops: n, preset: { id: "onlyIfStronger" } }));
  return { orders, exposed };
}

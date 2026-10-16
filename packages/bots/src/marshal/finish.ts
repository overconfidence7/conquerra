import { fewestToTake, type Order, type PlayerId, type TerritoryId } from "@conquerra/engine";
import { BREAKTHROUGH_MARGIN, chainOn, type Board } from "../board";
import { cloudBorders } from "../known";

/**
 * Finishing a rival (session 20, Nate's play test: with 95% of the map his Leader let a 2-territory rival win back a
 * chunk of it over four turns). When a rival is down to a handful of territories, the Marshal (and a leader with a
 * military command) goes and ends them, the way a person would in one or two turns:
 *
 *  - Its troops march through its own land to every territory of ours next to theirs (one order a hop, as you'd write
 *    them by hand), so their armies have nowhere to break out.
 *  - It strikes each of their territories with well over what it takes, their armies first (Seize the Initiative on
 *    the biggest), and chains on through the rest of their land and the empty land they could run to.
 *  - What can't strike this turn stands on the border, ready for the next.
 *
 * It only ever reads its own view (what it sees and remembers): land of theirs it has never seen isn't a target.
 */

export interface FinishOptions {
  /** Strike with this many times what it takes. */
  margin: number;
  /** At most this many hops through our own land to reach the border (orders: one a hop). */
  hops: number;
  /** Our territories whose armies it may move (a leader's command; the Marshal: all). */
  commands?(t: TerritoryId): boolean;
  /** Its armies may use the Initiative (once). */
  initiative: boolean;
  /** Bring up spare troops toward their land for next turn: all of them (Clean up), else about what the strikes still need. */
  bringAll?: boolean;
  /** Troops recruited this turn, by site (they're there only once their recruit has run). */
  recruited?: ReadonlyMap<TerritoryId, number>;
  /** Chain style: hops in all, and spare troops for Follow through. */
  maxHops: number;
  followThroughSpare: number;
}

export interface FinishResult {
  /** The rivals it's finishing, with the land it knows they hold. */
  targets: { rival: PlayerId; land: number }[];
  /** Whether it used the Initiative. */
  usedInitiative: boolean;
}

/**
 * Rivals down to a handful: at most `territories` or `share` of ours, and a third of ours at most. With `all` (Clean
 * up), everyone. Judged honestly under fog (session 23, orchestrator default): their land as far as we know, plus the
 * land in the fog they could plausibly hold (the sweep's "might be", `fog` steps; see plausibleLand). On turn 6 a rival
 * we've barely seen isn't down to a handful just because we've seen little of it. `fog` null: as before, on the land
 * we know of (the Marshal's own turn: judging honestly made all-Marshal games on Rootholm 8 about 3 turns longer).
 */
export function remnantRivals(b: Board, finish: { territories: number; share: number }, all = false, fog: number | null = 2): PlayerId[] {
  const ours = b.mine.length;
  const known = new Map<PlayerId, number>();
  for (const t of b.idx.ids) {
    const o = b.look0(t);
    if (o && o !== b.me.id) known.set(o, (known.get(o) ?? 0) + 1);
  }
  return b.alive
    .map((p) => p.id)
    .filter((p) => p !== b.me.id && (known.get(p) ?? 0) > 0)
    .filter((p) => {
      if (all) return true;
      const land = Math.max(known.get(p)!, b.knownLand.get(p) ?? 0) + (fog === null ? 0 : plausibleLand(b, p, fog));
      return land * 3 <= ours && (land <= finish.territories || land <= finish.share * ours);
    })
    .sort((x, y) => (known.get(x) ?? 0) - (known.get(y) ?? 0) || (x < y ? -1 : 1));
}

/**
 * Land in the fog `rival` could plausibly hold that we don't know is theirs (the sweep's "might be", session 20d):
 * land we've never seen that joins up with theirs through the fog, and fogged land within `fog` steps of it (or of
 * theirs) that was empty, theirs or ours when we last saw it. Land a third House held stays theirs as far as we know.
 * With the fog off, none. It only reads our view: the remnant could be there, so it counts.
 */
export function plausibleLand(b: Board, rival: PlayerId, fog: number): number {
  const { idx, owned } = b;
  const fogged = (t: TerritoryId) => b.view.territories[t]?.detail !== "full";
  const never = (t: TerritoryId) => {
    const v = b.view.territories[t];
    return !v || (v.detail !== "full" && !v.lastSeen);
  };
  const open = (t: TerritoryId) => {
    if (owned(t) || !fogged(t)) return false;
    if (never(t)) return true;
    const o = b.look0(t);
    return o === null || o === b.me.id || o === rival;
  };
  const seeds = idx.ids.filter((t) => !owned(t) && b.look0(t) === rival);
  const d = new Map<TerritoryId, number>(seeds.map((t) => [t, 0]));
  const q = [...seeds];
  for (let h = 0; h < q.length; h++) {
    const cur = q[h]!;
    for (const nb of idx.neighbors.get(cur)!) {
      if (!open(nb)) continue;
      // Never-seen land joins up at no cost; fog we've seen costs a step. (A shorter way in goes round again.)
      const step = never(nb) ? 0 : d.get(cur)! + 1;
      if (step > fog || (d.has(nb) && d.get(nb)! <= step)) continue;
      d.set(nb, step);
      q.push(nb);
    }
  }
  let n = 0;
  for (const t of d.keys()) if (b.look0(t) !== rival) n++;
  // Session 32, blackout: land never seen isn't on our map at all. If what they could hold reaches the cloud, all of it
  // could be theirs, as never-seen land joins up at no cost above (we can't tell how it joins). Nothing with standard fog.
  const dark = b.size - idx.ids.length;
  if (dark > 0 && [...d.keys()].some((t) => cloudBorders(b.ctx.map, t) > 0)) n += dark;
  return n;
}

/**
 * Plan the finish against `rivals`: orders go to `army(order, from)`; troops it moves come out of `free` (spare troops
 * by territory, recruits included). Territories it attacks go into `targeted`.
 */
export function planFinish(b: Board, rivals: readonly PlayerId[], free: Map<TerritoryId, number>, targeted: Set<TerritoryId>, id: () => string, army: (o: Order, from: TerritoryId, first?: boolean) => void, opt: FinishOptions): FinishResult {
  const { idx, owned, look, look0, garrison, crossing, expectAt, me } = b;
  const isTarget = new Set(rivals);
  const theirs = idx.ids.filter((t) => !owned(t) && isTarget.has(look0(t) ?? ""));
  const targets = rivals.map((r) => ({ rival: r, land: theirs.filter((t) => look0(t) === r).length }));
  let usedInitiative = !opt.initiative;
  if (!theirs.length) return { targets, usedInitiative };
  const may = (t: TerritoryId) => !opt.commands || opt.commands(t);
  /**
   * What it takes to be sure of `to` from `from` (null: not even everything we have), counting what they could recruit
   * there before our strike lands (a guess from the land we know they hold: their whole income in troops).
   */
  const recruits = new Map(rivals.map((r) => [r, 2 + 2 * theirs.filter((t) => look0(t) === r).length]));
  const sure = (from: TerritoryId, to: TerritoryId) => {
    const extra = recruits.get(look0(to) ?? "") ?? 0;
    const need = fewestToTake((n) => b.expectAt(from, to, n, [], false, extra).captureLikely, 100000);
    if (need === null) return null;
    return Math.ceil(need * (crossing(from, to) ? Math.max(opt.margin, BREAKTHROUGH_MARGIN) : opt.margin)) + 1;
  };
  /**
   * Gather `need` spare troops at `gate` from our land within `opt.hops` hops (nearest first), marching each hop as one
   * order (deepest first, so each hop's troops have arrived when it moves on). Returns what arrives.
   */
  /** What will stand in each territory of ours once our orders have run (troops, recruits, in and out). */
  const left = new Map<TerritoryId, number>();
  const leftAt = (t: TerritoryId) => left.get(t) ?? b.troopsAt(t) + (opt.recruited?.get(t) ?? 0);
  const gather = (gate: TerritoryId, need: number, dry = false): number => {
    const parent = new Map<TerritoryId, TerritoryId | null>([[gate, null]]);
    const depth = new Map<TerritoryId, number>([[gate, 0]]);
    const q = [gate];
    const take = new Map<TerritoryId, number>();
    let got = 0;
    const here = may(gate) ? Math.min(free.get(gate) ?? 0, need) : 0;
    if (here > 0) (take.set(gate, here), (got += here));
    for (let h = 0; h < q.length && got < need; h++) {
      const cur = q[h]!;
      if (depth.get(cur)! >= opt.hops) continue;
      for (const nb of [...idx.neighbors.get(cur)!].sort()) {
        // Only through land it commands (an order out of land it doesn't would move someone else's army).
        if (parent.has(nb) || !owned(nb) || !may(nb)) continue;
        parent.set(nb, cur);
        depth.set(nb, depth.get(cur)! + 1);
        q.push(nb);
        const spare = may(nb) ? (free.get(nb) ?? 0) : 0;
        if (spare > 0 && got < need) {
          const n = Math.min(spare, need - got);
          take.set(nb, n);
          got += n;
        }
      }
    }
    if (!got || dry) return got;
    // Each hop carries what comes through it.
    const flow = new Map<TerritoryId, number>();
    for (const [t, n] of take) {
      free.set(t, (free.get(t) ?? 0) - n);
      for (let x: TerritoryId | null = t; x !== null && x !== gate; x = parent.get(x)!) flow.set(x, (flow.get(x) ?? 0) + n);
    }
    for (const [t, n] of [...flow].sort((a, c) => depth.get(c[0])! - depth.get(a[0])! || (a[0] < c[0] ? -1 : 1))) {
      army({ id: id(), kind: "move", from: t, to: parent.get(t)!, troops: n }, t);
      left.set(t, leftAt(t) - n);
      left.set(parent.get(t)!, leftAt(parent.get(t)!) + n);
    }
    return got;
  };

  // Their armies first (biggest first), then the rest of their land.
  const order = [...theirs].sort((x, y) => look(y).troops - look(x).troops || (x < y ? -1 : 1));
  const struck: { from: TerritoryId; to: TerritoryId; troops: number; order: Order }[] = [];
  const staged = new Set<TerritoryId>();
  const strike = (g: TerritoryId, x: TerritoryId, troops: number, first = false) => {
    const o: Order = { id: id(), kind: "move", from: g, to: x, troops, preset: { id: "onlyIfStronger" } };
    if (!usedInitiative && look(x).troops > garrison) {
      o.timing = "first";
      usedInitiative = true;
    }
    army(o, g, first);
    left.set(g, leftAt(g) - troops);
    targeted.add(x);
    struck.push({ from: g, to: x, troops, order: o });
  };
  // 1. Strikes ready now (enough spare troops on the border already): first in the queue, before they can move.
  for (const x of order) {
    const g = idx.neighbors
      .get(x)!
      .filter((g) => owned(g) && may(g) && !b.blocked(g, x))
      .map((g) => ({ g, need: sure(g, x) }))
      .filter((e): e is { g: TerritoryId; need: number } => e.need !== null && (free.get(e.g) ?? 0) - (opt.recruited?.get(e.g) ?? 0) >= e.need)
      .sort((a, c) => a.need - c.need || (a.g < c.g ? -1 : 1))[0];
    if (!g) continue;
    free.set(g.g, free.get(g.g)! - g.need);
    strike(g.g, x, g.need, true);
  }
  // 2. Their armies, then the rest of their land: troops marched to the border, and a strike where enough can get there.
  const army0 = (x: TerritoryId) => look(x).troops > garrison;
  for (const pass of [true, false])
    for (const x of order) {
      if (targeted.has(x) || army0(x) !== pass) continue;
      const ranked = idx.neighbors
        .get(x)!
        .filter((g) => owned(g) && !b.blocked(g, x))
        .map((g) => ({ g, need: sure(g, x) }))
        .filter((e): e is { g: TerritoryId; need: number } => e.need !== null)
        .map((e) => ({ ...e, reach: gather(e.g, e.need, true) }))
        .sort((a, c) => Number(c.reach >= c.need) - Number(a.reach >= a.need) || a.need - c.need || c.reach - a.reach || (a.g < c.g ? -1 : 1));
      const best = ranked[0];
      if (!best || best.reach < best.need) continue;
      strike(best.g, x, gather(best.g, best.need));
    }
  // 3. Every territory of ours next to one of their armies holds against it, struck or not (an army that moves out
  // before our strike lands meets a wall), and stays put; where we couldn't strike, that's the ring for next turn.
  for (const x of order) {
    if (!army0(x)) continue;
    for (const g of idx.neighbors.get(x)!.filter((g) => owned(g)).sort()) {
      const short = b.holdNeed(g) - leftAt(g);
      if (short > 0) gather(g, short);
      staged.add(g);
      free.set(g, 0);
    }
  }
  // 4. Bring up: spare troops march toward their land (as far as `hops` goes), ready for next turn's strikes.
  const unstruck = theirs.filter((x) => !targeted.has(x));
  let budget = opt.bringAll ? Infinity : unstruck.reduce((a, x) => a + (look(x).troops + (recruits.get(look0(x) ?? "") ?? 0)) * opt.margin * 2, 0);
  if (unstruck.length && budget > 0) {
    const parent = new Map<TerritoryId, TerritoryId | null>();
    const depth = new Map<TerritoryId, number>();
    const q: TerritoryId[] = [];
    for (const x of unstruck)
      for (const g of idx.neighbors.get(x)!)
        if (owned(g) && !parent.has(g)) (parent.set(g, null), depth.set(g, 0), q.push(g));
    for (let h = 0; h < q.length; h++) {
      const cur = q[h]!;
      if (depth.get(cur)! >= opt.hops) continue;
      for (const nb of [...idx.neighbors.get(cur)!].sort())
        if (owned(nb) && may(nb) && !parent.has(nb)) (parent.set(nb, cur), depth.set(nb, depth.get(cur)! + 1), q.push(nb));
    }
    const flow = new Map<TerritoryId, number>();
    for (const t of q) {
      if (budget <= 0) break;
      if (depth.get(t) === 0 || !may(t)) continue;
      const n = Math.min(free.get(t) ?? 0, budget);
      if (n <= 0) continue;
      free.set(t, free.get(t)! - n);
      budget -= n;
      for (let x: TerritoryId | null = t; x !== null && parent.get(x) !== null; x = parent.get(x)!) flow.set(x, (flow.get(x) ?? 0) + n);
    }
    for (const [t, n] of [...flow].sort((a, c) => depth.get(c[0])! - depth.get(a[0])! || (a[0] < c[0] ? -1 : 1))) army({ id: id(), kind: "move", from: t, to: parent.get(t)!, troops: n }, t);
  }
  // Chain on through the rest of their land, and the empty land they could run to.
  const exits = new Set<TerritoryId>();
  for (const t of theirs) for (const n of idx.neighbors.get(t)!) if (!owned(n) && look(n).owner === null) exits.add(n);
  const worth = (t: TerritoryId) => (isTarget.has(look(t).owner ?? "") ? 100 + look(t).troops : exits.has(t) ? 10 : -1);
  for (const s of struck)
    chainOn({ ...b, valueOf: worth }, { order: s.order, from: s.from, to: s.to, troops: s.troops }, targeted, 1, id, (o) => army(o, s.from), {
      allowed: (_f, t) => worth(t) > 0,
      maxHops: opt.maxHops,
      followThroughSpare: opt.followThroughSpare,
    });
  // The empty land next to theirs, from where we stand, so they've nowhere to run.
  for (const n of [...exits].sort()) {
    if (targeted.has(n)) continue;
    const from = idx.neighbors
      .get(n)!
      .filter((g) => owned(g) && may(g) && !staged.has(g) && !crossing(g, n))
      .sort((a, c) => (free.get(c) ?? 0) - (free.get(a) ?? 0) || (a < c ? -1 : 1))[0];
    if (!from) continue;
    const need = sure(from, n);
    if (need === null || (free.get(from) ?? 0) < need) continue;
    free.set(from, free.get(from)! - need);
    army({ id: id(), kind: "move", from, to: n, troops: need, preset: { id: "onlyIfStronger" } }, from);
    targeted.add(n);
  }
  void me;
  return { targets, usedInitiative };
}

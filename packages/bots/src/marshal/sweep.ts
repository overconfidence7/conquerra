import { fewestToTake, type Order, type PlayerId, type TerritoryId } from "@conquerra/engine";
import { BREAKTHROUGH_MARGIN, type Board } from "../board";

/**
 * Mass and sweep, with a security blanket (session 20c, Nate's second note): how a leader (and the Marshal) finishes
 * the game once it's cleaning up. Late in a game our recruiting dwarfs theirs, so a remnant's army should never be as
 * big as ours where they meet; what session 20 called "slipping a strike" was the remnant getting away. Each order
 * plays in its own round and a remnant writes only a few, so the first orders in our queue play before their armies
 * move and the rest after. So:
 *
 *  1. Before anything else: a strike that's ready right now (the Initiative on their biggest army), and the ring held:
 *     troops step into each territory of ours next to one of their armies that couldn't hold it, from up to two
 *     steps away, where that's enough to hold it (an attack of theirs that isn't likely to win is called off).
 *  2. Mass: every spare troop (all but the 1 that holds each territory, and the capital's guard) marches through our own
 *     land to one staging territory next to the remnant's biggest army, as many hops as it takes, with our Leader.
 *  3. Sweep: from there one chain strikes their army and walks on through everywhere they are and everywhere their
 *     armies could get to this turn (worked out from each army's strength against what stands in its way), nearest
 *     first, back through our own land where it must, the Leader on it. An army too big to strike yet is struck only
 *     if it has marched out (each hop attacks only if it's still stronger), and the chain follows its trail.
 *  4. The security blanket: chains of transfers through our own land into every territory of ours their armies could
 *     reach, queued last, so anything they take is taken straight back by the troops arriving (each transfer attacks
 *     only if it's still stronger, so it never throws itself at their main army).
 *
 * A small remnant (a few territories) that we can strike everywhere at once this turn gets the ring instead (session
 * 20's way: troops to a territory next to each of theirs and a strike from every side), since that ends it sooner.
 * Several remnants far apart get a mass each, sized to what each needs; the biggest army gets the Leader and the rest.
 *
 * It only ever reads its own view (what it sees and remembers): where their armies could go is worked out from the map,
 * what it sees of them and our own troops, never from hidden positions. Land of theirs it has never seen isn't a target.
 */

export interface SweepOptions {
  /** Strike with this many times what it takes. */
  margin: number;
  /** Their armies are reckoned to chain at most this many hops (the Marshal's own longest chain). */
  reach: number;
  /** Troops each territory of ours in the blanket gets (arriving late, to take back what they took). */
  blanket: number;
  /** A remnant of at most this many territories can be ringed (when every territory of theirs can be struck at once). */
  ringUpTo: number;
  /** Our territories whose armies it may move (a leader's command; the Marshal: all). */
  commands?(t: TerritoryId): boolean;
  /** Its armies may use the Initiative (once). */
  initiative: boolean;
  /** Troops recruited this turn, by site (they're there only once their recruit has run). */
  recruited?: ReadonlyMap<TerritoryId, number>;
  /** The Leader that goes with the main mass, where it stands, and what an order carrying it says. */
  leader?: { at: TerritoryId; goes: Goes } | null;
}

export interface SweepResult {
  targets: { rival: PlayerId; land: number }[];
  usedInitiative: boolean;
  /** The Leader is on the main chain (so nobody else moves it). */
  leaderPlaced: boolean;
  /** Where each mass gathers (one per remnant group). */
  staging: TerritoryId[];
  /** How each remnant group was finished. */
  modes: ("sweep" | "ring")[];
}

type Emit = (o: Order, from: TerritoryId, first?: boolean) => void;
type Move = Extract<Order, { kind: "move" }>;
/** What an order carrying a Leader says: your own Leader (+20%), or a captured one (no bonus). */
export type Goes = Partial<Pick<Move, "withLeader" | "withGeneral">>;
type Queue = [Order, TerritoryId][];

/**
 * Plan the finish against `rivals`: orders go to `army(order, from, first)`; troops it moves come out of `free` (spare
 * troops by territory, recruits included). Territories it attacks go into `targeted`.
 */
export function planSweep(b: Board, rivals: readonly PlayerId[], free: Map<TerritoryId, number>, targeted: Set<TerritoryId>, id: () => string, army: Emit, opt: SweepOptions): SweepResult {
  const { idx, owned, look, garrison, crossing } = b;
  const isTarget = new Set(rivals);
  /**
   * Who holds `t` as far as we know: what we see or last saw, with a knocked-out player's land going to whoever
   * knocked them out (public), so a remnant's last land we remember under a fallen House isn't off limits.
   */
  const out = new Map(b.view.players.filter((p) => p.eliminatedTurn !== null).map((p) => [p.id, p.eliminatedBy]));
  const look0 = (t: TerritoryId): PlayerId | null => {
    const o = b.look0(t);
    return o && out.has(o) ? (out.get(o) ?? null) : o;
  };
  const theirs = idx.ids.filter((t) => !owned(t) && isTarget.has(look0(t) ?? ""));
  const targets = rivals.map((r) => ({ rival: r, land: theirs.filter((t) => look0(t) === r).length }));
  const result: SweepResult = { targets, usedInitiative: !opt.initiative, leaderPlaced: false, staging: [], modes: [] };
  if (!theirs.length) return result;
  const may = (t: TerritoryId) => owned(t) && (!opt.commands || opt.commands(t));
  /** A crossing a storm has closed this turn (everyone who can see either side knows). */
  const shut = new Set((b.view.closures ?? []).filter((c) => c.turn === b.view.turn).flatMap((c) => [`${c.a}|${c.b}`, `${c.b}|${c.a}`]));
  const closed = (x: TerritoryId, y: TerritoryId) => shut.has(`${x}|${y}`);
  /** What they could recruit before our strike lands (a guess from the land we know they hold: their whole income in troops). */
  const recruits = new Map(rivals.map((r) => [r, 2 + 2 * theirs.filter((t) => look0(t) === r).length]));
  /**
   * Where they could recruit (what anyone can tell from the map and what we've seen): their capital, a barracks, or
   * any territory of a province they hold whole. A remnant puts its income there and chains out the same turn.
   */
  const unknown = (t: TerritoryId) => {
    const v = b.view.territories[t];
    return !v || (v.detail !== "full" && !v.lastSeen);
  };
  const site = (x: TerritoryId) => {
    const r = look0(x)!;
    if (look(x).capitalOf === r || look(x).building === "barracks") return true;
    // (Land of that province we've never seen could well be theirs.)
    return (idx.provinceMembers.get(idx.byId.get(x)!.province) ?? []).every((m) => look0(m) === r || unknown(m));
  };
  const isArmy = (x: TerritoryId) => isTarget.has(look0(x) ?? "") && !owned(x) && (look(x).troops > garrison || site(x));
  const recruitedAt = (t: TerritoryId) => opt.recruited?.get(t) ?? 0;
  const extraAt = (to: TerritoryId) => (isArmy(to) ? (recruits.get(look0(to)!) ?? 0) : 0);
  const sure = (from: TerritoryId, to: TerritoryId, leader = false) => {
    const need = fewestToTake((n) => b.expectAt(from, to, n, [], leader, extraAt(to)).captureLikely, 100000);
    if (need === null) return null;
    return Math.ceil(need * (crossing(from, to) ? Math.max(opt.margin, BREAKTHROUGH_MARGIN) : opt.margin)) + 1;
  };
  /** What will stand in each territory of ours once our orders have run (troops, recruits, in and out). */
  const left = new Map<TerritoryId, number>();
  const leftAt = (t: TerritoryId) => left.get(t) ?? b.troopsAt(t) + recruitedAt(t);
  /** What stands there before the recruits run (for the orders that play first). */
  const now = new Map<TerritoryId, number>();
  const nowAt = (t: TerritoryId) => now.get(t) ?? b.troopsAt(t);
  const shift = (from: TerritoryId, to: TerritoryId, n: number, early = false) => {
    left.set(from, leftAt(from) - n);
    if (owned(to)) left.set(to, leftAt(to) + n);
    if (early) {
      now.set(from, nowAt(from) - n);
      if (owned(to)) now.set(to, nowAt(to) + n);
    }
  };
  const take = (t: TerritoryId, n: number) => free.set(t, (free.get(t) ?? 0) - n);
  /** Spare troops standing there before the recruits run. */
  const orig = (t: TerritoryId) => Math.max(0, Math.min(free.get(t) ?? 0, nowAt(t) - garrison));
  /** Territories whose troops stay where they are (they hold the ring). */
  const holding = new Set<TerritoryId>();

  // Orders, by when they should play: before anything else; the masses; the sweeps; the blanket, last of all.
  const early: Queue = [];
  const mass: Queue = [];
  const sweep: Queue = [];
  const blanket: Queue = [];
  const order = (o: Order, from: TerritoryId, into: Queue) => into.push([o, from]);

  /**
   * March up to `need` spare troops to `gate` through land we command (nearest first, within `hops`), one order a hop,
   * deepest first so each hop's troops have arrived when it moves on. With `dry`, only works out what would arrive.
   * `early`: only troops standing there before the recruits run. `skipGate`: the gate's own troops don't count.
   */
  const gather = (gate: TerritoryId, need: number, into: Queue, opts: { dry?: boolean; hops?: number; skipGate?: boolean; early?: boolean; bold?: boolean; source?: (t: TerritoryId) => boolean } = {}): { got: number; parent: Map<TerritoryId, TerritoryId | null>; orders: Order[] } => {
    const spareAt = (t: TerritoryId) => (holding.has(t) || (opts.source && !opts.source(t)) ? 0 : opts.early ? orig(t) : (free.get(t) ?? 0));
    const parent = new Map<TerritoryId, TerritoryId | null>([[gate, null]]);
    const depth = new Map<TerritoryId, number>([[gate, 0]]);
    const q = [gate];
    const took = new Map<TerritoryId, number>();
    let got = 0;
    const here = !opts.skipGate && may(gate) ? Math.min(spareAt(gate), need) : 0;
    if (here > 0) (took.set(gate, here), (got += here));
    for (let h = 0; h < q.length && got < need; h++) {
      const cur = q[h]!;
      if (depth.get(cur)! >= (opts.hops ?? Infinity)) continue;
      for (const nb of [...idx.neighbors.get(cur)!].sort()) {
        if (parent.has(nb) || !may(nb) || closed(cur, nb)) continue;
        parent.set(nb, cur);
        depth.set(nb, depth.get(cur)! + 1);
        q.push(nb);
        const spare = spareAt(nb);
        if (spare > 0 && got < need) {
          const n = Math.min(spare, need - got);
          took.set(nb, n);
          got += n;
        }
      }
    }
    const made: Order[] = [];
    if (!got || opts.dry) return { got, parent, orders: made };
    const flow = new Map<TerritoryId, number>();
    for (const [t, n] of took) {
      take(t, n);
      for (let x: TerritoryId | null = t; x !== null && x !== gate; x = parent.get(x)!) flow.set(x, (flow.get(x) ?? 0) + n);
    }
    for (const [t, n] of [...flow].sort((a, c) => depth.get(c[0])! - depth.get(a[0])! || (a[0] < c[0] ? -1 : 1))) {
      // (A march into land they took on the way attacks it: the mass's marches whatever the odds, the others only if still stronger.)
      const o: Order = { id: id(), kind: "move", from: t, to: parent.get(t)!, troops: n, ...(opts.bold ? {} : { preset: { id: "onlyIfStronger" } }) };
      order(o, t, into);
      made.push(o);
      shift(t, parent.get(t)!, n, opts.early);
    }
    return { got, parent, orders: made };
  };
  const strike = (from: TerritoryId, x: TerritoryId, troops: number | "all", into: Queue, extra: Goes = {}) => {
    const o: Move = { id: id(), kind: "move", from, to: x, troops, preset: { id: "onlyIfStronger" }, ...extra };
    // The Initiative: only on a strike that's ready before anyone moves (the troops are already there).
    if (into === early && !result.usedInitiative && isArmy(x)) (o.timing = "first", (result.usedInitiative = true));
    order(o, from, into);
    if (typeof troops === "number") shift(from, x, troops, into === early);
    targeted.add(x);
    return o;
  };

  // ---------- The remnant's groups (their land, with land two steps apart counted together) ----------
  const groupOf = new Map<TerritoryId, number>();
  const groups: TerritoryId[][] = [];
  for (const t of theirs) {
    if (groupOf.has(t)) continue;
    const g: TerritoryId[] = [];
    const q = [t];
    groupOf.set(t, groups.length);
    while (q.length) {
      const cur = q.shift()!;
      g.push(cur);
      for (const nb of idx.neighbors.get(cur)!)
        for (const x of [nb, ...idx.neighbors.get(nb)!])
          if (theirs.includes(x) && !groupOf.has(x)) (groupOf.set(x, groups.length), q.push(x));
    }
    groups.push(g.sort());
  }
  const byArmy = (g: TerritoryId[]) => [...g].sort((x, y) => look(y).troops - look(x).troops || (x < y ? -1 : 1));
  const ranked = groups.map((g) => ({ g, army: byArmy(g) })).sort((x, y) => look(y.army[0]!).troops - look(x.army[0]!).troops || (x.army[0]! < y.army[0]! ? -1 : 1));
  const walkable = (t: TerritoryId) => {
    const o = look0(t);
    return !o || o === b.me.id || isTarget.has(o);
  };
  const near = (x: TerritoryId) => idx.neighbors.get(x)!.filter((g) => may(g) && !b.blocked(g, x) && !closed(g, x));

  // ---------- 1. Strikes ready now ----------
  for (const { army: list } of ranked)
    for (const x of list) {
      if (!isArmy(x)) continue;
      const g = near(x)
        .map((g) => ({ g, need: sure(g, x) }))
        .filter((e): e is { g: TerritoryId; need: number } => e.need !== null && orig(e.g) >= e.need)
        .sort((a, c) => a.need - c.need || (a.g < c.g ? -1 : 1))[0];
      if (!g) continue;
      take(g.g, g.need);
      strike(g.g, x, g.need, early);
    }

  /**
   * Where a group's armies could get to this turn: from each army (or recruit site), hop by hop through land of ours or
   * empty land, while what's left of it would likely take the next (1 left behind each hop), up to `reach` hops; and
   * next to any land of theirs. (Their armies move in the first rounds: what stands there then, before our recruits.)
   */
  const reachOf = (g: TerritoryId[]) => {
    const out = new Set<TerritoryId>();
    const best = new Map<TerritoryId, number>();
    const q: [TerritoryId, number, number][] = [];
    for (const x of g) {
      for (const nb of idx.neighbors.get(x)!) if (walkable(nb) && !isTarget.has(look0(nb) ?? "")) out.add(nb);
      if (isArmy(x)) q.push([x, look(x).troops - garrison + extraAt(x), 0]);
    }
    for (let h = 0; h < q.length; h++) {
      const [cur, strength, hops] = q[h]!;
      if (hops >= opt.reach) continue;
      for (const nb of idx.neighbors.get(cur)!) {
        if (!walkable(nb) || isTarget.has(look0(nb) ?? "") || closed(cur, nb)) continue;
        const stand = owned(nb) ? nowAt(nb) : look(nb).troops;
        const rest = Math.floor(strength - stand * 1.2) - garrison;
        if (rest <= 0 || (best.get(nb) ?? -1) >= rest) continue;
        best.set(nb, rest);
        out.add(nb);
        q.push([nb, rest, hops + 1]);
      }
    }
    return out;
  };

  // ---------- 2. Staging: where each group's mass gathers ----------
  // Next to its biggest army if troops close by can make it hold before their armies move (else they'd take it before
  // the mass arrives); otherwise a step back, the nearest land of ours they can't reach this turn. Among those, where
  // our spare troops are nearest on average (fewest marches).
  type Plan = { g: TerritoryId[]; army: TerritoryId[]; stage: TerritoryId | null; ring: boolean; reach: Set<TerritoryId> };
  const plans: Plan[] = [];
  for (const [i, r] of ranked.entries()) {
    const adjacent = near(r.army[0]!);
    const holdable = (t: TerritoryId) => nowAt(t) + gather(t, Math.max(0, b.holdNeed(t) - nowAt(t)), [], { dry: true, hops: 2, skipGate: true, early: true }).got >= b.holdNeed(t);
    let options = adjacent.filter(holdable);
    if (!options.length && adjacent.length) {
      const pre = reachOf(r.g);
      const d = new Map<TerritoryId, number>([[r.army[0]!, 0]]);
      const q = [r.army[0]!];
      for (let h = 0; h < q.length && !options.length; h++) {
        const cur = q[h]!;
        if (d.get(cur)! >= 4) break;
        for (const nb of [...idx.neighbors.get(cur)!].sort()) {
          if (d.has(nb) || !walkable(nb)) continue;
          d.set(nb, d.get(cur)! + 1);
          q.push(nb);
        }
        const ring = q.filter((t) => d.get(t) === d.get(cur)! + 1 && may(t) && !pre.has(t));
        if (ring.length) options = ring;
      }
    }
    if (!options.length) options = adjacent;
    if (!options.length) options = [...new Set(r.g.flatMap(near))];
    if (!options.length) {
      // Nothing of ours touches them: the territory of ours nearest them, through land we could walk.
      const d = new Set<TerritoryId>(r.g);
      const q = [...r.g];
      let found: TerritoryId | null = null;
      for (let h = 0; h < q.length && !found; h++)
        for (const nb of [...idx.neighbors.get(q[h]!)!].sort()) {
          if (d.has(nb) || !walkable(nb)) continue;
          d.add(nb);
          if (may(nb)) {
            found = nb;
            break;
          }
          q.push(nb);
        }
      options = found ? [found] : [];
    }
    const cost = (s: TerritoryId) => {
      const d = new Map<TerritoryId, number>([[s, 0]]);
      const q = [s];
      let sum = 0, n = 0;
      for (let h = 0; h < q.length; h++) {
        const cur = q[h]!;
        const f = free.get(cur) ?? 0;
        (sum += f * d.get(cur)!), (n += f);
        for (const nb of idx.neighbors.get(cur)!) if (may(nb) && !d.has(nb)) (d.set(nb, d.get(cur)! + 1), q.push(nb));
      }
      return n ? sum / n : 1e9;
    };
    const stage = options.map((s) => ({ s, c: cost(s) - (opt.leader && i === 0 && s === opt.leader.at ? 1 : 0) })).sort((a, c) => a.c - c.c || leftAt(c.s) - leftAt(a.s) || (a.s < c.s ? -1 : 1))[0]?.s ?? null;
    plans.push({ ...r, stage, ring: false, reach: new Set() });
  }

  // ---------- 3. The ring held, before their armies move ----------
  // Each territory of ours next to one of their armies (not struck yet), the staging territories first: troops step
  // in from up to two steps away, where that's enough to hold it; what it needs to hold stays there.
  const ringAt: TerritoryId[] = [];
  for (const p of plans) {
    for (const x of p.army) {
      if (!isArmy(x) || targeted.has(x)) continue;
      for (const g of near(x).sort((a, c) => Number(c === p.stage) - Number(a === p.stage) || (a < c ? -1 : 1))) if (!ringAt.includes(g)) ringAt.push(g);
    }
  }
  for (const g of ringAt) {
    const need = b.holdNeed(g);
    const short = need - nowAt(g);
    if (short > 0) {
      const reach = gather(g, short, [], { dry: true, hops: 2, skipGate: true, early: true }).got;
      if (reach >= short) gather(g, short, early, { hops: 2, skipGate: true, early: true });
      else if (!plans.some((p) => p.stage === g)) continue;
    }
    holding.add(g);
    // What it needs to hold stays; the rest may go.
    free.set(g, Math.max(0, Math.min(free.get(g) ?? 0, leftAt(g) - need)));
  }
  for (const p of plans) if (p.stage) holding.delete(p.stage);

  // ---------- 4. Where their armies could get to this turn (now the ring is held) ----------
  for (const p of plans) p.reach = reachOf(p.g);

  // ---------- 5. The ring for a small remnant we can strike everywhere at once ----------
  // (Not the biggest army's group: the main mass goes there, and a ring strike sized to what they could recruit would
  // only fall short of what they saved up.)
  for (const p of plans) {
    if (p === plans.find((q) => q.stage)) continue;
    const unstruck = p.g.filter((x) => !targeted.has(x));
    if (!unstruck.length || p.g.length > opt.ringUpTo) continue;
    const spare = new Map(free);
    p.ring = unstruck.every((x) => {
      const best = near(x)
        .map((g) => ({ g, need: sure(g, x) }))
        .filter((e): e is { g: TerritoryId; need: number } => e.need !== null)
        .map((e) => ({ ...e, reach: gather(e.g, e.need, [], { dry: true, hops: 12 }).got }))
        .filter((e) => e.reach >= e.need)
        .sort((a, c) => a.need - c.need || (a.g < c.g ? -1 : 1))[0];
      if (!best) return false;
      // (Count those troops as spoken for while checking the rest.)
      free.set(best.g, Math.max(0, (free.get(best.g) ?? 0) - best.need));
      return true;
    });
    for (const [t, n] of spare) free.set(t, n);
    if (!p.ring) continue;
    result.modes.push("ring");
    for (const x of byArmy(p.g)) {
      if (targeted.has(x)) continue;
      const best = near(x)
        .map((g) => ({ g, need: sure(g, x) }))
        .filter((e): e is { g: TerritoryId; need: number } => e.need !== null)
        .map((e) => ({ ...e, reach: gather(e.g, e.need, [], { dry: true, hops: 12 }).got }))
        .sort((a, c) => Number(c.reach >= c.need) - Number(a.reach >= a.need) || a.need - c.need || (a.g < c.g ? -1 : 1))[0];
      if (!best || best.reach < best.need) continue;
      strike(best.g, x, gather(best.g, best.need, mass, { hops: 12 }).got, sweep);
    }
  }

  // ---------- 6. The security blanket: transfers into our land they could reach, queued last ----------
  // Its troops come from land they can't reach (so the chain doesn't start from land they took), set aside before the
  // masses take everything; on the way in, each hop takes back whatever they took.
  const danger = new Set(plans.flatMap((p) => [...p.reach]));
  const blanketAt = [...danger]
    .filter((t) => may(t) && !holding.has(t) && !plans.some((p) => p.stage === t))
    .sort((a, c) => Number(idx.neighbors.get(c)!.some((x) => theirs.includes(x))) - Number(idx.neighbors.get(a)!.some((x) => theirs.includes(x))) || (a < c ? -1 : 1));
  if (opt.blanket > 0 && blanketAt.length) {
    // One flow for the whole blanket: a tree from the land they can't reach inward (each territory's parent is the
    // neighbour nearer the safe land), each blanket territory drawing its troops back along it from its own root.
    // One order a step, carrying everything that passes (shallowest first, so each hop's troops have arrived).
    const parent = new Map<TerritoryId, TerritoryId | null>();
    const root = new Map<TerritoryId, TerritoryId>();
    const depth = new Map<TerritoryId, number>();
    const q: TerritoryId[] = [];
    for (const t of b.mine)
      if (may(t) && !danger.has(t) && !holding.has(t) && (free.get(t) ?? 0) > 0) (parent.set(t, null), root.set(t, t), depth.set(t, 0), q.push(t));
    // (Safe land with no spare troops passes them on too.)
    for (let h = 0; h < q.length; h++)
      for (const nb of [...idx.neighbors.get(q[h]!)!].sort())
        if (may(nb) && !parent.has(nb) && !closed(q[h]!, nb)) (parent.set(nb, q[h]!), root.set(nb, root.get(q[h]!)!), depth.set(nb, depth.get(q[h]!)! + 1), q.push(nb));
    const flow = new Map<TerritoryId, number>();
    for (const t of blanketAt) {
      const r = root.get(t);
      if (!r || r === t) continue;
      const n = Math.min(opt.blanket, free.get(r) ?? 0);
      if (n <= 0) continue;
      take(r, n);
      for (let x: TerritoryId = t; parent.get(x); x = parent.get(x)!) flow.set(x, (flow.get(x) ?? 0) + n);
    }
    for (const [t, n] of [...flow].sort((a, c) => depth.get(a[0])! - depth.get(c[0])! || (a[0] < c[0] ? -1 : 1))) {
      order({ id: id(), kind: "move", from: parent.get(t)!, to: t, troops: n, preset: { id: "onlyIfStronger" } }, parent.get(t)!, blanket);
      shift(parent.get(t)!, t, n);
    }
  }

  // ---------- 7. The masses: the smaller groups first, each with what it needs; the main group gets the rest ----------
  // (The main group is the biggest army's, ringed or not: its mass sweeps on through every group's land.)
  const needOf = (p: Plan) => Math.ceil(p.g.reduce((a, x) => a + (isArmy(x) ? (sure(p.stage!, x) ?? look(x).troops * 3) : 2), 0) * 1.25) + p.reach.size;
  const main = plans.find((p) => p.stage) ?? null;
  for (const p of [...plans].reverse()) {
    if ((p.ring && p !== main) || !p.stage) continue;
    const want = p === main ? Infinity : Math.max(0, needOf(p) - leftAt(p.stage) + 1);
    // The Leader marches with the main mass: a troop comes from where it stands, so it has an army to go with.
    const L = p === main ? opt.leader : null;
    if (L && may(L.at) && L.at !== p.stage && (free.get(L.at) ?? 0) <= 0 && leftAt(L.at) > garrison && !holding.has(L.at)) free.set(L.at, 1);
    const got = want > 0 ? gather(p.stage, want, mass, { bold: true }) : null;
    if (!L) continue;
    if (L.at === p.stage) result.leaderPlaced = true;
    else if (got?.orders.some((o) => o.kind === "move" && o.from === L.at)) {
      const path = new Set<TerritoryId>();
      for (let x: TerritoryId | null | undefined = L.at; x && x !== p.stage; x = got.parent.get(x)) path.add(x);
      for (const o of got.orders) if (o.kind === "move" && path.has(o.from)) Object.assign(o, L.goes);
      result.leaderPlaced = true;
    }
  }
  // ---------- 8. The sweeps: one chain from each staging territory through everywhere they are and could get to ----------
  for (const p of plans) {
    if ((p.ring && p !== main) || !p.stage) continue;
    if (!p.ring) result.modes.push("sweep");
    result.staging.push(p.stage);
    const goes: Goes = p === main && result.leaderPlaced && opt.leader ? opt.leader.goes : {};
    const leader = !!goes.withLeader;
    // What the chain should still have, hop by hop (our best guess: losses on the way, 1 left in each territory).
    let strength = leftAt(p.stage) - garrison;
    // Everywhere they are and everywhere their armies could get to (the main mass: on through every group's land),
    // and on into land we've never seen that joins theirs (that's where the rest of them must be).
    const visit = new Set([...(p === main ? theirs : p.g), ...p.reach]);
    for (const t of [...visit]) {
      if (!isTarget.has(look0(t) ?? "")) continue;
      const q = [t];
      for (let h = 0; h < q.length; h++)
        for (const nb of idx.neighbors.get(q[h]!)!) if (unknown(nb) && !visit.has(nb)) (visit.add(nb), q.push(nb));
    }
    visit.delete(p.stage);
    // (What another strike has gone for is passed through, not struck again.)
    const done = new Set<TerritoryId>([...visit].filter((t) => targeted.has(t)));
    let at = p.stage;
    let hops = 0;
    const ofGroup = new Set(p.g);
    // Their armies first (this group's), then the nearest (their land before ours at the same distance).
    const rank = (t: TerritoryId) => (isArmy(t) && ofGroup.has(t) ? 0 : 1);
    while (strength > garrison && hops < 400) {
      const d = new Map<TerritoryId, number>([[at, 0]]);
      const prev = new Map<TerritoryId, TerritoryId>();
      const q = [at];
      const found: TerritoryId[] = [];
      const armiesLeft = [...visit].some((t) => !done.has(t) && rank(t) === 0);
      let nearest = Infinity;
      for (let h = 0; h < q.length; h++) {
        const cur = q[h]!;
        // (Nothing nearer is left to find once past the nearest: unless an army of theirs is still to be reached.)
        if (d.get(cur)! > nearest && !armiesLeft) break;
        if (cur !== at && visit.has(cur) && !done.has(cur)) {
          found.push(cur);
          nearest = Math.min(nearest, d.get(cur)!);
          if (armiesLeft && rank(cur) === 0) break;
          continue;
        }
        for (const nb of [...idx.neighbors.get(cur)!].sort()) {
          if (d.has(nb) || !walkable(nb) || b.blocked(cur, nb) || closed(cur, nb)) continue;
          // Through land we hold (ours, or swept already) to the next one: never through land not yet swept.
          if (!(owned(nb) || done.has(nb) || visit.has(nb))) continue;
          d.set(nb, d.get(cur)! + 1);
          prev.set(nb, cur);
          q.push(nb);
        }
      }
      if (!found.length) break;
      const next = found.sort((a, c) => rank(a) - rank(c) || Number(unknown(a)) - Number(unknown(c)) || d.get(a)! - d.get(c)! || Number(owned(a)) - Number(owned(c)) || look(c).troops - look(a).troops || (a < c ? -1 : 1))[0]!;
      const path: TerritoryId[] = [];
      for (let x: TerritoryId | undefined = next; x && x !== at; x = prev.get(x)) path.unshift(x);
      let from = at;
      let ok = true;
      for (const to of path) {
        hops++;
        if (!owned(to) && !done.has(to)) {
          let e = b.expectAt(from, to, strength, [], leader, extraAt(to));
          const need = sure(from, to, leader);
          if (!e.captureLikely || need === null || strength < need) {
            if (!isArmy(to)) {
              ok = false;
              break;
            }
            // Too big for now: struck only if it marches out (as it would leave it: one troop).
            e = b.expectAt(from, to, strength, [], leader, garrison - look(to).troops);
          }
          strike(from, to, "all", sweep, goes);
          strength = Math.floor(strength - e.expectedAttackerLosses) - garrison;
          done.add(to);
        } else {
          order({ id: id(), kind: "move", from, to, troops: "all", preset: { id: "onlyIfStronger" }, ...goes }, from, sweep);
          if (owned(to)) targeted.add(to);
          strength -= garrison;
        }
        from = to;
      }
      at = from;
      if (!ok) {
        // Too strong for what's left: that territory waits for next turn, and the chain goes on from where it stands.
        visit.delete(next);
        continue;
      }
      done.add(next);
    }
  }

  // Into the queue: the early orders first of all, then the masses, the sweeps and the blanket.
  for (const [o, from] of early) army(o, from, true);
  for (const [o, from] of [...mass, ...sweep, ...blanket]) army(o, from);
  return result;
}

import type { BorderType, SpecialistType } from "@conquerra/content";
import {
  covers,
  distancesFrom,
  expectBattle,
  fewestToTake,
  indexMap,
  previewAttack,
  type GameContext,
  type Order,
  type PlayerId,
  type PlayerView,
  type ReplayEvent,
  type TerritoryDetail,
  type TerritoryId,
} from "@conquerra/engine";

export type Seen = TerritoryDetail & { detail: "full" };
/** What a territory probably holds (what we see, or our best guess for land in the fog). */
export type Guess = Pick<Seen, "owner" | "troops" | "building" | "culture" | "leaders" | "capitalOf"> & { specialists: SpecialistType[] };

/** The Captain's priorities, each of which the simulator can switch off to measure what it's worth. */
export type CaptainFeature = "chokes" | "breakthrough" | "focus" | "capital" | "forts" | "culture" | "runaway" | "raider" | "spies";

export interface CaptainOptions {
  /** Chain on when the army that should arrive is at least this many times what the next hop needs. */
  chainMargin: number;
  /** Priorities switched off (simulator experiments only). */
  off?: readonly CaptainFeature[];
  /** Simulator tuning of priority 8: the share of the land that marks a runaway leader, and the lead over anyone else. */
  runawayShare?: number;
  runawayLead?: number;
}

/** Tuned in the simulator (docs/sim-results-m3-bots.md): hop on when the next hop is comfortably likely to win. */
export const CAPTAIN_CHAIN_MARGIN = 1.25;
/** Attacking through a pass or across a sea lane: gather at least this many times what the attack needs. */
export const BREAKTHROUGH_MARGIN = 1.5;
/** A rival with this little land (as far as we know) is worth finishing off. */
export const WEAK_RIVAL_LAND = 3;
export const MAX_HOPS = 4;
/** Unexplored land is guessed as a neutral with this many troops (they start with 1). */
const UNEXPLORED_GUESS = 2;
/** At the end of a chain, this many spare troops add Follow through (one more push, wherever looks weakest then). */
const FOLLOW_THROUGH_SPARE = 6;
/** A runaway leader (priority 8): it looks to hold this share of the land, or at least RUNAWAY_MIN_SHARE and this many times anyone else. */
const RUNAWAY_SHARE = 0.4;
const RUNAWAY_MIN_SHARE = 0.25;
const RUNAWAY_LEAD = 1.75;
/** A fast attacker (priority 9): it took at least this many of our territories last turn. */
const RAID_CAPTURES = 2;

/** Land each living player holds as far as we know, most first (ties by id). */
export function landEstimates(known: ReadonlyMap<PlayerId, number>, living: readonly PlayerId[]): [PlayerId, number][] {
  const alive = new Set(living);
  return [...known].filter(([p]) => alive.has(p)).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
}

/**
 * Priority 8's judgement: a rival running away with the map looks to hold RUNAWAY_SHARE of the land, or at least
 * RUNAWAY_MIN_SHARE and RUNAWAY_LEAD times anyone else (`ownLand`: the judge's own, 0 for the Fallen). Only with at
 * least three players left. The Fallen bots use the same judgement to pick whom to shake.
 */
export function runawayLeader(estimates: readonly [PlayerId, number][], ownLand: number, total: number, aliveCount: number, opts: Pick<CaptainOptions, "runawayShare" | "runawayLead"> = {}): PlayerId | null {
  const [top, topLand] = estimates[0] ?? [null, 0];
  const runnerUp = Math.max(ownLand, estimates[1]?.[1] ?? 0);
  return top && aliveCount >= 3 && (topLand >= (opts.runawayShare ?? RUNAWAY_SHARE) * total || (topLand >= RUNAWAY_MIN_SHARE * total && topLand >= (opts.runawayLead ?? RUNAWAY_LEAD) * runnerUp)) ? top : null;
}

/**
 * What another bot can tell the board instead of the Captain's own reading (session 17: the Marshal estimates land it
 * can't see and names a runaway its own way, from the same view and what it remembers). Left out, the Captain's.
 */
export interface BoardOverrides {
  knownLand?: ReadonlyMap<PlayerId, number>;
  runaway?: PlayerId | null;
}

/**
 * Everything the Captain works out from one seat's view before it decides anything: what it sees and remembers, who
 * it borders, who it's focused on, how many troops each place needs to hold, what an attack would cost and what land
 * is worth. Generals (generals.ts) read the board the same way, so they judge exactly as the Captain does, and only
 * from their owner's view. Null if the seat holds no land.
 */
export function readBoard(ctx: GameContext, view: PlayerView, opts: CaptainOptions, lastTurn?: readonly ReplayEvent[], overrides: BoardOverrides = {}) {
  const { rules } = ctx;
  const idx = indexMap(ctx.map);
  const me = view.me;
  const garrison = rules.setup.minGarrison;
  const on = (f: CaptainFeature) => !opts.off?.includes(f);

  const seen = (t: TerritoryId): Seen | null => {
    const v = view.territories[t];
    return v && v.detail === "full" ? v : null;
  };
  const owned = (t: TerritoryId) => seen(t)?.owner === me.id;
  const rivalAt = (t: TerritoryId): PlayerId | null => {
    const v = seen(t);
    return v && v.owner !== null && v.owner !== me.id ? v.owner : null;
  };
  const troopsAt = (t: TerritoryId) => seen(t)?.troops ?? 0;
  const specsAt = (t: TerritoryId): SpecialistType[] => seen(t)?.specialists.map((s) => s.type) ?? [];
  const mine = idx.ids.filter(owned);
  if (!mine.length) return null;
  const border = (a: TerritoryId, b: TerritoryId): BorderType => idx.border(a, b) ?? "normal";
  const crossing = (a: TerritoryId, b: TerritoryId) => {
    const k = border(a, b);
    return k === "pass" || k === "sea";
  };
  const isFrontier = (t: TerritoryId) => idx.neighbors.get(t)!.some((x) => !owned(x));
  const frontier = mine.filter(isFrontier);
  const enemyPressure = (t: TerritoryId) => idx.neighbors.get(t)!.reduce((a, x) => a + (rivalAt(x) ? troopsAt(x) : 0), 0);
  const biggestEnemyNear = (t: TerritoryId) => idx.neighbors.get(t)!.reduce((a, x) => Math.max(a, rivalAt(x) ? troopsAt(x) : 0), 0);

  // ---------- The picture: who's left, who we border, who to finish ----------
  const alive = view.players.filter((p) => p.eliminatedTurn === null);
  /** Who holds `t` as far as we know: what we see, else what we last saw. */
  const look0 = (t: TerritoryId): PlayerId | null => {
    const v = view.territories[t]!;
    return v.detail === "full" ? v.owner : (v.lastSeen?.owner ?? null);
  };
  /** Land each rival holds as far as we know: what we see, plus what we last saw. */
  const counted = new Map<PlayerId, number>();
  for (const t of idx.ids) {
    const o = look0(t);
    if (o && o !== me.id) counted.set(o, (counted.get(o) ?? 0) + 1);
  }
  const knownLand: ReadonlyMap<PlayerId, number> = overrides.knownLand ?? counted;
  const facing = new Map<PlayerId, number>();
  for (const f of frontier) for (const nb of idx.neighbors.get(f)!) {
    const r = rivalAt(nb);
    if (r) facing.set(r, (facing.get(r) ?? 0) + troopsAt(nb));
  }
  const endgame = alive.length <= 3;
  const weakest = [...facing.keys()].sort((a, b) => (knownLand.get(a) ?? 0) - (knownLand.get(b) ?? 0) || facing.get(a)! - facing.get(b)! || (a < b ? -1 : 1))[0] ?? null;

  // 8. A rival running away with the map. Nobody shows land counts, so we estimate from what we see and remember:
  // it looks to hold RUNAWAY_SHARE of the land, or far more than anyone else (us included). Only with at least two
  // rivals left (head to head, the other player is always the target anyway). The same rule for every seat.
  const estimates = landEstimates(knownLand, alive.map((p) => p.id));
  const runaway = "runaway" in overrides ? (overrides.runaway ?? null) : on("runaway") ? runawayLeader(estimates, mine.length, idx.ids.length, alive.length, opts) : null;
  /** Rivals whose land touches the runaway's: they're holding it off, so weakening them only helps it. */
  const shieldsLeader = new Set<PlayerId>();
  if (runaway)
    for (const t of idx.ids) {
      if (look0(t) !== runaway) continue;
      for (const nb of idx.neighbors.get(t)!) {
        const o = look0(nb);
        if (o && o !== runaway && o !== me.id) shieldsLeader.add(o);
      }
    }

  // 9. A rival chaining through our border: in last turn's replay (what we watched, nothing more) it took several of
  // our territories. Like a person, we turn on it: it becomes our target (its chain is thinly held), and we hold that
  // front and its choke points before expanding elsewhere.
  const raids = new Map<PlayerId, number>();
  for (const e of lastTurn ?? [])
    if (e.type === "battle" && e.captured && e.player !== me.id && e.defender === me.id) raids.set(e.player, (raids.get(e.player) ?? 0) + 1);
  const raider = on("raider")
    ? ([...raids].filter(([p, k]) => k >= RAID_CAPTURES && facing.has(p)).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? null)
    : null;
  const facesRival = (t: TerritoryId, r: PlayerId) => idx.neighbors.get(t)!.some((x) => rivalAt(x) === r);
  const facesRaider = (t: TerritoryId) => !!raider && facesRival(t, raider);

  /**
   * The rival we concentrate on: the runaway leader if we border it; else a rival that just took several of our
   * territories; else a weakened neighbour, or in the endgame the weakest one we border (but never a weak rival
   * that's holding off a runaway leader).
   */
  const focus =
    runaway && facing.has(runaway)
      ? runaway
      : raider
        ? raider
        : on("focus") && weakest && (endgame || (knownLand.get(weakest) ?? 0) <= WEAK_RIVAL_LAND) && !shieldsLeader.has(weakest)
        ? weakest
        : null;
  /** The focused rival's capital, if we've seen it, and how far every territory is from it. */
  const focusCapital = focus ? (idx.ids.find((t) => seen(t)?.capitalOf === focus) ?? null) : null;
  const toFocusCapital = focusCapital ? distancesFrom(idx, focusCapital) : null;
  /** How hard the focused rival's armies next to `t` are to beat (troops x terrain x fort). */
  const opposition = (t: TerritoryId) =>
    idx.neighbors.get(t)!.reduce((m, x) => {
      if (rivalAt(x) !== focus) return m;
      const v = seen(x)!;
      return Math.max(m, v.troops * rules.terrain[idx.byId.get(x)!.terrain].defenseMult * (v.building === "fort" ? rules.buildings.fort.defenseMult : 1));
    }, 0);
  /**
   * In the endgame, one spearhead: the front facing the focused rival where its armies are weakest, nearer its
   * capital breaking ties. Reinforcements go there instead of being spread along every front (and never pile up in
   * front of a fort they can't break).
   */
  const spearhead = endgame && focus
    ? (frontier
        .filter((t) => idx.neighbors.get(t)!.some((x) => rivalAt(x) === focus))
        .map((t) => ({ t, score: opposition(t) + 3 * (toFocusCapital?.get(t) ?? 0) }))
        .sort((a, b) => a.score - b.score || (a.t < b.t ? -1 : 1))[0]?.t ?? null)
    : null;

  /**
   * Walls (session 20b): everyone who'd defend `t` if it were attacked now (its troops plus what its wall lends), when
   * it's part of a wall we can see; null otherwise. The engine shows a wall's shared garrison to anyone who sees part of it.
   */
  const wallDefend = (t: TerritoryId): number | null => view.walls?.find((w) => w.territories.includes(t))?.defend[t] ?? null;
  /** Troops needed in `t` so that no rival army we can see next to it is likely to take it (crossings, terrain, fort and Leaders count). */
  const needCache = new Map<TerritoryId, number>();
  const holdNeed = (t: TerritoryId): number => {
    const hit = needCache.get(t);
    if (hit !== undefined) return hit;
    const v = seen(t)!;
    let need = garrison;
    for (const nb of idx.neighbors.get(t)!) {
      const r = rivalAt(nb);
      if (!r) continue;
      const e = seen(nb)!;
      const attackers = e.troops - garrison;
      if (attackers <= 0) continue;
      const takes = (defenders: number) =>
        expectBattle(rules, {
          attackers,
          attackerSpecialists: e.specialists.map((s) => s.type),
          attackerLeader: e.leaders.includes(r),
          defenders,
          defenderSpecialists: v.specialists.map((s) => s.type),
          defenderLeader: v.leaders.includes(me.id),
          terrain: idx.byId.get(t)!.terrain,
          building: v.building,
          culture: v.culture,
          border: border(nb, t),
          luck: view.settings.luck,
        }).captureLikely;
      let lo = 1, hi = attackers * 3 + 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (takes(mid)) lo = mid + 1;
        else hi = mid;
      }
      // Our wall's lenders stand with it (session 20b): only the rest has to be here.
      const lent = owned(t) ? Math.max(0, (wallDefend(t) ?? 0) - v.troops) : 0;
      need = Math.max(need, lo - lent);
    }
    needCache.set(t, need);
    return need;
  };
  /** A choke point we hold: every rival next to it is across a pass or a sea lane. */
  const chokeHolder = (t: TerritoryId) => {
    if (!on("chokes")) return false;
    const rivals = idx.neighbors.get(t)!.filter((nb) => rivalAt(nb));
    return rivals.length > 0 && rivals.every((nb) => crossing(t, nb));
  };
  const capital = owned(me.capital) ? me.capital : null;
  // 5. A big army next to the capital: hold it.
  const capThreatened = on("capital") && !!capital && holdNeed(capital) >= troopsAt(capital) && biggestEnemyNear(capital) > garrison;

  /**
   * What we expect to find in `t`, the way a player would guess: what we see; else what we last saw there (a rival
   * army grows a little for each turn since); else an untouched neutral. Used to plan hops into the fog. Every hop
   * keeps "Only if still stronger", so the engine checks the real odds when it plays, by which time the land is in view.
   */
  const look = (t: TerritoryId): Guess => {
    const v = view.territories[t]!;
    if (v.detail === "full") return { owner: v.owner, troops: v.troops, specialists: v.specialists.map((s) => s.type), building: v.building, culture: v.culture, leaders: v.leaders, capitalOf: v.capitalOf };
    const last = v.lastSeen;
    if (last) return { owner: last.owner, troops: last.troops + (last.owner ? 2 * Math.max(1, view.turn - last.turn) : 0), specialists: [], building: last.building, culture: 0, leaders: [], capitalOf: null };
    return { owner: null, troops: UNEXPLORED_GUESS, specialists: [], building: null, culture: 0, leaders: [], capitalOf: null };
  };
  /** The odds of `troops` (with these specialists, and our Leader if it goes) taking `to` from `from`, on our best guess of what's there (and `extraDefenders` more). */
  const expectAt = (from: TerritoryId, to: TerritoryId, troops: number, specs: readonly SpecialistType[], leader = false, extraDefenders = 0) => {
    const g = look(to);
    return expectBattle(rules, {
      attackers: troops,
      attackerSpecialists: specs,
      attackerLeader: leader,
      // A walled target: its whole shared garrison (session 20b).
      defenders: (wallDefend(to) ?? g.troops) + extraDefenders,
      defenderSpecialists: g.specialists,
      defenderLeader: !!g.owner && g.leaders.includes(g.owner),
      terrain: idx.byId.get(to)!.terrain,
      building: g.building,
      culture: g.culture,
      border: border(from, to),
      luck: view.settings.luck,
    });
  };
  const valueOf = (t: TerritoryId): number => {
    const v = look(t);
    const def = idx.byId.get(t)!;
    // Culture is lost when land changes hands (session 16): taking it only denies the rival what it invested.
    let val = 1 + rules.terrain[def.terrain].income + (v.owner && v.owner !== me.id ? v.culture * 0.25 : 0);
    const prov = ctx.map.provinces.find((p) => p.id === def.province)!;
    const missing = (idx.provinceMembers.get(prov.id) ?? []).filter((m) => !owned(m)).length;
    if (missing === 1) val += prov.bonus * 2;
    else if (missing === 2) val += prov.bonus;
    if (v.building) val += 2;
    // Our own capital, taken from us: take it back.
    if (t === me.capital) val += 10;
    if (v.owner && v.owner !== me.id) {
      val += 2;
      if (v.leaders.includes(v.owner)) val += 3;
      // 4. A rival's capital, and the land of a rival we're finishing off.
      if (v.capitalOf === v.owner) val += 8;
      if ((knownLand.get(v.owner) ?? 0) <= WEAK_RIVAL_LAND) val += 4;
      if (v.owner === focus) val *= 2;
      // In the endgame, land of other rivals is worth less: no trading land back and forth with everyone.
      else if ((endgame || runaway) && focus) val *= 0.5;
    }
    // On the way to the focused rival's capital.
    if (toFocusCapital && (toFocusCapital.get(t) ?? 99) <= 2) val += 4;
    return val;
  };
  /**
   * Would `troops` of ours standing in `at` likely be thrown out by a rival army next to it (on our best guess of
   * what's there, terrain and Leaders counted)? For not leaving an army somewhere it can't hold.
   */
  const exposed = (at: TerritoryId, troops: number) =>
    idx.neighbors.get(at)!.some((x) => {
      const g = look(x);
      if (!g.owner || g.owner === me.id || g.troops - garrison <= 0) return false;
      return expectBattle(rules, {
        attackers: g.troops - garrison,
        attackerSpecialists: g.specialists,
        attackerLeader: g.leaders.includes(g.owner),
        defenders: Math.max(1, Math.floor(troops)),
        defenderSpecialists: [],
        defenderLeader: false,
        terrain: idx.byId.get(at)!.terrain,
        building: look(at).building,
        culture: look(at).culture,
        border: border(x, at),
        luck: view.settings.luck,
      }).captureLikely;
    });
  /** Fewest troops from `avail` likely to take `to` from `from` (with a small safety margin), or null. */
  const needFor = (from: TerritoryId, to: TerritoryId, avail: number, specs = specsAt(from), withLeader = false) =>
    fewestToTake((troops) => previewAttack(ctx, view, { from, to, troops, specialists: specs, ...(withLeader ? { withLeader } : {}) })?.captureLikely ?? false, avail);

  /**
   * A rival we'd like a front with (right of passage, session 15): the runaway leader, our target, a fast attacker, a
   * rival we could finish off, or anyone in the endgame.
   */
  const wantsFront = (p: PlayerId | null): p is PlayerId =>
    !!p && p !== me.id && alive.some((x) => x.id === p) && (p === runaway || p === focus || p === raider || endgame || (knownLand.get(p) ?? 0) <= WEAK_RIVAL_LAND) && !shieldsLeader.has(p);

  // Deals (session 14): an attack across a truce (or a joint war's truce) of ours, as far as we know who holds what.
  const ours = (view.deals ?? []).filter((d) => d.terms && (d.kind === "truce" || d.kind === "war"));
  const blocked = (from: TerritoryId, to: TerritoryId) => ours.length > 0 && ours.some((d) => covers(idx, d as Parameters<typeof covers>[1], from, to, look0));

  return {
    ctx, view, rules, idx, me, garrison, on, blocked,
    seen, owned, rivalAt, troopsAt, specsAt, mine, border, crossing, isFrontier, frontier, enemyPressure, biggestEnemyNear,
    alive, look0, knownLand, facing, endgame, runaway, shieldsLeader, raider, facesRival, facesRaider, wantsFront,
    focus, toFocusCapital, spearhead, holdNeed, chokeHolder, capital, capThreatened, look, expectAt, valueOf, needFor, exposed, wallDefend,
  };
}

export type Board = NonNullable<ReturnType<typeof readBoard>>;

/** One attack the chain starts from: its order, where it goes from and to, and how many it sends. */
export interface ChainStart {
  order: Order;
  from: TerritoryId;
  to: TerritoryId;
  troops: number;
  /** A march through a partner's land: the last of it, where the attack comes from. */
  attackFrom?: TerritoryId;
}

/**
 * 6. Chain on from where an attack should arrive, while the next hop is comfortably likely to win (into the fog
 * too, on our best guess of what's there), at most MAX_HOPS hops in all. Plenty left at the end: Follow through
 * pushes on once more. `allowed` and `value` say which neighbours a hop may go to and which is best (the Captain: any
 * land it doesn't hold, by what it's worth; a general: land on its way). `extra` goes on every hop (a general's
 * Leader goes along). New orders go to `push`, each hop's target to `targeted`.
 */
export function chainOn(
  b: Board,
  first: ChainStart,
  targeted: Set<TerritoryId>,
  margin: number,
  newId: () => string,
  push: (o: Order) => void,
  pick: {
    allowed?: (from: TerritoryId, to: TerritoryId) => boolean;
    value?: (t: TerritoryId) => number;
    leader?: boolean;
    extra?: Partial<Order>;
    /** A hop only goes where what arrives would be safe (a general's army doesn't stop next to a bigger one). */
    safe?: (to: TerritoryId, arriving: number) => boolean;
    /** Hops in all, and the spare troops that add Follow through (the Marshal's personalities; else MAX_HOPS and FOLLOW_THROUGH_SPARE). */
    maxHops?: number;
    followThroughSpare?: number;
    /**
     * Session 20c: defensible pauses. If the chain would end where `ok` says it can't stay (with what would arrive),
     * it ends instead at its last hop where it can (at most `back` hops back).
     */
    pause?: { back: number; ok: (t: TerritoryId, arriving: number) => boolean };
  } = {},
) {
  const { idx, garrison, owned, look, shieldsLeader, me, crossing, expectAt, specsAt } = b;
  const value = pick.value ?? b.valueOf;
  const specs = specsAt(first.from);
  let from = first.to, sent = first.troops, prevFrom = first.attackFrom ?? first.from, last = first.order;
  /** With pauses, the hops wait here until the chain's end is known (each with where it stood before it). */
  const held: { order: Order; from: TerritoryId; prevFrom: TerritoryId; sent: number; last: Order }[] = [];
  const push0 = push;
  if (pick.pause) push = (o: Order) => held.push({ order: o, from, prevFrom, sent, last });
  for (let hop = 0; hop < (pick.maxHops ?? MAX_HOPS) - 1; hop++) {
    const e = expectAt(prevFrom, from, sent, specs, pick.leader);
    if (!e.captureLikely) break;
    const avail = Math.floor(sent - e.expectedAttackerLosses) - garrison;
    if (avail <= 0) break;
    let best: { to: TerritoryId; value: number } | null = null;
    for (const nb of idx.neighbors.get(from)!) {
      const owner = look(nb).owner;
      if (owned(nb) || owner === me.id || targeted.has(nb) || (owner && shieldsLeader.has(owner)) || b.blocked(from, nb)) continue;
      if (pick.allowed && !pick.allowed(from, nb)) continue;
      const need = fewestToTake((troops) => expectAt(from, nb, troops, specs, pick.leader).captureLikely, avail);
      const m = crossing(from, nb) ? Math.max(margin, BREAKTHROUGH_MARGIN) : margin;
      if (need === null || avail < need * m) continue;
      if (pick.safe && !pick.safe(nb, avail - expectAt(from, nb, avail, specs, pick.leader).expectedAttackerLosses)) continue;
      const v = value(nb);
      if (!best || v > best.value || (v === best.value && nb < best.to)) best = { to: nb, value: v };
    }
    if (!best) break;
    const o = { id: newId(), kind: "move", from, to: best.to, troops: "all", preset: { id: "onlyIfStronger" }, ...(pick.extra ?? {}) } as Order;
    push(o);
    last = o;
    targeted.add(best.to);
    prevFrom = from;
    from = best.to;
    sent = avail;
  }
  if (pick.pause) {
    // Where would it stop? Back to the last hop it could hold (no further than `back`); else as planned.
    const arriving = (f: TerritoryId, t: TerritoryId, n: number) => Math.floor(n - expectAt(f, t, n, specs, pick.leader).expectedAttackerLosses);
    let keep = held.length;
    if (!pick.pause.ok(from, arriving(prevFrom, from, sent)))
      for (let k = held.length - 1; k >= Math.max(0, held.length - pick.pause.back); k--) {
        const h = held[k]!;
        // Ending at h.from (the chain before hop k): the first attack's target, or an earlier hop's.
        if (pick.pause.ok(h.from, arriving(h.prevFrom, h.from, h.sent))) {
          keep = k;
          break;
        }
      }
    for (const h of held.slice(keep)) targeted.delete((h.order as { to: TerritoryId }).to);
    for (const h of held.slice(0, keep)) push0(h.order);
    if (keep < held.length) {
      const h = held[keep]!;
      (from = h.from), (prevFrom = h.prevFrom), (sent = h.sent), (last = h.last);
    }
  }
  const end = expectAt(prevFrom, from, sent, specs, pick.leader);
  if (end.captureLikely && Math.floor(sent - end.expectedAttackerLosses) - garrison >= (pick.followThroughSpare ?? FOLLOW_THROUGH_SPARE)) {
    last.preset = { id: "followThrough" };
    last.conditions = [{ kind: "odds", atLeast: "likely" }];
  }
}

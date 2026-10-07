import type { MarshalJudgement, Personality, SpecialistType } from "@conquerra/content";
import { fewestToTake, investCost, isRecruitSiteIn, passageFor, Rng, seedRng, type GameContext, type Order, type PlayerId, type PlayerView, type ReplayEvent, type TerritoryId } from "@conquerra/engine";
import { BREAKTHROUGH_MARGIN, chainOn, readBoard, type Board, type CaptainOptions } from "../board";
import { captainSpoils, missionPull, missionSpend, spoilsOrder } from "../cards";
import { respectDeals, withoutDeals } from "../diplomacy";
import { captainSpies } from "../spies";
import { think, type Insight } from "./judge";
import type { MarshalMemory } from "./memory";
import { marshalBreaks } from "./talk";

/**
 * What the Marshal's planner is asked to plan (session 17; session 18's leaders call it with a scope and a purse):
 *  - the whole realm (a Marshal bot's turn);
 *  - one army: the stack in `at` (its attack and the chain on from it, or where it marches);
 *  - one front: every army on our land facing `rival` (their attacks and chains);
 *  - the realm's building: spending only (troops, buildings, culture, specialists, spies).
 */
export type MarshalScope = { kind: "realm" } | { kind: "army"; at: TerritoryId } | { kind: "front"; rival: PlayerId } | { kind: "build" };

export interface MarshalRequest {
  ctx: GameContext;
  view: PlayerView;
  personality: Personality;
  judgement: MarshalJudgement;
  memory: MarshalMemory;
  lastTurn?: readonly ReplayEvent[];
  /** What to plan (the whole realm by default). */
  scope?: MarshalScope;
  /** Gold it may spend (the treasury by default). */
  purse?: number;
}

export interface MarshalPlan {
  orders: Order[];
  /** The memory to keep for next turn (this turn taken in). */
  memory: MarshalMemory;
  insight: Insight;
}

/** Where each order came from, so a scope can keep just its part: spending, or an army (the territory it set out from). */
type Source = { spend: true } | { army: TerritoryId };

/** The Captain's own settings the Marshal shares (its priorities 1 to 9 all on). */
const BASE: CaptainOptions = { chainMargin: 1.25 };

/** A rival's land in a joint war we're part of is worth this much more (we actually attack). */
const WAR_PULL = 1.6;
/** The runaway leader's land is worth this much more to every Marshal (on top of the Captain's priority 8). */
const LEADER_PULL = 1.4;
/** One-front play: a rival that isn't the main target is worth this much (it still takes cheap land). */
const OFF_FRONT = 0.45;

/**
 * The Marshal (session 17): the hard level. It reads the board like the Captain (`readBoard`), with its own estimate of
 * land it can't see and its own runaway rule (memory.ts, judge.ts), and plays the Captain's priorities in its
 * personality's style: how far it chains, what it keeps back, what it builds, when it strikes, whom it hits. Every
 * personality plays by the same rules and gold. It only ever reads its own view, its memory and what it watched.
 */
export function planMarshal(req: MarshalRequest): MarshalPlan {
  const { ctx, personality: P, judgement, lastTurn } = req;
  const { insight, memory } = think(ctx, req.view, judgement, req.memory, lastTurn);
  const scope = req.scope ?? { kind: "realm" };
  // Deals: it keeps its word unless breaking a handshake deal clearly pays, by its own measure (the Schemer's is lower).
  const breaks = scope.kind === "realm" ? marshalBreaks(ctx, req.view, P, insight, lastTurn) : [];
  const view = withoutDeals(req.view, breaks.map((o) => (o.kind === "break" ? o.deal : "")));
  const sources = new Map<string, Source>();
  const moves = planMoves(ctx, view, P, insight, lastTurn, req.purse ?? view.me.gold, sources);
  const kept = moves.filter((o) => inScope(scope, sources.get(o.id), view, ctx));
  return { orders: [...breaks, ...respectDeals(ctx, view, kept)], memory, insight };
}

function inScope(scope: MarshalScope, src: Source | undefined, view: PlayerView, ctx: GameContext): boolean {
  if (scope.kind === "realm") return true;
  if (!src) return false;
  if (scope.kind === "build") return "spend" in src;
  if ("spend" in src) return false;
  if (scope.kind === "army") return src.army === scope.at;
  // A front: the army sets out from our land next to the rival's (as far as we know).
  const nbs = ctx.map.borders.flatMap((b) => (b.a === src.army ? [b.b] : b.b === src.army ? [b.a] : []));
  return nbs.some((t) => {
    const v = view.territories[t];
    return (v?.detail === "full" ? v.owner : v?.lastSeen?.owner) === scope.rival;
  });
}

/** The Marshal's board: the Captain's reading, with its own land estimates and runaway. */
export function marshalBoard(ctx: GameContext, view: PlayerView, insight: Insight, lastTurn?: readonly ReplayEvent[]): Board | null {
  const knownLand = new Map([...insight.est].map(([p, n]) => [p, Math.round(n)]));
  return readBoard(ctx, view, BASE, lastTurn, { knownLand, runaway: insight.runaway });
}

function planMoves(ctx: GameContext, view: PlayerView, P: Personality, insight: Insight, lastTurn: readonly ReplayEvent[] | undefined, purse: number, sources: Map<string, Source>): Order[] {
  const b = marshalBoard(ctx, view, insight, lastTurn);
  if (!b) return [];
  const { rules, idx, me, garrison, seen, owned, rivalAt, troopsAt, specsAt, mine, crossing, isFrontier, frontier, enemyPressure, biggestEnemyNear } = b;
  const { endgame, raider, runaway, shieldsLeader, facesRival, facesRaider, holdNeed, chokeHolder, capital, capThreatened, needFor } = b;
  const A = P.attack, D = P.defend, B = P.build;
  const rng = new Rng(seedRng(`${view.gameId}|${me.id}|${view.turn}|marshal`));
  const orders: Order[] = [];
  let n = 0;
  const id = () => `${me.id}-t${view.turn}-m${n++}`;
  const spend = (o: Order) => (orders.push(o), sources.set(o.id, { spend: true }));
  const army = (o: Order, from: TerritoryId) => (orders.push(o), sources.set(o.id, { army: from }));
  const calm = A.strikeTurn > 0 && view.turn < A.strikeTurn && !capThreatened;

  // ---------- Whom it's after ----------
  // Its main target: the runaway leader if it borders it, a joint war's target it borders, a rival raiding it, the
  // Captain's focus; for a one-front personality (once it strikes), the rival it faces that's easiest to beat.
  const facingTroops = (r: PlayerId) => b.facing.get(r) ?? 0;
  const oursFacing = (r: PlayerId) => frontier.filter((t) => facesRival(t, r)).reduce((a, t) => a + troopsAt(t), 0);
  const warTarget = [...insight.warTargets].find((r) => b.facing.has(r)) ?? null;
  let main: PlayerId | null = runaway && b.facing.has(runaway) ? runaway : warTarget ?? raider ?? b.focus;
  const atPeace = (r: PlayerId) => view.deals.some((d) => (d.kind === "truce" || d.kind === "war") && ((d.a === me.id && d.b === r) || (d.b === me.id && d.a === r)));
  if (!main && A.oneFront && !calm)
    main =
      [...b.facing.keys()]
        .filter((r) => !shieldsLeader.has(r) && !atPeace(r))
        .sort((x, y) => oursFacing(y) / Math.max(1, facingTroops(y)) - oursFacing(x) / Math.max(1, facingTroops(x)) || (x < y ? -1 : 1))[0] ?? null;
  const facesMain = (t: TerritoryId) => !!main && facesRival(t, main);
  /** One spearhead on the main front (one-front play, and the endgame): where the main rival's armies are weakest. */
  const opposition = (t: TerritoryId) => idx.neighbors.get(t)!.reduce((m, x) => (rivalAt(x) === main ? Math.max(m, troopsAt(x)) : m), 0);
  const spearhead = main && (A.oneFront || endgame) && !calm ? (frontier.filter(facesMain).sort((x, y) => opposition(x) - opposition(y) || (x < y ? -1 : 1))[0] ?? null) : null;
  const value = (t: TerritoryId) => {
    let v = b.valueOf(t);
    const owner = b.look(t).owner;
    if (owner && owner !== me.id) {
      if (owner === runaway) v *= LEADER_PULL;
      if (insight.warTargets.has(owner)) v *= WAR_PULL;
      if (A.vulture && insight.fought.has(owner)) v *= 1 + A.vulture * 0.5;
      if (A.oneFront && main && owner !== main && !calm) v *= OFF_FRONT;
    }
    return v;
  };

  // ---------- Spending ----------
  let gold = Math.min(purse, me.gold);
  const troopCost = rules.troops.cost;
  const building = (t: TerritoryId) => !!seen(t)!.building || !!seen(t)!.construction;
  const turnIn = spoilsOrder(view, id, captainSpoils(b));
  if (turnIn) spend(turnIn);
  const errand = missionSpend(b, gold);
  if (errand) {
    spend(errand.kind === "fort" ? { id: id(), kind: "build", territory: errand.territory, building: "fort" } : { id: id(), kind: "invest", territory: errand.territory });
    gold -= errand.cost;
  }

  // Forts: the Captain's (its threatened capital, a choke point facing a rival army), plus the personality's own on
  // fronts facing a big enough army, up to its number of forts on the frontier.
  const fortsUp = frontier.filter((t) => seen(t)!.building === "fort" || seen(t)!.construction?.building === "fort").length;
  const fortSpots = [
    ...(capThreatened && capital ? [capital] : []),
    ...frontier.filter((t) => chokeHolder(t) && biggestEnemyNear(t) >= 4),
    ...(B.fortAt > 0 && fortsUp < B.forts ? frontier.filter((t) => biggestEnemyNear(t) >= B.fortAt) : []),
  ].filter((t) => !building(t));
  const fortBuilding = mine.some((t) => seen(t)!.construction?.building === "fort") || errand?.kind === "fort";
  const fortAt = fortSpots.sort((a, c) => (a === capital ? -1 : c === capital ? 1 : 0) || biggestEnemyNear(c) - biggestEnemyNear(a) || (a < c ? -1 : 1))[0];
  if (fortAt && (!fortBuilding || B.fortAt > 0) && gold >= rules.buildings.fort.cost + troopCost * 3) {
    spend({ id: id(), kind: "build", territory: fortAt, building: "fort" });
    gold -= rules.buildings.fort.cost;
  }

  // Barracks, recruit and hire sites: as the Captain.
  const recruitSites = mine.filter((t) => isRecruitSiteIn(ctx, view, t));
  const hireSite = (t: TerritoryId) => t === me.capital || seen(t)?.building === "barracks";
  const frontRank = (t: TerritoryId) => (facesRaider(t) ? 2000 : 0) + (facesMain(t) ? 1000 : 0) + (t === spearhead ? 500 : 0) + enemyPressure(t);
  const hotFront = [...frontier].sort((a, c) => frontRank(c) - frontRank(a) || (a < c ? -1 : 1))[0];
  const nearSite = (t: TerritoryId) => recruitSites.some((r) => r === t || idx.neighbors.get(t)!.includes(r));
  const barracksBuilding = mine.some((t) => seen(t)!.construction?.building === "barracks");
  const homeless = !recruitSites.length && !barracksBuilding;
  const shelter = homeless ? [...mine].filter((t) => !building(t)).sort((a, c) => enemyPressure(a) - enemyPressure(c) || troopsAt(c) - troopsAt(a) || (a < c ? -1 : 1))[0] : undefined;
  if (shelter && gold >= rules.buildings.barracks.cost) {
    spend({ id: id(), kind: "build", territory: shelter, building: "barracks" });
    gold -= rules.buildings.barracks.cost;
  } else if (hotFront && !nearSite(hotFront) && !barracksBuilding && mine.length >= 5 && !building(hotFront) && gold >= rules.buildings.barracks.cost + troopCost * 4) {
    spend({ id: id(), kind: "build", territory: hotFront, building: "barracks" });
    gold -= rules.buildings.barracks.cost;
  }

  // Markets on safe land (no rival next to it as far as it knows), up to its number, keeping gold for troops.
  const quiet = (t: TerritoryId) => idx.neighbors.get(t)!.every((x) => owned(x) || b.look0(x) === null);
  const markets = mine.filter((t) => seen(t)!.building === "market" || seen(t)!.construction?.building === "market").length;
  if (view.turn >= B.marketsFrom && markets < B.markets && !capThreatened) {
    const spot = mine.filter((t) => !building(t) && quiet(t)).sort((a, c) => Number(isFrontier(a)) - Number(isFrontier(c)) || (a < c ? -1 : 1))[0];
    if (spot && gold >= rules.buildings.market.cost + troopCost * B.marketReserve) {
      spend({ id: id(), kind: "build", territory: spot, building: "market" });
      gold -= rules.buildings.market.cost;
    }
  }

  // Specialists: as the Captain.
  const byFront = (a: TerritoryId, c: TerritoryId) => Number(isFrontier(c)) - Number(isFrontier(a)) || frontRank(c) - frontRank(a) || (a < c ? -1 : 1);
  const site = capThreatened ? capital! : [...recruitSites].sort(byFront)[0];
  const hireAt = site && hireSite(site) ? site : recruitSites.filter(hireSite).sort(byFront)[0];
  if (hireAt) {
    const here = seen(hireAt)!;
    const room = rules.specialists.maxPerArmy - here.specialists.length;
    const has = (t: SpecialistType) => here.specialists.some((s) => s.type === t);
    const provinceCulture = (idx.provinceMembers.get(idx.byId.get(hireAt)!.province) ?? []).filter(owned).reduce((a, t) => a + seen(t)!.culture, 0);
    const unlocked = (t: SpecialistType) => rules.specialists[t].cultureRequired <= provinceCulture;
    const fortAhead = idx.neighbors.get(hireAt)!.some((x) => rivalAt(x) && seen(x)!.building === "fort");
    const rough = rules.specialists.rangers.terrains;
    const roughFront = idx.neighbors.get(hireAt)!.some((x) => !!rivalAt(x) && rough.includes(idx.byId.get(x)!.terrain) && troopsAt(x) >= 3);
    let want: SpecialistType | null = null;
    if (fortAhead && !has("siege") && unlocked("siege")) want = "siege";
    else if (roughFront && !has("rangers") && unlocked("rangers") && here.troops >= 8) want = "rangers";
    else if (!has("standardBearer") && unlocked("standardBearer") && here.troops >= 20) want = "standardBearer";
    else if (unlocked("healers") && !has("healers") && here.troops >= 15) want = "healers";
    else if (!has("cavalry") && here.troops >= 10 && rng.next() < 0.3) want = "cavalry";
    if (want && room > 0 && gold >= rules.specialists[want].cost + troopCost * 4) {
      spend({ id: id(), kind: "hire", territory: hireAt, specialist: want });
      gold -= rules.specialists[want].cost;
    }
  }

  // Culture: where it means to hold (its capital and choke points facing a rival, with enough troops there for the
  // bonus to pay), from its turn and keeping its reserve; a culture-minded personality also raises safe land.
  if (view.turn >= B.cultureFrom) {
    const worth = (t: TerritoryId) => {
      const cost = investCost(rules, seen(t)!.culture);
      return cost !== null && troopsAt(t) * rules.culture.defensePerLevel * 4 >= cost / troopCost;
    };
    const shortAtFront = mine.some((t) => chokeHolder(t) && holdNeed(t) > troopsAt(t));
    const hold = shortAtFront
      ? undefined
      : mine
          .filter((t) => (t === capital || chokeHolder(t)) && biggestEnemyNear(t) > garrison && worth(t) && seen(t)!.culture < rules.culture.max)
          .sort((a, c) => seen(a)!.culture - seen(c)!.culture || Number(c === capital) - Number(a === capital) || (a < c ? -1 : 1))[0];
    const safe = B.cultureEverywhere ? mine.filter((t) => quiet(t) && seen(t)!.culture < rules.culture.max).sort((a, c) => seen(a)!.culture - seen(c)!.culture || Number(c === capital) - Number(a === capital) || (a < c ? -1 : 1))[0] : undefined;
    const spot = hold ?? safe;
    const cost = spot ? investCost(rules, seen(spot)!.culture) : null;
    if (spot && cost !== null && gold >= cost + troopCost * B.cultureReserve) {
      spend({ id: id(), kind: "invest", territory: spot });
      gold -= cost;
    }
  }

  // Spies: the Captain's choices of where (its main target's province, a province of ours to guard), its own number.
  if (B.spies > 0) {
    const spying = captainSpies(b, id, gold, { max: B.spies, fromTurn: B.spiesFrom, reserve: troopCost * B.spyReserve });
    for (const o of spying.orders) spend(o);
    gold -= spying.spent;
  }

  let recruited = 0;
  if (site && gold >= troopCost) {
    recruited = Math.floor(gold / troopCost);
    spend({ id: id(), kind: "recruit", territory: site, count: recruited });
    gold -= recruited * troopCost;
  }

  // ---------- What each army keeps back ----------
  const keep = (t: TerritoryId) => {
    if (t === capital && capThreatened) return holdNeed(t);
    if (chokeHolder(t)) return holdNeed(t);
    if (runaway && facesRival(t, runaway)) return Math.max(garrison, holdNeed(t));
    // Its style: a share of what it takes to hold any front facing a rival (the Turtle more, the Blitzer nothing).
    if (D.frontGarrison > 0 && idx.neighbors.get(t)!.some((x) => rivalAt(x))) return Math.max(garrison, Math.ceil(holdNeed(t) * D.frontGarrison));
    return garrison;
  };
  const free = new Map<TerritoryId, number>();
  for (const t of mine) free.set(t, Math.max(0, troopsAt(t) + (t === site ? recruited : 0) - keep(t)));

  // ---------- Attacks ----------
  type Plan = { from: TerritoryId; to: TerritoryId; troops: number; score: number; vsPlayer: boolean; breakthrough: boolean; through?: TerritoryId[] };
  const candidates: Plan[] = [];
  const staging = new Map<TerritoryId, number>();
  for (const from of mine) {
    const avail = free.get(from)!;
    for (const to of idx.neighbors.get(from)!) {
      const tv = seen(to);
      if (!tv || tv.owner === me.id) continue;
      const rival = tv.owner;
      if (rival && shieldsLeader.has(rival) && to !== me.capital) continue;
      if (b.blocked(from, to)) continue;
      // Near a front a fast attacker is pushing through: fight it, don't grab neutral land.
      if (raider && facesRaider(from) && rival === null) continue;
      const v = value(to);
      if (crossing(from, to)) {
        const need = needFor(from, to, Math.max(avail, troopsAt(from) * 4));
        if (need === null) continue;
        const real = Math.ceil(need * Math.max(BREAKTHROUGH_MARGIN, rival && calm ? A.calmMargin : 1));
        if (avail >= real) candidates.push({ from, to, troops: avail, score: (v * 1.25 * missionPull(b, from, to)) / real, vsPlayer: rival !== null, breakthrough: true });
        else if (rival === main || rival === null || tv.troops <= 3) staging.set(from, Math.max(staging.get(from) ?? 0, v));
        continue;
      }
      if (avail <= 0) continue;
      const need = needFor(from, to, avail);
      if (need === null) continue;
      // Calm play: rival land only with a big margin; neutral land only where the army that takes it would be safe.
      if (calm && rival && avail < need * A.calmMargin) continue;
      if (calm && !rival && b.exposed(to, Math.max(1, avail - need))) continue;
      candidates.push({ from, to, troops: need, score: (v * missionPull(b, from, to)) / Math.max(1, need), vsPlayer: rival !== null, breakthrough: false });
    }
  }
  // Right of passage: through a partner's land to a front it wants (as the Captain).
  const open = passageFor(view.deals.filter((d) => d.terms).map((d) => ({ a: d.a, b: d.b, terms: d.terms! })), me.id);
  if (open.length && !calm) {
    const wanted = (p: PlayerId | null) => !!p && !open.includes(p) && (b.wantsFront(p) || insight.warTargets.has(p));
    const max = rules.diplomacy.passage.maxThrough;
    for (const from of mine) {
      const avail = free.get(from)!;
      if (avail <= 0) continue;
      const ways = new Map<TerritoryId, TerritoryId[]>();
      const q: TerritoryId[] = [];
      for (const x of idx.neighbors.get(from)!) if (open.includes(b.look0(x) ?? "")) (ways.set(x, [x]), q.push(x));
      while (q.length) {
        const t = q.shift()!;
        const way = ways.get(t)!;
        for (const to of idx.neighbors.get(t)!) {
          const owner = b.look0(to);
          if (open.includes(owner ?? "")) {
            if (way.length < max && !ways.has(to) && to !== from) (ways.set(to, [...way, to]), q.push(to));
            continue;
          }
          if (owned(to) || !wanted(owner) || b.blocked(t, to)) continue;
          const need = fewestToTake((troops) => b.expectAt(t, to, troops, specsAt(from)).captureLikely, avail);
          if (need === null) continue;
          candidates.push({ from, to, troops: need, score: (value(to) * 0.9) / Math.max(1, need), vsPlayer: true, breakthrough: false, through: way });
        }
      }
    }
  }
  candidates.sort((a, c) => c.score - a.score || (a.to < c.to ? -1 : 1));
  const targeted = new Set<TerritoryId>();
  const attackedFrom = new Set<TerritoryId>();
  let usedInitiative = false;
  const queued: { order: Order; from: TerritoryId; to: TerritoryId; troops: number; attackFrom?: TerritoryId }[] = [];
  for (const c of candidates) {
    if (targeted.has(c.to)) continue;
    const avail = free.get(c.from)!;
    if (avail < c.troops || avail <= 0) continue;
    const extra = c.breakthrough ? avail - c.troops : attackedFrom.has(c.from) ? 0 : Math.floor((avail - c.troops) * A.sendShare);
    const send = c.troops + extra;
    free.set(c.from, avail - send);
    targeted.add(c.to);
    attackedFrom.add(c.from);
    const o: Order = { id: id(), kind: "move", from: c.from, to: c.to, troops: send, preset: { id: "onlyIfStronger" }, ...(c.through ? { through: c.through } : {}) };
    if (!usedInitiative && c.vsPlayer && me.leader.alive && me.cooldowns.seize === 0) {
      o.timing = "first";
      usedInitiative = true;
    }
    army(o, c.from);
    queued.push({ order: o, from: c.from, to: c.to, troops: send, ...(c.through ? { attackFrom: c.through[c.through.length - 1]! } : {}) });
    staging.delete(c.from);
  }
  // Chain on from where each attack should arrive, as far as its style goes.
  const chainB: Board = { ...b, valueOf: value };
  for (const first of queued)
    chainOn(chainB, first, targeted, calm ? Math.max(A.chainMargin, A.calmMargin) : A.chainMargin, id, (o) => army(o, first.from), { maxHops: A.maxHops, followThroughSpare: A.followThroughSpare });

  // ---------- Reinforcements ----------
  const goals = new Map<TerritoryId, number>();
  const want = (t: TerritoryId, w: number) => goals.set(t, Math.max(goals.get(t) ?? 0, w));
  if (capThreatened && capital && holdNeed(capital) > troopsAt(capital) + (site === capital ? recruited : 0)) want(capital, 100);
  for (const t of frontier) {
    if (chokeHolder(t)) {
      if (holdNeed(t) > troopsAt(t)) want(t, facesRaider(t) ? 70 : 50);
      continue;
    }
    if (facesRaider(t)) want(t, 45 + enemyPressure(t) / 10);
    else if (t === spearhead) want(t, 60);
    else if (spearhead && facesMain(t)) want(t, 3 + enemyPressure(t) / 30);
    else if (facesMain(t)) want(t, 30 + enemyPressure(t) / 10);
    else want(t, enemyPressure(t) > 0 ? 5 + enemyPressure(t) / 20 : 1);
  }
  for (const [t, v] of staging) want(t, 40 + v);
  const distFrom = new Map<TerritoryId, Map<TerritoryId, number>>();
  for (const g of goals.keys()) {
    const d = new Map<TerritoryId, number>([[g, 0]]);
    const q = [g];
    for (let h = 0; h < q.length; h++) {
      const cur = q[h]!;
      for (const nb of idx.neighbors.get(cur)!)
        if (owned(nb) && !d.has(nb)) {
          d.set(nb, d.get(cur)! + 1);
          q.push(nb);
        }
    }
    distFrom.set(g, d);
  }
  let reserveUsed = false;
  for (const t of mine) {
    const avail = free.get(t)!;
    if (avail <= 0 || attackedFrom.has(t) || t === spearhead) continue;
    let send = avail;
    if (isFrontier(t) && !chokeHolder(t)) {
      // A front stack shifts sideways only toward a spearhead (it keeps what it needs to hold its own stretch).
      if (!spearhead || goals.get(t)! >= 30) continue;
      send = Math.min(avail, troopsAt(t) + (t === site ? recruited : 0) - Math.max(keep(t), holdNeed(t)));
      if (send <= 0) continue;
    } else if (goals.has(t) && !spearhead) continue;
    let best: { g: TerritoryId; score: number; d: number } | null = null;
    for (const [g, w] of goals) {
      const d = distFrom.get(g)!.get(t);
      if (d === undefined || d === 0) continue;
      const score = w / (1 + d);
      if (!best || score > best.score || (score === best.score && g < best.g)) best = { g, score, d };
    }
    if (!best) continue;
    const dg = distFrom.get(best.g)!;
    const step = idx.neighbors.get(t)!.filter((nb) => owned(nb) && dg.get(nb) === best!.d - 1).sort()[0];
    if (!step) continue;
    if (!reserveUsed && best.d === 1 && !goals.has(capital ?? "") && biggestEnemyNear(step) > troopsAt(step) && me.leader.alive && me.cooldowns.lie === 0) {
      reserveUsed = true;
      army({ id: id(), kind: "move", from: t, to: step, troops: send, preset: { id: "reinforceIfHit" }, timing: "last" }, t);
      continue;
    }
    army({ id: id(), kind: "move", from: t, to: step, troops: send }, t);
  }

  // ---------- Pull back stacks that would be crushed ----------
  if (D.retreatAt > 0)
    for (const t of frontier) {
      if (t === capital || attackedFrom.has(t) || chokeHolder(t)) continue;
      const here = troopsAt(t);
      if (here >= 6 && biggestEnemyNear(t) >= here * D.retreatAt) army({ id: id(), kind: "retreat", from: t, preset: { id: "retreatIfOutnumbered" } }, t);
    }
  return orders;
}

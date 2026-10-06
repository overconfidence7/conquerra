import type { SpecialistType } from "@conquerra/content";
import { investCost, isRecruitSiteIn, Rng, seedRng, type GameContext, type Order, type PlayerView, type ReplayEvent, type TerritoryId } from "@conquerra/engine";
import { BREAKTHROUGH_MARGIN, CAPTAIN_CHAIN_MARGIN, chainOn, readBoard, type CaptainOptions } from "./board";
import type { Bot } from "./recruit";

export { CAPTAIN_CHAIN_MARGIN, type CaptainFeature, type CaptainOptions } from "./board";

/** The Captain with other settings (the simulator tunes the chain margin). */
export const makeCaptainBot = (opts: CaptainOptions = { chainMargin: CAPTAIN_CHAIN_MARGIN }): Bot => ({
  id: "captain",
  name: "Captain",
  plan: (ctx, view, lastTurn) => plan(ctx, view, opts, lastTurn),
});

/**
 * "Captain" bot: the default opponent from session 8. Like the Recruit, it plays only from its own fog-limited view
 * (including its "last seen" memory), with the same rules as people. What it does better, in priority order:
 *  1. Holds choke points cheaply: on a pass or sea-lane landing facing a rival, it keeps just enough troops to hold
 *     (the crossing penalty does the rest) and builds a fort there when it can afford one, instead of piling up.
 *  2. Breaks through with force: it only attacks through a pass or across a sea lane with a real army (half as
 *     much again as the attack needs), gathering troops at the crossing until it has one, and brings siege for a
 *     fort when it can hire it. Once through, it chains on.
 *  3. Lands from the sea where the far side is weak (cheap landings score well, and a landing opens a new front).
 *  4. Finishes what it starts: it goes after a rival with only a few territories left, and with 3 or fewer players
 *     left it concentrates on one rival (the weakest it borders) and that rival's capital, instead of trading land
 *     back and forth with everyone.
 *  5. Defends its capital when a big army stands next to it: it keeps enough there to hold, recruits there, builds a
 *     fort and sends reinforcements.
 *  6. Chains like a person: it hops on when the army that should arrive is comfortably more than the next hop needs.
 *  7. Loyal land: raises culture at its capital and choke points it holds, where a rival army is next door and enough
 *     troops stand there for the bonus to be worth the gold, once it has a real army's worth of gold to spare.
 *  8. Gangs up on a runaway leader: when one rival looks to hold about 40% of the land, or far more than anyone
 *     else (estimated from its own view and memory), that rival becomes its main target, its fronts with that rival
 *     come first and keep honest garrisons, and it stops attacking weaker rivals who are holding the leader off.
 *  9. Turns on a fast attacker: when last turn's replay showed a rival taking two or more of its territories, that
 *     rival becomes its target (a chain is thinly held behind it), it recruits on that front, marches nearby troops
 *     there, keeps the choke points facing it held, and stops grabbing neutral land near it. (Just digging in
 *     instead was tried: it cut runaways too, but Recruit bots then beat it far more often.)
 */
export const captainBot: Bot = makeCaptainBot();

/** Loyal land (priority 7): raise culture once the gold left still buys this many troops (fewer at a threatened capital), from this turn on. */
const LOYAL_RESERVE = 8;
const LOYAL_RESERVE_THREATENED = 3;
const LOYAL_FROM_TURN = 3;
/** Loyal land: a level is worth buying when the troops there, made this much stronger over this many fights, beat its price in troops (tuned: 2 to 8 tried). */
const LOYAL_FIGHTS = 4;
/** Armies this close (through our own land) to the raided front march there instead of attacking elsewhere. */
const RAID_RADIUS = 2;

function plan(ctx: GameContext, view: PlayerView, opts: CaptainOptions, lastTurn?: readonly ReplayEvent[]): Order[] {
  const b = readBoard(ctx, view, opts, lastTurn);
  if (!b) return [];
  const { rules, idx, me, garrison, on, seen, owned, rivalAt, troopsAt, specsAt, mine, crossing, isFrontier, frontier, enemyPressure, biggestEnemyNear } = b;
  const { endgame, raider, runaway, shieldsLeader, facesRival, facesRaider, focus, spearhead, holdNeed, chokeHolder, capital, capThreatened, valueOf, needFor } = b;
  const rng = new Rng(seedRng(`${view.gameId}|${me.id}|${view.turn}|captain`));
  const orders: Order[] = [];
  let n = 0;
  const id = () => `${me.id}-t${view.turn}-${n++}`;

  // ---------- Spending ----------
  let gold = me.gold;
  const building = (t: TerritoryId) => !!seen(t)!.building || !!seen(t)!.construction;

  // 1/5. A fort where it counts: the threatened capital, else a choke point we hold facing a rival army.
  const fortBuilding = mine.some((t) => seen(t)!.construction?.building === "fort");
  const fortSpots = [...(capThreatened && capital ? [capital] : []), ...frontier.filter((t) => chokeHolder(t) && biggestEnemyNear(t) >= 4)].filter((t) => !building(t));
  const fortAt = fortSpots.sort((a, b) => (a === capital ? -1 : b === capital ? 1 : 0) || biggestEnemyNear(b) - biggestEnemyNear(a) || (a < b ? -1 : 1))[0];
  if (on("forts") && fortAt && !fortBuilding && gold >= rules.buildings.fort.cost + rules.troops.cost * 3) {
    orders.push({ id: id(), kind: "build", territory: fortAt, building: "fort" });
    gold -= rules.buildings.fort.cost;
  }

  // A barracks near the front we care about most, once the realm has grown.
  // Recruit at the capital, a barracks, or anywhere in a province we hold completely; hire only at the first two.
  const recruitSites = mine.filter((t) => isRecruitSiteIn(ctx, view, t));
  const hireSite = (t: TerritoryId) => t === me.capital || seen(t)?.building === "barracks";
  const facesFocus = (t: TerritoryId) => !!focus && idx.neighbors.get(t)!.some((x) => rivalAt(x) === focus);
  const frontRank = (t: TerritoryId) => (facesRaider(t) ? 2000 : 0) + (facesFocus(t) ? 1000 : 0) + enemyPressure(t);
  const hotFront = [...frontier].sort((a, b) => frontRank(b) - frontRank(a) || (a < b ? -1 : 1))[0];
  const nearSite = (t: TerritoryId) => recruitSites.some((r) => r === t || idx.neighbors.get(t)!.includes(r));
  const barracksBuilding = mine.some((t) => seen(t)!.construction?.building === "barracks");
  // Nowhere left to recruit (the capital fell and there's no barracks): build one at once, in the safest land we hold.
  const homeless = !recruitSites.length && !barracksBuilding;
  const shelter = homeless ? [...mine].filter((t) => !building(t)).sort((a, b) => enemyPressure(a) - enemyPressure(b) || troopsAt(b) - troopsAt(a) || (a < b ? -1 : 1))[0] : undefined;
  if (shelter && gold >= rules.buildings.barracks.cost) {
    orders.push({ id: id(), kind: "build", territory: shelter, building: "barracks" });
    gold -= rules.buildings.barracks.cost;
  } else if (
    hotFront &&
    !nearSite(hotFront) &&
    !barracksBuilding &&
    mine.length >= 5 &&
    !building(hotFront) &&
    gold >= rules.buildings.barracks.cost + rules.troops.cost * 4
  ) {
    orders.push({ id: id(), kind: "build", territory: hotFront, building: "barracks" });
    gold -= rules.buildings.barracks.cost;
  }

  // Recruit at the threatened capital, else at the site nearest the front we care about.
  // (Recruiting next to the endgame spearhead instead was tried: it made games about 4 turns longer.)
  const byFront = (a: TerritoryId, b: TerritoryId) => Number(isFrontier(b)) - Number(isFrontier(a)) || frontRank(b) - frontRank(a) || (a < b ? -1 : 1);
  const site = capThreatened ? capital! : [...recruitSites].sort(byFront)[0];
  // Specialists: at the recruit site if we can hire there, else the capital or barracks nearest the front.
  const hireAt = site && hireSite(site) ? site : recruitSites.filter(hireSite).sort(byFront)[0];
  if (hireAt) {
    const here = seen(hireAt)!;
    const room = rules.specialists.maxPerArmy - here.specialists.length;
    const has = (t: SpecialistType) => here.specialists.some((s) => s.type === t);
    const provinceCulture = (idx.provinceMembers.get(idx.byId.get(hireAt)!.province) ?? []).filter(owned).reduce((a, t) => a + seen(t)!.culture, 0);
    const unlocked = (t: SpecialistType) => rules.specialists[t].cultureRequired <= provinceCulture;
    // 2. Siege for a fort we'll have to break (next to the site, or across a crossing from it).
    const fortAhead = idx.neighbors.get(hireAt)!.some((x) => rivalAt(x) && seen(x)!.building === "fort");
    let want: SpecialistType | null = null;
    if (fortAhead && !has("siege") && unlocked("siege")) want = "siege";
    else if (unlocked("healers") && !has("healers") && here.troops >= 15) want = "healers";
    else if (!has("cavalry") && here.troops >= 10 && rng.next() < 0.3) want = "cavalry";
    if (want && room > 0 && gold >= rules.specialists[want].cost + rules.troops.cost * 4) {
      orders.push({ id: id(), kind: "hire", territory: hireAt, specialist: want });
      gold -= rules.specialists[want].cost;
    }
  }

  // 7. Loyal land: culture where it pays. Each level makes that land defend better for good (and blocks unrest), so
  // it goes where we mean to hold and a rival army stands next door: the capital and choke points we hold, and only
  // where enough troops stand for the bonus to be worth the gold, never while a choke point is short of troops, and
  // only with a real army's worth of gold to spare (a threatened capital needs less). Otherwise, a little culture in
  // safe interior land when comfortably rich, as before. (Buying at every capital, choke point and forted frontier
  // whenever there was gold to spare lost: 37.7% against Captains that don't. See docs/sim-results-m3-fixes.md.)
  // Worth it: the troops standing there, made stronger by one more level over a few fights, beat the price in troops.
  const worthRaising = (t: TerritoryId) => {
    const cost = investCost(rules, seen(t)!.culture);
    return cost !== null && troopsAt(t) * rules.culture.defensePerLevel * LOYAL_FIGHTS >= cost / rules.troops.cost;
  };
  const shortAtFront = mine.some((t) => chokeHolder(t) && holdNeed(t) > troopsAt(t));
  const loyal = on("culture") && !shortAtFront
    ? mine
        .filter((t) => (t === capital || chokeHolder(t)) && biggestEnemyNear(t) > garrison && worthRaising(t) && seen(t)!.culture < rules.culture.max)
        .sort((a, b) => seen(a)!.culture - seen(b)!.culture || Number(b === capital) - Number(a === capital) || biggestEnemyNear(b) - biggestEnemyNear(a) || (a < b ? -1 : 1))[0]
    : undefined;
  const loyalCost = loyal ? investCost(rules, seen(loyal)!.culture) : null;
  const reserve = rules.troops.cost * (loyal === capital && capThreatened ? LOYAL_RESERVE_THREATENED : LOYAL_RESERVE);
  const interior = mine.filter((t) => !isFrontier(t));
  if (loyal && loyalCost !== null && view.turn >= LOYAL_FROM_TURN && gold >= loyalCost + reserve) {
    orders.push({ id: id(), kind: "invest", territory: loyal });
    gold -= loyalCost;
  } else if (interior.length && gold >= 40 && !capThreatened && rng.next() < 0.4) {
    const spot = [...interior].sort((a, b) => seen(a)!.culture - seen(b)!.culture || (a < b ? -1 : 1))[0]!;
    const cost = investCost(rules, seen(spot)!.culture);
    if (cost !== null && gold - cost >= 25) {
      orders.push({ id: id(), kind: "invest", territory: spot });
      gold -= cost;
    }
  }

  let recruited = 0;
  if (site && gold >= rules.troops.cost) {
    recruited = Math.floor(gold / rules.troops.cost);
    orders.push({ id: id(), kind: "recruit", territory: site, count: recruited });
    gold -= recruited * rules.troops.cost;
  }

  // ---------- What each army must keep back ----------
  // The capital under threat keeps enough to hold; a choke point keeps just enough to hold (the crossing helps);
  // everywhere else keeps the 1-troop garrison (attacking is the best defence).
  const keep = (t: TerritoryId) => {
    if (t === capital && capThreatened) return holdNeed(t);
    if (chokeHolder(t)) return holdNeed(t);
    // 8. Honest garrisons on the fronts with a runaway leader.
    if (runaway && facesRival(t, runaway)) return Math.max(garrison, holdNeed(t));
    return garrison;
  };
  const free = new Map<TerritoryId, number>();
  for (const t of mine) free.set(t, Math.max(0, troopsAt(t) + (t === site ? recruited : 0) - keep(t)));

  // ---------- Attacks ----------
  /** 9. Our land within RAID_RADIUS steps (through our own land) of a front facing the fast attacker. */
  const nearRaid = new Map<TerritoryId, number>();
  if (raider) {
    const q = frontier.filter(facesRaider);
    for (const t of q) nearRaid.set(t, 0);
    for (let h = 0; h < q.length; h++) {
      const d = nearRaid.get(q[h]!)!;
      if (d >= RAID_RADIUS) continue;
      for (const nb of idx.neighbors.get(q[h]!)!)
        if (owned(nb) && !nearRaid.has(nb)) {
          nearRaid.set(nb, d + 1);
          q.push(nb);
        }
    }
  }

  type Plan = { from: TerritoryId; to: TerritoryId; troops: number; score: number; vsPlayer: boolean; breakthrough: boolean };
  const candidates: Plan[] = [];
  /** Crossings we'd like to break through but can't yet: gather troops there (the staging point). */
  const staging = new Map<TerritoryId, number>();
  for (const from of mine) {
    const avail = free.get(from)!;
    for (const to of idx.neighbors.get(from)!) {
      const tv = seen(to);
      if (!tv || tv.owner === me.id) continue;
      const rival = tv.owner;
      // 8. Not a rival that's holding off the runaway leader (unless it's our own capital to take back).
      if (rival && shieldsLeader.has(rival) && to !== me.capital) continue;
      // 9. Armies near a front a fast attacker is pushing through fight instead of grabbing neutral land.
      if (nearRaid.has(from) && rival === null) continue;
      const offFocus = endgame && !!focus && rival !== null && rival !== focus;
      const value = valueOf(to);
      if (on("breakthrough") && crossing(from, to)) {
        // 2/3. Through a pass or across the sea only with a real army, so it can push on afterwards.
        const need = needFor(from, to, Math.max(avail, troopsAt(from) * 4));
        if (need === null) continue;
        const real = Math.ceil(need * BREAKTHROUGH_MARGIN);
        if (avail >= real && !offFocus) candidates.push({ from, to, troops: avail, score: (value * 1.25) / real, vsPlayer: rival !== null, breakthrough: true });
        else if (!offFocus && (rival === focus || rival === null || tv.troops <= 3)) staging.set(from, Math.max(staging.get(from) ?? 0, value));
        continue;
      }
      if (avail <= 0) continue;
      const need = needFor(from, to, avail);
      if (need === null) continue;
      candidates.push({ from, to, troops: need, score: value / Math.max(1, need), vsPlayer: rival !== null, breakthrough: false });
    }
  }
  candidates.sort((a, b) => b.score - a.score || (a.to < b.to ? -1 : 1));
  const targeted = new Set<TerritoryId>();
  const attackedFrom = new Set<TerritoryId>();
  let usedInitiative = false;
  const queued: { order: Order; from: TerritoryId; to: TerritoryId; troops: number }[] = [];
  for (const c of candidates) {
    if (targeted.has(c.to)) continue;
    const avail = free.get(c.from)!;
    if (avail < c.troops || avail <= 0) continue;
    // Concentrate: a big stack throws extra weight into its main attack (all of it for a breakthrough).
    const extra = c.breakthrough ? avail - c.troops : attackedFrom.has(c.from) ? 0 : Math.floor((avail - c.troops) * 0.5);
    const send = c.troops + extra;
    free.set(c.from, avail - send);
    targeted.add(c.to);
    attackedFrom.add(c.from);
    const o: Order = { id: id(), kind: "move", from: c.from, to: c.to, troops: send, preset: { id: "onlyIfStronger" } };
    if (!usedInitiative && c.vsPlayer && me.leader.alive && me.cooldowns.seize === 0) {
      o.timing = "first";
      usedInitiative = true;
    }
    orders.push(o);
    queued.push({ order: o, from: c.from, to: c.to, troops: send });
    staging.delete(c.from);
  }

  // 6. Chain on from where an attack should arrive, while the next hop is comfortably likely to win.
  for (const first of queued) chainOn(b, first, targeted, opts.chainMargin, id, (o) => orders.push(o));

  // ---------- Reinforcements: march spare troops to where they matter most ----------
  /** Where troops are wanted, and how badly. */
  const goals = new Map<TerritoryId, number>();
  const want = (t: TerritoryId, w: number) => goals.set(t, Math.max(goals.get(t) ?? 0, w));
  // The capital only pulls troops in if what's there plus the new recruits still isn't enough to hold it.
  if (capThreatened && capital && holdNeed(capital) > troopsAt(capital) + (site === capital ? recruited : 0)) want(capital, 100);
  for (const t of frontier) {
    if (chokeHolder(t)) {
      if (holdNeed(t) > troopsAt(t)) want(t, facesRaider(t) ? 70 : 50);
      continue;
    }
    // 9. The front a fast attacker is pushing through comes first.
    if (facesRaider(t)) want(t, 45 + enemyPressure(t) / 10);
    else if (t === spearhead) want(t, 60);
    else if (spearhead && facesFocus(t)) want(t, 3 + enemyPressure(t) / 30);
    else if (facesFocus(t)) want(t, 30 + enemyPressure(t) / 10);
    else want(t, enemyPressure(t) > 0 ? 5 + enemyPressure(t) / 20 : 1);
  }
  for (const [t, value] of staging) want(t, 40 + value);
  // Distances (through our own land) from each goal.
  const distFrom = new Map<TerritoryId, Map<TerritoryId, number>>();
  for (const g of goals.keys()) {
    const d = new Map<TerritoryId, number>([[g, 0]]);
    const q = [g];
    while (q.length) {
      const cur = q.shift()!;
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
    // 9. Near a front a fast attacker is pushing through, our other front stacks send their spare troops there too.
    const raidHelper = nearRaid.has(t) && !facesRaider(t) && !chokeHolder(t);
    if (avail <= 0 || attackedFrom.has(t) || (goals.has(t) && t !== spearhead && !spearhead && !raidHelper) || t === spearhead) continue;
    // Interior troops, and the spare troops of a choke point we hold, go to the best goal they can reach. In the
    // endgame the front line also shifts sideways: a front stack keeps what it needs to hold its stretch and sends
    // the rest to the spearhead (otherwise two big realms just stare at each other along a long front).
    let send = avail;
    if (isFrontier(t) && !chokeHolder(t)) {
      if (!spearhead && !raidHelper) continue;
      send = Math.min(avail, troopsAt(t) + (t === site ? recruited : 0) - holdNeed(t));
      if (send <= 0) continue;
    }
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
    // One interior stack next to a threatened front waits in reserve and only goes if that front is hit.
    if (!reserveUsed && best.d === 1 && !goals.has(capital ?? "") && biggestEnemyNear(step) > troopsAt(step) && me.leader.alive && me.cooldowns.lie === 0) {
      reserveUsed = true;
      orders.push({ id: id(), kind: "move", from: t, to: step, troops: send, preset: { id: "reinforceIfHit" }, timing: "last" });
      continue;
    }
    orders.push({ id: id(), kind: "move", from: t, to: step, troops: send });
  }

  // ---------- Pull back stacks that would be crushed (never the capital or a choke point) ----------
  for (const t of frontier) {
    if (t === capital || attackedFrom.has(t) || chokeHolder(t)) continue;
    const here = troopsAt(t);
    if (here >= 6 && biggestEnemyNear(t) >= here * 2.5) orders.push({ id: id(), kind: "retreat", from: t, preset: { id: "retreatIfOutnumbered" } });
  }
  return orders;
}

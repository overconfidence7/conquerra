import type { LeaderPlanning } from "@conquerra/content";
import { investCost, isRecruitSiteIn, wallRules, type LeaderStyle, type Order, type PlayerId, type StewardCommand, type TerritoryId } from "@conquerra/engine";
import type { Board } from "../board";
import { realmShape, type RealmShape } from "./realm";

/**
 * A Steward's spending (session 18): culture, buildings, forts and the economy, from its own purse, with the Marshal's
 * judgement on what pays. It writes several orders a turn where the purse allows (a fort here, culture there), and it
 * saves up for something urgent (a fort where an army is massing) rather than fritter the purse away.
 *
 *  - Build up this province: forts where a rival army threatens it, a barracks where the province has nowhere to
 *    recruit near its front, markets on its quiet land, then culture where it holds.
 *  - Fortify this frontier: forts where you're most threatened (facing one rival, or anyone), then garrisons: troops
 *    recruited where the border is short and marched in.
 *  - Raise culture here: culture across one province, where it protects first, then the lowest.
 *  - Grow the economy: markets and culture, whichever pays back fastest, on land that's safe.
 *  - Walls (session 20b): Run the realm and Build up this province finish a wall (culture to the top and a fort) where a
 *    territory worth holding (the capital, a choke point, a province held whole, or next to a wall of ours) is nearly
 *    there, ahead of markets (the Turtle from scratch; the Merchant after its markets).
 *  - Run the realm: urgent forts first (a threatened capital, choke points facing an army), markets where they pay, a
 *    barracks where there's nowhere to recruit, and a level of culture a turn where it protects (the capital and choke
 *    points facing an army). Culture bought only for its income doesn't pay back under today's rules (session 18's
 *    sims: it halved a Captain's wins), so "Run the realm" leaves it to "Raise culture here" and "Grow the economy".
 *  - Run the realm with a plan (session 20d, Nate's third note; your Steward, `planned`): markets and barracks in the
 *    interior (realm.ts), forts at choke points and on wall candidates (the capital's province, provinces held whole
 *    that face a rival, the province your Leader stands in), and the wall up fast: several levels of culture in one
 *    territory in a turn, the fort first. Threatened (a rival army near the capital's province, or a runaway), it puts
 *    everything into the wall until it stands; otherwise what's left after the markets goes into it.
 *
 * It only ever reads its owner's view (the board), and never builds where something is already going up or another
 * leader of yours is building this turn (`taken`).
 */

/** Something the Steward could buy, best first. `urgent`: it saves up for this rather than buy lesser things. */
interface Wish {
  order: { kind: "build"; territory: TerritoryId; building: "fort" | "market" | "barracks" } | { kind: "invest"; territory: TerritoryId };
  territory: TerritoryId;
  cost: number;
  urgent: boolean;
  /** Session 20d: another level of culture on a place already bought for this turn (a wall going up fast). */
  stack?: boolean;
}

export function planSteward(
  b: Board,
  cfg: LeaderPlanning["steward"],
  command: StewardCommand,
  purse: number,
  newId: () => string,
  taken: Set<TerritoryId>,
  maxTurns: number,
  /** Forts your military leaders asked for (session 20: where they guess a rival army strikes next). */
  asked: ReadonlySet<TerritoryId> = new Set(),
  /** Its personality (session 20c): the Turtle and the Merchant run the realm their own way. */
  style: LeaderStyle | null = null,
  /** Walls (session 20b): finish one where at most this much gold is left (the Marshal's personality; default the Steward's own). */
  wallsNear?: number,
  /**
   * Session 20d: Run the realm with a plan (your Steward; the Marshal's realm share keeps session 20b's way), and where
   * your Leader stands (it walls that province too: the two leaders work together).
   */
  extra: { planned?: boolean; leaderAt?: TerritoryId | null } = {},
): Order[] {
  const { rules, idx, mine, seen, owned, rivalAt, troopsAt, biggestEnemyNear, holdNeed, chokeHolder, capital, capThreatened, look0, view } = b;
  const building = (t: TerritoryId) => !!seen(t)?.building || !!seen(t)?.construction || taken.has(t);
  const provinceOf = (t: TerritoryId) => idx.byId.get(t)!.province;
  const members = (prov: string) => idx.provinceMembers.get(prov) ?? [];
  const holdsWhole = (prov: string) => members(prov).every(owned);
  /** No rival next to it, as far as we know. */
  const quiet = (t: TerritoryId) => idx.neighbors.get(t)!.every((x) => owned(x) || look0(x) === null);
  const facesRival = (t: TerritoryId, r?: PlayerId) => idx.neighbors.get(t)!.some((x) => (r ? rivalAt(x) === r : !!rivalAt(x)));
  const fort = rules.buildings.fort.cost, market = rules.buildings.market.cost, barracks = rules.buildings.barracks.cost, troop = rules.troops.cost;
  /** Session 20d: the realm's shape, when it builds with a plan (Run the realm, your Steward). */
  const plan = extra.planned && command.kind === "realm" && cfg.plan ? cfg.plan : null;
  const shape: RealmShape | null = plan ? realmShape(b, plan.threat) : null;
  /** Wall candidates, best first: the capital and its province, the province your Leader stands in (held whole), the rest. */
  const candidates: TerritoryId[] = [];
  if (shape) {
    const lp = extra.leaderAt && owned(extra.leaderAt) ? provinceOf(extra.leaderAt) : null;
    const withLeader = lp && holdsWhole(lp) ? members(lp) : [];
    const capProv = capital ? provinceOf(capital) : null;
    for (const t of [...shape.wallCandidates.filter((t) => capProv && provinceOf(t) === capProv), ...withLeader, ...shape.wallCandidates]) if (owned(t) && !candidates.includes(t)) candidates.push(t);
  }
  const candidateSet = new Set(candidates);
  /** Plots kept for a fort (session 20d): wall candidates and choke points. */
  const fortPlot = (t: TerritoryId) => !!shape && (candidateSet.has(t) || shape.choke.has(t));
  const interior = (t: TerritoryId) => shape?.interior.get(t) ?? 0;

  // ---------- What could be bought, and what each is worth ----------
  /** A fort matters where a big enough rival army stands next door and the troops there couldn't hold alone. */
  const turtle = style === "turtle" && command.kind === "realm" ? cfg.styles.turtle : null;
  const merchant = style === "merchant" && command.kind === "realm" ? cfg.styles.merchant : null;
  const fortWorth = (t: TerritoryId, r?: PlayerId) => {
    if (building(t)) return 0;
    const threat = idx.neighbors.get(t)!.reduce((m, x) => (rivalAt(x) && (!r || rivalAt(x) === r) ? Math.max(m, troopsAt(x)) : m), 0);
    if (threat < (turtle?.fortThreat ?? cfg.fortThreat)) return 0;
    const weight = (t === capital ? 3 : chokeHolder(t) ? 2 : holdsWhole(provinceOf(t)) ? 1.5 : 1) * (asked.has(t) ? 2 : 1);
    const short = holdNeed(t) > troopsAt(t) ? 1.5 : 1;
    return threat * weight * short;
  };
  const forts = (land: readonly TerritoryId[], r?: PlayerId): Wish[] =>
    land
      .map((t) => ({ t, w: fortWorth(t, r) }))
      .filter((x) => x.w > 0)
      .sort((a, c) => c.w - a.w || (a.t < c.t ? -1 : 1))
      .map(({ t }) => ({ order: { kind: "build", territory: t, building: "fort" }, territory: t, cost: fort, urgent: asked.has(t) || (t === capital ? capThreatened : holdNeed(t) > troopsAt(t)) }));
  /** Culture where it means to hold (the Marshal's rule): the troops there, a few fights over, beat its price in troops. */
  const holdCulture = (t: TerritoryId) => {
    const cost = investCost(rules, seen(t)!.culture);
    return cost !== null && facesRival(t) && troopsAt(t) * rules.culture.defensePerLevel * cfg.cultureFights >= cost / troop;
  };
  /** Gold a turn back for each gold spent: a market, or a level of culture (its income, and its share of a whole province's bonus). */
  const payback = (t: TerritoryId, what: "market" | "culture") => {
    const safe = quiet(t) ? 1 : cfg.exposedWorth;
    if (what === "market") return (rules.buildings.market.income / market) * safe;
    const cost = investCost(rules, seen(t)!.culture);
    if (cost === null) return 0;
    const prov = provinceOf(t);
    const bonus = holdsWhole(prov) ? rules.culture.provinceBonusPerLevel / Math.max(1, members(prov).length) : 0;
    return ((rules.culture.incomePerLevel + bonus) / cost) * safe;
  };
  const marketsPay = view.turn <= maxTurns - cfg.marketsStopBefore;
  const economy = (land: readonly TerritoryId[]): Wish[] => {
    const out: { w: Wish; pay: number }[] = [];
    for (const t of land) {
      if (marketsPay && !building(t) && quiet(t) && !keepForFort(t) && !fortPlot(t)) out.push({ w: { order: { kind: "build", territory: t, building: "market" }, territory: t, cost: market, urgent: false }, pay: payback(t, "market") });
      const cost = investCost(rules, seen(t)!.culture);
      if (cost !== null) out.push({ w: { order: { kind: "invest", territory: t }, territory: t, cost, urgent: false }, pay: payback(t, "culture") });
    }
    // (With a plan, session 20d: the deepest land first among what pays the same.)
    return out.sort((a, c) => c.pay - a.pay || interior(c.w.territory) - interior(a.w.territory) || (a.w.territory < c.w.territory ? -1 : 1)).map((x) => x.w);
  };
  const culture = (land: readonly TerritoryId[]): Wish[] =>
    land
      .filter((t) => investCost(rules, seen(t)!.culture) !== null)
      .sort((a, c) => Number(holdCulture(c)) - Number(holdCulture(a)) || seen(a)!.culture - seen(c)!.culture || biggestEnemyNear(c) - biggestEnemyNear(a) || (a < c ? -1 : 1))
      .map((t) => ({ order: { kind: "invest", territory: t }, territory: t, cost: investCost(rules, seen(t)!.culture)!, urgent: false }));
  // ---------- Walls (session 20b) ----------
  const W = wallRules(rules);
  const near = wallsNear ?? (turtle ? turtle.walls : merchant ? merchant.walls : cfg.walls.near);
  const ours = (view.walls ?? []).filter((w) => w.owner === view.me.id).flatMap((w) => w.territories);
  const walled = new Set(ours);
  /** Gold still to pay to wall `t` (culture to the top, and a fort), or null if it can't be (another building stands there). */
  const wallLeft = (t: TerritoryId): number | null => {
    if (!W || walled.has(t)) return null;
    const v = seen(t)!;
    let gold = 0;
    for (let c = v.culture; c < W.culture; c++) gold += investCost(rules, c) ?? Infinity;
    if (W.needsFort && v.building !== "fort" && v.construction?.building !== "fort") {
      if (v.building || v.construction || taken.has(t)) return null;
      gold += fort;
    }
    return gold;
  };
  /** Land worth walling: the capital, a choke point, a province held whole, or land next to a wall of ours (it joins up). */
  const wallWeight = (t: TerritoryId) => (t === capital ? 3 : chokeHolder(t) ? 2 : idx.neighbors.get(t)!.some((x) => walled.has(x)) ? 1.5 : holdsWhole(provinceOf(t)) ? 1 : 0);
  /** Land worth walling with its culture (nearly) at the top keeps its one building plot for the fort (session 20b). */
  const keepForFort = (t: TerritoryId) => !!W && W.needsFort && near > 0 && wallWeight(t) > 0 && seen(t)!.culture + 1 >= W.culture;
  /** The next piece of the walls nearest done (a fort first if it has none, else a level of culture), up to `each` places. */
  const walls = (land: readonly TerritoryId[]): Wish[] => {
    if (!W || near <= 0) return [];
    return land
      .map((t) => ({ t, left: wallLeft(t), w: wallWeight(t) }))
      .filter((x): x is { t: TerritoryId; left: number; w: number } => x.left !== null && x.left > 0 && x.left <= near && x.w > 0)
      .sort((a, c) => a.left - c.left || c.w - a.w || (a.t < c.t ? -1 : 1))
      .slice(0, cfg.walls.each)
      .map(({ t }): Wish => {
        const v = seen(t)!;
        const needsFort = W.needsFort && v.building !== "fort" && v.construction?.building !== "fort";
        // The fort first (it takes a turn to build); culture rises a level a turn.
        return needsFort
          ? { order: { kind: "build", territory: t, building: "fort" }, territory: t, cost: fort, urgent: false }
          : { order: { kind: "invest", territory: t }, territory: t, cost: investCost(rules, v.culture)!, urgent: false };
      });
  };

  /**
   * Session 20d: the whole wall over `land`, best first: for each territory the fort (if it has none: it takes two turns)
   * and then every level of culture still to buy, one wish a level (several in a turn: `stack`).
   */
  const wallPieces = (land: readonly TerritoryId[]): Wish[] => {
    if (!W) return [];
    const out: Wish[] = [];
    for (const t of land) {
      if (wallLeft(t) === null || walled.has(t)) continue;
      const v = seen(t)!;
      if (W.needsFort && v.building !== "fort" && v.construction?.building !== "fort") out.push({ order: { kind: "build", territory: t, building: "fort" }, territory: t, cost: fort, urgent: false });
      for (let c = v.culture; c < W.culture; c++) out.push({ order: { kind: "invest", territory: t }, territory: t, cost: investCost(rules, c) ?? Infinity, urgent: false, stack: true });
    }
    return out;
  };
  /** Forts on choke points that face a rival (session 20d): where a wall may be wanted, and the cheapest half of one. */
  const chokeForts = (): Wish[] =>
    shape && plan?.chokeForts
      ? mine
          .filter((t) => shape.choke.has(t) && facesRival(t) && !building(t) && !candidateSet.has(t))
          .sort((a, c) => biggestEnemyNear(c) - biggestEnemyNear(a) || (a < c ? -1 : 1))
          .map((t): Wish => ({ order: { kind: "build", territory: t, building: "fort" }, territory: t, cost: fort, urgent: false }))
      : [];

  const sites = mine.filter((t) => isRecruitSiteIn(b.ctx, view, t));
  /** A barracks where land facing rivals is more than a step from anywhere to recruit (or there's nowhere at all). */
  const barracksFor = (land: readonly TerritoryId[]): Wish[] => {
    if (mine.some((t) => seen(t)!.construction?.building === "barracks")) return [];
    const near = (t: TerritoryId) => sites.some((s) => s === t || idx.neighbors.get(t)!.includes(s));
    let spot = land.filter((t) => !building(t) && facesRival(t) && (!sites.length || !near(t))).sort((a, c) => biggestEnemyNear(c) - biggestEnemyNear(a) || (a < c ? -1 : 1))[0];
    // With a plan (session 20d): a step or two back from that front, as deep inside as it can, off the fort plots.
    if (spot && shape) {
      const d = new Map<TerritoryId, number>([[spot, 0]]);
      const q = [spot];
      for (let h = 0; h < q.length; h++) if (d.get(q[h]!)! < 2) for (const nb of idx.neighbors.get(q[h]!)!) if (owned(nb) && !d.has(nb)) (d.set(nb, d.get(q[h]!)! + 1), q.push(nb));
      spot = [...d.keys()].filter((t) => !building(t) && !fortPlot(t)).sort((a, c) => interior(c) - interior(a) || d.get(a)! - d.get(c)! || (a < c ? -1 : 1))[0] ?? spot;
    }
    return spot ? [{ order: { kind: "build", territory: spot, building: "barracks" }, territory: spot, cost: barracks, urgent: !sites.length }] : [];
  };

  // ---------- Each command's list, best first ----------
  let wishes: Wish[] = [];
  const garrisons: { t: TerritoryId; short: number }[] = [];
  switch (command.kind) {
    case "buildUp": {
      const land = members(command.province).filter(owned);
      wishes = [...forts(land), ...walls(land), ...barracksFor(land), ...economy(land).filter((w) => w.order.kind === "build"), ...culture(land).filter((w) => holdCulture(w.territory) || quiet(w.territory))];
      break;
    }
    case "fortify": {
      const front = mine.filter((t) => facesRival(t, command.player));
      wishes = forts(front, command.player);
      for (const t of front) {
        const short = holdNeed(t) - troopsAt(t);
        if (short > 0) garrisons.push({ t, short });
      }
      garrisons.sort((x, y) => (y.t === capital ? 1 : 0) - (x.t === capital ? 1 : 0) || y.short - x.short || (x.t < y.t ? -1 : 1));
      break;
    }
    case "culture":
      wishes = culture(members(command.province).filter(owned));
      break;
    case "economy":
      wishes = economy(mine);
      break;
    case "realm": {
      const urgent = forts(mine).filter((w) => w.territory === capital || chokeHolder(w.territory) || w.urgent || asked.has(w.territory));
      // What pays (Part 2's sims): markets before culture bought for income, which doesn't pay back yet; culture only
      // where it protects (the capital and choke points facing an army), a level a turn.
      // With a plan (session 20d): threatened, everything into the wall (after a threatened capital's fort); otherwise
      // markets (deep inside), then the wall with what's left, then forts at choke points, then the rest.
      const rush = shape?.threatened ? wallPieces(candidates) : [];
      const steady = shape && !shape.threatened ? wallPieces(candidates) : [];
      wishes = shape
        ? [
            ...urgent.filter((w) => w.territory === capital && !candidateSet.has(capital)),
            ...rush,
            ...urgent.filter((w) => !candidateSet.has(w.territory) || !shape.threatened),
            ...(turtle ? steady : []),
            ...economy(mine).filter((w) => w.order.kind === "build").slice(0, merchant?.markets ?? Infinity),
            ...steady,
            ...chokeForts(),
            ...barracksFor(mine),
            ...(turtle ? culture(mine).filter((w) => holdCulture(w.territory)).slice(0, turtle.culture) : culture(mine).filter((w) => (w.territory === capital || chokeHolder(w.territory)) && holdCulture(w.territory)).slice(0, 1)),
            ...economy(mine).filter((w) => w.order.kind === "invest" && payback(w.territory, "culture") >= (merchant?.culturePays ?? cfg.culturePays)),
          ]
        : turtle
        ? [
            // The Turtle (session 20c): forts wherever an army stands next door, and culture where it protects, first.
            ...forts(mine),
            ...walls(mine),
            ...culture(mine).filter((w) => holdCulture(w.territory)).slice(0, turtle.culture),
            ...barracksFor(mine),
            ...economy(mine).filter((w) => w.order.kind === "invest" && payback(w.territory, "culture") >= cfg.culturePays),
            ...economy(mine).filter((w) => w.order.kind === "build"),
          ]
        : merchant
          ? [
              // The Merchant (session 20c): a threatened capital's fort, then markets, then the other urgent forts,
              // then culture for its income. (Markets before even the capital's fort made it 4-7 points stronger than
              // Neutral in the sims.)
              ...urgent.filter((w) => w.territory === capital),
              ...economy(mine).filter((w) => w.order.kind === "build").slice(0, merchant.markets ?? Infinity),
              ...urgent,
              ...walls(mine),
              ...barracksFor(mine),
              ...economy(mine).filter((w) => w.order.kind === "invest" && payback(w.territory, "culture") >= merchant.culturePays),
            ]
          : [
              ...urgent,
              ...economy(mine).filter((w) => w.order.kind === "build"),
              ...walls(mine),
              ...barracksFor(mine),
              ...culture(mine).filter((w) => (w.territory === capital || chokeHolder(w.territory)) && holdCulture(w.territory)).slice(0, 1),
              // Culture for its income, where it pays back as well as a market would (session 19).
              ...economy(mine).filter((w) => w.order.kind === "invest" && payback(w.territory, "culture") >= cfg.culturePays),
            ];
      break;
    }
  }

  // ---------- Buy, best first; save up for something urgent ----------
  const orders: Order[] = [];
  let gold = purse;
  const bought = new Set<string>();
  /** Levels of culture bought this turn, by place (session 20d: a wall's culture can rise several levels in a turn). */
  const raised = new Map<TerritoryId, number>();
  const builtHere = new Set<TerritoryId>();
  for (const w of wishes) {
    // One thing per place a turn (culture one level, or a building on an empty plot), except a wall going up with a
    // plan (session 20d): its fort and as many levels of culture as the purse holds, each at its own price.
    const key = w.territory;
    const stacking = !!w.stack;
    if (w.order.kind === "build" ? building(w.territory) || builtHere.has(key) || (!plan && bought.has(key)) : stacking ? false : bought.has(key)) continue;
    const level = (seen(w.territory)?.culture ?? 0) + (raised.get(key) ?? 0);
    const cost = w.order.kind === "invest" && stacking ? investCost(rules, level) : w.cost;
    if (cost === null || (w.order.kind === "invest" && !stacking && (raised.get(key) ?? 0) > 0)) continue;
    if (cost > gold) {
      if (w.urgent) break;
      continue;
    }
    orders.push({ ...w.order, id: newId() } as Order);
    gold -= cost;
    bought.add(key);
    if (w.order.kind === "invest") raised.set(key, (raised.get(key) ?? 0) + 1);
    if (w.order.kind === "build") (taken.add(w.territory), builtHere.add(key));
  }
  // Garrisons (Fortify): troops recruited where the border is short, at the nearest recruit site (through our own
  // land), marched in (or a step on their way).
  for (const g of garrisons) {
    if (gold < troop) break;
    const d = new Map<TerritoryId, number>([[g.t, 0]]);
    const q = [g.t];
    for (let h = 0; h < q.length; h++)
      for (const nb of idx.neighbors.get(q[h]!)!)
        if (owned(nb) && !d.has(nb)) (d.set(nb, d.get(q[h]!)! + 1), q.push(nb));
    const site = sites.filter((x) => d.has(x)).sort((x, y) => d.get(x)! - d.get(y)! || (x < y ? -1 : 1))[0];
    if (!site) continue;
    const count = Math.min(Math.floor(gold / troop), g.short);
    orders.push({ id: newId(), kind: "recruit", territory: site, count } as Order);
    const step = site === g.t ? null : idx.neighbors.get(site)!.filter((x) => d.get(x) === d.get(site)! - 1).sort()[0];
    if (step) orders.push({ id: newId(), kind: "move", from: site, to: step, troops: count } as Order);
    gold -= count * troop;
  }
  return orders;
}

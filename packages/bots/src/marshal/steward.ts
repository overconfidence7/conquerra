import type { LeaderPlanning } from "@conquerra/content";
import { investCost, isRecruitSiteIn, type Order, type PlayerId, type StewardCommand, type TerritoryId } from "@conquerra/engine";
import type { Board } from "../board";

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
 *  - Run the realm: urgent forts first (a threatened capital, choke points facing an army), markets where they pay, a
 *    barracks where there's nowhere to recruit, and a level of culture a turn where it protects (the capital and choke
 *    points facing an army). Culture bought only for its income doesn't pay back under today's rules (session 18's
 *    sims: it halved a Captain's wins), so "Run the realm" leaves it to "Raise culture here" and "Grow the economy".
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
}

export function planSteward(b: Board, cfg: LeaderPlanning["steward"], command: StewardCommand, purse: number, newId: () => string, taken: Set<TerritoryId>, maxTurns: number): Order[] {
  const { rules, idx, mine, seen, owned, rivalAt, troopsAt, biggestEnemyNear, holdNeed, chokeHolder, capital, capThreatened, look0, view } = b;
  const building = (t: TerritoryId) => !!seen(t)?.building || !!seen(t)?.construction || taken.has(t);
  const provinceOf = (t: TerritoryId) => idx.byId.get(t)!.province;
  const members = (prov: string) => idx.provinceMembers.get(prov) ?? [];
  const holdsWhole = (prov: string) => members(prov).every(owned);
  /** No rival next to it, as far as we know. */
  const quiet = (t: TerritoryId) => idx.neighbors.get(t)!.every((x) => owned(x) || look0(x) === null);
  const facesRival = (t: TerritoryId, r?: PlayerId) => idx.neighbors.get(t)!.some((x) => (r ? rivalAt(x) === r : !!rivalAt(x)));
  const fort = rules.buildings.fort.cost, market = rules.buildings.market.cost, barracks = rules.buildings.barracks.cost, troop = rules.troops.cost;

  // ---------- What could be bought, and what each is worth ----------
  /** A fort matters where a big enough rival army stands next door and the troops there couldn't hold alone. */
  const fortWorth = (t: TerritoryId, r?: PlayerId) => {
    if (building(t)) return 0;
    const threat = idx.neighbors.get(t)!.reduce((m, x) => (rivalAt(x) && (!r || rivalAt(x) === r) ? Math.max(m, troopsAt(x)) : m), 0);
    if (threat < cfg.fortThreat) return 0;
    const weight = t === capital ? 3 : chokeHolder(t) ? 2 : holdsWhole(provinceOf(t)) ? 1.5 : 1;
    const short = holdNeed(t) > troopsAt(t) ? 1.5 : 1;
    return threat * weight * short;
  };
  const forts = (land: readonly TerritoryId[], r?: PlayerId): Wish[] =>
    land
      .map((t) => ({ t, w: fortWorth(t, r) }))
      .filter((x) => x.w > 0)
      .sort((a, c) => c.w - a.w || (a.t < c.t ? -1 : 1))
      .map(({ t }) => ({ order: { kind: "build", territory: t, building: "fort" }, territory: t, cost: fort, urgent: t === capital ? capThreatened : holdNeed(t) > troopsAt(t) }));
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
      if (marketsPay && !building(t) && quiet(t)) out.push({ w: { order: { kind: "build", territory: t, building: "market" }, territory: t, cost: market, urgent: false }, pay: payback(t, "market") });
      const cost = investCost(rules, seen(t)!.culture);
      if (cost !== null) out.push({ w: { order: { kind: "invest", territory: t }, territory: t, cost, urgent: false }, pay: payback(t, "culture") });
    }
    return out.sort((a, c) => c.pay - a.pay || (a.w.territory < c.w.territory ? -1 : 1)).map((x) => x.w);
  };
  const culture = (land: readonly TerritoryId[]): Wish[] =>
    land
      .filter((t) => investCost(rules, seen(t)!.culture) !== null)
      .sort((a, c) => Number(holdCulture(c)) - Number(holdCulture(a)) || seen(a)!.culture - seen(c)!.culture || biggestEnemyNear(c) - biggestEnemyNear(a) || (a < c ? -1 : 1))
      .map((t) => ({ order: { kind: "invest", territory: t }, territory: t, cost: investCost(rules, seen(t)!.culture)!, urgent: false }));
  const sites = mine.filter((t) => isRecruitSiteIn(b.ctx, view, t));
  /** A barracks where land facing rivals is more than a step from anywhere to recruit (or there's nowhere at all). */
  const barracksFor = (land: readonly TerritoryId[]): Wish[] => {
    if (mine.some((t) => seen(t)!.construction?.building === "barracks")) return [];
    const near = (t: TerritoryId) => sites.some((s) => s === t || idx.neighbors.get(t)!.includes(s));
    const spot = land.filter((t) => !building(t) && facesRival(t) && (!sites.length || !near(t))).sort((a, c) => biggestEnemyNear(c) - biggestEnemyNear(a) || (a < c ? -1 : 1))[0];
    return spot ? [{ order: { kind: "build", territory: spot, building: "barracks" }, territory: spot, cost: barracks, urgent: !sites.length }] : [];
  };

  // ---------- Each command's list, best first ----------
  let wishes: Wish[] = [];
  const garrisons: { t: TerritoryId; short: number }[] = [];
  switch (command.kind) {
    case "buildUp": {
      const land = members(command.province).filter(owned);
      wishes = [...forts(land), ...barracksFor(land), ...economy(land).filter((w) => w.order.kind === "build"), ...culture(land).filter((w) => holdCulture(w.territory) || quiet(w.territory))];
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
      const urgent = forts(mine).filter((w) => w.territory === capital || chokeHolder(w.territory) || w.urgent);
      // What pays (Part 2's sims): markets before culture bought for income, which doesn't pay back yet; culture only
      // where it protects (the capital and choke points facing an army), a level a turn.
      wishes = [
        ...urgent,
        ...economy(mine).filter((w) => w.order.kind === "build"),
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
  for (const w of wishes) {
    // One thing per place a turn (culture rises one level at a time; a building needs an empty plot).
    const key = w.territory;
    if (bought.has(key) || (w.order.kind === "build" && building(w.territory))) continue;
    if (w.cost > gold) {
      if (w.urgent) break;
      continue;
    }
    orders.push({ ...w.order, id: newId() } as Order);
    gold -= w.cost;
    bought.add(key);
    if (w.order.kind === "build") taken.add(w.territory);
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

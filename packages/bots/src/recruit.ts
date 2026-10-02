import type { UnitType } from "@conquerra/content";
import {
  indexMap,
  previewAttack,
  Rng,
  seedRng,
  totalUnits,
  type GameContext,
  type Order,
  type PlayerView,
  type TerritoryId,
  type Units,
} from "@conquerra/engine";

export interface Bot {
  id: string;
  name: string;
  plan(ctx: GameContext, view: PlayerView): Order[];
}

/**
 * "Recruit" tier bot. Plays only from its own fog-limited view, with the same rules as people.
 * Strategy, in plain terms:
 *  1. Build a market at home early, raise a new leader if it died, then spend the rest on troops.
 *  2. From each border territory, attack the most valuable neighbors it can probably take.
 *  3. Push idle troops from safe interior land toward the border.
 */
export const recruitBot: Bot = {
  id: "recruit",
  name: "Recruit",
  plan(ctx, view) {
    const { rules } = ctx;
    const idx = indexMap(ctx.map);
    const me = view.me;
    const rng = new Rng(seedRng(`${view.gameId}|${me.id}|${view.turn}|bot`));
    const orders: Order[] = [];
    let n = 0;
    const id = () => `${me.id}-t${view.turn}-${n++}`;

    const owned = (t: TerritoryId) => {
      const v = view.territories[t];
      return !!v && v.visible && v.owner === me.id;
    };
    const mine = idx.ids.filter(owned);
    const isFrontier = (t: TerritoryId) => idx.neighbors.get(t)!.some((x) => !owned(x));
    const garrison = rules.setup.minGarrison;
    const unitsAt = (t: TerritoryId): Units => {
      const v = view.territories[t];
      return v && v.visible ? { ...v.units } : { infantry: 0, cavalry: 0, siege: 0 };
    };

    // ---------- 1. Economy ----------
    let gold = me.gold;
    const capitalHeld = owned(me.capital);
    if (!me.leader.alive && capitalHeld && gold >= rules.leader.raiseCost + 6) {
      orders.push({ id: id(), kind: "raiseLeader" });
      gold -= rules.leader.raiseCost;
    }
    const capView = view.territories[me.capital];
    if (
      capitalHeld &&
      view.turn >= 2 &&
      capView?.visible &&
      !capView.building &&
      gold >= rules.buildings.market.cost + rules.units.infantry.cost * 2
    ) {
      orders.push({ id: id(), kind: "build", territory: me.capital, building: "market" });
      gold -= rules.buildings.market.cost;
    }
    const recruitSites = mine.filter((t) => {
      const v = view.territories[t];
      return t === me.capital || (v?.visible && v.building && rules.buildings[v.building].allowsRecruit);
    });
    // Recruit where the threat is: the site nearest an enemy, else the capital.
    const site = recruitSites.sort((a, b) => Number(isFrontier(b)) - Number(isFrontier(a)) || (a < b ? -1 : 1))[0];
    if (site) {
      const batch: Record<UnitType, number> = { infantry: 0, cavalry: 0, siege: 0 };
      const enemyFortNear = idx.neighbors.get(site)!.some((x) => {
        const v = view.territories[x];
        return v?.visible && v.owner && v.owner !== me.id && v.building === "fort";
      });
      while (true) {
        const pick: UnitType = enemyFortNear && batch.siege < 2 ? "siege" : rng.next() < 0.25 ? "cavalry" : "infantry";
        const cost = rules.units[pick].cost;
        if (gold >= cost) {
          batch[pick]++;
          gold -= cost;
        } else if (gold >= rules.units.infantry.cost) {
          batch.infantry++;
          gold -= rules.units.infantry.cost;
        } else break;
      }
      for (const u of ["infantry", "cavalry", "siege"] as const)
        if (batch[u] > 0) orders.push({ id: id(), kind: "recruit", territory: site, unit: u, count: batch[u] });
    }

    // ---------- 2. Attacks ----------
    const free = new Map<TerritoryId, Units>();
    for (const t of mine) {
      const u = unitsAt(t);
      // Keep the garrison back (cheapest first)
      let keep = garrison;
      for (const k of ["infantry", "siege", "cavalry"] as const) {
        const take = Math.min(u[k], keep);
        u[k] -= take;
        keep -= take;
      }
      free.set(t, u);
    }

    const provinceOf = (t: TerritoryId) => idx.byId.get(t)!.province;
    const valueOf = (t: TerritoryId): number => {
      const v = view.territories[t]!;
      if (!v.visible) return 0;
      const def = idx.byId.get(t)!;
      let val = 1 + rules.terrain[def.terrain].income;
      const prov = ctx.map.provinces.find((p) => p.id === def.province)!;
      const members = idx.provinceMembers.get(prov.id)!;
      const missing = members.filter((m) => !owned(m)).length;
      if (missing === 1) val += prov.bonus * 2;
      else if (missing === 2) val += prov.bonus;
      if (v.owner && v.owner !== me.id) {
        val += 1;
        if (view.players.length && v.leaders.includes(v.owner)) val += 2;
      }
      if (v.building) val += 2;
      return val;
    };

    type Plan = { from: TerritoryId; to: TerritoryId; army: Units; score: number; vsPlayer: boolean };
    const candidates: Plan[] = [];
    for (const from of mine) {
      const avail = free.get(from)!;
      if (totalUnits(avail) <= 0) continue;
      for (const to of idx.neighbors.get(from)!) {
        const tv = view.territories[to];
        if (!tv?.visible || tv.owner === me.id) continue;
        const army = smallestWinningArmy(ctx, view, from, to, avail);
        if (!army) continue;
        candidates.push({ from, to, army, score: valueOf(to) / Math.max(1, totalUnits(army)), vsPlayer: tv.owner !== null });
      }
    }
    candidates.sort((a, b) => b.score - a.score || (a.to < b.to ? -1 : 1));
    const targeted = new Set<TerritoryId>();
    let usedInitiative = false;
    for (const c of candidates) {
      if (targeted.has(c.to)) continue;
      const avail = free.get(c.from)!;
      if (["infantry", "cavalry", "siege"].some((k) => avail[k as UnitType] < c.army[k as UnitType])) continue;
      for (const k of ["infantry", "cavalry", "siege"] as const) avail[k] -= c.army[k];
      targeted.add(c.to);
      const o: Order = {
        id: id(),
        kind: "move",
        from: c.from,
        to: c.to,
        units: c.army,
        // Only go if we still hold the launch point with enough troops when this order's turn comes.
        conditions: [
          { kind: "owns", territory: c.from },
          { kind: "minUnits", territory: c.from, count: totalUnits(c.army) + garrison },
        ],
      };
      if (!usedInitiative && c.vsPlayer && me.leader.alive && me.cooldowns.seize === 0) {
        o.timing = "first";
        usedInitiative = true;
      }
      orders.push(o);
    }

    // ---------- 3. Move idle interior troops toward the border ----------
    const frontier = mine.filter(isFrontier);
    if (frontier.length) {
      // distance (through my land) from each territory to the nearest border territory
      const dist = new Map<TerritoryId, number>(frontier.map((f) => [f, 0]));
      const q = [...frontier];
      while (q.length) {
        const cur = q.shift()!;
        for (const nb of idx.neighbors.get(cur)!)
          if (owned(nb) && !dist.has(nb)) (dist.set(nb, dist.get(cur)! + 1), q.push(nb));
      }
      for (const t of mine) {
        if (isFrontier(t)) continue;
        const avail = free.get(t)!;
        if (totalUnits(avail) <= 0) continue;
        const d = dist.get(t);
        if (d === undefined) continue;
        const step = idx.neighbors.get(t)!.filter((nb) => owned(nb) && dist.get(nb) === d - 1).sort()[0];
        if (step) orders.push({ id: id(), kind: "move", from: t, to: step, units: avail });
      }
    }
    return orders;
  },
};

/** Smallest force from `avail` that is expected to take `to` (with one extra unit as a safety margin). */
function smallestWinningArmy(ctx: GameContext, view: PlayerView, from: TerritoryId, to: TerritoryId, avail: Units): Units | null {
  const terrain = indexMap(ctx.map).byId.get(to)!.terrain;
  const cavalryFirst = terrain === "plains";
  const order: UnitType[] = cavalryFirst ? ["cavalry", "infantry", "siege"] : ["infantry", "siege", "cavalry"];
  const max = totalUnits(avail);
  const army: Units = { infantry: 0, cavalry: 0, siege: 0 };
  const left = { ...avail };
  for (let size = 1; size <= max; size++) {
    const pick = order.find((u) => left[u] > 0)!;
    left[pick]--;
    army[pick]++;
    const e = previewAttack(ctx, view, from, to, army);
    if (!e) return null;
    if (e.captureLikely && size < max) {
      const k = order.find((u) => left[u] > 0)!;
      army[k]++;
      return army;
    }
    if (e.captureGuaranteed) return army;
  }
  return null;
}

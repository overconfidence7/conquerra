import type { SpecialistType } from "@conquerra/content";
import {
  indexMap,
  investCost,
  previewAttack,
  Rng,
  seedRng,
  type GameContext,
  type Order,
  type PlayerView,
  type TerritoryDetail,
  type TerritoryId,
} from "@conquerra/engine";

export interface Bot {
  id: string;
  name: string;
  plan(ctx: GameContext, view: PlayerView): Order[];
}

type Seen = TerritoryDetail & { detail: "full" };

/**
 * "Recruit" tier bot. Plays only from its own fog-limited view, with the same rules as people.
 * Strategy, in plain terms:
 *  1. Spend: raise a fallen leader, put a barracks near the front once the realm grows, hire a specialist
 *     when it clearly helps (siege next to enemy forts, cavalry for reach, healers once unlocked),
 *     a little culture in safe interior land when rich, and everything else on troops at the front.
 *  2. Attack the most valuable neighbours it can probably take, with the "Only if still stronger" preset,
 *     and "Follow through" when it has plenty to spare.
 *  3. March idle interior troops toward the front, concentrating on the border that faces the most enemy troops.
 *  4. Keep a reserve ready with "Reinforce if hit", and pull badly outnumbered stacks back with "Retreat if outnumbered".
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
    const garrison = rules.setup.minGarrison;

    const seen = (t: TerritoryId): Seen | null => {
      const v = view.territories[t];
      return v && v.detail === "full" ? v : null;
    };
    const owned = (t: TerritoryId) => seen(t)?.owner === me.id;
    const enemy = (t: TerritoryId) => {
      const v = seen(t);
      return !!v && v.owner !== null && v.owner !== me.id;
    };
    const mine = idx.ids.filter(owned);
    const isFrontier = (t: TerritoryId) => idx.neighbors.get(t)!.some((x) => !owned(x));
    const enemyPressure = (t: TerritoryId) =>
      idx.neighbors.get(t)!.reduce((a, x) => a + (enemy(x) ? seen(x)!.troops : 0), 0);
    const biggestEnemyNear = (t: TerritoryId) =>
      idx.neighbors.get(t)!.reduce((a, x) => Math.max(a, enemy(x) ? seen(x)!.troops : 0), 0);
    const troopsAt = (t: TerritoryId) => seen(t)?.troops ?? 0;

    // ---------- 1. Spending ----------
    let gold = me.gold;
    const capitalHeld = owned(me.capital);
    if (!me.leader.alive && capitalHeld && gold >= rules.leader.raiseCost + rules.troops.cost * 3) {
      orders.push({ id: id(), kind: "raiseLeader" });
      gold -= rules.leader.raiseCost;
    }

    const frontier = mine.filter(isFrontier);
    const recruitSites = mine.filter((t) => t === me.capital || seen(t)?.building === "barracks");
    // A barracks on the busiest front once the realm has grown, so new troops start where the fighting is.
    // Build another whenever the front has moved more than a step away from every recruiting site.
    const hotFront = [...frontier].sort((a, b) => enemyPressure(b) - enemyPressure(a) || (a < b ? -1 : 1))[0];
    const nearSite = (t: TerritoryId) => recruitSites.some((r) => r === t || idx.neighbors.get(t)!.includes(r));
    const building = mine.some((t) => seen(t)!.construction?.building === "barracks");
    if (
      hotFront &&
      !nearSite(hotFront) &&
      !building &&
      mine.length >= 5 &&
      !recruitSites.includes(hotFront) &&
      !seen(hotFront)!.building &&
      !seen(hotFront)!.construction &&
      gold >= rules.buildings.barracks.cost + rules.troops.cost * 4
    ) {
      orders.push({ id: id(), kind: "build", territory: hotFront, building: "barracks" });
      gold -= rules.buildings.barracks.cost;
    }

    // Recruit where the threat is: the frontier site under most pressure, else the capital.
    const site = [...recruitSites].sort(
      (a, b) => Number(isFrontier(b)) - Number(isFrontier(a)) || enemyPressure(b) - enemyPressure(a) || (a < b ? -1 : 1),
    )[0];
    if (site) {
      const here = seen(site)!;
      const room = rules.specialists.maxPerArmy - here.specialists.length;
      const has = (t: SpecialistType) => here.specialists.some((s) => s.type === t);
      const provinceCulture = (idx.provinceMembers.get(idx.byId.get(site)!.province) ?? [])
        .filter(owned)
        .reduce((a, t) => a + seen(t)!.culture, 0);
      const unlocked = (t: SpecialistType) => rules.specialists[t].cultureRequired <= provinceCulture;
      const enemyFortNear = idx.neighbors.get(site)!.some((x) => enemy(x) && seen(x)!.building === "fort");
      let want: SpecialistType | null = null;
      if (enemyFortNear && !has("siege") && unlocked("siege")) want = "siege";
      else if (unlocked("healers") && !has("healers") && here.troops >= 15) want = "healers";
      else if (!has("cavalry") && here.troops >= 10 && rng.next() < 0.3) want = "cavalry";
      if (want && room > 0 && gold >= rules.specialists[want].cost + rules.troops.cost * 4) {
        orders.push({ id: id(), kind: "hire", territory: site, specialist: want });
        gold -= rules.specialists[want].cost;
      }
    }

    // A little culture: when comfortably rich, in the safest interior land (light touch, military first).
    const interior = mine.filter((t) => !isFrontier(t));
    if (interior.length && gold >= 30 && rng.next() < 0.5) {
      const spot = [...interior].sort((a, b) => seen(a)!.culture - seen(b)!.culture || (a < b ? -1 : 1))[0]!;
      const cost = investCost(rules, seen(spot)!.culture);
      if (cost !== null && gold - cost >= 20) {
        orders.push({ id: id(), kind: "invest", territory: spot });
        gold -= cost;
      }
    }

    if (site && gold >= rules.troops.cost) {
      const count = Math.floor(gold / rules.troops.cost);
      orders.push({ id: id(), kind: "recruit", territory: site, count });
      gold -= count * rules.troops.cost;
    }
    // Plan with the troops we just recruited (they can act this turn).
    const recruited = orders.reduce((a, o) => a + (o.kind === "recruit" ? o.count : 0), 0);
    const free = new Map<TerritoryId, number>();
    for (const t of mine) free.set(t, Math.max(0, troopsAt(t) - garrison + (t === site ? recruited : 0)));
    const specsAt = (t: TerritoryId): SpecialistType[] => seen(t)?.specialists.map((s) => s.type) ?? [];

    // ---------- 2. Attacks ----------
    const valueOf = (t: TerritoryId): number => {
      const v = seen(t)!;
      const def = idx.byId.get(t)!;
      let val = 1 + rules.terrain[def.terrain].income + v.culture * 0.5;
      const prov = ctx.map.provinces.find((p) => p.id === def.province)!;
      const missing = (idx.provinceMembers.get(prov.id) ?? []).filter((m) => !owned(m)).length;
      if (missing === 1) val += prov.bonus * 2;
      else if (missing === 2) val += prov.bonus;
      if (v.owner && v.owner !== me.id) {
        val += 2;
        if (v.leaders.includes(v.owner)) val += 3;
      }
      if (v.building) val += 2;
      return val;
    };

    type Plan = { from: TerritoryId; to: TerritoryId; troops: number; score: number; vsPlayer: boolean; spare: number };
    const candidates: Plan[] = [];
    for (const from of mine) {
      const avail = free.get(from)!;
      if (avail <= 0) continue;
      for (const to of idx.neighbors.get(from)!) {
        const tv = seen(to);
        if (!tv || tv.owner === me.id) continue;
        const troops = smallestWinningArmy(ctx, view, from, to, avail, specsAt(from));
        if (troops === null) continue;
        candidates.push({ from, to, troops, score: valueOf(to) / Math.max(1, troops), vsPlayer: tv.owner !== null, spare: avail - troops });
      }
    }
    candidates.sort((a, b) => b.score - a.score || (a.to < b.to ? -1 : 1));
    const targeted = new Set<TerritoryId>();
    let usedInitiative = false;
    const attackedFrom = new Set<TerritoryId>();
    for (const c of candidates) {
      if (targeted.has(c.to)) continue;
      const avail = free.get(c.from)!;
      if (avail < c.troops) continue;
      // Concentrate: a big stack throws extra weight into its main attack instead of trickling.
      const extra = attackedFrom.has(c.from) ? 0 : Math.floor((avail - c.troops) * 0.5);
      const send = c.troops + extra;
      free.set(c.from, avail - send);
      targeted.add(c.to);
      attackedFrom.add(c.from);
      const pushOn = send - c.troops >= 6;
      const o: Order = {
        id: id(),
        kind: "move",
        from: c.from,
        to: c.to,
        troops: send,
        preset: pushOn ? { id: "followThrough" } : { id: "onlyIfStronger" },
        ...(pushOn ? { conditions: [{ kind: "odds", atLeast: "likely" }] } : {}),
      };
      if (!usedInitiative && c.vsPlayer && me.leader.alive && me.cooldowns.seize === 0) {
        o.timing = "first";
        usedInitiative = true;
      }
      orders.push(o);
    }

    // ---------- 3. Move idle interior troops toward the front ----------
    if (frontier.length) {
      // Prefer fronts facing the most enemy troops, so reinforcements pile up where they matter.
      const weight = new Map(frontier.map((f) => [f, enemyPressure(f)]));
      const dist = new Map<TerritoryId, number>(frontier.map((f) => [f, 0]));
      const q = [...frontier];
      while (q.length) {
        const cur = q.shift()!;
        for (const nb of idx.neighbors.get(cur)!)
          if (owned(nb) && !dist.has(nb)) {
            dist.set(nb, dist.get(cur)! + 1);
            weight.set(nb, weight.get(cur)!);
            q.push(nb);
          }
      }
      let reserveUsed = false;
      for (const t of mine) {
        if (isFrontier(t)) continue;
        const avail = free.get(t)!;
        if (avail <= 0) continue;
        const d = dist.get(t);
        if (d === undefined) continue;
        const steps = idx.neighbors.get(t)!.filter((nb) => owned(nb) && dist.get(nb) === d - 1);
        const step = steps.sort((a, b) => weight.get(b)! - weight.get(a)! || (a < b ? -1 : 1))[0];
        if (!step) continue;
        // One interior stack next to a threatened front waits in reserve and only goes if that front is hit.
        if (!reserveUsed && d === 1 && biggestEnemyNear(step) > troopsAt(step) && me.leader.alive && me.cooldowns.lie === 0) {
          reserveUsed = true;
          orders.push({ id: id(), kind: "move", from: t, to: step, troops: avail, preset: { id: "reinforceIfHit" }, timing: "last" });
          continue;
        }
        orders.push({ id: id(), kind: "move", from: t, to: step, troops: avail });
      }
    }

    // ---------- 4. Pull back stacks that would be crushed ----------
    for (const t of frontier) {
      if (t === me.capital || attackedFrom.has(t)) continue;
      const mineHere = troopsAt(t);
      if (mineHere >= 6 && biggestEnemyNear(t) >= mineHere * 2.5)
        orders.push({ id: id(), kind: "retreat", from: t, preset: { id: "retreatIfOutnumbered" } });
    }
    return orders;
  },
};

/** Fewest troops from `avail` expected to take `to`, plus a safety margin; null if even all of them can't. */
function smallestWinningArmy(
  ctx: GameContext,
  view: PlayerView,
  from: TerritoryId,
  to: TerritoryId,
  avail: number,
  specialists: SpecialistType[],
): number | null {
  const likely = (troops: number) => previewAttack(ctx, view, { from, to, troops, specialists })?.captureLikely ?? false;
  if (avail <= 0 || !likely(avail)) return null;
  let lo = 1, hi = avail;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (likely(mid)) hi = mid;
    else lo = mid + 1;
  }
  return Math.min(avail, lo + Math.max(1, Math.ceil(lo * 0.2)));
}

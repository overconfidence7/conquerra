import type { BuildingType } from "@conquerra/content";
import { setsIn, type Order, type PlayerView, type SpoilsSet, type TerritoryId } from "@conquerra/engine";
import type { Board } from "./board";

/**
 * The bots and the Spoils deck (session 13). Bots judge cards only from their own view: their own hand, and how many
 * cards rivals hold. Windfalls never grow, so a bot turns a set in as soon as it has one.
 */

export type SpoilsChoice = { set: SpoilsSet; territory?: TerritoryId; building?: BuildingType };

/** The turn-in order (`id` is only asked for when there is one, so a bot's other order ids don't shift). */
export const spoilsOrder = (view: PlayerView, id: () => string, c: SpoilsChoice | null): Order | null =>
  c && view.settings.spoils ? ({ id: id(), kind: "spoils", set: c.set, ...(c.territory ? { territory: c.territory } : {}), ...(c.building ? { building: c.building } : {}) } as Order) : null;

/**
 * The Captain's choice, from its usual judgement:
 *  - one of each first whenever it has it (the best set since session 16): its fort on the front it most needs to hold,
 *    or, with no front needing one, a market on its safest land without a building;
 *  - three Towers: a fort on the front it most needs to hold (a choke point it holds, or its threatened capital, else
 *    the frontier land facing the biggest rival army), when that land has no building;
 *  - three Laurels: culture where it means to hold (its capital, or a choke point it holds facing a rival);
 *  - three Swords: troops at its capital;
 *  - one of each when that's all it has (or a Tower set would find nowhere worth a fort).
 */
export function captainSpoils(b: Board): SpoilsChoice | null {
  const { me, frontier, mine, seen, troopsAt, biggestEnemyNear, chokeHolder, capital, capThreatened, ctx } = b;
  const sets = setsIn(me.spoils);
  if (!sets.length) return null;
  const free = (t: TerritoryId) => !seen(t)?.building && !seen(t)?.construction;
  const threat = (t: TerritoryId) => biggestEnemyNear(t) - troopsAt(t);
  const spots = [...(capThreatened && capital ? [capital] : []), ...frontier.filter((t) => chokeHolder(t) && biggestEnemyNear(t) > 0), ...frontier.filter((t) => biggestEnemyNear(t) >= 4)].filter(free);
  const fortSpot = spots.sort((a, c) => Number(c === capital && capThreatened) - Number(a === capital && capThreatened) || Number(chokeHolder(c)) - Number(chokeHolder(a)) || threat(c) - threat(a) || (a < c ? -1 : 1))[0];
  if (sets.includes("mixed")) {
    if (fortSpot) return { set: "mixed", territory: fortSpot, building: "fort" };
    const safe = mine.filter(free).sort((a, c) => threat(a) - threat(c) || (a < c ? -1 : 1))[0];
    return safe ? { set: "mixed", territory: safe, building: "market" } : { set: "mixed" };
  }
  if (sets.includes("tower") && fortSpot) return { set: "tower", territory: fortSpot };
  if (sets.includes("laurel")) {
    const max = ctx.rules.culture.max;
    const hold = [...(capital ? [capital] : []), ...frontier.filter((t) => chokeHolder(t) && biggestEnemyNear(t) > 0)].filter((t) => (seen(t)?.culture ?? max) < max);
    return { set: "laurel", territory: hold[0] ?? capital ?? mine[0]! };
  }
  if (sets.includes("sword")) return { set: "sword" };
  // Only a Tower set and nowhere it's needed: the safest land without a building.
  const spot = mine.filter(free).sort((a, c) => threat(c) - threat(a) || (a < c ? -1 : 1))[0];
  return spot ? { set: "tower", territory: spot } : null;
}

/** The Recruit's simple choice: one of each (a fort where the game puts it), Swords, a fort on its busiest front, or Laurels at its capital. */
export function recruitSpoils(view: PlayerView, frontier: readonly TerritoryId[], pressure: (t: TerritoryId) => number): SpoilsChoice | null {
  const sets = setsIn(view.me.spoils);
  if (sets.includes("mixed")) return { set: "mixed" };
  if (sets.includes("sword")) return { set: "sword" };
  const held = (t: TerritoryId) => {
    const v = view.territories[t];
    return v?.detail === "full" && v.owner === view.me.id;
  };
  const free = (t: TerritoryId) => {
    const v = view.territories[t];
    return held(t) && v?.detail === "full" && !v.building && !v.construction;
  };
  // Home: the capital if it still holds it, else its strongest land.
  const home = held(view.me.capital) ? view.me.capital : [...frontier].filter(held).sort((a, b) => pressure(a) - pressure(b) || (a < b ? -1 : 1))[0];
  if (sets.includes("tower")) {
    // Its busiest front without a building, else home, else any of its land without one.
    const anyFree = Object.keys(view.territories).filter(free).sort()[0];
    const spot = [...frontier].filter(free).sort((a, b) => pressure(b) - pressure(a) || (a < b ? -1 : 1))[0] ?? (home && free(home) ? home : anyFree);
    if (spot) return { set: "tower", territory: spot };
  }
  if (sets.includes("laurel") && home) return { set: "laurel", territory: home };
  return null;
}

/**
 * Fate missions pull the Captain a little (session 13): an attack that would complete or advance an open mission
 * scores this much higher. It's only a nudge on attacks it already judged likely to win, so it never chases a bad
 * mission (one it can't win, or that would leave its land bare).
 */
export const MISSION_PULL = 1.3;

export function missionPull(b: Board, from: TerritoryId, to: TerritoryId): number {
  const { me, idx, rivalAt, border } = b;
  let pull = 1;
  for (const m of me.missions) {
    const prov = idx.byId.get(to)!.province;
    const helps =
      (m.kind === "takeIn" && prov === m.province) ||
      (m.kind === "whole" && prov === m.province) ||
      (m.kind === "takeFrom" && rivalAt(to) === m.rival) ||
      (m.kind === "cross" && border(from, to) === m.border) ||
      m.kind === "spree";
    if (helps) pull = Math.max(pull, m.kind === "spree" ? 1.1 : MISSION_PULL);
  }
  return pull;
}

/** A fort or culture mission the Captain can afford without going short: where to build or invest (else null). */
export function missionSpend(b: Board, gold: number): { kind: "fort" | "invest"; territory: TerritoryId; cost: number } | null {
  const { me, rules, seen, owned, idx } = b;
  const reserve = rules.troops.cost * 4;
  for (const m of me.missions) {
    if (m.kind === "fort" && m.territory && owned(m.territory) && !seen(m.territory)?.building && !seen(m.territory)?.construction) {
      const cost = rules.buildings.fort.cost;
      if (gold >= cost + reserve) return { kind: "fort", territory: m.territory, cost };
    }
    if (m.kind === "culture" && m.province) {
      const spot = (idx.provinceMembers.get(m.province) ?? [])
        .filter((t) => owned(t) && seen(t)!.culture < rules.culture.max)
        .sort((a, c) => seen(a)!.culture - seen(c)!.culture || (a < c ? -1 : 1))[0];
      const cost = spot ? rules.culture.investCost[seen(spot)!.culture] : undefined;
      if (spot && cost !== undefined && gold >= cost + reserve) return { kind: "invest", territory: spot, cost };
    }
  }
  return null;
}

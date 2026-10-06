import { setsIn, type Order, type PlayerView, type SpoilsSet, type TerritoryId } from "@conquerra/engine";
import type { Board } from "./board";

/**
 * The bots and the Spoils deck (session 13). Bots judge cards only from their own view: their own hand, and how many
 * cards rivals hold. Windfalls never grow, so a bot turns a set in as soon as it has one.
 */

export type SpoilsChoice = { set: SpoilsSet; territory?: TerritoryId };

/** The turn-in order (`id` is only asked for when there is one, so a bot's other order ids don't shift). */
export const spoilsOrder = (view: PlayerView, id: () => string, c: SpoilsChoice | null): Order | null =>
  c && view.settings.spoils ? ({ id: id(), kind: "spoils", set: c.set, ...(c.territory ? { territory: c.territory } : {}) } as Order) : null;

/**
 * The Captain's choice, from its usual judgement:
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
  if (sets.includes("tower")) {
    const spots = [...(capThreatened && capital ? [capital] : []), ...frontier.filter((t) => chokeHolder(t) && biggestEnemyNear(t) > 0), ...frontier.filter((t) => biggestEnemyNear(t) >= 4)].filter(free);
    const spot = spots.sort((a, c) => Number(c === capital && capThreatened) - Number(a === capital && capThreatened) || Number(chokeHolder(c)) - Number(chokeHolder(a)) || threat(c) - threat(a) || (a < c ? -1 : 1))[0];
    if (spot) return { set: "tower", territory: spot };
  }
  if (sets.includes("laurel")) {
    const max = ctx.rules.culture.max;
    const hold = [...(capital ? [capital] : []), ...frontier.filter((t) => chokeHolder(t) && biggestEnemyNear(t) > 0)].filter((t) => (seen(t)?.culture ?? max) < max);
    return { set: "laurel", territory: hold[0] ?? capital ?? mine[0]! };
  }
  if (sets.includes("sword")) return { set: "sword" };
  if (sets.includes("mixed")) return { set: "mixed" };
  // Only a Tower set and nowhere it's needed: the safest land without a building.
  const spot = mine.filter(free).sort((a, c) => threat(c) - threat(a) || (a < c ? -1 : 1))[0];
  return spot ? { set: "tower", territory: spot } : null;
}

/** The Recruit's simple choice: Swords, one of each, a fort on its busiest front, or Laurels at its capital. */
export function recruitSpoils(view: PlayerView, frontier: readonly TerritoryId[], pressure: (t: TerritoryId) => number): SpoilsChoice | null {
  const sets = setsIn(view.me.spoils);
  if (sets.includes("sword")) return { set: "sword" };
  if (sets.includes("mixed")) return { set: "mixed" };
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
    const spot = [...frontier].filter(free).sort((a, b) => pressure(b) - pressure(a) || (a < b ? -1 : 1))[0] ?? (home && free(home) ? home : undefined);
    if (spot) return { set: "tower", territory: spot };
  }
  if (sets.includes("laurel") && home) return { set: "laurel", territory: home };
  return null;
}

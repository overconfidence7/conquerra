import type { MapIndex } from "./mapIndex";
import { Rng } from "./rng";
import type { FizzleCode, GameContext, GameEvent, GameState, LandChange, PlayerId, SpoilsMark, SpoilsSet, TerritoryId } from "./types";

/**
 * The Spoils deck (session 13, design additions §6). Every number is in rules.spoils (packages/content).
 *  - At the end of any turn you took at least one territory, you earn one card (at most one a turn). Its mark,
 *    Sword, Tower or Laurel, comes from the game's seeded random numbers (the deck's own sequence).
 *  - Three alike, or one of each, turn in for a windfall: Swords, troops at your capital; Towers, a finished fort
 *    with a small garrison on land you choose; Laurels, culture in a province you hold; one of each, troops and gold.
 *    Windfalls never grow with each set (unlike Risk), so they can't feed a runaway.
 *  - Turning in is an order: it takes its slot with your others.
 *  - At the hand limit you must turn a set in that turn; if you don't, the game does it for you as the turn ends
 *    (five cards always hold a set: three marks can't fill five cards without three alike or one of each).
 *  - Others only ever see how many cards you hold.
 */

export const SPOILS_MARKS: readonly SpoilsMark[] = ["sword", "tower", "laurel"];

/** What resolveTurn lends the Spoils: the board and how to announce what happened. */
export interface SpoilsHost {
  ctx: GameContext;
  s: GameState;
  idx: MapIndex;
  emit(e: GameEvent): void;
}

const count = (hand: readonly SpoilsMark[], m: SpoilsMark) => hand.filter((x) => x === m).length;

/** The sets a hand can turn in: three alike of each mark it can, then one of each. */
export function setsIn(hand: readonly SpoilsMark[]): SpoilsSet[] {
  const out: SpoilsSet[] = SPOILS_MARKS.filter((m) => count(hand, m) >= 3);
  if (SPOILS_MARKS.every((m) => count(hand, m) >= 1)) out.push("mixed");
  return out;
}

/** The hand without that set (the oldest cards of it go), or null if it doesn't hold it. */
export function withoutSet(hand: readonly SpoilsMark[], set: SpoilsSet): SpoilsMark[] | null {
  const want: SpoilsMark[] = set === "mixed" ? [...SPOILS_MARKS] : [set, set, set];
  const out = [...hand];
  for (const m of want) {
    const i = out.indexOf(m);
    if (i < 0) return null;
    out.splice(i, 1);
  }
  return out;
}

/** Your capital if you hold it, else your strongest territory (most troops; ties by id). */
export function homeOf(s: GameState, idx: MapIndex, pid: PlayerId): TerritoryId | null {
  const p = s.players.find((x) => x.id === pid);
  if (p && s.territories[p.capital]?.owner === pid) return p.capital;
  let home: TerritoryId | null = null;
  for (const id of idx.ids) {
    const t = s.territories[id]!;
    if (t.owner === pid && (!home || t.troops > s.territories[home]!.troops)) home = id;
  }
  return home;
}

/** The territories a Laurel set raises, starting from `at`: it first, then your others in its province, least culture first. */
export function laurelLand(ctx: GameContext, s: GameState, idx: MapIndex, pid: PlayerId, at: TerritoryId): TerritoryId[] {
  const { rules } = ctx;
  const province = idx.byId.get(at)!.province;
  const others = (idx.provinceMembers.get(province) ?? [])
    .filter((t) => t !== at && s.territories[t]!.owner === pid)
    .sort((a, b) => s.territories[a]!.culture - s.territories[b]!.culture || (a < b ? -1 : 1));
  return [at, ...others].filter((t) => s.territories[t]!.culture < rules.culture.max).slice(0, rules.spoils.laurel.territories);
}

/**
 * Turn a set in for its windfall. Returns null if it happened, or why it couldn't (then nothing changed).
 * `orderId` null: the game turning a set in for you at the hand limit.
 */
export function turnInSpoils(h: SpoilsHost, pid: PlayerId, set: SpoilsSet, territory: TerritoryId | undefined, orderId: string | null): { code: FizzleCode; territory?: TerritoryId } | null {
  const { s, idx, ctx } = h;
  const cfg = ctx.rules.spoils;
  const p = s.players.find((x) => x.id === pid)!;
  const rest = withoutSet(p.spoils, set);
  if (!rest) return { code: "noSet" };
  const home = homeOf(s, idx, pid);
  if (!home) return { code: "notHeld" };
  let at = home;
  let troops = 0;
  let gold = 0;
  let fort = false;
  const culture: TerritoryId[] = [];
  const land: LandChange[] = [];
  if (set === "tower" || set === "laurel") {
    at = territory ?? home;
    const t = s.territories[at];
    if (!t || t.owner !== pid) return { code: "notHeld", territory: at };
    if (set === "tower") {
      if (t.building || t.construction) return { code: "hasBuilding", territory: at };
      t.building = "fort";
      t.troops += cfg.tower.garrison;
      troops = cfg.tower.garrison;
      fort = true;
      land.push({ territory: at, building: "fort", troops: t.troops });
    } else {
      const raise = laurelLand(ctx, s, idx, pid, at);
      if (!raise.length) return { code: "cultureMax", territory: at };
      for (const id of raise) {
        const x = s.territories[id]!;
        x.culture = Math.min(ctx.rules.culture.max, x.culture + cfg.laurel.culture);
        culture.push(id);
        land.push({ territory: id, culture: x.culture });
      }
    }
  } else {
    troops = set === "sword" ? cfg.sword.troops : cfg.mixed.troops;
    gold = set === "mixed" ? cfg.mixed.gold : 0;
    s.territories[at]!.troops += troops;
    p.gold += gold;
    land.push({ territory: at, troops: s.territories[at]!.troops });
  }
  p.spoils = rest;
  h.emit({ type: "spoilsTurnedIn", player: pid, orderId, set, at, troops, gold, fort, culture, land });
  return null;
}

/**
 * The set the game turns in for you at the hand limit (and the one the turn-in sheet suggests): three Swords if you
 * have them, else one of each, else three Towers (a fort on your most threatened land without a building), else
 * three Laurels (your capital's province).
 */
export function autoSpoils(ctx: GameContext, s: GameState, idx: MapIndex, pid: PlayerId): { set: SpoilsSet; territory?: TerritoryId } | null {
  const p = s.players.find((x) => x.id === pid);
  if (!p) return null;
  const sets = setsIn(p.spoils);
  const home = homeOf(s, idx, pid);
  if (!home) return null;
  for (const set of ["sword", "mixed"] as const) if (sets.includes(set)) return { set };
  if (sets.includes("tower")) {
    const threat = (t: TerritoryId) =>
      Math.max(0, ...(idx.neighbors.get(t) ?? []).map((n) => (s.territories[n]!.owner && s.territories[n]!.owner !== pid ? s.territories[n]!.troops : 0))) - s.territories[t]!.troops;
    const spot = idx.ids
      .filter((t) => s.territories[t]!.owner === pid && !s.territories[t]!.building && !s.territories[t]!.construction)
      .sort((a, b) => threat(b) - threat(a) || (a < b ? -1 : 1))[0];
    if (spot) return { set: "tower", territory: spot };
  }
  if (sets.includes("laurel") && laurelLand(ctx, s, idx, pid, home).length) return { set: "laurel", territory: home };
  return sets[0] ? { set: sets[0], territory: home } : null;
}

/** Pick a mark with the rules' weights. */
function drawMark(ctx: GameContext, rng: Rng): SpoilsMark {
  const w = ctx.rules.spoils.marks;
  const total = SPOILS_MARKS.reduce((a, m) => a + w[m], 0);
  let x = rng.next() * total;
  for (const m of SPOILS_MARKS) {
    x -= w[m];
    if (x < 0) return m;
  }
  return SPOILS_MARKS[SPOILS_MARKS.length - 1]!;
}

/**
 * As the turn ends (in seat order): anyone still at the hand limit has a set turned in for them, then everyone who
 * took land this turn earns a card.
 */
export function spoilsEndOfTurn(h: SpoilsHost, seats: readonly PlayerId[], tookLand: ReadonlySet<PlayerId>) {
  const { s, ctx, idx } = h;
  if (!s.settings.spoils) return;
  const rng = new Rng(s.decks.spoils);
  for (const pid of seats) {
    const p = s.players.find((x) => x.id === pid)!;
    if (p.eliminatedTurn !== null) continue;
    while (p.spoils.length >= ctx.rules.spoils.handLimit) {
      const auto = autoSpoils(ctx, s, idx, pid);
      if (!auto || turnInSpoils(h, pid, auto.set, auto.territory, null)) break;
    }
    if (!tookLand.has(pid)) continue;
    const mark = drawMark(ctx, rng);
    p.spoils.push(mark);
    h.emit({ type: "spoilsEarned", player: pid, mark, hand: p.spoils.length });
  }
  s.decks.spoils = rng.state;
}

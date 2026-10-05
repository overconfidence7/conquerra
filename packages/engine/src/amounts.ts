/**
 * How many troops a move or attack sends. Players pick a share of the army that's there when the order plays,
 * because a chained army's size isn't known until its earlier battles are over:
 *  - "all": everyone who can go (the 1-troop garrison always stays)
 *  - { share: 0.75 | 0.5 | 0.25 }: that share of the army, rounded to the nearest troop
 *  - "enough": the fewest troops likely to win, plus a small safety margin ("Just enough")
 *  - a number: exactly that many (or as many as can go)
 */
export type Share = 0.25 | 0.5 | 0.75;
export type TroopAmount = number | "all" | "enough" | { share: Share };

/**
 * How many troops a recruit order buys: "all" the gold you have when it plays, a share of it, or an exact number
 * (as many as you can afford, if fewer).
 */
export type RecruitAmount = number | "all" | { share: Share };

/** The share chips, in the order the order screen shows them. */
export const SHARES: readonly Share[] = [0.75, 0.5, 0.25];

export const isShare = (a: TroopAmount): a is { share: Share } => typeof a === "object" && a !== null && "share" in a;

/** "All", "3/4", "1/2", "1/4", "Just enough", or the number. */
export function amountLabel(a: TroopAmount): string {
  if (a === "all") return "All";
  if (a === "enough") return "Just enough";
  if (isShare(a)) return a.share === 0.75 ? "3/4" : a.share === 0.5 ? "1/2" : "1/4";
  return String(a);
}

/**
 * Fewest troops (up to `max`) for which `likely` holds, plus a safety margin of 20% (at least 1), capped at `max`.
 * Null if even `max` troops aren't likely to win. Shared by the engine ("Just enough"), the order screen and the bots.
 */
export function fewestToTake(likely: (troops: number) => boolean, max: number): number | null {
  if (max <= 0 || !likely(max)) return null;
  let lo = 1, hi = max;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (likely(mid)) hi = mid;
    else lo = mid + 1;
  }
  return Math.min(max, lo + Math.max(1, Math.ceil(lo * 0.2)));
}

/**
 * Turn an amount into a troop count.
 * @param army the troops there that can act (the share is taken of this)
 * @param available how many can actually go (the army minus the garrison that must stay)
 * @param enough "Just enough" for this target, or null if not even all of them would likely win (then all go)
 * A share or "Just enough" always sends at least 1 when anyone can go; nothing ever sends more than `available`.
 */
export function troopsFor(a: TroopAmount, army: number, available: number, enough: () => number | null): number {
  if (available <= 0) return 0;
  let n: number;
  if (a === "all") n = available;
  else if (a === "enough") n = enough() ?? available;
  else if (isShare(a) && SHARES.includes(a.share)) n = Math.max(1, Math.round(army * a.share));
  // An exact number. Anything unrecognised sends nothing (the order fizzles).
  else n = Math.floor(Number(a) || 0);
  return Math.max(0, Math.min(available, n));
}

/**
 * Troops a recruit order buys with the gold you have when it plays. A share buys that share of your gold's worth
 * (rounded down, but at least 1 if you can afford one). Anything unrecognised buys nothing (the order fizzles).
 */
export function recruitCount(a: RecruitAmount, gold: number, cost: number): number {
  const affordable = Math.max(0, Math.floor(gold / cost));
  if (affordable <= 0) return 0;
  if (a === "all") return affordable;
  if (isShare(a)) return SHARES.includes(a.share) ? Math.min(affordable, Math.max(1, Math.floor((gold * a.share) / cost))) : 0;
  const n = Math.floor(Number(a) || 0);
  return n >= 1 ? Math.min(affordable, n) : 0;
}

/** "All", "3/4", ... or the number, for a recruit order. */
export const recruitLabel = (a: RecruitAmount): string => amountLabel(a);

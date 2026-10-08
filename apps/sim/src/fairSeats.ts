/**
 * Session 20b: fair seats on the big maps. Trying every capital layout is fine for Embervale at 4 (43 of them) but the
 * big maps have tens of thousands, so this searches instead:
 *
 *  1. measure each capital spot's win rate on the current layout (equal bots, the same games every time);
 *  2. try moving the weakest spot, then the strongest, to other capital spots of the map (only layouts that pass the
 *     map maker's paper check), nearest first, the least exposed first for a weak spot and the most exposed first for a
 *     strong one;
 *  3. keep the first move that shrinks the spread between the best and worst spot; repeat until nothing helps or the
 *     budget (a number of measured layouts) runs out.
 *
 * Pure apart from `measure` (which plays the games), so the order it tries things in is the same for the same inputs.
 */

export interface Measured {
  layout: string[];
  /** Each spot's win rate, in layout order. */
  rates: number[];
  /** Best minus worst. */
  spread: number;
}

export interface SearchOptions {
  start: readonly string[];
  /** The map's capital spots (the only places a capital may go). */
  slots: readonly string[];
  /** Plays a layout and returns each spot's win rate (in layout order). */
  measure(layout: readonly string[]): Promise<number[]>;
  /** Does a layout pass the map maker's paper check? */
  paperFair(layout: readonly string[]): boolean;
  /** Borders between two territories. */
  dist(a: string, b: string): number;
  /** How exposed `spot` would be in `layout` (lower is safer); orders the candidates. */
  exposure?(layout: readonly string[], spot: string): number;
  /** Layouts measured at most (the start counts). */
  budget: number;
  /** Candidate moves tried for each mover a round. */
  perMover?: number;
  log?(line: string): void;
}

export interface SearchResult {
  start: Measured;
  best: Measured;
  /** Every layout measured, in order. */
  tried: Measured[];
}

const spreadOf = (rates: readonly number[]) => Math.max(...rates) - Math.min(...rates);

export async function searchFairSeats(o: SearchOptions): Promise<SearchResult> {
  const tried: Measured[] = [];
  const seen = new Set<string>();
  const key = (l: readonly string[]) => [...l].sort().join(",");
  const run = async (layout: readonly string[]): Promise<Measured> => {
    const rates = await o.measure(layout);
    const m = { layout: [...layout], rates, spread: spreadOf(rates) };
    tried.push(m);
    seen.add(key(layout));
    return m;
  };
  const start = await run(o.start);
  let best = start;
  o.log?.(`start spread ${(100 * start.spread).toFixed(1)}`);
  const perMover = o.perMover ?? 4;
  while (tried.length < o.budget) {
    const order = best.layout.map((t, i) => ({ t, r: best.rates[i]! })).sort((a, b) => a.r - b.r || (a.t < b.t ? -1 : 1));
    const movers = [{ spot: order[0]!.t, weak: true }, { spot: order[order.length - 1]!.t, weak: false }];
    let improved = false;
    for (const { spot, weak } of movers) {
      const cands = o.slots
        .filter((s) => !best.layout.includes(s))
        .map((s) => ({ s, layout: best.layout.map((t) => (t === spot ? s : t)) }))
        .filter((c) => !seen.has(key(c.layout)) && o.paperFair(c.layout))
        .map((c) => ({ ...c, d: o.dist(spot, c.s), e: o.exposure ? o.exposure(c.layout, c.s) : 0 }))
        // Small moves first; for a weak spot the safest place, for a strong one the most exposed.
        .sort((a, b) => a.d - b.d || (weak ? a.e - b.e : b.e - a.e) || (a.s < b.s ? -1 : 1))
        .slice(0, perMover);
      for (const c of cands) {
        if (tried.length >= o.budget) break;
        const m = await run(c.layout);
        o.log?.(`  ${weak ? "weak" : "strong"} ${spot} -> ${c.s}: spread ${(100 * m.spread).toFixed(1)}${m.spread < best.spread ? " (better)" : ""}`);
        if (m.spread < best.spread) {
          best = m;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
    if (!improved) break;
  }
  return { start, best, tried };
}

/** Spearman's rank correlation (ties share their average rank). */
export function rankCorrelation(xs: readonly number[], ys: readonly number[]): number {
  const ranks = (v: readonly number[]) => {
    const idx = v.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
    const r = new Array<number>(v.length);
    for (let i = 0; i < idx.length; ) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1]!.x === idx[i]!.x) j++;
      for (let k = i; k <= j; k++) r[idx[k]!.i] = (i + j) / 2;
      i = j + 1;
    }
    return r;
  };
  const rx = ranks(xs), ry = ranks(ys);
  const n = xs.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i]! - mx) * (ry[i]! - my);
    dx += (rx[i]! - mx) ** 2;
    dy += (ry[i]! - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

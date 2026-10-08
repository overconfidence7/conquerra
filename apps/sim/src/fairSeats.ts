/**
 * Session 20b: fair seats on the big maps. Trying every capital layout is fine for Embervale at 4 (43 of them) but the
 * big maps have tens of thousands, so this searches instead:
 *
 *  1. measure each capital spot's win rate on the current layout (equal bots, the same games every time);
 *  2. try moving each spot, the most uneven first (the weakest and the strongest lead), to other capital spots of the
 *     map (only layouts that pass the map maker's paper check), nearest first, the least exposed first for a weak spot
 *     and the most exposed first for a strong one; then two spots at once (a full table often allows no single move);
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
    const fair = 1 / best.layout.length;
    // Every spot, the most uneven first (the weakest and the strongest lead).
    const movers = best.layout
      .map((t, i) => ({ spot: t, weak: best.rates[i]! < fair, off: Math.abs(best.rates[i]! - fair) }))
      .sort((a, b) => b.off - a.off || (a.spot < b.spot ? -1 : 1));
    const rank = new Map(movers.map((m, i) => [m.spot, i]));
    const free = o.slots.filter((s) => !best.layout.includes(s));
    const fresh = (layout: string[]) => !seen.has(key(layout)) && o.paperFair(layout);
    // One spot moved: small moves first; for a weak spot the safest place, for a strong one the most exposed.
    const singles = movers.flatMap(({ spot, weak }) =>
      free
        .map((s) => ({ layout: best.layout.map((t) => (t === spot ? s : t)), label: `${weak ? "weak" : "strong"} ${spot} -> ${s}`, r: rank.get(spot)!, d: o.dist(spot, s), e: o.exposure ? o.exposure(best.layout.map((t) => (t === spot ? s : t)), s) * (weak ? 1 : -1) : 0 }))
        .filter((c) => fresh(c.layout))
        .sort((a, b) => a.d - b.d || a.e - b.e || (a.label < b.label ? -1 : 1))
        .slice(0, perMover),
    );
    // Two spots moved together (the paper check often allows no single move on a full table): pairs among the four
    // most uneven spots, the smallest moves first.
    const top = movers.slice(0, 4);
    const doubles: typeof singles = [];
    for (let i = 0; i < top.length; i++)
      for (let j = i + 1; j < top.length; j++)
        for (const a of free)
          for (const b of free) {
            if (a === b) continue;
            const layout = best.layout.map((t) => (t === top[i]!.spot ? a : t === top[j]!.spot ? b : t));
            if (!fresh(layout)) continue;
            doubles.push({ layout, label: `${top[i]!.spot} -> ${a} and ${top[j]!.spot} -> ${b}`, r: 100 + i * 4 + j, d: o.dist(top[i]!.spot, a) + o.dist(top[j]!.spot, b), e: 0 });
          }
    doubles.sort((a, b) => a.r - b.r || a.d - b.d || (a.label < b.label ? -1 : 1));
    const seenRound = new Set<string>();
    const cands = [...singles.sort((a, b) => a.r - b.r), ...doubles.slice(0, 2 * perMover)].filter((c) => !seenRound.has(key(c.layout)) && (seenRound.add(key(c.layout)), true));
    let improved = false;
    for (const c of cands) {
      if (tried.length >= o.budget) break;
      const m = await run(c.layout);
      o.log?.(`  ${c.label}: spread ${(100 * m.spread).toFixed(1)}${m.spread < best.spread ? " (better)" : ""}`);
      if (m.spread < best.spread) {
        best = m;
        improved = true;
        break;
      }
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

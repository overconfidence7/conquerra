import type { Rng } from "@conquerra/engine";
import type { Mesh } from "./mesh";
import { reversePts, type Arc } from "./outline";
import { MinHeap } from "./util";

export interface River {
  /** Territory pairs the river runs between (they become `river` borders). */
  pairs: [number, number][];
  /** Smoothed line from the source down to the mouth. */
  pts: number[];
  /** Junction corners from source to mouth, each lower than the one before. */
  corners: number[];
}

/**
 * Rivers start at junctions high up (next to a mountain range when there is one) and follow territory borders
 * down to a sea or lake. Each step along a border must end lower than it started, so rivers only flow downhill.
 * A river may also end where it meets an earlier river.
 */
export function makeRivers(
  mesh: Mesh,
  rng: Rng,
  arcs: readonly Arc[],
  isJunction: Uint8Array,
  territories: number,
  cornerElev: Float64Array,
  cornerTouches: (v: number, what: "water" | "rock") => boolean,
  want: number,
): River[] {
  // Border arcs between two territories, by endpoint junction.
  const fromCorner = new Map<number, number[]>();
  arcs.forEach((a, i) => {
    if (a.closed || a.lo < 0 || a.hi >= territories) return;
    for (const v of [a.corners[0]!, a.corners[a.corners.length - 1]!]) fromCorner.set(v, [...(fromCorner.get(v) ?? []), i]);
  });
  const usedArc = new Set<number>();
  const riverCorner = new Set<number>();
  const rivers: River[] = [];

  const junctions = [...fromCorner.keys()].filter((v) => isJunction[v] && !cornerTouches(v, "water"));
  const byRock = junctions.filter((v) => cornerTouches(v, "rock"));
  const pool = (byRock.length >= want * 2 ? byRock : junctions).sort((a, b) => cornerElev[b]! - cornerElev[a]! || a - b);
  const sources = rng.shuffle(pool.slice(0, Math.max(want * 4, 8)));

  for (const src of sources) {
    if (rivers.length >= want) break;
    if (riverCorner.has(src)) continue;
    // Shortest all-downhill route to water (or to another river).
    const best = new Map<number, number>([[src, 0]]);
    const prev = new Map<number, [number, number]>(); // corner -> [previous corner, arc]
    const heap = new MinHeap();
    heap.push(0, src);
    let end = -1;
    const done = new Set<number>();
    while (heap.size) {
      const [d, v] = heap.pop();
      if (done.has(v)) continue;
      done.add(v);
      if (v !== src && (cornerTouches(v, "water") || riverCorner.has(v))) {
        end = v;
        break;
      }
      for (const i of fromCorner.get(v) ?? []) {
        if (usedArc.has(i)) continue;
        const a = arcs[i]!;
        const w = a.corners[0] === v ? a.corners[a.corners.length - 1]! : a.corners[0]!;
        if (cornerElev[w]! >= cornerElev[v]!) continue; // downhill only
        const nd = d + a.pts.length;
        if (nd < (best.get(w) ?? Infinity)) {
          best.set(w, nd);
          prev.set(w, [v, i]);
          heap.push(nd, w);
        }
      }
    }
    if (end < 0) continue;
    const path: number[] = [];
    const corners = [end];
    for (let v = end; v !== src; ) {
      const [p, i] = prev.get(v)!;
      path.push(i);
      corners.push(p);
      v = p;
    }
    if (path.length < 3) continue;
    path.reverse();
    corners.reverse();
    const pts: number[] = [];
    path.forEach((i, k) => {
      const a = arcs[i]!;
      const forward = a.corners[0] === corners[k];
      const p = forward ? a.pts : reversePts(a.pts);
      pts.push(...(k === 0 ? p : p.slice(2)));
    });
    for (const i of path) usedArc.add(i);
    for (const v of corners) riverCorner.add(v);
    rivers.push({ pairs: path.map((i) => [arcs[i]!.lo, arcs[i]!.hi] as [number, number]), pts, corners });
  }
  return rivers;
}

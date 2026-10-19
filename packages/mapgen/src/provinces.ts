import type { Rng } from "@conquerra/engine";
import { apportion } from "./util";

/**
 * Group territories into `count` provinces of similar size. Provinces grow over ordinary and river borders only,
 * so they don't straddle mountains or the sea; a cut-off scrap too small to be its own province joins a
 * neighbour across a pass or lane. Several tries; the most even result wins.
 */
export function makeProvinces(rng: Rng, territories: number, innerAdj: number[][], allAdj: number[][], count: number): Int32Array {
  // Pieces of land joined by ordinary borders.
  const piece = new Int32Array(territories).fill(-1);
  const pieces: number[][] = [];
  for (let s = 0; s < territories; s++) {
    if (piece[s] !== -1) continue;
    const q = [s];
    piece[s] = pieces.length;
    for (let h = 0; h < q.length; h++) for (const m of innerAdj[q[h]!]!) if (piece[m] === -1) (piece[m] = pieces.length), q.push(m);
    pieces.push(q);
  }
  const avg = territories / count;
  const big = pieces.filter((p) => p.length >= Math.max(2, avg * 0.5));
  const perPiece = apportion(count, big.map((p) => p.length), 1);

  let best: Int32Array | null = null, bestSpread = Infinity;
  for (let attempt = 0; attempt < 24; attempt++) {
    const prov = new Int32Array(territories).fill(-1);
    let next = 0;
    big.forEach((p, i) => {
      grow(rng, p, Math.min(perPiece[i]!, p.length), next, innerAdj, prov);
      next += Math.min(perPiece[i]!, p.length);
    });
    // Scraps join the smallest neighbouring province.
    for (let guard = 0; guard < territories && prov.some((x) => x < 0); guard++)
      for (let t = 0; t < territories; t++) {
        if (prov[t]! >= 0) continue;
        const options = allAdj[t]!.filter((m) => prov[m]! >= 0);
        if (!options.length) continue;
        const size = (p: number) => prov.filter((x) => x === p).length;
        options.sort((a, b) => size(prov[a]!) - size(prov[b]!) || a - b);
        prov[t] = prov[options[0]!]!;
      }
    const sizes = Array.from({ length: next }, (_, i) => prov.filter((x) => x === i).length);
    const spread = Math.max(...sizes) - Math.min(...sizes);
    if (spread < bestSpread) (bestSpread = spread), (best = prov);
    if (spread <= 1) break;
  }
  return best!;
}

/** Split one piece into k provinces: spread-out seeds, then the smallest province grabs a neighbour, repeat. */
function grow(rng: Rng, members: number[], k: number, first: number, adj: number[][], prov: Int32Array) {
  const inPiece = new Set(members);
  const bfs = (from: number) => {
    const d = new Map<number, number>([[from, 0]]);
    const q = [from];
    for (let h = 0; h < q.length; h++) for (const m of adj[q[h]!]!) if (inPiece.has(m) && !d.has(m)) d.set(m, d.get(q[h]!)! + 1), q.push(m);
    return d;
  };
  const seeds = [members[rng.int(members.length)]!];
  const dists = [bfs(seeds[0]!)];
  while (seeds.length < k) {
    let pick = members[0]!, far = -1;
    for (const t of members) {
      const d = Math.min(...dists.map((m) => m.get(t) ?? 0));
      if (d > far || (d === far && rng.next() < 0.3)) (far = d), (pick = t);
    }
    seeds.push(pick);
    dists.push(bfs(pick));
  }
  const size = new Array<number>(k).fill(1);
  seeds.forEach((s, i) => (prov[s] = first + i));
  // (Session 33b: each province's own territories, so a grab looks only at them. The pick is the same: the nearest to
  // the seed, then the lowest id, in whatever order they're looked at.)
  const own = seeds.map((s) => [s]);
  let left = members.length - k;
  while (left > 0) {
    const order = Array.from({ length: k }, (_, i) => i).sort((a, b) => size[a]! - size[b]! || a - b);
    let grabbed = false;
    for (const p of order) {
      // The unclaimed neighbour closest to this province's seed.
      let pick = -1, pd = Infinity;
      for (const t of own[p]!) {
        for (const m of adj[t]!) {
          if (!inPiece.has(m) || prov[m]! >= 0) continue;
          const d = dists[p]!.get(m) ?? 99;
          if (d < pd || (d === pd && m < pick)) (pd = d), (pick = m);
        }
      }
      if (pick >= 0) {
        prov[pick] = first + p;
        own[p]!.push(pick);
        size[p]!++;
        left--;
        grabbed = true;
        break;
      }
    }
    if (!grabbed) break;
  }
}

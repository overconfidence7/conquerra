import type { Mesh } from "./mesh";
import { dist } from "./util";

export interface SeaLane {
  a: number;
  b: number;
  /** From A's coast to B's coast. */
  pts: [number, number, number, number];
  length: number;
}

/** Graph distances (in borders) from one territory. */
function graphDist(adj: readonly number[][], from: number): Int32Array {
  const d = new Int32Array(adj.length).fill(-1);
  d[from] = 0;
  const q = [from];
  for (let h = 0; h < q.length; h++) for (const m of adj[q[h]!]!) if (d[m] === -1) (d[m] = d[q[h]!]! + 1), q.push(m);
  return d;
}

/**
 * Sea lanes: drawn crossings over water between two coastal territories that don't touch.
 * First, every island (or any piece of land cut off from the rest) gets the shortest lane that joins it up.
 * Then a few extra lanes are added across bays and gulfs where they make the biggest shortcut.
 */
export function makeSeaLanes(
  mesh: Mesh,
  owner: Int32Array,
  isWater: (c: number) => boolean,
  territories: number,
  landAdj: number[][],
  extra: number,
): SeaLane[] {
  const sp = mesh.spacing;
  const coastal: number[][] = Array.from({ length: territories }, () => []);
  for (let c = 0; c < mesh.cells; c++) {
    const t = owner[c]!;
    if (t >= 0 && mesh.neighbors[c]!.some((m) => isWater(m))) coastal[t]!.push(c);
  }
  // Candidate lanes: for each pair of coastal territories, their closest coastal cells, if the water between is clear.
  const candidates: SeaLane[] = [];
  const maxLen = sp * 16;
  for (let a = 0; a < territories; a++)
    for (let b = a + 1; b < territories; b++) {
      if (landAdj[a]!.includes(b)) continue;
      let best: [number, number] | null = null, bestD = Infinity;
      for (const ca of coastal[a]!)
        for (const cb of coastal[b]!) {
          const d = dist(mesh.x[ca]!, mesh.y[ca]!, mesh.x[cb]!, mesh.y[cb]!);
          if (d < bestD) (bestD = d), (best = [ca, cb]);
        }
      if (!best || bestD > maxLen) continue;
      const lane = clearCrossing(mesh, owner, isWater, a, b, best[0], best[1]);
      if (lane) candidates.push(lane);
    }
  candidates.sort((p, q) => p.length - q.length || p.a - q.a || p.b - q.b);

  const adj = landAdj.map((l) => [...l]);
  const lanes: SeaLane[] = [];
  const add = (l: SeaLane) => {
    lanes.push(l);
    adj[l.a]!.push(l.b);
    adj[l.b]!.push(l.a);
  };
  // 1. Join every cut-off piece of land.
  for (;;) {
    const d = graphDist(adj, 0);
    const comp = new Int32Array(territories).fill(-1);
    let pieces = 0;
    for (let s = 0; s < territories; s++) {
      if (comp[s] !== -1) continue;
      const ds = graphDist(adj, s);
      for (let t = 0; t < territories; t++) if (ds[t]! >= 0) comp[t] = pieces;
      pieces++;
    }
    if (pieces <= 1 || d.every((x) => x >= 0)) break;
    // The smallest piece gets its shortest lane to anything outside it.
    const sizes = Array.from({ length: pieces }, (_, i) => comp.filter((x) => x === i).length);
    const small = sizes.indexOf(Math.min(...sizes));
    const lane = candidates.find((l) => (comp[l.a] === small) !== (comp[l.b] === small));
    if (!lane) break; // the map check will reject this map
    add(lane);
  }
  // 2. A few shortcuts: the lanes that save the most marching, spread out along the coast.
  const usedT = new Set(lanes.flatMap((l) => [l.a, l.b]));
  for (let k = 0; k < extra; k++) {
    let best: SeaLane | null = null, bestScore = -Infinity;
    for (const l of candidates) {
      if (usedT.has(l.a) || usedT.has(l.b) || l.length > sp * 12) continue;
      const g = graphDist(adj, l.a)[l.b]!;
      if (g >= 0 && g < 3) continue;
      const tooClose = lanes.some((o) => dist(o.pts[0], o.pts[1], l.pts[0], l.pts[1]) < sp * 6);
      if (tooClose) continue;
      const score = (g < 0 ? 20 : g) - l.length / (sp * 2);
      if (score > bestScore) (bestScore = score), (best = l);
    }
    if (!best) break;
    add(best);
    usedT.add(best.a);
    usedT.add(best.b);
  }
  return lanes;
}

/** Walk the straight line from A to B: it must leave A, cross only open water, and land in B. */
function clearCrossing(mesh: Mesh, owner: Int32Array, isWater: (c: number) => boolean, a: number, b: number, ca: number, cb: number): SeaLane | null {
  const x0 = mesh.x[ca]!, y0 = mesh.y[ca]!, x1 = mesh.x[cb]!, y1 = mesh.y[cb]!;
  const len = dist(x0, y0, x1, y1);
  const steps = Math.max(4, Math.ceil(len / (mesh.spacing / 3)));
  let phase = 0; // 0 = still in A, 1 = on water, 2 = in B
  let sx = x0, sy = y0, ex = x1, ey = y1;
  let hint = ca;
  let waterSteps = 0;
  for (let i = 1; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps, y = y0 + ((y1 - y0) * i) / steps;
    const c = mesh.delaunay.find(x, y, hint);
    hint = c;
    const w = isWater(c);
    const t = owner[c]!;
    if (phase === 0) {
      if (w) (phase = 1), (sx = x), (sy = y);
      else if (t !== a) return null;
    } else if (phase === 1) {
      if (w) waterSteps++;
      else if (t === b) (phase = 2), (ex = x), (ey = y);
      else return null;
    } else if (t !== b) return null;
  }
  if (phase !== 2 || waterSteps < 2) return null;
  return { a, b, pts: [sx, sy, ex, ey], length: dist(sx, sy, ex, ey) };
}

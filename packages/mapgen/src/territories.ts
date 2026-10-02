import type { Rng } from "@conquerra/engine";
import { components } from "./land";
import type { Mesh } from "./mesh";
import { apportion, dist, MinHeap, Noise } from "./util";

/**
 * Split the land into `count` territories of similar size with organic borders.
 *
 * How: drop seeds spread out over each landmass, then let every seed grow outward at once over a "wobbly"
 * cost field (noise makes some directions cheaper, which gives irregular borders). Repeat a dozen times,
 * nudging seeds to the middle of their area and slowing down the big territories so sizes even out.
 * Growth only ever spreads from a territory's own cells, so every territory is one connected piece.
 */
export function makeTerritories(mesh: Mesh, rng: Rng, isLand: (c: number) => boolean, count: number): Int32Array {
  const n = mesh.cells;
  const wobble = new Noise(rng);
  const owner = new Int32Array(n).fill(-1);
  const comps = components(mesh, isLand);
  const land = comps.reduce((a, c) => a + c.length, 0);
  const target = land / count;
  const kept = comps.filter((c) => c.length >= target * 0.45);
  const perComp = apportion(count, kept.map((c) => c.length), 1);
  // A landmass can't hold more territories than about one per 12 cells.
  let next = 0;
  kept.forEach((comp, i) => {
    const k = Math.max(1, Math.min(perComp[i]!, Math.floor(comp.length / 12)));
    growRegions(mesh, rng, wobble, comp, k, next, owner);
    next += k;
  });
  if (next !== count) throw new Error(`could only fit ${next} of ${count} territories`);
  return owner;
}

function growRegions(mesh: Mesh, rng: Rng, wobble: Noise, comp: number[], k: number, first: number, owner: Int32Array) {
  const inComp = new Uint8Array(mesh.cells);
  for (const c of comp) inComp[c] = 1;
  const target = comp.length / k;
  const sp = mesh.spacing;
  const costTo = (a: number, b: number) => {
    const mx = (mesh.x[a]! + mesh.x[b]!) / 2, my = (mesh.y[a]! + mesh.y[b]!) / 2;
    return dist(mesh.x[a]!, mesh.y[a]!, mesh.x[b]!, mesh.y[b]!) * (0.35 + 1.3 * wobble.fbm(mx, my, sp * 6, 3));
  };

  // Seeds: the first anywhere, then each new one as far as possible from the others.
  const seeds = [comp[rng.int(comp.length)]!];
  while (seeds.length < k) {
    let best = comp[0]!, bestD = -1;
    for (const c of comp) {
      let d = Infinity;
      for (const s of seeds) d = Math.min(d, dist(mesh.x[c]!, mesh.y[c]!, mesh.x[s]!, mesh.y[s]!));
      if (d > bestD) (bestD = d), (best = c);
    }
    seeds.push(best);
  }
  const weight = new Array<number>(k).fill(1);
  const local = new Int32Array(mesh.cells).fill(-1);

  const grow = () => {
    for (const c of comp) local[c] = -1;
    const best = new Float64Array(mesh.cells).fill(Infinity);
    const heap = new MinHeap();
    // Item encodes cell and region: cell * 4096 + region.
    seeds.forEach((s, r) => {
      best[s] = 0;
      heap.push(0, s * 4096 + r);
    });
    const g = new Float64Array(mesh.cells);
    while (heap.size) {
      const [key, item] = heap.pop();
      const c = Math.floor(item / 4096), r = item % 4096;
      if (local[c] !== -1) continue;
      local[c] = r;
      g[c] = key / weight[r]!;
      for (const m of mesh.neighbors[c]!) {
        if (!inComp[m] || local[m] !== -1) continue;
        const nk = (g[c]! + costTo(c, m)) * weight[r]!;
        if (nk < best[m]!) {
          best[m] = nk;
          heap.push(nk, m * 4096 + r);
        }
      }
    }
  };

  for (let round = 0; round < 14; round++) {
    grow();
    const size = new Array<number>(k).fill(0), sx = new Array<number>(k).fill(0), sy = new Array<number>(k).fill(0);
    for (const c of comp) {
      const r = local[c]!;
      size[r]!++;
      sx[r]! += mesh.x[c]!;
      sy[r]! += mesh.y[c]!;
    }
    if (round < 5) {
      // Move each seed to the cell of its region nearest the region's middle.
      const bestD = new Array<number>(k).fill(Infinity);
      for (const c of comp) {
        const r = local[c]!;
        const d = dist(mesh.x[c]!, mesh.y[c]!, sx[r]! / size[r]!, sy[r]! / size[r]!);
        if (d < bestD[r]!) (bestD[r] = d), (seeds[r] = c);
      }
    }
    // Slow down big regions, speed up small ones.
    for (let r = 0; r < k; r++) weight[r] = weight[r]! * Math.sqrt(Math.max(0.25, size[r]! / target));
  }
  grow();
  for (const c of comp) owner[c] = first + local[c]!;
}

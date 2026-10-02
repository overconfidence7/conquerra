import type { Rng } from "@conquerra/engine";
import type { Mesh } from "./mesh";
import { clamp, dist, Noise, randomDirection } from "./util";

export interface LandOptions {
  /** Share of the map that is water (0.2–0.6). */
  water: number;
  /** Inland seas or big gulfs carved into the land. */
  seas: number;
  /** Lakes inside the land. */
  lakes: number;
  /** Island chains off the coast (each 2–3 islands). */
  islandChains: number;
  /** Rough island size, in cells. */
  islandCells: number;
}

export interface Land {
  /** Raw elevation, 0..1 (water is below `seaLevel`). */
  elev: Float64Array;
  seaLevel: number;
  /** Moisture, 0..1 (forests and swamps like it wet). */
  moist: Float64Array;
  /** Small-scale noise, 0..1, for patchy biomes. */
  detail: Float64Array;
  water: Uint8Array;
}

/** Breadth-first steps from a set of start cells, over cells allowed by `pass` (-1 if unreachable). */
export function bfsSteps(mesh: Mesh, starts: readonly number[], pass: (c: number) => boolean): Int32Array {
  const d = new Int32Array(mesh.cells).fill(-1);
  const q: number[] = [];
  for (const s of starts) if (d[s] === -1) (d[s] = 0), q.push(s);
  for (let h = 0; h < q.length; h++) {
    const c = q[h]!;
    for (const n of mesh.neighbors[c]!) if (d[n] === -1 && pass(n)) (d[n] = d[c]! + 1), q.push(n);
  }
  return d;
}

/** Connected groups of cells for which `inSet` is true, biggest first (ties: lowest cell first). */
export function components(mesh: Mesh, inSet: (c: number) => boolean): number[][] {
  const seen = new Uint8Array(mesh.cells);
  const out: number[][] = [];
  for (let s = 0; s < mesh.cells; s++) {
    if (seen[s] || !inSet(s)) continue;
    const comp = [s];
    seen[s] = 1;
    for (let h = 0; h < comp.length; h++)
      for (const n of mesh.neighbors[comp[h]!]!) if (!seen[n] && inSet(n)) (seen[n] = 1), comp.push(n);
    out.push(comp);
  }
  return out.sort((a, b) => b.length - a.length || a[0]! - b[0]!);
}

const onFrame = (mesh: Mesh, c: number) => mesh.cellEdges[c]!.some((e) => mesh.edgeCellB[e] === -1);

export function makeLand(mesh: Mesh, rng: Rng, opts: LandOptions): Land {
  const { width: W, height: H } = mesh;
  const minDim = Math.min(W, H);
  const n = mesh.cells;
  const shapeNoise = new Noise(rng), moistNoise = new Noise(rng), detailNoise = new Noise(rng);

  // Seas: dents pushed down into the elevation, somewhere in the middle part of the map.
  const dents: { x: number; y: number; r: number; depth: number }[] = [];
  for (let i = 0; i < opts.seas; i++)
    dents.push({ x: W * (0.2 + 0.6 * rng.next()), y: H * (0.2 + 0.6 * rng.next()), r: minDim * (0.14 + 0.08 * rng.next()), depth: 0.55 });

  const elev = new Float64Array(n), moist = new Float64Array(n), detail = new Float64Array(n);
  for (let c = 0; c < n; c++) {
    const x = mesh.x[c]!, y = mesh.y[c]!;
    // Higher towards the middle so the land is a continent ringed by sea; noise makes bays and peninsulas.
    const edge = Math.min(x, W - x, y, H - y) / (0.5 * minDim);
    // A rounded continent (an ellipse filling most of the map) roughened by noise into bays and peninsulas.
    const ux = (x - W / 2) / (W * 0.44), uy = (y - H / 2) / (H * 0.44);
    const shape = 1 - (ux * ux + uy * uy);
    let e = 0.62 * shapeNoise.fbm(x, y, minDim * 0.32, 5) + 0.38 * shape;
    for (const d of dents) {
      const u = dist(x, y, d.x, d.y) / d.r;
      if (u < 1) e -= d.depth * (1 - u * u) * (1 - u * u);
    }
    if (edge < 0.06) e -= 1; // the map frame is always sea
    elev[c] = e;
    moist[c] = moistNoise.fbm(x, y, minDim * 0.35, 4);
    detail[c] = detailNoise.fbm(x, y, mesh.spacing * 5, 3);
  }

  // Sea level: the elevation that leaves exactly the requested share of the map under water.
  const sorted = Array.from(elev).sort((a, b) => a - b);
  const seaLevel = sorted[Math.floor(clamp(opts.water, 0.05, 0.9) * (n - 1))]!;
  const water = new Uint8Array(n);
  for (let c = 0; c < n; c++) water[c] = elev[c]! < seaLevel ? 1 : 0;

  // Island chains: a short string of small islands in open sea, a few cells off the coast.
  const coastDist = () => bfsSteps(mesh, Array.from({ length: n }, (_, c) => c).filter((c) => !water[c]), (c) => water[c] === 1);
  for (let k = 0; k < opts.islandChains; k++) {
    const d = coastDist();
    const spots = Array.from({ length: n }, (_, c) => c).filter((c) => d[c]! >= 4 && d[c]! <= 6 && !onFrame(mesh, c));
    if (!spots.length) break;
    const start = spots[rng.int(spots.length)]!;
    const [dx, dy] = randomDirection(rng);
    const islands = 2 + rng.int(2);
    const radius = Math.sqrt(opts.islandCells / 3.14159) * mesh.spacing;
    for (let i = 0; i < islands; i++) {
      const cx = mesh.x[start]! + dx * i * radius * 3.2, cy = mesh.y[start]! + dy * i * radius * 3.2;
      if (cx < W * 0.06 || cx > W * 0.94 || cy < H * 0.06 || cy > H * 0.94) break;
      for (let c = 0; c < n; c++) {
        const u = dist(mesh.x[c]!, mesh.y[c]!, cx, cy) / (radius * (0.75 + 0.5 * detail[c]!));
        if (u < 1 && d[c]! >= 2) (water[c] = 0), (elev[c] = Math.max(elev[c]!, seaLevel + 0.02 + 0.05 * (1 - u)));
      }
    }
  }

  // Tidy up: drop specks of land, fill tiny ponds.
  for (const comp of components(mesh, (c) => !water[c])) if (comp.length < opts.islandCells * 0.5) for (const c of comp) water[c] = 1;
  for (const comp of components(mesh, (c) => water[c] === 1))
    if (comp.length < 6 && !comp.some((c) => onFrame(mesh, c))) for (const c of comp) water[c] = 0;

  // Lakes: blobs of water well inside the land, preferring low ground.
  const lakesNow = components(mesh, (c) => water[c] === 1).filter((comp) => !comp.some((c) => onFrame(mesh, c))).length;
  for (let k = lakesNow; k < opts.lakes; k++) {
    const d = bfsSteps(mesh, Array.from({ length: n }, (_, c) => c).filter((c) => water[c]), (c) => !water[c]);
    const spots = Array.from({ length: n }, (_, c) => c).filter((c) => d[c]! >= 5);
    if (!spots.length) break;
    const start = spots[rng.int(spots.length)]!;
    const size = 8 + rng.int(10);
    const lake = [start];
    const inLake = new Set(lake);
    while (lake.length < size) {
      const options: number[] = [];
      for (const c of lake) for (const m of mesh.neighbors[c]!) if (!inLake.has(m) && d[m]! >= 3) options.push(m);
      if (!options.length) break;
      options.sort((a, b) => elev[a]! - elev[b]! || a - b);
      const pick = options[rng.int(Math.min(3, options.length))]!;
      lake.push(pick);
      inLake.add(pick);
    }
    for (const c of lake) (water[c] = 1), (elev[c] = Math.min(elev[c]!, seaLevel - 0.01));
  }

  // Keep elevation and the land/water split in agreement.
  for (let c = 0; c < n; c++) {
    if (water[c] && elev[c]! >= seaLevel) elev[c] = seaLevel - 0.005;
    if (!water[c] && elev[c]! < seaLevel) elev[c] = seaLevel + 0.005;
  }
  return { elev, seaLevel, moist, detail, water };
}

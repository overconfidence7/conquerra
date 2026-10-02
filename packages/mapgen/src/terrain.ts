import { BIOME_CODES, type Biome, type Terrain } from "@conquerra/content";
import { bfsSteps } from "./land";
import type { Mesh } from "./mesh";

/** Share of territories of each game terrain (the rest are plains). Close to the old hand-made maps. */
const QUOTA = { mountains: 0.08, hills: 0.1, swamp: 0.06, forest: 0.22 };

export interface CellKinds {
  owner: Int32Array;
  water: Uint8Array;
  rock: Uint8Array;
  /** Sea (not lake) water. */
  sea: Uint8Array;
}

/**
 * Game terrain for each territory, from the ground it covers: the highest land beside the ranges becomes
 * mountains and hills, low wet coast becomes swamp, the wettest of the rest forest, everything else plains.
 */
export function assignTerrain(mesh: Mesh, k: CellKinds, territories: number, elev: Float64Array, moist: Float64Array): Terrain[] {
  const e = new Array<number>(territories).fill(0), m = new Array<number>(territories).fill(0), n = new Array<number>(territories).fill(0);
  const rockSide = new Array<number>(territories).fill(0), wetSide = new Array<number>(territories).fill(0);
  for (let c = 0; c < mesh.cells; c++) {
    const t = k.owner[c]!;
    if (t < 0) continue;
    e[t]! += elev[c]!;
    m[t]! += moist[c]!;
    n[t]!++;
    if (mesh.neighbors[c]!.some((x) => k.rock[x])) rockSide[t]!++;
    if (mesh.neighbors[c]!.some((x) => k.water[x])) wetSide[t]!++;
  }
  const avgE = e.map((v, t) => v / n[t]!), avgM = m.map((v, t) => v / n[t]!);
  const terrain = new Array<Terrain>(territories).fill("plains");
  const free = new Set(Array.from({ length: territories }, (_, t) => t));
  const take = (count: number, score: (t: number) => number, kind: Terrain) => {
    const order = [...free].sort((a, b) => score(b) - score(a) || a - b).slice(0, count);
    for (const t of order) (terrain[t] = kind), free.delete(t);
  };
  const q = (share: number) => Math.round(share * territories);
  const high = (t: number) => avgE[t]! + (rockSide[t]! / n[t]!) * 0.6;
  take(q(QUOTA.mountains), high, "mountains");
  take(q(QUOTA.hills), high, "hills");
  take(q(QUOTA.swamp), (t) => avgM[t]! - avgE[t]! + (wetSide[t]! / n[t]!) * 0.5, "swamp");
  take(q(QUOTA.forest), (t) => avgM[t]!, "forest");
  return terrain;
}

/** Which ground types count as a match for each game terrain (the painting must agree with the rules). */
export const TERRAIN_BIOMES: Record<Terrain, Biome[]> = {
  plains: ["grass", "farmland", "sand"],
  forest: ["forest"],
  hills: ["hills"],
  mountains: ["hills", "rock", "snow"],
  swamp: ["swamp"],
};

/**
 * Ground type for every cell. Each territory is mostly its own terrain's ground, with patches of others
 * (chosen by smooth noise, so they come out as blobs, not speckles). Sea coasts get beaches.
 */
export function assignBiomes(
  mesh: Mesh,
  k: CellKinds,
  territories: number,
  terrain: readonly Terrain[],
  elev: Float64Array,
  detail: Float64Array,
): Biome[] {
  const biome = new Array<Biome>(mesh.cells).fill("grass");
  const landDist = bfsSteps(mesh, Array.from({ length: mesh.cells }, (_, c) => c).filter((c) => !k.water[c]), (c) => k.water[c] === 1);
  const cellsOf: number[][] = Array.from({ length: territories }, () => []);
  const rockCells: number[] = [];
  for (let c = 0; c < mesh.cells; c++) {
    if (k.water[c]) biome[c] = landDist[c]! <= 1 ? "shallow" : "deep";
    else if (k.rock[c]) rockCells.push(c);
    else if (k.owner[c]! >= 0) cellsOf[k.owner[c]!]!.push(c);
  }
  rockCells.sort((a, b) => elev[b]! - elev[a]! || a - b);
  rockCells.forEach((c, i) => (biome[c] = i < rockCells.length * 0.45 ? "snow" : "rock"));

  for (let t = 0; t < territories; t++) {
    const cells = [...cellsOf[t]!].sort((a, b) => detail[b]! - detail[a]! || a - b);
    const n = cells.length;
    const share = (i: number) => i / n;
    cells.forEach((c, i) => {
      const s = share(i);
      let b: Biome;
      switch (terrain[t]) {
        case "forest":
          b = s < 0.78 ? "forest" : "grass";
          break;
        case "hills":
          b = s < 0.15 ? "forest" : s < 0.85 ? "hills" : "grass";
          break;
        case "mountains":
          b = s < 0.2 ? "forest" : "hills";
          break;
        case "swamp":
          b = s < 0.72 ? "swamp" : "grass";
          break;
        default:
          b = s < 0.12 ? "forest" : s > 0.6 ? "farmland" : "grass";
      }
      biome[c] = b;
    });
    // Mountain territories: only their very highest ground is bare rock (bare rock and snow mostly mean an impassable range).
    if (terrain[t] === "mountains") {
      const high = [...cellsOf[t]!].sort((a, b) => elev[b]! - elev[a]! || a - b);
      for (const c of high.slice(0, Math.floor(n * 0.15))) biome[c] = "rock";
    }
    // Beaches along the open sea on plains.
    if (terrain[t] === "plains")
      for (const c of cellsOf[t]!) if (detail[c]! < 0.5 && mesh.neighbors[c]!.some((x) => k.sea[x])) biome[c] = "sand";
  }
  return biome;
}

/** Height of each cell for relief lighting, 0..1. Sea level is 0.31: water below it, land above. */
export const SEA_HEIGHT = 0.31;

export function cellHeights(mesh: Mesh, k: CellKinds, terrain: readonly Terrain[], elev: Float64Array, detail: Float64Array): Float64Array {
  const h = new Float64Array(mesh.cells);
  const isLand = (c: number) => !k.water[c];
  const landDist = bfsSteps(mesh, Array.from({ length: mesh.cells }, (_, c) => c).filter(isLand), (c) => k.water[c] === 1);
  const waterDist = bfsSteps(mesh, Array.from({ length: mesh.cells }, (_, c) => c).filter((c) => k.water[c] === 1), isLand);
  const rankOf = (cells: number[]) => {
    const r = new Map<number, number>();
    [...cells].sort((a, b) => elev[a]! - elev[b]! || a - b).forEach((c, i) => r.set(c, cells.length > 1 ? i / (cells.length - 1) : 0.5));
    return r;
  };
  const all = Array.from({ length: mesh.cells }, (_, c) => c);
  const landRank = rankOf(all.filter((c) => isLand(c) && !k.rock[c]));
  const rockRank = rankOf(all.filter((c) => k.rock[c]));
  const lift: Record<Terrain, number> = { plains: 0, forest: 0.03, hills: 0.12, mountains: 0.2, swamp: -0.02 };
  for (let c = 0; c < mesh.cells; c++) {
    if (k.water[c]) {
      // Shallows near the shore, deep water further out.
      const d = Math.min(1, (landDist[c]! - 1) / 5);
      h[c] = SEA_HEIGHT - 0.03 - 0.24 * d;
    } else if (k.rock[c]) {
      h[c] = 0.68 + 0.22 * rockRank.get(c)! + 0.03 * ridgeDepth(mesh, k, c) + 0.04 * detail[c]!;
    } else {
      const t = k.owner[c]!;
      let v = SEA_HEIGHT + 0.03 + 0.2 * landRank.get(c)! + (t >= 0 ? lift[terrain[t]!] : 0) + 0.04 * (detail[c]! - 0.5);
      // Next to mountains the land climbs.
      if (mesh.neighbors[c]!.some((x) => k.rock[x])) v += 0.08;
      // Coasts sit just above the water.
      if (waterDist[c] === 1) v = Math.min(v, SEA_HEIGHT + 0.04);
      h[c] = Math.max(SEA_HEIGHT + 0.01, Math.min(0.66, v));
    }
  }
  return h;
}

/** How many rock cells deep this cell is (1 at the edge of a range). */
function ridgeDepth(mesh: Mesh, k: CellKinds, c: number): number {
  return mesh.neighbors[c]!.every((x) => k.rock[x]) ? 2 : 1;
}

export interface Grids {
  cellSize: number;
  cols: number;
  rows: number;
  biome: string;
  /** 0..255 per square. */
  height: Uint8Array;
  seaLevel: number;
  /** Is each square water? */
  wet: Uint8Array;
}

/** Sample cells onto the low-resolution grids the renderer reads, then soften the height map. */
export function buildGrids(mesh: Mesh, biome: readonly Biome[], heights: Float64Array, cellSize: number): Grids {
  const cols = Math.ceil(mesh.width / cellSize), rows = Math.ceil(mesh.height / cellSize);
  let codes = "";
  const raw = new Float64Array(cols * rows);
  const wet = new Uint8Array(cols * rows);
  let hint = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const cell = mesh.delaunay.find((c + 0.5) * cellSize, (r + 0.5) * cellSize, hint);
      hint = cell;
      const b = biome[cell]!;
      codes += BIOME_CODES[b];
      raw[r * cols + c] = heights[cell]!;
      wet[r * cols + c] = b === "shallow" || b === "deep" ? 1 : 0;
    }
  // Two passes of a 3x3 blur, keeping water below sea level and land above it.
  let cur = raw;
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float64Array(cols * rows);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        let s = 0, w = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr, cc = c + dc;
            if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
            const k = dr === 0 && dc === 0 ? 4 : dr === 0 || dc === 0 ? 2 : 1;
            s += cur[rr * cols + cc]! * k;
            w += k;
          }
        next[r * cols + c] = s / w;
      }
    cur = next;
  }
  const seaLevel = Math.round(SEA_HEIGHT * 255);
  const height = new Uint8Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    let v = Math.round(cur[i]! * 255);
    if (wet[i]) v = Math.min(v, seaLevel);
    else v = Math.max(v, seaLevel + 2);
    height[i] = Math.max(0, Math.min(255, v));
  }
  return { cellSize, cols, rows, biome: codes, height, seaLevel, wet };
}

/**
 * Carve rivers into the height map so that, walking from source to mouth, the land under the river never rises.
 * Repeats until every river is settled (values only ever go down, so this always finishes).
 */
export function carveRivers(g: Grids, rivers: readonly number[][]): void {
  const squares = rivers.map((pts) => {
    const out: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      const c = Math.min(g.cols - 1, Math.floor(pts[i]! / g.cellSize)), r = Math.min(g.rows - 1, Math.floor(pts[i + 1]! / g.cellSize));
      const s = r * g.cols + c;
      if (!g.wet[s] && out[out.length - 1] !== s) out.push(s);
    }
    return out;
  });
  for (let pass = 0; pass < 200; pass++) {
    let changed = false;
    for (const list of squares) {
      let lowest = 255;
      for (const s of list) {
        // A small dip, so the valley shows in the lighting.
        const want = Math.max(g.seaLevel + 2, Math.min(lowest, g.height[s]! - (pass === 0 ? 3 : 0)));
        if (g.height[s]! > want) (g.height[s] = want), (changed = true);
        lowest = Math.min(lowest, g.height[s]!);
      }
    }
    if (!changed) break;
  }
}

/** Base64 without relying on Node or browser helpers. */
export function toBase64(bytes: Uint8Array): string {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!, b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    out += abc[(n >> 18) & 63]! + abc[(n >> 12) & 63]! + (i + 1 < bytes.length ? abc[(n >> 6) & 63]! : "=") + (i + 2 < bytes.length ? abc[n & 63]! : "=");
  }
  return out;
}

export function fromBase64(s: string): Uint8Array {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = s.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0, acc = 0, o = 0;
  for (const ch of clean) {
    acc = (acc << 6) | abc.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 255;
    }
  }
  return out;
}

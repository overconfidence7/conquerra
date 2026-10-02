import type { Mesh } from "./mesh";
import { r1 } from "./util";

/**
 * Outlines. Every cell carries a region label (a territory, a water body or a mountain range; -1 = off the map).
 * The border between two regions is cut into "arcs" that run from one junction (where three or more regions meet)
 * to the next. Each arc is smoothed once, and every outline is stitched from the same smoothed arcs, so a border
 * drawn for one territory matches its neighbour's exactly.
 */
export interface Arc {
  /** The two regions on either side (lo < hi). */
  lo: number;
  hi: number;
  corners: number[];
  closed: boolean;
  /** Smoothed points, x/y pairs. */
  pts: number[];
}

const pairOf = (a: number, b: number) => (a < b ? [a, b] : [b, a]) as [number, number];

function chaikin(pts: number[], closed: boolean, rounds: number): number[] {
  let p = pts;
  for (let r = 0; r < rounds; r++) {
    const n = p.length / 2;
    const out: number[] = [];
    if (!closed) out.push(p[0]!, p[1]!);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % n;
      const ax = p[2 * i]!, ay = p[2 * i + 1]!, bx = p[2 * j]!, by = p[2 * j + 1]!;
      out.push(0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by, 0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by);
    }
    if (!closed) out.push(p[2 * n - 2]!, p[2 * n - 1]!);
    p = out;
  }
  return p;
}

export interface Outlines {
  arcs: Arc[];
  /** Arcs touching each corner (by arc index), for walking rivers along borders. */
  isJunction: Uint8Array;
}

export function buildArcs(mesh: Mesh, label: Int32Array): Outlines {
  const lab = (c: number) => (c < 0 ? -1 : label[c]!);
  const nE = mesh.edgeA.length;
  const boundary = new Uint8Array(nE);
  for (let e = 0; e < nE; e++) if (lab(mesh.edgeCellA[e]!) !== lab(mesh.edgeCellB[e]!)) boundary[e] = 1;
  // Ignore the outer frame between off-map and sea: water outlines still close along the frame.
  const pairKeyOf = (e: number) => {
    const [a, b] = pairOf(lab(mesh.edgeCellA[e]!), lab(mesh.edgeCellB[e]!));
    return `${a}|${b}`;
  };
  const isJunction = new Uint8Array(mesh.cornerX.length);
  for (let v = 0; v < mesh.cornerX.length; v++) {
    const bes = mesh.cornerEdges[v]!.filter((e) => boundary[e]);
    if (bes.length === 0) continue;
    if (bes.length !== 2 || pairKeyOf(bes[0]!) !== pairKeyOf(bes[1]!)) isJunction[v] = 1;
  }
  const visited = new Uint8Array(nE);
  const arcs: Arc[] = [];
  const other = (e: number, v: number) => (mesh.edgeA[e] === v ? mesh.edgeB[e]! : mesh.edgeA[e]!);
  const walk = (startV: number, startE: number): number[] => {
    const corners = [startV];
    let v = startV, e = startE;
    for (;;) {
      visited[e] = 1;
      v = other(e, v);
      corners.push(v);
      if (isJunction[v] || v === startV) break;
      const next = mesh.cornerEdges[v]!.find((x) => boundary[x] && !visited[x]);
      if (next === undefined) break;
      e = next;
    }
    return corners;
  };
  const push = (corners: number[], e: number) => {
    const [lo, hi] = pairOf(lab(mesh.edgeCellA[e]!), lab(mesh.edgeCellB[e]!));
    const closed = corners[0] === corners[corners.length - 1] && !isJunction[corners[0]!];
    const raw: number[] = [];
    const list = closed ? corners.slice(0, -1) : corners;
    for (const v of list) raw.push(mesh.cornerX[v]!, mesh.cornerY[v]!);
    arcs.push({ lo, hi, corners, closed, pts: chaikin(raw, closed, 2) });
  };
  for (let v = 0; v < mesh.cornerX.length; v++) {
    if (!isJunction[v]) continue;
    for (const e of mesh.cornerEdges[v]!) if (boundary[e] && !visited[e]) push(walk(v, e), e);
  }
  // Loops with no junction at all (an island or lake inside a single neighbour).
  for (let e = 0; e < nE; e++) if (boundary[e] && !visited[e]) push(walk(mesh.edgeA[e]!, e), e);
  return { arcs, isJunction };
}

/** Closed outline rings of one region, stitched from its arcs. Flat x,y lists at 0.1 precision. */
export function ringsOf(arcs: readonly Arc[], region: number): number[][] {
  const mine = arcs.map((a, i) => i).filter((i) => arcs[i]!.lo === region || arcs[i]!.hi === region);
  const used = new Set<number>();
  const byEnd = new Map<number, number[]>();
  for (const i of mine) {
    const a = arcs[i]!;
    if (a.closed) continue;
    for (const v of [a.corners[0]!, a.corners[a.corners.length - 1]!]) byEnd.set(v, [...(byEnd.get(v) ?? []), i]);
  }
  const rings: number[][] = [];
  for (const i of mine) {
    if (used.has(i)) continue;
    used.add(i);
    const a = arcs[i]!;
    if (a.closed) {
      rings.push(tidy(a.pts));
      continue;
    }
    const ring: number[] = [...a.pts];
    const startV = a.corners[0]!;
    let endV = a.corners[a.corners.length - 1]!;
    while (endV !== startV) {
      const nextI = (byEnd.get(endV) ?? []).find((j) => !used.has(j));
      if (nextI === undefined) break;
      used.add(nextI);
      const b = arcs[nextI]!;
      const forward = b.corners[0] === endV;
      const pts = forward ? b.pts : reversePts(b.pts);
      ring.push(...pts.slice(2));
      endV = forward ? b.corners[b.corners.length - 1]! : b.corners[0]!;
    }
    rings.push(tidy(ring));
  }
  return rings.filter((r) => r.length >= 6);
}

export function reversePts(pts: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = pts.length - 2; i >= 0; i -= 2) out.push(pts[i]!, pts[i + 1]!);
  return out;
}

/** Round to 0.1 and drop repeated points. */
export function tidy(pts: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) {
    const x = r1(pts[i]!), y = r1(pts[i + 1]!);
    if (out.length && out[out.length - 2] === x && out[out.length - 1] === y) continue;
    out.push(x, y);
  }
  return out;
}

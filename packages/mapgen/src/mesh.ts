import type { Rng } from "@conquerra/engine";
import { Delaunay } from "d3-delaunay";

/**
 * The fine mesh everything is built from: a few thousand small, irregular cells (Voronoi cells around jittered
 * grid points). Land, water, mountains and territories are all sets of these cells, and every outline is made of
 * their edges, so shared borders always line up exactly.
 */
export interface Mesh {
  width: number;
  height: number;
  /** Average distance between cell centres. */
  spacing: number;
  cells: number;
  x: Float64Array;
  y: Float64Array;
  /** Cells sharing an edge, sorted. */
  neighbors: number[][];
  /** Corner points (where cell edges meet). */
  cornerX: number[];
  cornerY: number[];
  /** Each edge joins two corners and separates two cells (cellB is -1 on the map frame). */
  edgeA: number[];
  edgeB: number[];
  edgeCellA: number[];
  edgeCellB: number[];
  cornerEdges: number[][];
  cellEdges: number[][];
  delaunay: Delaunay<number>;
}

export function buildMesh(rng: Rng, width: number, height: number, spacing: number): Mesh {
  const cols = Math.round(width / spacing), rows = Math.round(height / spacing);
  const sx = width / cols, sy = height / rows;
  const pts: number[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) pts.push((c + 0.5 + (rng.next() - 0.5) * 0.7) * sx, (r + 0.5 + (rng.next() - 0.5) * 0.7) * sy);
  const n = pts.length / 2;
  const delaunay = new Delaunay(Float64Array.from(pts));
  const voronoi = delaunay.voronoi([0, 0, width, height]);

  const cornerId = new Map<string, number>();
  const cornerX: number[] = [], cornerY: number[] = [];
  const corner = (x: number, y: number) => {
    const key = `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
    let id = cornerId.get(key);
    if (id === undefined) {
      id = cornerX.length;
      cornerId.set(key, id);
      cornerX.push(x);
      cornerY.push(y);
    }
    return id;
  };
  const edgeId = new Map<number, number>();
  const edgeA: number[] = [], edgeB: number[] = [], edgeCellA: number[] = [], edgeCellB: number[] = [];
  const cellEdges: number[][] = [];
  for (let i = 0; i < n; i++) {
    const poly = voronoi.cellPolygon(i);
    const mine: number[] = [];
    cellEdges.push(mine);
    if (!poly) continue;
    const ids = poly.map(([x, y]) => corner(x, y));
    for (let k = 0; k < ids.length - 1; k++) {
      const a = ids[k]!, b = ids[k + 1]!;
      if (a === b) continue;
      const key = a < b ? a * 1e7 + b : b * 1e7 + a;
      let e = edgeId.get(key);
      if (e === undefined) {
        e = edgeA.length;
        edgeId.set(key, e);
        edgeA.push(a);
        edgeB.push(b);
        edgeCellA.push(i);
        edgeCellB.push(-1);
      } else edgeCellB[e] = i;
      mine.push(e);
    }
  }
  const cornerEdges: number[][] = cornerX.map(() => []);
  const neighbors: number[][] = Array.from({ length: n }, () => []);
  for (let e = 0; e < edgeA.length; e++) {
    cornerEdges[edgeA[e]!]!.push(e);
    cornerEdges[edgeB[e]!]!.push(e);
    const a = edgeCellA[e]!, b = edgeCellB[e]!;
    if (b >= 0) {
      neighbors[a]!.push(b);
      neighbors[b]!.push(a);
    }
  }
  for (const l of neighbors) l.sort((a, b) => a - b);
  const x = new Float64Array(n), y = new Float64Array(n);
  for (let i = 0; i < n; i++) (x[i] = pts[2 * i]!), (y[i] = pts[2 * i + 1]!);
  return { width, height, spacing, cells: n, x, y, neighbors, cornerX, cornerY, edgeA, edgeB, edgeCellA, edgeCellB, cornerEdges, cellEdges, delaunay };
}

/** The cell containing a point (the nearest cell centre). `hint` speeds up nearby lookups. */
export function cellAt(mesh: Mesh, x: number, y: number, hint = 0): number {
  return mesh.delaunay.find(x, y, hint);
}

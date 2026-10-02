import type { BorderType, MapDef } from "@conquerra/content";
import { Delaunay } from "d3-delaunay";

export interface MapGeometry {
  viewBox: [number, number, number, number];
  /** SVG path for each territory's shape. */
  cells: Map<string, string>;
  /** Where to put each territory's label (its map point). */
  centers: Map<string, [number, number]>;
  /** Edges between territories in different provinces (one path). */
  provinceEdges: string;
  /** River and mountain-pass borders. */
  specialEdges: { type: Exclude<BorderType, "normal">; a: string; b: string; d: string }[];
  /** Map borders whose shapes don't touch (drawn as a connecting line, like a sea lane). */
  connectors: { a: string; b: string }[];
  /** Label spot for each province (the middle of its territories). */
  provinceLabels: { id: string; name: string; x: number; y: number }[];
}

const MARGIN = 55;
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const fmt = (n: number) => Math.round(n * 10) / 10;

/**
 * Territory shapes from each territory's point: Voronoi cells clipped to a frame around the map.
 * Province outlines and special borders are the cell edges shared by the territories involved.
 */
export function buildGeometry(map: MapDef): MapGeometry {
  const pts = map.territories.map((t) => [t.x, t.y] as [number, number]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs) - MARGIN, y0 = Math.min(...ys) - MARGIN;
  const x1 = Math.max(...xs) + MARGIN, y1 = Math.max(...ys) + MARGIN;
  const voronoi = Delaunay.from(pts).voronoi([x0, y0, x1, y1]);

  const cells = new Map<string, string>();
  const centers = new Map<string, [number, number]>();
  // Every cell edge, keyed by its two (rounded) end points, with the cells that share it.
  const edges = new Map<string, { seg: [[number, number], [number, number]]; owners: number[] }>();
  map.territories.forEach((t, i) => {
    const poly = voronoi.cellPolygon(i);
    centers.set(t.id, [t.x, t.y]);
    if (!poly) return;
    cells.set(t.id, `M${poly.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join("L")}Z`);
    for (let k = 0; k < poly.length - 1; k++) {
      const p = poly[k]!, q = poly[k + 1]!;
      const a = `${fmt(p[0])},${fmt(p[1])}`, b = `${fmt(q[0])},${fmt(q[1])}`;
      if (a === b) continue;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      const e = edges.get(key) ?? { seg: [p as [number, number], q as [number, number]], owners: [] };
      e.owners.push(i);
      edges.set(key, e);
    }
  });

  const shared = new Map<string, string[]>(); // territory pair -> path segments
  for (const e of edges.values()) {
    if (e.owners.length !== 2) continue;
    const [i, j] = e.owners as [number, number];
    const k = pairKey(map.territories[i]!.id, map.territories[j]!.id);
    const d = `M${fmt(e.seg[0][0])},${fmt(e.seg[0][1])}L${fmt(e.seg[1][0])},${fmt(e.seg[1][1])}`;
    shared.set(k, [...(shared.get(k) ?? []), d]);
  }

  const province = new Map(map.territories.map((t) => [t.id, t.province]));
  let provinceEdges = "";
  for (const [k, segs] of shared) {
    const [a, b] = k.split("|") as [string, string];
    if (province.get(a) !== province.get(b)) provinceEdges += segs.join("");
  }

  const specialEdges: MapGeometry["specialEdges"] = [];
  const connectors: MapGeometry["connectors"] = [];
  for (const b of map.borders) {
    const segs = shared.get(pairKey(b.a, b.b));
    if (!segs) connectors.push({ a: b.a, b: b.b });
    else if (b.type !== "normal") specialEdges.push({ type: b.type, a: b.a, b: b.b, d: segs.join("") });
  }

  const provinceLabels = map.provinces.map((p) => {
    const members = map.territories.filter((t) => t.province === p.id);
    const x = members.reduce((a, t) => a + t.x, 0) / Math.max(1, members.length);
    const y = members.reduce((a, t) => a + t.y, 0) / Math.max(1, members.length);
    return { id: p.id, name: p.name, x, y };
  });

  return { viewBox: [x0, y0, x1 - x0, y1 - y0], cells, centers, provinceEdges, specialEdges, connectors, provinceLabels };
}

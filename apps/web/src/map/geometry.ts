import type { Line, MapDef } from "@conquerra/content";

/**
 * Plain SVG shapes from the map maker's drawing data. Session 4 replaces this simple renderer with the
 * illustrated one; this only needs to be readable.
 */
export interface MapGeometry {
  viewBox: [number, number, number, number];
  /** SVG path for each territory's outline (draw with fill-rule evenodd: lakes inside a territory are holes). */
  cells: Map<string, string>;
  /** Where each territory's banner goes (its label point). */
  centers: Map<string, [number, number]>;
  /** Lakes and seas (drawn over the sea-coloured background, so lakes inside the land show). */
  water: string;
  /** Impassable mountain ranges. */
  mountains: { id: string; name: string; d: string; label: [number, number] }[];
  /** Borders between territories in different provinces (one path). */
  provinceEdges: string;
  rivers: string[];
  passes: { a: string; b: string; x: number; y: number }[];
  seaLanes: { a: string; b: string; d: string }[];
  /** Province name spots (the middle of each province's label line). */
  provinceLabels: { id: string; name: string; x: number; y: number }[];
}

const line = (pts: Line, close: boolean) => {
  let d = "";
  for (let i = 0; i < pts.length; i += 2) d += `${i ? "L" : "M"}${pts[i]},${pts[i + 1]}`;
  return close ? `${d}Z` : d;
};
const rings = (rs: readonly Line[]) => rs.map((r) => line(r, true)).join("");

export function buildGeometry(map: MapDef): MapGeometry {
  const g = map.geometry;
  if (!g) throw new Error(`Map ${map.id} has no drawing data`);
  const province = new Map(map.territories.map((t) => [t.id, t.province]));
  return {
    viewBox: [0, 0, g.width, g.height],
    cells: new Map(g.territories.map((t) => [t.id, rings(t.rings)])),
    centers: new Map(g.territories.map((t) => [t.id, [t.label.x, t.label.y]])),
    water: g.water.map((w) => rings(w.rings)).join(""),
    mountains: g.mountains.map((m) => ({ id: m.id, name: m.name, d: rings(m.rings), label: [m.label.x, m.label.y] })),
    provinceEdges: g.borderLines
      .filter((b) => province.get(b.a) !== province.get(b.b))
      .flatMap((b) => b.lines.map((l) => line(l, false)))
      .join(""),
    rivers: g.rivers.map((r) => line(r.path, false)),
    passes: g.passes.map((p) => ({ a: p.a, b: p.b, x: p.x, y: p.y })),
    seaLanes: g.seaLanes.map((l) => ({ a: l.a, b: l.b, d: line(l.path, false) })),
    provinceLabels: g.provinceLabels.map((p) => ({
      id: p.id,
      name: map.provinces.find((x) => x.id === p.id)?.name ?? "",
      x: p.path[2]!,
      y: p.path[3]!,
    })),
  };
}

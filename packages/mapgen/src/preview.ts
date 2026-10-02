import type { MapDef } from "@conquerra/content";
import { fromBase64 } from "./terrain";

/** Flat debug colours per biome code. */
const COLORS: Record<string, [number, number, number]> = {
  g: [138, 178, 92],
  a: [196, 190, 110],
  f: [62, 112, 58],
  h: [150, 150, 96],
  r: [130, 122, 112],
  s: [236, 238, 242],
  w: [94, 120, 88],
  d: [226, 206, 150],
  o: [112, 172, 196],
  O: [52, 98, 150],
};

const path = (pts: readonly number[], close: boolean) => {
  let d = "";
  for (let i = 0; i < pts.length; i += 2) d += `${i === 0 ? "M" : "L"}${pts[i]},${pts[i + 1]}`;
  return close ? d + "Z" : d;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * A quick debug picture of a generated map (not the final art): flat biome colours with simple hill shading
 * from the height map, territory and province borders, rivers, passes, sea lanes and capital slots.
 */
export function mapPreviewSvg(map: MapDef): string {
  const g = map.geometry;
  if (!g) throw new Error("map has no geometry");
  const { cols, rows, cellSize, data } = g.biome;
  const h = fromBase64(g.heightMap.data);
  const at = (c: number, r: number) => h[Math.max(0, Math.min(rows - 1, r)) * cols + Math.max(0, Math.min(cols - 1, c))]!;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.width} ${g.height}" width="${g.width * 1.5}" height="${g.height * 1.5}">`);
  // Ground: one rectangle per run of identical colour in each row.
  for (let r = 0; r < rows; r++) {
    let runStart = 0, runColor = "";
    const flush = (end: number) => {
      if (runColor) out.push(`<rect x="${runStart * cellSize}" y="${r * cellSize}" width="${(end - runStart) * cellSize + 0.6}" height="${cellSize + 0.6}" fill="${runColor}"/>`);
    };
    for (let c = 0; c <= cols; c++) {
      let color = "";
      if (c < cols) {
        const base = COLORS[data[r * cols + c]!] ?? [255, 0, 255];
        // Light from the upper left: slopes facing it are brighter, slopes facing away darker.
        const slope = (at(c + 1, r) - at(c - 1, r) + at(c, r + 1) - at(c, r - 1)) / 255;
        const shade = Math.round(Math.max(0.6, Math.min(1.35, 1 + slope * 4)) * 20) / 20;
        color = `rgb(${base.map((v) => Math.min(255, Math.round(v * shade))).join(",")})`;
      }
      if (color !== runColor) {
        flush(c);
        runStart = c;
        runColor = color;
      }
    }
  }
  const province = new Map(map.territories.map((t) => [t.id, t.province]));
  for (const w of g.water) out.push(`<path d="${w.rings.map((r) => path(r, true)).join("")}" fill="none" stroke="#1d3d5c" stroke-width="1.4"/>`);
  for (const m of g.mountains) out.push(`<path d="${m.rings.map((r) => path(r, true)).join("")}" fill="none" stroke="#4a3f36" stroke-width="1.6"/>`);
  for (const b of g.borderLines) {
    const prov = province.get(b.a) !== province.get(b.b);
    out.push(`<path d="${b.lines.map((l) => path(l, false)).join("")}" fill="none" stroke="${prov ? "#2b2118" : "#3b3226"}" stroke-width="${prov ? 2.4 : 0.9}" stroke-opacity="${prov ? 0.9 : 0.6}"/>`);
  }
  for (const r of g.rivers) out.push(`<path d="${path(r.path, false)}" fill="none" stroke="#2f7fc4" stroke-width="2.6" stroke-linecap="round"/>`);
  for (const l of g.seaLanes) out.push(`<path d="${path(l.path, false)}" fill="none" stroke="#f4f0e0" stroke-width="2" stroke-dasharray="6 4"/>`);
  for (const p of g.passes) out.push(`<circle cx="${p.x}" cy="${p.y}" r="6" fill="#f2d16b" stroke="#3a2a10" stroke-width="1.5"/>`);
  const slots = new Set(map.capitalSlots);
  for (const t of g.territories) {
    const def = map.territories.find((x) => x.id === t.id)!;
    if (t.castle) out.push(`<rect x="${t.castle.x - 5}" y="${t.castle.y - 5}" width="10" height="10" fill="${slots.has(t.id) ? "#c0392b" : "#777"}" stroke="#fff" stroke-width="1.2"/>`);
    out.push(`<circle cx="${t.label.x}" cy="${t.label.y}" r="2.2" fill="#111"/>`);
    out.push(`<text x="${t.label.x}" y="${t.label.y - 5}" font-size="9" text-anchor="middle" font-family="Georgia, serif" fill="#111" stroke="#fff" stroke-width="2" paint-order="stroke">${esc(def.name)}</text>`);
  }
  for (const p of g.provinceLabels) {
    const name = map.provinces.find((x) => x.id === p.id)!.name;
    out.push(`<path id="pl-${p.id}" d="M${p.path[0]},${p.path[1]}Q${p.path[2]},${p.path[3]} ${p.path[4]},${p.path[5]}" fill="none"/>`);
    out.push(`<text font-size="17" font-family="Georgia, serif" fill="#3a1f0a" fill-opacity="0.55" letter-spacing="2"><textPath href="#pl-${p.id}" startOffset="50%" text-anchor="middle">${esc(name.toUpperCase())}</textPath></text>`);
  }
  for (const w of g.water) out.push(`<text x="${w.label.x}" y="${w.label.y}" font-size="13" font-style="italic" text-anchor="middle" font-family="Georgia, serif" fill="#e8f2fa">${esc(w.name)}</text>`);
  for (const m of g.mountains) out.push(`<text x="${m.label.x}" y="${m.label.y}" font-size="11" font-style="italic" text-anchor="middle" font-family="Georgia, serif" fill="#2a1d12" stroke="#eee" stroke-width="2" paint-order="stroke">${esc(m.name)}</text>`);
  out.push(`<text x="12" y="24" font-size="18" font-family="Georgia, serif" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${esc(map.name)} · ${map.territories.length} territories · ${map.provinces.length} provinces (debug preview)</text>`);
  out.push("</svg>");
  return out.join("\n");
}

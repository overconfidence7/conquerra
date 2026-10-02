import type { MapDef } from "@conquerra/content";

/**
 * Nate's place-name changes: a per-map file (`packages/mapgen/names/<map>.json`) listing "old name": "new name".
 * Applied after the map maker runs, so names change without touching the generator. Covers territories,
 * provinces, seas and lakes, mountain ranges and rivers. Random maps never use these files.
 */
export interface NameFile {
  about?: string;
  renames: Record<string, string>;
}

/** Rename places on a map. Returns the new map and any old names that weren't found (probably a typo). */
export function applyRenames(map: MapDef, renames: Record<string, string>): { map: MapDef; unknown: string[] } {
  const m: MapDef = JSON.parse(JSON.stringify(map));
  const used = new Set<string>();
  const rename = <T extends { name: string }>(x: T) => {
    const to = renames[x.name];
    if (to !== undefined && to.trim()) {
      used.add(x.name);
      x.name = to.trim();
    }
  };
  m.territories.forEach(rename);
  m.provinces.forEach(rename);
  if (m.geometry) {
    m.geometry.water.forEach(rename);
    m.geometry.mountains.forEach(rename);
    m.geometry.rivers.forEach(rename);
  }
  const all = [...m.territories, ...m.provinces, ...(m.geometry ? [...m.geometry.water, ...m.geometry.mountains, ...m.geometry.rivers] : [])].map((x) => x.name);
  const dupes = all.filter((n, i) => all.indexOf(n) !== i);
  if (dupes.length) throw new Error(`Two places would both be called "${dupes[0]}". Pick different names in the names file.`);
  return { map: m, unknown: Object.keys(renames).filter((k) => !used.has(k)) };
}

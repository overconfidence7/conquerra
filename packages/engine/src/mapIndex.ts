import type { BorderType, MapDef, TerritoryDef } from "@conquerra/content";
import type { TerritoryId } from "./types";

export interface MapIndex {
  byId: Map<TerritoryId, TerritoryDef>;
  neighbors: Map<TerritoryId, TerritoryId[]>;
  border: (a: TerritoryId, b: TerritoryId) => BorderType | null;
  provinceMembers: Map<string, TerritoryId[]>;
  ids: TerritoryId[];
}

const cache = new WeakMap<MapDef, MapIndex>();

export function indexMap(map: MapDef): MapIndex {
  const hit = cache.get(map);
  if (hit) return hit;
  const byId = new Map(map.territories.map((t) => [t.id, t]));
  const neighbors = new Map<TerritoryId, TerritoryId[]>(map.territories.map((t) => [t.id, []]));
  const borders = new Map<string, BorderType>();
  for (const b of map.borders) {
    neighbors.get(b.a)!.push(b.b);
    neighbors.get(b.b)!.push(b.a);
    borders.set(b.a < b.b ? `${b.a}|${b.b}` : `${b.b}|${b.a}`, b.type);
  }
  for (const list of neighbors.values()) list.sort();
  const provinceMembers = new Map<string, TerritoryId[]>();
  for (const t of map.territories) provinceMembers.set(t.province, [...(provinceMembers.get(t.province) ?? []), t.id]);
  const idx: MapIndex = {
    byId,
    neighbors,
    border: (a, b) => borders.get(a < b ? `${a}|${b}` : `${b}|${a}`) ?? null,
    provinceMembers,
    ids: map.territories.map((t) => t.id),
  };
  cache.set(map, idx);
  return idx;
}

/** Breadth-first distances (in borders crossed) from a start territory. */
export function distancesFrom(idx: MapIndex, start: TerritoryId): Map<TerritoryId, number> {
  const dist = new Map<TerritoryId, number>([[start, 0]]);
  const q = [start];
  while (q.length) {
    const cur = q.shift()!;
    for (const n of idx.neighbors.get(cur) ?? [])
      if (!dist.has(n)) {
        dist.set(n, dist.get(cur)! + 1);
        q.push(n);
      }
  }
  return dist;
}

import bigJson from "../data/maps/big-tables.json";

/**
 * Session 34: bigger tables on the official 200s. Krakenmere and Rootholm seat up to 20 (`maxPlayers`), with capital
 * layouts for 11 to 20 players made from each map's own capital spots by `packages/mapgen/scripts/big-layouts.ts`. They
 * live beside the map files (`data/maps/big-tables.json`), not in them: the files stay exactly what the map maker
 * makes (and the map lab's fingerprints with them); every game joins the two when it loads a map (`withBigTables`).
 * The layouts for 2 to 10 are the map's own and never change.
 */
export interface BigTable {
  maxPlayers: number;
  layouts: { players: number; slots: string[]; bonus?: Record<string, number>; harder?: string[]; buildings?: Record<string, "market">; culture?: Record<string, number> }[];
}
export const bigTables: Readonly<Record<string, BigTable>> = bigJson as unknown as Record<string, BigTable>;

/** A map with its big tables joined (more seats, the layouts for 11 and up after its own); any other map as it is. */
export function withBigTables<M extends { id: string; maxPlayers: number; capitalLayouts?: BigTable["layouts"] }>(map: M): M {
  const big = bigTables[map.id];
  if (!big) return map;
  const own = map.capitalLayouts ?? [];
  return { ...map, maxPlayers: Math.max(map.maxPlayers, big.maxPlayers), capitalLayouts: [...own, ...big.layouts.filter((l) => !own.some((o) => o.players === l.players))] };
}

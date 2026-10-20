import bigJson from "../data/maps/big-tables.json";
import versionsJson from "../data/maps/layout-versions.json";

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

/**
 * Session 34b: layout versions. Version 1 is every map's own layouts plus session 34's big tables (above). A later
 * version (`data/maps/layout-versions.json`, made by `apps/sim/scripts/s34b-pin.ts`) replaces some table sizes'
 * layouts with ones chosen by the simulator, and may add table sizes. A game's setup records the version it was dealt
 * from (`layouts`; a setup without one is version 1), so a running game keeps its spots and its history replays.
 * A shipped version never changes; new games use `LAYOUT_VERSION`.
 */
export const layoutVersions: Readonly<Record<string, Readonly<Record<string, BigTable>>>> = versionsJson as unknown as Record<string, Record<string, BigTable>>;
export const LAYOUT_VERSION = Math.max(1, ...Object.keys(layoutVersions).map(Number));

/**
 * A map with its big tables joined (more seats, the layouts for 11 and up after its own) and its later layout versions
 * attached (`layoutVersions`, read by the engine's `layoutFor`); any other map as it is.
 */
export function withBigTables<M extends { id: string; maxPlayers: number; capitalLayouts?: BigTable["layouts"]; layoutVersions?: { version: number; layouts: BigTable["layouts"] }[] }>(map: M): M {
  const big = bigTables[map.id];
  const later = Object.entries(layoutVersions)
    .flatMap(([v, maps]) => (maps[map.id] ? [{ version: Number(v), ...maps[map.id]! }] : []))
    .sort((a, b) => a.version - b.version);
  if (!big && !later.length) return map;
  const own = map.capitalLayouts ?? [];
  const joined = big ? [...own, ...big.layouts.filter((l) => !own.some((o) => o.players === l.players))] : own;
  return {
    ...map,
    maxPlayers: Math.max(map.maxPlayers, big?.maxPlayers ?? 0, ...later.map((l) => l.maxPlayers)),
    capitalLayouts: joined,
    ...(later.length ? { layoutVersions: later.map((l) => ({ version: l.version, layouts: l.layouts })) } : {}),
  };
}

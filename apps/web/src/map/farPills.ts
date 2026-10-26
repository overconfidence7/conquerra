import type { MapDef } from "@conquerra/content";
import type { PlayerView, TerritoryId } from "@conquerra/engine";
import { territoryStatus } from "./status";

/**
 * Session 35: a 300 or 400 at Far was a wall of troop pills (one on every territory you can see). Past this many
 * territories the Far view thins them to what reads at a glance: every capital you can see, your Leader, your own
 * land on its border (where you grow or are struck), and a rival's land where it touches another House's. Interior
 * land and neutral land show no pill at Far; the realm's colour still says who holds it, and Mid and Near show every
 * pill as before. Maps of 200 territories and under (the twelve official maps, the smaller random ones) are unchanged.
 */
export const THIN_FAR_ABOVE = 200;

/** Whether a map's Far view thins its pills. */
export const thinsAtFar = (map: Pick<MapDef, "territories">) => map.territories.length > THIN_FAR_ABOVE;

/**
 * The territories that keep their pill at Far on a big map, or null when every pill shows (a smaller map). Reads only
 * what the seat already knows: owners in sight or last seen (never the cloud).
 */
export function farPills(map: MapDef, view: PlayerView): Set<TerritoryId> | null {
  if (!thinsAtFar(map)) return null;
  const owner = new Map<TerritoryId, string | null>();
  const status = new Map(map.territories.map((t) => [t.id, territoryStatus(view, t.id)]));
  for (const [id, s] of status) owner.set(id, s.kind === "unknown" ? null : s.owner);
  const near = new Map<TerritoryId, TerritoryId[]>();
  for (const b of map.borders) {
    (near.get(b.a) ?? near.set(b.a, []).get(b.a)!).push(b.b);
    (near.get(b.b) ?? near.set(b.b, []).get(b.b)!).push(b.a);
  }
  const keep = new Set<TerritoryId>();
  for (const [id, s] of status) {
    if (s.kind === "unknown") continue;
    if (s.capital || s.leader) {
      keep.add(id);
      continue;
    }
    const who = owner.get(id) ?? null;
    if (who === null) continue;
    const others = (near.get(id) ?? []).map((n) => owner.get(n) ?? null);
    // Your land: on any border (neutral or a rival's). A rival's: where it meets you or another House.
    if (who === view.me.id ? others.some((o) => o !== who) : others.some((o) => o !== null && o !== who)) keep.add(id);
  }
  return keep;
}

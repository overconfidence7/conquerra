import type { BuildingType, MapDef, SpecialistType } from "@conquerra/content";
import type { PlayerView, TerritoryId } from "@conquerra/engine";
import type { MarkerContent } from "./layout";

/**
 * What the map can show about one territory right now: seen (full detail), remembered (last-seen intel, shown
 * faded with "?"), or unknown (fog you've never seen through: no marker at all).
 */
export interface TerritoryStatus {
  id: TerritoryId;
  kind: "seen" | "remembered" | "unknown";
  owner: string | null;
  troops: number;
  building: BuildingType | null;
  /** Being built (shown as an outline). */
  construction: BuildingType | null;
  specialists: SpecialistType[];
  culture: number;
  leader: boolean;
  /** Captured generals standing here (whose Leader each was): their portraits go on the marker. */
  generals: string[];
  capital: boolean;
}

export function territoryStatus(view: PlayerView, id: TerritoryId): TerritoryStatus {
  const v = view.territories[id]!;
  const blank = { specialists: [], culture: 0, leader: false, generals: [], capital: false, construction: null };
  if (v.detail === "full")
    return {
      id,
      kind: "seen",
      owner: v.owner,
      troops: v.troops,
      building: v.building,
      construction: v.construction?.building ?? null,
      specialists: v.specialists.map((s) => s.type),
      culture: v.culture,
      leader: v.leaders.length > 0,
      generals: v.generals ?? [],
      capital: v.capitalOf !== null,
    };
  if (v.lastSeen) return { id, kind: "remembered", owner: v.lastSeen.owner, troops: v.lastSeen.troops, building: v.lastSeen.building, ...blank };
  return { id, kind: "unknown", owner: null, troops: 0, building: null, ...blank };
}

/** The marker for a territory, or null when there's nothing to show (unexplored fog). */
export function markerContent(map: MapDef, view: PlayerView, s: TerritoryStatus): MarkerContent | null {
  if (s.kind === "unknown") return null;
  const name = map.territories.find((t) => t.id === s.id)?.name ?? "";
  return {
    label: s.kind === "remembered" ? `${s.troops}?` : String(s.troops),
    owned: s.owner !== null,
    crown: s.leader,
    ...(s.generals.length ? { generals: s.generals.length } : {}),
    building: s.building !== null || s.construction !== null,
    specialists: s.specialists.length,
    culture: s.culture,
    name,
    capital: s.capital,
  };
}

/** Who wins a spot when markers collide: your land, then rivals you can see, then neutrals, then old intel. */
export function markerPriority(view: PlayerView, s: TerritoryStatus): number {
  if (s.kind === "remembered") return 0;
  if (s.owner === view.me.id) return s.capital ? 4 : 3;
  if (s.owner) return 2;
  return 1;
}

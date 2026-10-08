import type { PlayerId, PlayerView, TerritoryId } from "@conquerra/engine";

/**
 * The walls the map draws (session 20b), each a ring round its whole footprint: the walls you can see (anyone who
 * sees part of a wall sees all of it), and the walled land you only remember (in the fog, greyed), grouped by its
 * last-seen House. Pure, so the ring is tested without a screen.
 */
export interface WallFootprint {
  key: string;
  owner: PlayerId;
  remembered: boolean;
  territories: TerritoryId[];
}

export function wallFootprints(view: PlayerView, ids: readonly TerritoryId[]): WallFootprint[] {
  const out: WallFootprint[] = (view.walls ?? []).map((w, i) => ({ key: `w${i}`, owner: w.owner, remembered: false, territories: [...w.territories] }));
  const inWall = new Set(out.flatMap((w) => w.territories));
  const remembered = new Map<PlayerId, TerritoryId[]>();
  for (const t of ids) {
    const v = view.territories[t];
    if (inWall.has(t) || v?.detail !== "fogged" || !v.lastSeen?.walled || !v.lastSeen.owner) continue;
    remembered.set(v.lastSeen.owner, [...(remembered.get(v.lastSeen.owner) ?? []), t]);
  }
  for (const [owner, territories] of remembered) out.push({ key: `r:${owner}`, owner, remembered: true, territories });
  return out;
}

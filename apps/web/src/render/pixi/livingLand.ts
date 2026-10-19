import type { MapDef } from "@conquerra/content";
import type { PlayerView } from "@conquerra/engine";
import { hitTester, quadPoint } from "../../map/shapes";
import { isUnknown } from "../../map/status";

/**
 * Session 33b: the land under each of the living map's sprites, so blackout's cloud hides them (pure, tested without
 * WebGL). A boat marks a sea lane, a sail or a beam a landmark, a flag or a chimney a settlement: under blackout each
 * shows only once every territory it stands for is known (a boat: both ends of its lane). Standard fog shows them all.
 */
export interface LandFinder {
  /** The territory a point stands on, or the nearest one by its label (a lighthouse on the shore, a range's village). */
  at(x: number, y: number): string;
}

export function landFinder(map: MapDef): LandFinder {
  const g = map.geometry!;
  const hit = hitTester(g);
  return {
    at(x, y) {
      const id = hit.at(x, y);
      if (id) return id;
      let best = g.territories[0]!.id, d = Infinity;
      for (const t of g.territories) {
        const e = (t.label.x - x) ** 2 + (t.label.y - y) ** 2;
        if (e < d) (d = e), (best = t.id);
      }
      return best;
    },
  };
}

/** Whether a sprite standing for these territories shows in this view: under blackout, only over known land. */
export function shownOver(view: PlayerView, lands: readonly string[]): boolean {
  return view.settings.fog !== "blackout" || lands.every((id) => !isUnknown(view, id));
}

type Landmark = { kind: string; x: number; y: number; w: number; v: number };
export interface LivingSites {
  /** A boat at the middle of each sea lane long enough to show one, heading `angle`. */
  boats: { x: number; y: number; angle: number; lands: string[] }[];
  /** The windmills (their sails turn) and the lighthouses (their beams sweep). */
  windmills: { landmark: Landmark; lands: string[] }[];
  lighthouses: { landmark: Landmark; lands: string[] }[];
  /** A flag on each capital's castle. */
  flags: { x: number; y: number; territory: string; lands: string[] }[];
  /** Chimneys: villages, towns and capitals. */
  chimneys: { x: number; y: number; seed: number; lands: string[] }[];
}

/** Where the living map puts its sprites, and the land each stands for (the same map always gets the same). */
export function livingSites(map: MapDef, landmarks: readonly Landmark[]): LivingSites {
  const g = map.geometry!;
  const land = landFinder(map);
  const seed = map.id.length * 7919 + g.width;
  const out: LivingSites = { boats: [], windmills: [], lighthouses: [], flags: [], chimneys: [] };
  for (const l of g.seaLanes) {
    const [x0, y0, x1, y1] = l.path as [number, number, number, number];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len <= 40) continue;
    const bend = Math.min(30, len * 0.18);
    const cx = (x0 + x1) / 2 + ((y1 - y0) / (len || 1)) * bend, cy = (y0 + y1) / 2 - ((x1 - x0) / (len || 1)) * bend;
    const [x, y, angle] = quadPoint(x0, y0, cx, cy, x1, y1, 0.5);
    out.boats.push({ x, y, angle, lands: [l.a, l.b] });
  }
  for (const l of landmarks) {
    if (l.kind === "windmill") out.windmills.push({ landmark: l, lands: [land.at(l.x, l.y)] });
    if (l.kind === "lighthouse") out.lighthouses.push({ landmark: l, lands: [land.at(l.x, l.y)] });
  }
  for (const t of g.territories) if (t.castle) out.flags.push({ x: t.castle.x + 6, y: t.castle.y - 30, territory: t.id, lands: [t.id] });
  g.decorations.forEach((d, i) => {
    if (d.kind === "village" || d.kind === "town") out.chimneys.push({ x: d.x + (d.kind === "town" ? 3 : 1), y: d.y - (d.kind === "town" ? 20 : 14), seed: seed * 31 + i, lands: [land.at(d.x, d.y)] });
  });
  for (const t of g.territories) if (t.castle) out.chimneys.push({ x: t.castle.x - 8, y: t.castle.y - 30, seed: seed * 37 + t.id.length * 101 + Math.round(t.castle.x), lands: [t.id] });
  return out;
}

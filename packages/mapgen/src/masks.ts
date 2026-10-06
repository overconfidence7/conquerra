import dragon from "../masks/dragon.json";
import { insideRings } from "./util";

/**
 * Silhouettes the land can grow into (`shape: "mask"`). A mask is drawn in its own box: x from 0 to `aspect`,
 * y from 0 (top) to 1 (bottom). The land fills the inside of the outline, roughened a little by the coast noise.
 *
 * Two ways to add one:
 *  - **An outline in code:** a list of points around the edge (`rings`), like the two below. Several rings
 *    are fine (a ring inside another is a hole, a separate ring is an island).
 *  - **A black-and-white picture:** `pnpm --filter @conquerra/mapgen mask <picture.png> <id> "<Name>"` turns it into
 *    rows of `#` (land) and `.` (sea) in `masks/<id>.json`; add the file to `IMAGE_MASKS` below. Black is land.
 *
 * Keep the parts chunky: anything thinner than about a tenth of the box's height is narrower than one territory
 * on a 120-territory map, and the map maker will round it away.
 */
export interface MaskDef {
  id: string;
  name: string;
  /** Width / height of the box. */
  aspect: number;
  /** Outlines, as flat x,y lists in box units (height 1). */
  rings?: number[][];
  /** Or a picture: rows top to bottom, `#` = land. */
  rows?: string[];
}

/** Points written in a 0..100-high box, scaled to height 1. */
const ring = (...pts: number[]) => pts.map((v) => v / 100);

export const MASKS: MaskDef[] = [
  {
    id: "shield",
    name: "The Shield",
    aspect: 0.92,
    // A heater shield with a notch in the top edge, the sides bowing in to a point at the bottom.
    rings: [
      ring(
        5, 5, 38, 5, 46, 12, 54, 5, 87, 5, // top edge, with a notch in the middle
        88, 30, 86, 48, 81, 63, 72, 77, 60, 88, 46, 97, // right side down to the point
        32, 88, 20, 77, 11, 63, 6, 48, 4, 30,
      ),
    ],
  },
  {
    id: "crown",
    name: "The Crown",
    aspect: 1.6,
    // A crown: a broad band with five points, the middle one tallest, and a round jewel isle above it.
    rings: [
      ring(
        8, 92, 8, 60, 6, 32, 12, 24, 18, 32, 26, 52, // left point
        36, 26, 44, 18, 50, 28, 56, 46, // second point
        66, 16, 80, 6, 94, 16, 104, 46, // middle point
        110, 28, 116, 18, 124, 26, 134, 52, // fourth point
        142, 32, 148, 24, 154, 32, 152, 60, 152, 92, // right point and down
        120, 86, 80, 94, 40, 86,
      ),
    ],
  },
];

/**
 * Masks made from Nate's pictures (`pnpm --filter @conquerra/mapgen mask ...`). The dragon (Wyrmland) is Gemini's
 * outline from art batch 3 (session 12); it replaced a hand-drawn one that didn't read as a dragon at Far zoom.
 */
export const IMAGE_MASKS: MaskDef[] = [dragon];

export const allMasks = (): MaskDef[] => [...MASKS, ...IMAGE_MASKS];

export function findMask(id: string): MaskDef {
  const m = allMasks().find((x) => x.id === id);
  if (!m) throw new Error(`Unknown mask "${id}" (have: ${allMasks().map((x) => x.id).join(", ")})`);
  return m;
}

/** Is the point (box units: x 0..aspect, y 0..1) inside the mask? */
export function maskInside(m: MaskDef): (x: number, y: number) => boolean {
  if (m.rings) return (x, y) => insideRings(m.rings!, x, y);
  const rows = m.rows ?? [];
  const h = rows.length, w = rows[0]?.length ?? 0;
  return (x, y) => {
    const r = Math.floor(y * h), c = Math.floor((x / m.aspect) * w);
    return r >= 0 && r < h && c >= 0 && c < w && rows[r]![c] === "#";
  };
}

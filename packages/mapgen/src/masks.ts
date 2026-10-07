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

/**
 * A left-right symmetric outline in a 0..100-high box `width` wide: the right half's points, clockwise from the top
 * middle to the bottom middle; the left half is its mirror image (session 19).
 */
const sym = (width: number, ...right: number[]) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < right.length; i += 2) pts.push([right[i]!, right[i + 1]!]);
  const left = pts.slice(1, -1).reverse().map(([x, y]) => [width - x, y] as [number, number]);
  return ring(...[...pts, ...left].flat());
};

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
  {
    id: "phoenix",
    name: "The Phoenix",
    aspect: 1.8,
    // A phoenix rising (session 19): a small head on a neck, wings spread wide with scalloped trailing feathers, and a
    // fanned tail of three feathers.
    rings: [
      sym(180,
        90, 3, 97, 6, 99, 13, 95, 19, 96, 28, 104, 34, // head and neck
        118, 26, 136, 14, 156, 6, 176, 4, // the wing's leading edge, out to its tip
        172, 14, 160, 18, 164, 26, 148, 27, 150, 36, 132, 37, 132, 46, 112, 48, // the scalloped trailing feathers, back in
        110, 57, 106, 65, // the body
        122, 77, 134, 93, 118, 89, 110, 81, 106, 96, 96, 86, 90, 98, // the tail feathers
      ),
    ],
  },
  {
    id: "kraken",
    name: "The Kraken",
    aspect: 1.5,
    // A kraken (session 19): a round mantle, and six thick arms: the outer pair curling up, the next pair reaching down
    // and out, the inner pair straight down.
    rings: [
      sym(150,
        75, 2, 88, 4, 98, 12, 102, 24, 100, 36, // the mantle
        116, 33, 130, 25, 138, 13, 147, 15, 142, 30, 127, 42, 108, 50, // the outer arm, curling up
        121, 56, 133, 67, 139, 83, 135, 97, 124, 95, 124, 79, 114, 68, 100, 61, // the middle arm, down and out
        98, 78, 93, 97, 83, 95, 84, 77, 80, 65, 75, 67, // the inner arm, straight down
      ),
    ],
  },
  {
    id: "worldtree",
    name: "The Tree of Life",
    aspect: 1.2,
    // A tree of life (session 19, redrawn at Nate's word: the first read as a uvula): a round crown with a scalloped,
    // leafy rim and deep sea inlets cutting up between its branches, a sturdy trunk (a natural choke point), and two
    // pairs of roots splaying out below with sea between them.
    rings: [
      sym(120,
        60, 1, 68, 2, 74, 1, 82, 4, 88, 4, 95, 9, 101, 11, 106, 17, 110, 21, 113, 28, 113, 35, 110, 41, 106, 46, // the crown's leafy rim
        101, 48, 97, 33, 92, 49, 86, 50, 81, 35, 76, 50, 70, 52, // under the crown: three branches, with deep inlets between
        68, 58, 68, 68, // the trunk
        74, 70, 86, 70, 100, 73, 111, 80, 117, 92, 107, 93, 97, 82, 86, 78, // the outer root
        78, 85, 86, 97, 76, 99, 71, 87, // the middle root
        60, 79, // between the middle roots
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

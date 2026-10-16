import type { Rng } from "@conquerra/engine";
import { findMask, maskInside } from "./masks";
import { clamp, dist, randomDirection } from "./util";

/** The overall shape of the land. */
export type LandShape = "continent" | "archipelago" | "twinContinents" | "inlandSea" | "crescent" | "mask";
export const LAND_SHAPES: LandShape[] = ["continent", "archipelago", "twinContinents", "inlandSea", "crescent", "mask"];

/** Plain names for the lab and the docs. */
export const SHAPE_NAMES: Record<LandShape, string> = {
  continent: "One continent",
  archipelago: "Archipelago",
  twinContinents: "Twin continents",
  inlandSea: "Inland sea",
  crescent: "Crescent",
  mask: "Silhouette",
};

export interface ShapeOptions {
  shape: LandShape;
  /** Mask id (shape "mask"). */
  mask?: string;
  /** Archipelago: how many islands. Inland sea and crescent: isles in the middle sea or the bay. */
  islands?: number;
  /** Twin continents: a narrow land bridge between them. */
  landBridge?: boolean;
  /** Session 31, crescent: the bay's size against the land's (default 0.7) and how far off centre it sits (default 0.4). */
  bite?: number;
  biteOffset?: number;
  territories: number;
}

/**
 * Where land should be, before the coast noise roughens it: a smooth field over the map, above 0 inside the shape,
 * below 0 outside, about 1 deep in the middle of a big landmass. Works in "box units": x from 0 to `aspect`,
 * y from 0 to 1.
 */
export interface ShapeField {
  aspect: number;
  /** Share of the map inside the shape (sets the default water share). */
  insideShare: number;
  /** -1..1 at a point in box units. */
  at(x: number, y: number): number;
}

const GRID = 220;

/** An ellipse that can be tilted: centre, radii, and a direction (unit vector) for its long axis. */
interface Ellipse {
  x: number;
  y: number;
  rx: number;
  ry: number;
  c: number;
  s: number;
}
const inEllipse = (e: Ellipse, x: number, y: number) => {
  const dx = x - e.x, dy = y - e.y;
  const u = (dx * e.c + dy * e.s) / e.rx, v = (-dx * e.s + dy * e.c) / e.ry;
  return u * u + v * v <= 1;
};
const ellipse = (x: number, y: number, rx: number, ry: number, dir: [number, number] = [1, 0]): Ellipse => ({ x, y, rx, ry, c: dir[0], s: dir[1] });

/** A capsule (a thick line): for a land bridge. */
const inCapsule = (ax: number, ay: number, bx: number, by: number, r: number, x: number, y: number) => {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return dist(x, y, ax + t * dx, ay + t * dy) <= r;
};

/** A random number in [a, b). */
const between = (rng: Rng, a: number, b: number) => a + (b - a) * rng.next();

/** A direction close to horizontal (for tilting continents a little). */
function slightTilt(rng: Rng, amount: number): [number, number] {
  const [x, y] = randomDirection(rng);
  const tx = 1, ty = y * amount * (x >= 0 ? 1 : -1);
  const d = Math.sqrt(tx * tx + ty * ty);
  return [tx / d, ty / d];
}

/** The inside test for each shape, in box units, and the box's aspect. */
function insideTest(o: ShapeOptions, rng: Rng): { aspect: number; inside: (x: number, y: number) => boolean } {
  const M = 0.07; // sea margin all round
  switch (o.shape) {
    case "archipelago": {
      // Islands on a jittered grid, so every island has a neighbour across a short stretch of sea.
      const aspect = 1.45;
      const k = Math.max(4, o.islands ?? Math.round(o.territories / 6.5));
      const cols = Math.max(2, Math.round(Math.sqrt(k * aspect))), rows = Math.max(2, Math.ceil(k / cols));
      const sw = (aspect - 2 * M) / cols, sh = (1 - 2 * M) / rows;
      // Exactly k islands: the last row may be short, and is centred.
      const isles: Ellipse[] = [];
      for (let r = 0; r < rows; r++) {
        const inRow = r < rows - 1 ? cols : Math.max(0, k - cols * (rows - 1));
        const left = M + ((cols - inRow) * sw) / 2;
        for (let c = 0; c < inRow; c++) {
          const cx = left + (c + 0.5) * sw + between(rng, -0.1, 0.1) * sw;
          const cy = M + (r + 0.5) * sh + between(rng, -0.1, 0.1) * sh;
          const main = ellipse(cx, cy, (sw / 2) * between(rng, 0.66, 0.9), (sh / 2) * between(rng, 0.66, 0.9), randomDirection(rng));
          isles.push(main);
          // A lobe on some islands, so they aren't all ovals.
          if (rng.next() < 0.6) {
            const [dx, dy] = randomDirection(rng);
            const r0 = Math.min(main.rx, main.ry);
            isles.push(ellipse(cx + dx * r0 * 0.7, cy + dy * r0 * 0.7, r0 * between(rng, 0.45, 0.6), r0 * between(rng, 0.35, 0.5), randomDirection(rng)));
          }
        }
      }
      return { aspect, inside: (x, y) => isles.some((e) => inEllipse(e, x, y)) };
    }
    case "twinContinents": {
      const aspect = 1.7;
      const gap = 0.075;
      const half = (aspect - 2 * M - gap) / 2;
      const off = between(rng, -0.07, 0.07);
      const parts: Ellipse[] = [];
      const near: [number, number][] = [];
      for (const side of [0, 1]) {
        const rx = (half / 2) * between(rng, 0.92, 1), ry = (0.5 - M) * between(rng, 0.84, 0.98);
        const cx = side === 0 ? M + half / 2 : aspect - M - half / 2;
        const cy = 0.5 + (side === 0 ? off : -off);
        parts.push(ellipse(cx, cy, rx, ry, slightTilt(rng, 0.25)));
        // A peninsula or a bulge, for a less regular coast.
        const [dx, dy] = randomDirection(rng);
        parts.push(ellipse(cx + dx * rx * 0.55, cy + dy * ry * 0.55, rx * between(rng, 0.45, 0.6), ry * between(rng, 0.35, 0.5), randomDirection(rng)));
        near.push([side === 0 ? cx + rx * 0.9 : cx - rx * 0.9, cy]);
      }
      const bridge = o.landBridge ?? rng.next() < 0.5;
      const [a, b] = near as [[number, number], [number, number]];
      const by = between(rng, -0.12, 0.12);
      return {
        aspect,
        inside: (x, y) => parts.some((e) => inEllipse(e, x, y)) || (bridge && inCapsule(a[0], a[1] + by, b[0], b[1] + by, 0.045, x, y)),
      };
    }
    case "inlandSea": {
      const aspect = 1.45;
      const outer = ellipse(aspect / 2, 0.5, aspect / 2 - M, 0.5 - M);
      const inner = ellipse(aspect / 2 + between(rng, -0.05, 0.05), 0.5 + between(rng, -0.04, 0.04), outer.rx * between(rng, 0.44, 0.5), outer.ry * between(rng, 0.44, 0.5), slightTilt(rng, 0.3));
      const isles: Ellipse[] = [];
      const n = o.islands ?? 1;
      for (let i = 0; i < n; i++) {
        // One big isle in the middle, or a ring of smaller ones.
        const [dx, dy] = n === 1 ? [0, 0] : randomDirection(rng);
        const r = n === 1 ? 0.58 : 0.3;
        isles.push(ellipse(inner.x + dx * inner.rx * 0.5, inner.y + dy * inner.ry * 0.5, inner.rx * r, inner.ry * r, randomDirection(rng)));
      }
      return { aspect, inside: (x, y) => (inEllipse(outer, x, y) && !inEllipse(inner, x, y)) || isles.some((e) => inEllipse(e, x, y)) };
    }
    case "crescent": {
      const aspect = 1.45;
      const outer = ellipse(aspect / 2, 0.5, aspect / 2 - M, 0.5 - M);
      const [dx, dy] = randomDirection(rng);
      const off = o.biteOffset ?? 0.4, size = o.bite ?? 0.7;
      const bite = ellipse(outer.x + dx * outer.rx * off, outer.y + dy * outer.ry * off, outer.rx * size, outer.ry * size);
      const isles: Ellipse[] = [];
      for (let i = 0; i < (o.islands ?? 2); i++) {
        const t = (i + 1) / ((o.islands ?? 2) + 1) - 0.5;
        // Isles in the bay, strung across its mouth.
        isles.push(ellipse(bite.x + dx * bite.rx * 0.15 - dy * bite.rx * t * 1.1, bite.y + dy * bite.ry * 0.15 + dx * bite.ry * t * 1.1, bite.rx * 0.2, bite.ry * 0.2, randomDirection(rng)));
      }
      return { aspect, inside: (x, y) => (inEllipse(outer, x, y) && !inEllipse(bite, x, y)) || isles.some((e) => inEllipse(e, x, y)) };
    }
    case "mask": {
      const m = findMask(o.mask ?? "dragon");
      const test = maskInside(m);
      // The mask fills the box less its margins.
      const sx = (m.aspect - 2 * M) / m.aspect, sy = 1 - 2 * M;
      return { aspect: m.aspect, inside: (x, y) => test(((x - M) / sx), (y - M) / sy) };
    }
    default:
      throw new Error(`no field for shape ${o.shape}`);
  }
}

/**
 * Turn an inside test into a smooth field: the distance to the shape's edge (positive inside), measured on a
 * grid with a two-pass chamfer (only + and min, so it's the same everywhere), scaled so that `falloff` box units
 * in from the coast is 1.
 */
function distanceField(aspect: number, inside: (x: number, y: number) => boolean, falloff: number, minHalfWidth: number): ShapeField {
  const rows = aspect >= 1 ? Math.round(GRID / aspect) : GRID, cols = aspect >= 1 ? GRID : Math.round(GRID * aspect);
  const cw = aspect / cols, ch = 1 / rows;
  const n = cols * rows;
  let isIn = new Uint8Array(n);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) isIn[r * cols + c] = inside((c + 0.5) * cw, (r + 0.5) * ch) ? 1 : 0;
  // Chamfer weights 3 (side) and 4 (diagonal): distances in thirds of a grid square.
  const chamfer = (want: number) => {
    const d = new Float64Array(n);
    for (let i = 0; i < n; i++) d[i] = isIn[i] === want ? 0 : 1e9;
    const at = (r: number, c: number) => (r < 0 || c < 0 || r >= rows || c >= cols ? 1e9 : d[r * cols + c]!);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        d[i] = Math.min(d[i]!, at(r, c - 1) + 3, at(r - 1, c) + 3, at(r - 1, c - 1) + 4, at(r - 1, c + 1) + 4);
      }
    for (let r = rows - 1; r >= 0; r--)
      for (let c = cols - 1; c >= 0; c--) {
        const i = r * cols + c;
        d[i] = Math.min(d[i]!, at(r, c + 1) + 3, at(r + 1, c) + 3, at(r + 1, c + 1) + 4, at(r + 1, c - 1) + 4);
      }
    return d;
  };
  const step = Math.min(cw, ch) / 3;
  // Trim parts thinner than about a territory (a thin tip would only make slivers): shrink the shape by
  // `minHalfWidth`, then grow what's left back by the same amount.
  const core = chamfer(0);
  const kept = new Uint8Array(n);
  for (let i = 0; i < n; i++) kept[i] = core[i]! * step > minHalfWidth ? 1 : 0;
  isIn = kept;
  const grow = chamfer(1);
  const opened = new Uint8Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) count += opened[i] = grow[i]! * step <= minHalfWidth ? 1 : 0;
  isIn = opened;
  const toOut = chamfer(0), toIn = chamfer(1);
  const field = new Float64Array(n);
  for (let i = 0; i < n; i++) field[i] = clamp(((isIn[i] ? toOut[i]! : -toIn[i]!) * step) / falloff, -1, 1);
  return {
    aspect,
    insideShare: count / n,
    at(x, y) {
      // Bilinear between grid centres.
      const fx = clamp(x / cw - 0.5, 0, cols - 1.001), fy = clamp(y / ch - 0.5, 0, rows - 1.001);
      const c0 = Math.floor(fx), r0 = Math.floor(fy), tx = fx - c0, ty = fy - r0;
      const a = field[r0 * cols + c0]!, b = field[r0 * cols + c0 + 1]!, c = field[(r0 + 1) * cols + c0]!, d = field[(r0 + 1) * cols + c0 + 1]!;
      return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    },
  };
}

/** The shape field for every shape but "continent" (which keeps the original rounded-continent formula). */
export function makeShapeField(o: ShapeOptions, rng: Rng): ShapeField {
  const { aspect, inside } = insideTest(o, rng);
  // How far in from the coast the land counts as "deep inside": a bit less for thin shapes.
  const falloff = o.shape === "archipelago" ? 0.07 : o.shape === "mask" ? 0.06 : 0.09;
  // About half a territory's width at 120 territories (a little more on smaller maps, where territories look bigger).
  // Silhouettes keep more of their drawing.
  const minHalf = (o.shape === "mask" ? 0.017 : 0.028) * Math.sqrt(120 / Math.max(40, o.territories));
  return distanceField(aspect, inside, falloff * Math.min(1, aspect), minHalf * Math.min(1, aspect));
}

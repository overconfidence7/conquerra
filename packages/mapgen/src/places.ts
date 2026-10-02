import type { Biome, DecorationKind } from "@conquerra/content";
import type { Rng } from "@conquerra/engine";
import type { Mesh } from "./mesh";
import { dist, pointSegDist, r1 } from "./util";

/** Room a banner needs around a label point: no decoration comes closer than this. */
export const LABEL_CLEAR = 22;
/** Room around a building site or castle. */
export const SITE_CLEAR = 12;
export const CASTLE_CLEAR = 18;

/** Distance from a point to the nearest outline segment. */
function clearance(rings: readonly number[][], x: number, y: number): number {
  let best = Infinity;
  for (const ring of rings)
    for (let i = 0; i + 3 < ring.length; i += 2) best = Math.min(best, pointSegDist(x, y, ring[i]!, ring[i + 1]!, ring[i + 2]!, ring[i + 3]!));
  return best;
}

export interface Spot {
  x: number;
  y: number;
}

/**
 * The label point: the spot inside the territory furthest from its border (so the banner has the most room).
 * Tried at every cell centre and halfway to each neighbouring cell of the same territory.
 */
export function labelPoint(mesh: Mesh, cells: readonly number[], owner: Int32Array, rings: readonly number[][]): { x: number; y: number; r: number } {
  let bx = mesh.x[cells[0]!]!, by = mesh.y[cells[0]!]!, br = -1;
  const t = owner[cells[0]!]!;
  for (const c of cells) {
    const tries: [number, number][] = [[mesh.x[c]!, mesh.y[c]!]];
    for (const m of mesh.neighbors[c]!) if (owner[m] === t) tries.push([(mesh.x[c]! + mesh.x[m]!) / 2, (mesh.y[c]! + mesh.y[m]!) / 2]);
    for (const [x, y] of tries) {
      const r = clearance(rings, x, y);
      if (r > br) (br = r), (bx = x), (by = y);
    }
  }
  return { x: r1(bx), y: r1(by), r: Math.floor(br * 10) / 10 };
}

/** A clear spot in the territory, at least `away` from each of `avoid` (cell centres only). */
export function siteIn(mesh: Mesh, cells: readonly number[], rings: readonly number[][], avoid: readonly Spot[], away: number, okCell: (c: number) => boolean): Spot {
  let best: Spot | null = null, bestScore = -Infinity;
  for (const c of cells) {
    if (!okCell(c)) continue;
    const x = mesh.x[c]!, y = mesh.y[c]!;
    if (avoid.some((a) => dist(a.x, a.y, x, y) < away)) continue;
    const room = clearance(rings, x, y);
    // Prefer roomy spots not too far from the label (the first thing to avoid).
    const near = avoid.length ? dist(avoid[0]!.x, avoid[0]!.y, x, y) : 0;
    const score = Math.min(room, 20) - near * 0.15;
    if (score > bestScore) (bestScore = score), (best = { x: r1(x), y: r1(y) });
  }
  if (best) return best;
  const a = avoid[0] ?? { x: mesh.x[cells[0]!]!, y: mesh.y[cells[0]!]! };
  return { x: r1(a.x), y: r1(a.y + away) };
}

export interface Decoration {
  kind: DecorationKind;
  x: number;
  y: number;
  v: number;
}

export const DECORATION_BIOMES: Record<DecorationKind, Biome[]> = {
  "tree-conifer": ["forest", "grass"],
  "tree-broadleaf": ["forest", "grass"],
  peak: ["rock", "snow"],
  hill: ["hills"],
  village: ["grass", "farmland"],
  town: ["grass", "farmland"],
};
const VARIANTS: Record<DecorationKind, number> = { "tree-conifer": 3, "tree-broadleaf": 3, peak: 4, hill: 3, village: 3, town: 2 };

export interface DecorContext {
  mesh: Mesh;
  rng: Rng;
  /** Ground type at a point, read from the stored biome grid (what the renderer will see). */
  biomeAt: (x: number, y: number) => Biome;
  cellBiome: readonly Biome[];
  elevRank: (c: number) => number;
  detail: Float64Array;
  labels: readonly { x: number; y: number }[];
  sites: readonly Spot[];
  castles: readonly Spot[];
  /** Cells of each territory, and whether it may hold a village. */
  territoryCells: readonly number[][];
  villageOk: readonly boolean[];
  /** One town per province: the territory it goes in. */
  townIn: readonly number[];
}

/**
 * Sprites for the painting. Every placement is seeded, stays on its own kind of ground (checked against the
 * stored biome grid), never sits in water, and keeps clear of banners, building sites and castles.
 */
export function placeDecorations(d: DecorContext): Decoration[] {
  const out: Decoration[] = [];
  const { mesh, rng } = d;
  const clear = (x: number, y: number, extra = 0) =>
    d.labels.every((l) => dist(l.x, l.y, x, y) >= LABEL_CLEAR + extra) &&
    d.sites.every((s) => dist(s.x, s.y, x, y) >= SITE_CLEAR + extra) &&
    d.castles.every((s) => dist(s.x, s.y, x, y) >= CASTLE_CLEAR + extra);
  const place = (kind: DecorationKind, c: number, spread: number, extra = 0) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const x = mesh.x[c]! + (rng.next() - 0.5) * spread, y = mesh.y[c]! + (rng.next() - 0.5) * spread;
      if (x < 0 || y < 0 || x > mesh.width || y > mesh.height) continue;
      const rx = r1(x), ry = r1(y);
      if (!DECORATION_BIOMES[kind].includes(d.biomeAt(rx, ry)) || !clear(rx, ry, extra)) continue;
      out.push({ kind, x: rx, y: ry, v: 1 + rng.int(VARIANTS[kind]) });
      return true;
    }
    return false;
  };
  const sp = mesh.spacing;

  // Settlements first, so trees and hills don't crowd them.
  const settlements: Spot[] = [];
  const settle = (kind: "village" | "town", t: number) => {
    const cells = rng.shuffle(d.territoryCells[t]!.filter((c) => ["grass", "farmland"].includes(d.cellBiome[c]!)));
    for (const c of cells) {
      if (settlements.some((s) => dist(s.x, s.y, mesh.x[c]!, mesh.y[c]!) < sp * 3)) continue;
      const before = out.length;
      if (place(kind, c, sp * 0.5, 6)) {
        settlements.push(out[before]!);
        return;
      }
    }
  };
  d.townIn.forEach((t) => settle("town", t));
  d.territoryCells.forEach((cells, t) => {
    if (!d.villageOk[t]) return;
    settle("village", t);
    if (cells.length > 90) settle("village", t);
  });
  const nearSettlement = (c: number) => settlements.some((s) => dist(s.x, s.y, mesh.x[c]!, mesh.y[c]!) < sp * 1.2);

  for (let c = 0; c < mesh.cells; c++) {
    const b = d.cellBiome[c]!;
    if (b === "forest" && !nearSettlement(c)) {
      const kind: DecorationKind = d.elevRank(c) > 0.55 || d.detail[c]! > 0.62 ? "tree-conifer" : "tree-broadleaf";
      place(kind, c, sp * 0.8);
      if (d.detail[c]! > 0.5) place(kind, c, sp * 0.8);
    } else if (b === "grass" && rng.next() < 0.07 && !nearSettlement(c)) place("tree-broadleaf", c, sp * 0.8);
    else if (b === "hills" && rng.next() < 0.75) place("hill", c, sp * 0.7);
    else if (b === "rock" || b === "snow") {
      place("peak", c, sp * 0.6);
      if (rng.next() < 0.35) place("peak", c, sp * 0.6);
    }
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x || a.kind.localeCompare(b.kind));
}

/**
 * A gentle line through a group of cells along its longest direction, for curving a province name across it.
 * Always reads left to right.
 */
export function labelLine(mesh: Mesh, cells: readonly number[]): number[] {
  let mx = 0, my = 0;
  for (const c of cells) (mx += mesh.x[c]!), (my += mesh.y[c]!);
  mx /= cells.length;
  my /= cells.length;
  let sxx = 0, sxy = 0, syy = 0;
  for (const c of cells) {
    const dx = mesh.x[c]! - mx, dy = mesh.y[c]! - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  sxx /= cells.length;
  sxy /= cells.length;
  syy /= cells.length;
  // The main axis (largest eigenvector of the spread), worked out without trigonometry.
  const half = (sxx - syy) / 2;
  const lambda = (sxx + syy) / 2 + Math.sqrt(half * half + sxy * sxy);
  let vx = sxy, vy = lambda - sxx;
  if (Math.abs(vx) + Math.abs(vy) < 1e-9) (vx = 1), (vy = 0);
  const len = Math.sqrt(vx * vx + vy * vy);
  vx /= len;
  vy /= len;
  // Keep names from going too steep: blend toward horizontal.
  vx = vx * 0.6 + (vx >= 0 ? 0.4 : -0.4);
  const l2 = Math.sqrt(vx * vx + vy * vy);
  vx /= l2;
  vy /= l2;
  if (vx < 0) (vx = -vx), (vy = -vy);
  const reach = Math.sqrt(lambda) * 1.3;
  const bow = reach * 0.12;
  // Start, a middle point bowed slightly upward, end.
  return [r1(mx - vx * reach), r1(my - vy * reach), r1(mx + vy * bow), r1(my - vx * bow), r1(mx + vx * reach), r1(my + vy * reach)];
}

import type { DetailMix, ZoomDetail } from "./zoom";

/**
 * Army markers: how big they are on screen, and where they go so they never overlap.
 * Pure (no drawing), so it's tested without WebGL. Sizes are screen pixels.
 */

/** The troop pill is never smaller than this on screen, at any zoom. */
export const MIN_PILL_HEIGHT = 18;
export const MAX_PILL_HEIGHT = 30;

/** What a marker shows, so its size can be worked out. */
export interface MarkerContent {
  /** The troop number as shown ("12", or "12?" for last-seen intel). */
  label: string;
  /** Owned by a House (banner and pill colours); false for neutral land. */
  owned: boolean;
  crown: boolean;
  /** Captured generals standing here: a portrait each above the pill (Mid and Near). */
  generals?: number;
  building: boolean;
  specialists: number;
  culture: number;
  /** Territory name (shown at Near). */
  name: string;
  /** Two-line capital label under the marker. */
  capital: boolean;
}

export interface MarkerMetrics {
  pillH: number;
  pillW: number;
  font: number;
  /** Small icons (crown, building, specialists). */
  icon: number;
  /** Width and height of the whole marker, for collision. The pill's centre is the marker's anchor. */
  w: number;
  h: number;
  /** How far the box's centre sits below the anchor (the box isn't symmetric when there's a name or capital label). */
  dy: number;
}

const DIGIT_W = 0.62;
/** How far the culture laurels hang below the pill (screen px). */
export const CULTURE_PIP_DROP = 10;

/** Pill height for a zoom: grows a little as you zoom in, never below the minimum. */
export function pillHeight(z: Pick<ZoomDetail, "territoryPx">): number {
  return Math.max(MIN_PILL_HEIGHT, Math.min(MAX_PILL_HEIGHT, 15 + z.territoryPx * 0.05));
}

export function markerMetrics(c: MarkerContent, z: Pick<ZoomDetail, "territoryPx">, mix: DetailMix): MarkerMetrics {
  const pillH = pillHeight(z);
  const font = Math.round(pillH * 0.66);
  const icon = Math.round(pillH * 0.78);
  const shield = mix.icons > 0.5 && c.owned ? pillH * 0.62 : 0;
  const pillW = Math.max(pillH * 1.25, c.label.length * font * DIGIT_W + pillH * 0.7 + shield);
  let w = pillW, top = pillH / 2, bottom = pillH / 2;
  if (mix.icons > 0.5) {
    if (c.owned) w += pillH * 0.9; // banner on the left
    if (c.culture) bottom += CULTURE_PIP_DROP; // laurel pips hang from the pill's lower edge (Mid and Near)
    if (c.building) w += icon + 2; // building icon on the right
    if (c.crown) top = Math.max(top, pillH / 2 + icon * 0.7);
    if (c.generals) top = Math.max(top, pillH / 2 + pillH * 1.45);
  }
  if (mix.nearDetail > 0.5) {
    if (c.specialists) {
      bottom += icon + 3;
      w = Math.max(w, c.specialists * (icon + 2));
    }
  }
  // The name sits above the pill at Near, except on capitals, whose plaque already names them.
  if (mix.names > 0.5 && c.name && !(c.capital && mix.icons > 0.5)) {
    top += font * 0.95 + 3;
    w = Math.max(w, c.name.length * font * 0.58);
  }
  if (c.capital && mix.icons > 0.5) {
    bottom += font * 1.9 + 2;
    w = Math.max(w, Math.max(c.name.length, 7) * font * 0.6);
  }
  return { pillH, pillW, font, icon, w: Math.ceil(w), h: Math.ceil(top + bottom), dy: (bottom - top) / 2 };
}

// ---------- Collision ----------

export interface MarkerBox {
  id: string;
  /** Where the marker wants to be (its territory's label point, on screen). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Vertical offset of the box centre from (x, y). */
  dy?: number;
  /** Higher wins the spot when two collide (your own land, then visible armies, then last-seen intel). */
  priority: number;
  /** Optional labels (province plaques): with no room they're simply dropped, never folded into a marker. */
  optional?: boolean;
  /** Stays on its own spot or isn't shown (province names at Far, session 17: never moved off their province). */
  fixed?: boolean;
}

export interface MarkerPlacement {
  /** Where the marker's anchor ends up (shifted away from (x, y) if it had to move). */
  x: number;
  y: number;
  shifted: boolean;
  /** Set when there was no room: this marker is hidden and counted on the named one instead ("+1"). */
  mergedInto: string | null;
  /** Markers folded into this one. */
  merged: string[];
  /** An optional box with no room: not shown. */
  dropped?: boolean;
}

const overlaps = (ax: number, ay: number, a: MarkerBox, bx: number, by: number, b: MarkerBox, gap: number) =>
  Math.abs(ax - bx) * 2 < a.w + b.w + gap * 2 && Math.abs(ay + (a.dy ?? 0) - by - (b.dy ?? 0)) * 2 < a.h + b.h + gap * 2;

/**
 * Place every marker so none overlap. Highest priority first; each takes its own spot if it's free, otherwise the
 * nearest free spot within `maxShift` px, otherwise it merges into the marker in its way.
 */
export function layoutMarkers(boxes: readonly MarkerBox[], opts: { gap?: number; maxShift?: number } = {}): Map<string, MarkerPlacement> {
  const gap = opts.gap ?? 2;
  const order = [...boxes].sort((a, b) => b.priority - a.priority || a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : 1));
  const placed: { box: MarkerBox; x: number; y: number }[] = [];
  const out = new Map<string, MarkerPlacement>();
  // A grid of placed anchors, so each check only looks at markers close enough to touch (session 16: the reach is
  // worked out from the biggest box placed so far, not a fixed margin, and keys are numbers: far fewer cells to read).
  const cell = 64;
  const grid = new Map<number, number[]>();
  const keyOf = (cx: number, cy: number) => (cx + 32768) * 65536 + (cy + 32768);
  let reachW = 0, reachH = 0;
  const cellsAround = (x: number, y: number, b: MarkerBox, visit: (k: number) => boolean | void) => {
    const rx = Math.ceil((b.w / 2 + reachW + gap) / cell) + 1;
    const ry = Math.ceil((b.h / 2 + Math.abs(b.dy ?? 0) + reachH + gap) / cell) + 1;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    for (let i = cx - rx; i <= cx + rx; i++)
      for (let j = cy - ry; j <= cy + ry; j++) {
        const list = grid.get(keyOf(i, j));
        if (list) for (const k of list) if (visit(k) === false) return false;
      }
    return true;
  };
  const near = (x: number, y: number, b: MarkerBox) => {
    const found: number[] = [];
    cellsAround(x, y, b, (k) => void found.push(k));
    return found;
  };
  const free = (x: number, y: number, b: MarkerBox) => cellsAround(x, y, b, (k) => !overlaps(x, y, b, placed[k]!.x, placed[k]!.y, placed[k]!.box, gap));

  for (const b of order) {
    const maxShift = b.fixed ? 0 : (opts.maxShift ?? Math.max(b.w, b.h) * 0.9);
    const step = Math.max(4, Math.min(b.w, b.h) / 3);
    let spot: [number, number] | null = free(b.x, b.y, b) ? [b.x, b.y] : null;
    for (let d = step; !spot && d <= maxShift + 0.01; d += step) {
      const n = Math.max(8, Math.round((2 * Math.PI * d) / step));
      for (let k = 0; k < n && !spot; k++) {
        const a = (k / n) * Math.PI * 2;
        // Prefer moving sideways (markers are wider than tall).
        const x = b.x + Math.cos(a) * d * 1.3, y = b.y + Math.sin(a) * d * 0.8;
        if (free(x, y, b)) spot = [x, y];
      }
    }
    if (spot) {
      const idx = placed.push({ box: b, x: spot[0], y: spot[1] }) - 1;
      const gk = keyOf(Math.floor(spot[0] / cell), Math.floor(spot[1] / cell));
      const list = grid.get(gk);
      if (list) list.push(idx);
      else grid.set(gk, [idx]);
      reachW = Math.max(reachW, b.w / 2);
      reachH = Math.max(reachH, b.h / 2 + Math.abs(b.dy ?? 0));
      out.set(b.id, { x: spot[0], y: spot[1], shifted: spot[0] !== b.x || spot[1] !== b.y, mergedInto: null, merged: [] });
      continue;
    }
    if (b.optional) {
      out.set(b.id, { x: b.x, y: b.y, shifted: false, mergedInto: null, merged: [], dropped: true });
      continue;
    }
    // No room: fold into whichever placed marker overlaps our own spot the most.
    let host = placed[0]!;
    let best = -Infinity;
    for (const k of near(b.x, b.y, b).length ? near(b.x, b.y, b) : placed.map((_, i) => i)) {
      const p = placed[k]!;
      const score = -Math.hypot(p.x - b.x, p.y - b.y);
      if (score > best) (best = score), (host = p);
    }
    out.get(host.box.id)!.merged.push(b.id);
    out.set(b.id, { x: host.x, y: host.y, shifted: true, mergedInto: host.box.id, merged: [] });
  }
  return out;
}

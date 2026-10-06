/**
 * The map camera, as plain numbers: a screen point is `map * scale + (x, y)`.
 * Pure, so it's shared by both renderers and easy to test.
 */
export interface Camera {
  x: number;
  y: number;
  scale: number;
}

/** Screen space covered by menus that sit over the map (px). The camera fits and clamps to what's left. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Viewport {
  width: number;
  height: number;
  insets?: Insets;
}

/** The part of the map the camera frames, in map units (x and y default to 0: the whole map). */
export interface MapSize {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

/** A box on the screen (px). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The biggest clear part of the screen for a frame of this shape (width / height), given the menus over the map
 * (session 16): fully zoomed out, the whole map sits clear of every menu, and you can pan any edge of it into that
 * clear part at every zoom. Tries every box whose edges are the screen's or a menu's (plus `gap`), keeps the ones no
 * menu overlaps, and picks the one the frame fits largest in (then the biggest). Returned as insets.
 */
export function clearInsets(width: number, height: number, covered: readonly Rect[], aspect: number, gap = 6): Insets {
  const boxes = covered.filter((r) => r.width > 0 && r.height > 0 && r.x < width && r.y < height && r.x + r.width > 0 && r.y + r.height > 0);
  const clampTo = (v: number, max: number) => Math.max(0, Math.min(max, v));
  const xs = [...new Set([0, width, ...boxes.flatMap((r) => [clampTo(r.x - gap, width), clampTo(r.x + r.width + gap, width)])])].sort((a, b) => a - b);
  const ys = [...new Set([0, height, ...boxes.flatMap((r) => [clampTo(r.y - gap, height), clampTo(r.y + r.height + gap, height)])])].sort((a, b) => a - b);
  const clear = (x0: number, y0: number, x1: number, y1: number) => boxes.every((r) => r.x >= x1 || r.x + r.width <= x0 || r.y >= y1 || r.y + r.height <= y0);
  let best = { fit: -1, area: -1, x0: 0, y0: 0, x1: width, y1: height };
  for (let a = 0; a < xs.length; a++)
    for (let b = a + 1; b < xs.length; b++)
      for (let c = 0; c < ys.length; c++)
        for (let d = c + 1; d < ys.length; d++) {
          const x0 = xs[a]!, x1 = xs[b]!, y0 = ys[c]!, y1 = ys[d]!;
          // How big the frame would be in this box (its height), and the box's area to break ties.
          const fit = Math.min((x1 - x0) / aspect, y1 - y0);
          const area = (x1 - x0) * (y1 - y0);
          if (fit < best.fit || (fit === best.fit && area <= best.area)) continue;
          if (clear(x0, y0, x1, y1)) best = { fit, area, x0, y0, x1, y1 };
        }
  return { left: best.x0, top: best.y0, right: width - best.x1, bottom: height - best.y1 };
}

/** The screen area not covered by menus. */
export function usable(vp: Viewport): { left: number; top: number; width: number; height: number } {
  const i = vp.insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
  return { left: i.left, top: i.top, width: Math.max(1, vp.width - i.left - i.right), height: Math.max(1, vp.height - i.top - i.bottom) };
}

/**
 * What the camera frames: the land, with a little sea round it, instead of the whole map rectangle (which has a
 * wide band of open sea). Uses only the map's outlines, so it works the same on any map.
 */
export function landFrame(g: { width: number; height: number; territories: readonly { rings: readonly (readonly number[])[] }[] }): Required<MapSize> {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of g.territories)
    for (const r of t.rings)
      for (let i = 0; i < r.length; i += 2) {
        x0 = Math.min(x0, r[i]!);
        x1 = Math.max(x1, r[i]!);
        y0 = Math.min(y0, r[i + 1]!);
        y1 = Math.max(y1, r[i + 1]!);
      }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, width: g.width, height: g.height };
  const pad = Math.max(x1 - x0, y1 - y0) * 0.03;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(g.width, x1 + pad);
  y1 = Math.min(g.height, y1 + pad);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export const toScreen = (c: Camera, mx: number, my: number): [number, number] => [mx * c.scale + c.x, my * c.scale + c.y];
export const toMap = (c: Camera, sx: number, sy: number): [number, number] => [(sx - c.x) / c.scale, (sy - c.y) / c.scale];

/** The whole frame, centred in the screen space the menus leave free, with a little margin. */
export function fitCamera(map: MapSize, vp: Viewport, margin = 8): Camera {
  const u = usable(vp);
  const scale = Math.min((u.width - margin * 2) / map.width, (u.height - margin * 2) / map.height);
  const mx = map.x ?? 0, my = map.y ?? 0;
  return { scale, x: u.left + (u.width - map.width * scale) / 2 - mx * scale, y: u.top + (u.height - map.height * scale) / 2 - my * scale };
}

/** How far in and out you can zoom: a bit past "whole map", up to a few territories filling the screen. */
export function scaleLimits(map: MapSize, vp: Viewport, maxScale: number): { min: number; max: number } {
  const fit = fitCamera(map, vp).scale;
  return { min: fit * 0.92, max: Math.max(fit * 1.5, maxScale) };
}

/**
 * Keep the frame on screen. When it's smaller than the free screen space it's centred; when bigger, you can pan
 * to each edge plus a small margin, never into a wide band of empty sea.
 */
export function clampCamera(c: Camera, map: MapSize, vp: Viewport): Camera {
  const u = usable(vp);
  const axis = (pos: number, start: number, size: number, uStart: number, uSize: number) => {
    const len = size * c.scale;
    const s0 = start * c.scale;
    if (len <= uSize) return uStart + (uSize - len) / 2 - s0;
    const slack = Math.min(uSize * 0.06, (len - uSize) * 0.5);
    // Screen position of the frame's start edge must stay within [uStart + uSize - len - slack, uStart + slack].
    const edge = Math.min(uStart + slack, Math.max(uStart + uSize - len - slack, pos + s0));
    return edge - s0;
  };
  return { scale: c.scale, x: axis(c.x, map.x ?? 0, map.width, u.left, u.width), y: axis(c.y, map.y ?? 0, map.height, u.top, u.height) };
}

/** Zoom by `factor` keeping the map point under (sx, sy) where it is. */
export function zoomAt(c: Camera, factor: number, sx: number, sy: number, limits: { min: number; max: number }): Camera {
  const scale = Math.max(limits.min, Math.min(limits.max, c.scale * factor));
  const f = scale / c.scale;
  return { scale, x: sx - (sx - c.x) * f, y: sy - (sy - c.y) * f };
}

/** Centre the camera on a map point at a given scale. */
export function centreOn(mx: number, my: number, scale: number, vp: Viewport): Camera {
  return { scale, x: vp.width / 2 - mx * scale, y: vp.height / 2 - my * scale };
}

/** Smoothly between two cameras (t 0..1), zooming in log space so it feels even. */
export function lerpCamera(a: Camera, b: Camera, t: number, vp: Viewport): Camera {
  const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  const scale = Math.exp(Math.log(a.scale) + (Math.log(b.scale) - Math.log(a.scale)) * e);
  // Interpolate the map point at the screen centre, so the view doesn't swing.
  const [ax, ay] = toMap(a, vp.width / 2, vp.height / 2);
  const [bx, by] = toMap(b, vp.width / 2, vp.height / 2);
  return centreOn(ax + (bx - ax) * e, ay + (by - ay) * e, scale, vp);
}

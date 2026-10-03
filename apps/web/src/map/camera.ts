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

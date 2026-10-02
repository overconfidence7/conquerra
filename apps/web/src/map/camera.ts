/**
 * The map camera, as plain numbers: a screen point is `map * scale + (x, y)`.
 * Pure, so it's shared by both renderers and easy to test.
 */
export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface MapSize {
  width: number;
  height: number;
}

export const toScreen = (c: Camera, mx: number, my: number): [number, number] => [mx * c.scale + c.x, my * c.scale + c.y];
export const toMap = (c: Camera, sx: number, sy: number): [number, number] => [(sx - c.x) / c.scale, (sy - c.y) / c.scale];

/** The whole map, centred, with a little margin. */
export function fitCamera(map: MapSize, vp: Viewport, margin = 12): Camera {
  const scale = Math.min((vp.width - margin * 2) / map.width, (vp.height - margin * 2) / map.height);
  return { scale, x: (vp.width - map.width * scale) / 2, y: (vp.height - map.height * scale) / 2 };
}

/** How far in and out you can zoom: a bit past "whole map", up to a few territories filling the screen. */
export function scaleLimits(map: MapSize, vp: Viewport, maxScale: number): { min: number; max: number } {
  const fit = fitCamera(map, vp).scale;
  return { min: fit * 0.85, max: Math.max(fit * 1.5, maxScale) };
}

/** Keep at least part of the map on screen, and centre it when it's smaller than the screen. */
export function clampCamera(c: Camera, map: MapSize, vp: Viewport): Camera {
  const w = map.width * c.scale, h = map.height * c.scale;
  // A little room past the edge, so the coast never sits right against the screen edge.
  const slackX = Math.min(vp.width * 0.12, w * 0.5), slackY = Math.min(vp.height * 0.12, h * 0.5);
  const x = w <= vp.width ? (vp.width - w) / 2 : Math.min(slackX, Math.max(vp.width - w - slackX, c.x));
  const y = h <= vp.height ? (vp.height - h) / 2 : Math.min(slackY, Math.max(vp.height - h - slackY, c.y));
  return { scale: c.scale, x, y };
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

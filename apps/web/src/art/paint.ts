/**
 * Small painting toolkit for the placeholder art: canvases, tileable noise and colour helpers.
 */

export type Ctx = CanvasRenderingContext2D;

export function canvas(w: number, h = w): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return [c, c.getContext("2d", { willReadFrequently: false })!];
}

/** A tiny seeded generator, so placeholders look the same every load. */
export function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Value noise that wraps every `period` units, so textures tile. */
export function tileNoise(seed: number, period: number) {
  const r = rand(seed);
  const grid = new Float32Array(period * period);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const at = (x: number, y: number) => grid[(((y % period) + period) % period) * period + (((x % period) + period) % period)]!;
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

/** Fractal noise over a square texture of `size` px, tileable. `base` = lattice cells across at the coarsest octave. */
export function fbmField(size: number, seed: number, base: number, octaves: number): Float32Array {
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const period = base << o;
    const n = tileNoise(seed + o * 101, period);
    const k = period / size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) out[y * size + x] = out[y * size + x]! + n(x * k, y * k) * amp;
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] = out[i]! / total;
  return out;
}

export type RGB = [number, number, number];
export const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const rgb = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const shade = (c: RGB, f: number): RGB => (f >= 0 ? mix(c, [255, 255, 255], f) : mix(c, [0, 0, 0], -f));

/** Colour ramp: stops at positions 0..1. */
export function ramp(stops: [number, string][]) {
  const s = stops.map(([p, c]) => [p, hex(c)] as const);
  return (t: number): RGB => {
    if (t <= s[0]![0]) return s[0]![1];
    for (let i = 1; i < s.length; i++)
      if (t <= s[i]![0]) return mix(s[i - 1]![1], s[i]![1], (t - s[i - 1]![0]) / (s[i]![0] - s[i - 1]![0]));
    return s[s.length - 1]![1];
  };
}

/** Paint every pixel from a function of the noise value (and position). */
export function paintField(ctx: Ctx, size: number, f: (i: number, x: number, y: number) => RGB) {
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const c = f(i, x, y);
      img.data[i * 4] = c[0];
      img.data[i * 4 + 1] = c[1];
      img.data[i * 4 + 2] = c[2];
      img.data[i * 4 + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
}

/** Draw something at (x, y) and at its wrapped copies, so shapes near an edge tile. */
export function wrapped(size: number, x: number, y: number, r: number, draw: (x: number, y: number) => void) {
  for (const dx of [-size, 0, size])
    for (const dy of [-size, 0, size]) {
      const px = x + dx, py = y + dy;
      if (px + r < 0 || px - r > size || py + r < 0 || py - r > size) continue;
      draw(px, py);
    }
}

/** A soft oval shadow on the ground, offset down-right (light comes from the upper left). */
export function groundShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.35) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(20,14,6,${a})`);
  g.addColorStop(1, "rgba(20,14,6,0)");
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export const INK = "#3b2a1a";

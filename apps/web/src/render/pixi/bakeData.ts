import type { Line, MapGeometry } from "@conquerra/content";

/**
 * Turns the map maker's data into small images the ground shader reads (done once per game, on the CPU):
 *   - biome weights: one channel per ground type, on the biome grid (the shader blends them smoothly)
 *   - aux 1: land mask (crisp coast), land mask blurred (shallows and shore), smoothed height (relief lighting)
 *   - aux 2: mountain range mask, and blurred (range shading and the shadow ranges cast)
 * Canvases keep alpha at 255 everywhere, so the browser never alters the colour channels.
 */

/** Biome letters in shader channel order: [g a f] [h r s] [w d -]. Water (o, O) is handled by the coast mask. */
export const BIOME_CHANNELS = ["g", "a", "f", "h", "r", "s", "w", "d"] as const;

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Three RGB canvases of biome weights. Water squares borrow their land neighbours' ground, so coasts blend. */
export function biomeCanvases(g: MapGeometry): HTMLCanvasElement[] {
  const { cols, rows, data } = g.biome;
  const n = cols * rows;
  const w = BIOME_CHANNELS.map(() => new Float32Array(n));
  const known = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const k = BIOME_CHANNELS.indexOf(data[i] as (typeof BIOME_CHANNELS)[number]);
    if (k >= 0) {
      w[k]![i] = 1;
      known[i] = 1;
    }
  }
  // Grow land ground types out into the water, a few squares, so the coastline (drawn from outlines) sits on real ground.
  for (let pass = 0; pass < 6; pass++) {
    const next: number[] = [];
    for (let i = 0; i < n; i++) {
      if (known[i]) continue;
      const x = i % cols, y = (i / cols) | 0;
      let cnt = 0;
      const acc = new Float32Array(BIOME_CHANNELS.length);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const j = ny * cols + nx;
        if (!known[j]) continue;
        cnt++;
        for (let k = 0; k < acc.length; k++) acc[k]! += w[k]![j]!;
      }
      if (cnt) {
        for (let k = 0; k < acc.length; k++) w[k]![i] = acc[k]! / cnt;
        next.push(i);
      }
    }
    for (const i of next) known[i] = 1;
  }
  // Anything still unknown (open sea) becomes sand, which never shows (it's under water).
  for (let i = 0; i < n; i++) if (!known[i]) w[7]![i] = 1;

  const out: HTMLCanvasElement[] = [];
  for (let t = 0; t < 3; t++) {
    const c = makeCanvas(cols, rows);
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(cols, rows);
    for (let i = 0; i < n; i++) {
      for (let ch = 0; ch < 3; ch++) img.data[i * 4 + ch] = Math.round((w[t * 3 + ch]?.[i] ?? 0) * 255);
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    out.push(c);
  }
  return out;
}

/** Separable box blur, `passes` times (three passes is close to a gaussian). Returns a new array. */
export function boxBlur(src: Float32Array, w: number, h: number, r: number, passes = 2): Float32Array {
  if (r < 1) return src;
  const a = new Float32Array(src), b = new Float32Array(src.length);
  const d = 2 * r + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += a[row + Math.min(w - 1, Math.max(0, x))]!;
      for (let x = 0; x < w; x++) {
        b[row + x] = acc / d;
        acc += a[row + Math.min(w - 1, x + r + 1)]! - a[row + Math.max(0, x - r)]!;
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += b[Math.min(h - 1, Math.max(0, y)) * w + x]!;
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / d;
        acc += b[Math.min(h - 1, y + r + 1) * w + x]! - b[Math.max(0, y - r) * w + x]!;
      }
    }
  }
  return a;
}

/** Fill outline rings (even-odd) into a mask, 0..1 per pixel, at `ppu` pixels per map unit. */
export function rasterize(groups: readonly (readonly Line[])[], w: number, h: number, ppu: number): Float32Array {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.scale(ppu, ppu);
  for (const rings of groups) {
    const p = new Path2D();
    for (const r of rings) {
      p.moveTo(r[0]!, r[1]!);
      for (let i = 2; i < r.length; i += 2) p.lineTo(r[i]!, r[i + 1]!);
      p.closePath();
    }
    ctx.fill(p, "evenodd");
  }
  const px = ctx.getImageData(0, 0, w, h).data;
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = px[i * 4 + 3]! / 255;
  return out;
}

export interface AuxData {
  /** Pixels per map unit of the aux images. */
  ppu: number;
  width: number;
  height: number;
  /** R land, G land blurred, B height. */
  aux1: HTMLCanvasElement;
  /** R range mask, G range blurred, B forest glades (painted as open grass). */
  aux2: HTMLCanvasElement;
}

function pack(w: number, h: number, r: Float32Array, g: Float32Array, b: Float32Array | null) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    img.data[i * 4] = Math.round(Math.min(1, Math.max(0, r[i]!)) * 255);
    img.data[i * 4 + 1] = Math.round(Math.min(1, Math.max(0, g[i]!)) * 255);
    img.data[i * 4 + 2] = b ? Math.round(Math.min(1, Math.max(0, b[i]!)) * 255) : 0;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function auxCanvases(g: MapGeometry, ppu = 1, glades: readonly { x: number; y: number; r: number }[] = []): AuxData {
  const w = Math.ceil(g.width * ppu), h = Math.ceil(g.height * ppu);
  const land = rasterize([...g.territories.map((t) => t.rings), ...g.mountains.map((m) => m.rings)], w, h, ppu);
  const landBlur = boxBlur(land, w, h, Math.round(8 * ppu), 2);
  const range = rasterize(g.mountains.map((m) => m.rings), w, h, ppu);
  const rangeBlur = boxBlur(range, w, h, Math.round(6 * ppu), 2);

  // Height: bilinear from the grid, then smoothed so the lighting has no square facets.
  const hm = g.heightMap;
  const raw = Uint8Array.from(atob(hm.data), (ch) => ch.charCodeAt(0));
  const height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const gy = Math.min(hm.rows - 1.001, Math.max(0, (y + 0.5) / ppu / hm.cellSize - 0.5));
    const y0 = Math.floor(gy), fy = gy - y0;
    for (let x = 0; x < w; x++) {
      const gx = Math.min(hm.cols - 1.001, Math.max(0, (x + 0.5) / ppu / hm.cellSize - 0.5));
      const x0 = Math.floor(gx), fx = gx - x0;
      const i = y0 * hm.cols + x0;
      const a = raw[i]!, b = raw[i + 1]!, c = raw[i + hm.cols]!, d = raw[i + hm.cols + 1]!;
      height[y * w + x] = (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy) / 255;
    }
  }
  const smooth = boxBlur(height, w, h, Math.max(1, Math.round(5 * ppu)), 2);
  let glade: Float32Array | null = null;
  if (glades.length) {
    const c = makeCanvas(w, h);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.scale(ppu, ppu);
    ctx.fillStyle = "#fff";
    for (const k of glades) {
      // A lumpy glade: a few overlapping blobs with ragged edges (the same every time for the same spot).
      let seed = Math.round(k.x * 7 + k.y * 13) >>> 0 || 1;
      const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
      for (let b = 0; b < 3; b++) {
        const a0 = rnd() * Math.PI * 2, off = b ? k.r * (0.5 + rnd() * 0.5) : 0;
        const cx = k.x + Math.cos(a0) * off, cy = k.y + Math.sin(a0) * off * 0.7, r0 = k.r * (b ? 0.55 + rnd() * 0.3 : 0.9);
        ctx.beginPath();
        for (let a = 0; a < 14; a++) {
          const r = r0 * (0.78 + rnd() * 0.44);
          ctx.lineTo(cx + Math.cos((a * Math.PI) / 7) * r, cy + Math.sin((a * Math.PI) / 7) * r);
        }
        ctx.fill();
      }
    }
    const px = ctx.getImageData(0, 0, w, h).data;
    glade = new Float32Array(w * h);
    for (let i = 0; i < glade.length; i++) glade[i] = px[i * 4 + 3]! / 255;
    glade = boxBlur(glade, w, h, Math.max(1, Math.round(2 * ppu)), 2);
  }
  return { ppu, width: w, height: h, aux1: pack(w, h, land, landBlur, smooth), aux2: pack(w, h, range, rangeBlur, glade) };
}

import type { Rng } from "@conquerra/engine";

/*
 * Small helpers. The map maker only uses + - * / and Math.sqrt / floor / round / min / max / abs, never
 * Math.sin, Math.pow, Math.hypot and friends: their last digits can differ between browsers and servers,
 * and the same seed must give the same map everywhere.
 */

export const dist = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
};

/** Round to 0.1 map units (what the map file stores). */
export const r1 = (n: number) => Math.round(n * 10) / 10;

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** A random direction (unit vector) without trigonometry: pick a point in the unit circle and normalize it. */
export function randomDirection(rng: Rng): [number, number] {
  for (;;) {
    const x = rng.next() * 2 - 1, y = rng.next() * 2 - 1;
    const d2 = x * x + y * y;
    if (d2 > 0.04 && d2 <= 1) {
      const d = Math.sqrt(d2);
      return [x / d, y / d];
    }
  }
}

/**
 * Smooth "value noise" in [0, 1]: random values on a lattice, blended with a smoothstep curve, a few octaves deep.
 * Same seed, same field.
 */
export class Noise {
  private readonly values: Float64Array;
  private readonly perm: Uint16Array;
  constructor(rng: Rng) {
    this.values = new Float64Array(256);
    for (let i = 0; i < 256; i++) this.values[i] = rng.next();
    const p = rng.shuffle(Array.from({ length: 256 }, (_, i) => i));
    this.perm = new Uint16Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255]!;
  }
  private lattice(ix: number, iy: number): number {
    return this.values[this.perm[(this.perm[ix & 255]! + iy) & 511]!]!;
  }
  /** One octave at unit frequency. */
  value(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = this.lattice(ix, iy), b = this.lattice(ix + 1, iy);
    const c = this.lattice(ix, iy + 1), d = this.lattice(ix + 1, iy + 1);
    const top = a + (b - a) * sx, bottom = c + (d - c) * sx;
    return top + (bottom - top) * sy;
  }
  /** Several octaves, each twice as fine and half as strong. `scale` is the size of the biggest features in map units. */
  fbm(x: number, y: number, scale: number, octaves = 4): number {
    let sum = 0, amp = 1, norm = 0, f = 1 / scale;
    for (let o = 0; o < octaves; o++) {
      sum += this.value(x * f + o * 17.3, y * f + o * 31.7) * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  }
}

/** A binary-heap priority queue (lowest key first; ties broken by item number so results never depend on luck). */
export class MinHeap {
  private keys: number[] = [];
  private items: number[] = [];
  get size() {
    return this.items.length;
  }
  push(key: number, item: number) {
    const k = this.keys, it = this.items;
    k.push(key);
    it.push(item);
    let i = it.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p]! < key || (k[p] === key && it[p]! < item)) break;
      k[i] = k[p]!;
      it[i] = it[p]!;
      i = p;
    }
    k[i] = key;
    it[i] = item;
  }
  /** Removes the smallest; returns [key, item]. */
  pop(): [number, number] {
    const k = this.keys, it = this.items;
    const topK = k[0]!, topI = it[0]!;
    const lastK = k.pop()!, lastI = it.pop()!;
    const n = it.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        let mk = lastK, mi = lastI;
        if (l < n && (k[l]! < mk || (k[l] === mk && it[l]! < mi))) (m = l), (mk = k[l]!), (mi = it[l]!);
        if (r < n && (k[r]! < mk || (k[r] === mk && it[r]! < mi))) (m = r), (mk = k[r]!), (mi = it[r]!);
        if (m === i) break;
        k[i] = mk;
        it[i] = mi;
        i = m;
      }
      k[i] = lastK;
      it[i] = lastI;
    }
    return [topK, topI];
  }
}

/** Does segment p1-p2 cross segment p3-p4? */
export function segmentsCross(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number,
): boolean {
  const d1 = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
  const d2 = (x4 - x3) * (y2 - y3) - (y4 - y3) * (x2 - x3);
  const d3 = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
  const d4 = (x2 - x1) * (y4 - y1) - (y2 - y1) * (x4 - x1);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Distance from point p to segment a-b. */
export function pointSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  return dist(px, py, ax + t * dx, ay + t * dy);
}

/** Is the point inside the shape made of these rings (even-odd rule)? Rings are flat x,y lists. */
export function insideRings(rings: readonly (readonly number[])[], x: number, y: number): boolean {
  let inside = false;
  for (const ring of rings) {
    const n = ring.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = ring[2 * i]!, yi = ring[2 * i + 1]!, xj = ring[2 * j]!, yj = ring[2 * j + 1]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Largest-remainder split of `total` in proportion to `weights` (each at least `min`). */
export function apportion(total: number, weights: readonly number[], min = 0): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const base = weights.map((w) => Math.max(min, Math.floor((total * w) / sum)));
  let left = total - base.reduce((a, b) => a + b, 0);
  const order = weights
    .map((w, i) => ({ i, rem: (total * w) / sum - Math.floor((total * w) / sum) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) base[order[k]!.i]!++;
  for (let k = order.length - 1, guard = 0; left < 0 && guard < order.length * 1000; k = (k - 1 + order.length) % order.length, guard++) {
    const i = order[k]!.i;
    if (base[i]! > min) base[i]!--, left++;
  }
  return base;
}

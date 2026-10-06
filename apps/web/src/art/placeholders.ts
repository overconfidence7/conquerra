import { menuPlaceholder } from "./menuPlaceholders";
import { canvas, fbmField, groundShadow, hex, INK, mix, paintField, rand, ramp, rgb, shade, wrapped, type Ctx, type RGB } from "./paint";

/**
 * Placeholder art, painted in code in the same storybook style the real art will have. Each is keyed by the real
 * art's file name (docs/art/asset-list-and-prompts.md), so dropping in the real file replaces it with no code change.
 * Sprites are drawn at 2x the size they're shown at, with the object's base at the bottom centre.
 */

export interface Painted {
  image: HTMLCanvasElement;
  /** For tinted art: the parts to colour with the House tincture (white/grey with alpha). */
  tintMask?: HTMLCanvasElement;
}

const TEX = 256;

// ---------------- Ground and water textures ----------------

function noiseTexture(seed: number, base: number, octaves: number, f: (n: number, x: number, y: number, r: () => number) => RGB, post?: (ctx: Ctx, r: () => number) => void) {
  const [c, ctx] = canvas(TEX);
  const n = fbmField(TEX, seed, base, octaves);
  const r = rand(seed * 7 + 3);
  paintField(ctx, TEX, (i, x, y) => f(n[i]!, x, y, r));
  post?.(ctx, r);
  return c;
}

const grassRamp = ramp([[0.3, "#5d8a34"], [0.5, "#79a443"], [0.7, "#93b553"]]);
const TEXTURES: Record<string, () => HTMLCanvasElement> = {
  "terrain-grass": () =>
    noiseTexture(11, 4, 5, (n, _x, _y, r) => shade(grassRamp(n), (r() - 0.5) * 0.08), (ctx, r) => {
      for (let i = 0; i < 260; i++) {
        const x = r() * TEX, y = r() * TEX;
        ctx.fillStyle = r() < 0.15 ? "rgba(250,240,170,0.8)" : r() < 0.5 ? "rgba(70,105,35,0.45)" : "rgba(170,200,95,0.45)";
        wrapped(TEX, x, y, 2, (px, py) => ctx.fillRect(px, py, 1.6, 1.6));
      }
    }),
  "terrain-farmland": () => {
    const [c, ctx] = canvas(TEX);
    const r = rand(23);
    const cols = ["#c9a64a", "#a8b553", "#7f9e45", "#d8bc63", "#8c7a45", "#9cb35a"].map(hex);
    // A wrapping grid of fields, each with furrows.
    const n = 4, s = TEX / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const col = cols[Math.floor(r() * cols.length)]!;
        const x = i * s, y = j * s;
        ctx.fillStyle = rgb(col);
        ctx.fillRect(x, y, s, s);
        ctx.strokeStyle = rgb(shade(col, -0.18), 0.55);
        ctx.lineWidth = 1.2;
        const vertical = r() < 0.5;
        for (let k = 3; k < s; k += 5) {
          ctx.beginPath();
          if (vertical) (ctx.moveTo(x + k, y + 2), ctx.lineTo(x + k, y + s - 2));
          else (ctx.moveTo(x + 2, y + k), ctx.lineTo(x + s - 2, y + k));
          ctx.stroke();
        }
      }
    // Hedgerows.
    ctx.strokeStyle = "rgba(55,85,30,0.9)";
    ctx.lineWidth = 3;
    for (let k = 0; k <= TEX; k += s) {
      ctx.beginPath();
      ctx.moveTo(k, 0);
      ctx.lineTo(k, TEX);
      ctx.moveTo(0, k);
      ctx.lineTo(TEX, k);
      ctx.stroke();
    }
    return c;
  },
  "terrain-forest": () =>
    noiseTexture(31, 4, 4, (n) => mix(hex("#244a24"), hex("#3a6a2e"), n), (ctx, r) => {
      for (let i = 0; i < 420; i++) {
        const x = r() * TEX, y = r() * TEX, rad = 5 + r() * 6;
        const base = mix(hex("#2c5a2a"), hex("#4f8236"), r());
        wrapped(TEX, x, y, rad, (px, py) => {
          ctx.fillStyle = rgb(shade(base, -0.35), 0.7);
          ctx.beginPath();
          ctx.arc(px + 1.5, py + 1.5, rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = rgb(base);
          ctx.beginPath();
          ctx.arc(px, py, rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = rgb(shade(base, 0.25), 0.8);
          ctx.beginPath();
          ctx.arc(px - rad * 0.3, py - rad * 0.3, rad * 0.45, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }),
  "terrain-hills": () => noiseTexture(41, 3, 5, (n, _x, _y, r) => shade(mix(hex("#6f8a3e"), hex("#a3a560"), n), (r() - 0.5) * 0.06)),
  "terrain-rock": () =>
    noiseTexture(51, 4, 6, (n, _x, _y, r) => shade(mix(hex("#6e6a64"), hex("#a49d92"), n), (r() - 0.5) * 0.12), (ctx, r) => {
      ctx.strokeStyle = "rgba(45,40,36,0.45)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 40; i++) {
        let x = r() * TEX, y = r() * TEX;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) ctx.lineTo((x += (r() - 0.5) * 14), (y += (r() - 0.3) * 12));
        ctx.stroke();
      }
    }),
  "terrain-snow": () => noiseTexture(61, 4, 5, (n, _x, _y, r) => shade(mix(hex("#c9d4e2"), hex("#f6f8fb"), n), (r() - 0.5) * 0.04)),
  "terrain-swamp": () =>
    noiseTexture(71, 4, 5, (n) => mix(hex("#4c5a2c"), hex("#6f7a3b"), n), (ctx, r) => {
      for (let i = 0; i < 26; i++) {
        const x = r() * TEX, y = r() * TEX, rx = 6 + r() * 14, ry = 3 + r() * 6;
        wrapped(TEX, x, y, rx, (px, py) => {
          ctx.fillStyle = "rgba(42,70,62,0.85)";
          ctx.beginPath();
          ctx.ellipse(px, py, rx, ry, r() * 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.strokeStyle = "rgba(150,160,70,0.7)";
      for (let i = 0; i < 200; i++) {
        const x = r() * TEX, y = r() * TEX;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (r() - 0.5) * 3, y - 4 - r() * 3);
        ctx.stroke();
      }
    }),
  "terrain-sand": () => noiseTexture(81, 4, 5, (n, x, y) => shade(mix(hex("#d6bf86"), hex("#ead7a2"), n), Math.sin((x + y * 0.4 + n * 40) * ((Math.PI * 2 * 12) / TEX)) * 0.04)),
  "water-shallow": () => noiseTexture(91, 3, 4, (n, x, y) => shade(mix(hex("#4fa2ae"), hex("#74c0c0"), n), Math.sin(((x * 2 + y) / TEX) * Math.PI * 2 * 5 + n * 7) * 0.03)),
  "water-deep": () => noiseTexture(101, 3, 4, (n, x, y) => shade(mix(hex("#21507a"), hex("#2d6592"), n), Math.sin(((x + y * 2) / TEX) * Math.PI * 2 * 4 + n * 6) * 0.025)),
};

// ---------------- Sprites ----------------

const S = 2; // drawn at 2x

/** A pine: stacked triangles. */
function pine(ctx: Ctx, x: number, y: number, h: number, col: RGB) {
  ctx.lineWidth = 0.9 * S;
  ctx.strokeStyle = "rgba(30,22,12,0.75)";
  ctx.fillStyle = "#5a3d22";
  ctx.fillRect(x - 1.2 * S, y - h * 0.18, 2.4 * S, h * 0.18);
  for (let k = 0; k < 3; k++) {
    const top = y - h + k * h * 0.22, w = h * (0.28 + k * 0.08), base = top + h * 0.45;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + w, base);
    ctx.lineTo(x - w, base);
    ctx.closePath();
    const g = ctx.createLinearGradient(x - w, top, x + w, base);
    g.addColorStop(0, rgb(shade(col, 0.22)));
    g.addColorStop(1, rgb(shade(col, -0.25)));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.stroke();
  }
}

/** A round leafy tree. */
function oak(ctx: Ctx, x: number, y: number, r: number, col: RGB) {
  ctx.lineWidth = 0.9 * S;
  ctx.strokeStyle = "rgba(30,22,12,0.75)";
  ctx.fillStyle = "#5a3d22";
  ctx.fillRect(x - 1.5 * S, y - r * 0.9, 3 * S, r * 0.9);
  ctx.strokeRect(x - 1.5 * S, y - r * 0.9, 3 * S, r * 0.9);
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 1.9, r * 0.2, x, y - r * 1.5, r * 1.2);
  g.addColorStop(0, rgb(shade(col, 0.3)));
  g.addColorStop(1, rgb(shade(col, -0.25)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y - r * 1.5, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function sprite(w: number, h: number, draw: (ctx: Ctx, w: number, h: number) => void): HTMLCanvasElement {
  const [c, ctx] = canvas(w * S, h * S);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  draw(ctx, w * S, h * S);
  return c;
}

function treeCluster(kind: "conifer" | "broadleaf", v: number) {
  return sprite(36, 34, (ctx, w, h) => {
    const r = rand(v * 13 + (kind === "conifer" ? 1 : 2));
    const count = kind === "conifer" ? 3 + v : 2 + v;
    groundShadow(ctx, w * 0.55, h * 0.88, w * 0.42, h * 0.12, 0.3);
    const spots = Array.from({ length: count }, () => [w * (0.22 + r() * 0.56), h * (0.62 + r() * 0.3)] as const).sort((a, b) => a[1] - b[1]);
    for (const [x, y] of spots) {
      const col = kind === "conifer" ? mix(hex("#24502c"), hex("#3c6e34"), r()) : mix(hex("#4f8a32"), hex("#77a63c"), r());
      if (kind === "conifer") pine(ctx, x, y, h * (0.5 + r() * 0.2), col);
      else oak(ctx, x, y, w * (0.13 + r() * 0.05), col);
    }
  });
}

function peak(v: number) {
  return sprite(48, 42, (ctx, w, h) => {
    const r = rand(v * 31);
    groundShadow(ctx, w * 0.62, h * 0.9, w * 0.46, h * 0.1, 0.22);
    const base = h * 0.92;
    // A main peak and a lower shoulder; jagged edges, lit face left, shadow face right.
    const peaks = [
      { cx: w * (0.44 + r() * 0.08), top: h * (0.08 + r() * 0.1), half: w * (0.34 + r() * 0.06), snow: v !== 3 },
      { cx: w * (r() < 0.5 ? 0.24 : 0.74), top: h * (0.42 + r() * 0.12), half: w * 0.22, snow: false },
    ].sort((a, b) => a.top - b.top).reverse();
    for (const p of peaks) {
      const tx = p.cx + (r() - 0.5) * p.half * 0.3;
      const left: [number, number][] = [[tx, p.top]], right: [number, number][] = [[tx, p.top]];
      for (let k = 1; k <= 4; k++) {
        const t = k / 4;
        left.push([tx - p.half * t + (r() - 0.5) * p.half * 0.12, p.top + (base - p.top) * t + (k < 4 ? (r() - 0.5) * 3 * S : 0)]);
        right.push([tx + p.half * t + (r() - 0.5) * p.half * 0.12, p.top + (base - p.top) * t + (k < 4 ? (r() - 0.5) * 3 * S : 0)]);
      }
      const ridgeX = tx + p.half * 0.08;
      const face = (pts: [number, number][], fill: string) => {
        ctx.beginPath();
        ctx.moveTo(pts[0]![0], pts[0]![1]);
        for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]);
        ctx.lineTo(ridgeX, base);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      };
      face(left, "#8b857a");
      face(right, "#4b4740");
      // Ridge line and a couple of gullies.
      ctx.strokeStyle = "rgba(40,32,24,0.5)";
      ctx.lineWidth = 0.8 * S;
      ctx.beginPath();
      ctx.moveTo(tx, p.top);
      ctx.lineTo(ridgeX, base);
      ctx.moveTo(tx - p.half * 0.35, p.top + (base - p.top) * 0.45);
      ctx.lineTo(tx - p.half * 0.5, base - 2);
      ctx.stroke();
      if (p.snow) {
        const sh = (base - p.top) * 0.28;
        ctx.beginPath();
        ctx.moveTo(tx, p.top);
        ctx.lineTo(tx - p.half * 0.3, p.top + sh);
        ctx.lineTo(tx - p.half * 0.1, p.top + sh * 0.75);
        ctx.lineTo(tx + p.half * 0.05, p.top + sh * 1.05);
        ctx.lineTo(tx + p.half * 0.28, p.top + sh * 0.9);
        ctx.closePath();
        ctx.fillStyle = "#eef1f5";
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(tx, p.top);
        ctx.lineTo(tx + p.half * 0.05, p.top + sh * 1.05);
        ctx.lineTo(tx + p.half * 0.28, p.top + sh * 0.9);
        ctx.closePath();
        ctx.fillStyle = "#b7bfcc";
        ctx.fill();
      }
      ctx.strokeStyle = "#2e241a";
      ctx.lineWidth = 1.1 * S;
      ctx.beginPath();
      ctx.moveTo(left[left.length - 1]![0], base);
      for (const q of [...left].reverse()) ctx.lineTo(q[0], q[1]);
      for (const q of right.slice(1)) ctx.lineTo(q[0], q[1]);
      ctx.stroke();
    }
  });
}

function hill(v: number) {
  return sprite(36, 18, (ctx, w, h) => {
    const r = rand(v * 17);
    groundShadow(ctx, w * 0.6, h * 0.84, w * 0.44, h * 0.2, 0.18);
    const peakX = w * (0.38 + r() * 0.16);
    const mound = () => {
      ctx.beginPath();
      ctx.moveTo(w * 0.04, h * 0.86);
      ctx.bezierCurveTo(w * 0.18, h * 0.3, peakX - w * 0.1, h * (0.08 + r() * 0.08), peakX, h * 0.12);
      ctx.bezierCurveTo(peakX + w * 0.14, h * 0.14, w * 0.8, h * 0.4, w * 0.96, h * 0.86);
      ctx.closePath();
    };
    const g = ctx.createLinearGradient(w * 0.25, 0, w * 0.75, h);
    g.addColorStop(0, "rgba(176,184,112,0.95)");
    g.addColorStop(0.55, "rgba(124,138,72,0.95)");
    g.addColorStop(1, "rgba(84,96,50,0.95)");
    mound();
    ctx.fillStyle = g;
    ctx.fill();
    // Only the shadowed (right) flank gets a soft dark edge.
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "rgba(50,40,24,0.35)";
    ctx.lineWidth = 2 * S;
    ctx.beginPath();
    ctx.moveTo(peakX, h * 0.12);
    ctx.bezierCurveTo(peakX + w * 0.14, h * 0.14, w * 0.8, h * 0.4, w * 0.96, h * 0.86);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "rgba(120,112,98,0.8)";
    for (let i = 0; i < v; i++) {
      ctx.beginPath();
      ctx.ellipse(w * (0.3 + r() * 0.4), h * (0.55 + r() * 0.2), 1.6 * S, 1 * S, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** A cottage, front view with a pitched roof. */
function cottage(ctx: Ctx, x: number, y: number, s: number, roof: string) {
  ctx.lineWidth = 1.1 * S;
  ctx.strokeStyle = INK;
  ctx.fillStyle = "#e8dcc0";
  ctx.fillRect(x - s, y - s, s * 2, s);
  ctx.strokeRect(x - s, y - s, s * 2, s);
  ctx.fillStyle = "#4a3320";
  ctx.fillRect(x - s * 0.25, y - s * 0.6, s * 0.5, s * 0.6);
  ctx.beginPath();
  ctx.moveTo(x - s * 1.25, y - s);
  ctx.lineTo(x, y - s * 2);
  ctx.lineTo(x + s * 1.25, y - s);
  ctx.closePath();
  ctx.fillStyle = roof;
  ctx.fill();
  ctx.stroke();
}

function village(v: number) {
  return sprite(40, 30, (ctx, w, h) => {
    const r = rand(v * 41);
    groundShadow(ctx, w * 0.55, h * 0.84, w * 0.44, h * 0.16, 0.28);
    const n = 3 + v;
    const spots = Array.from({ length: n }, () => [w * (0.2 + r() * 0.6), h * (0.55 + r() * 0.35)] as const).sort((a, b) => a[1] - b[1]);
    for (const [x, y] of spots) cottage(ctx, x, y, w * 0.07, r() < 0.6 ? "#c8a04a" : "#a9643a");
  });
}

function tower(ctx: Ctx, x: number, y: number, tw: number, th: number, roof: string, flag?: string) {
  ctx.lineWidth = 1.2 * S;
  ctx.strokeStyle = INK;
  const g = ctx.createLinearGradient(x - tw, 0, x + tw, 0);
  g.addColorStop(0, "#d8d1c3");
  g.addColorStop(1, "#8f877a");
  ctx.fillStyle = g;
  ctx.fillRect(x - tw, y - th, tw * 2, th);
  ctx.strokeRect(x - tw, y - th, tw * 2, th);
  ctx.beginPath();
  ctx.moveTo(x - tw * 1.3, y - th);
  ctx.lineTo(x, y - th - tw * 2.4);
  ctx.lineTo(x + tw * 1.3, y - th);
  ctx.closePath();
  ctx.fillStyle = roof;
  ctx.fill();
  ctx.stroke();
  if (flag) {
    const top = y - th - tw * 2.4;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, top - tw * 1.4);
    ctx.stroke();
    ctx.fillStyle = flag;
    ctx.beginPath();
    ctx.moveTo(x, top - tw * 1.4);
    ctx.lineTo(x + tw * 1.3, top - tw * 1.1);
    ctx.lineTo(x, top - tw * 0.8);
    ctx.fill();
  }
}

function wall(ctx: Ctx, x0: number, x1: number, y: number, hgt: number) {
  ctx.fillStyle = "#b9b0a1";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2 * S;
  ctx.fillRect(x0, y - hgt, x1 - x0, hgt);
  ctx.strokeRect(x0, y - hgt, x1 - x0, hgt);
  ctx.fillStyle = "#b9b0a1";
  for (let x = x0; x < x1 - 2; x += hgt * 0.6) {
    ctx.fillRect(x, y - hgt * 1.3, hgt * 0.32, hgt * 0.32);
    ctx.strokeRect(x, y - hgt * 1.3, hgt * 0.32, hgt * 0.32);
  }
}

function town(v: number) {
  return sprite(46, 38, (ctx, w, h) => {
    const r = rand(v * 53);
    groundShadow(ctx, w * 0.55, h * 0.86, w * 0.46, h * 0.15, 0.3);
    for (let i = 0; i < 6; i++) cottage(ctx, w * (0.2 + r() * 0.6), h * (0.55 + r() * 0.15), w * 0.06, r() < 0.7 ? "#b5583a" : "#c8a04a");
    tower(ctx, w * (0.45 + r() * 0.1), h * 0.66, w * 0.05, h * 0.3, "#7a4a2e");
    wall(ctx, w * 0.1, w * 0.9, h * 0.9, h * 0.14);
  });
}

function castle(v: number) {
  return sprite(64, 60, (ctx, w, h) => {
    groundShadow(ctx, w * 0.56, h * 0.9, w * 0.48, h * 0.13, 0.4);
    const roof = v === 1 ? "#3d5f9e" : "#7c3b3b";
    tower(ctx, w * 0.5, h * 0.62, w * 0.09, h * 0.36, roof, "#e3c77e");
    tower(ctx, w * 0.32, h * 0.7, w * 0.06, h * 0.26, roof, "#e3c77e");
    tower(ctx, w * 0.68, h * 0.7, w * 0.06, h * 0.26, roof, "#e3c77e");
    wall(ctx, w * 0.12, w * 0.88, h * 0.9, h * 0.14);
    tower(ctx, w * 0.14, h * 0.92, w * 0.055, h * 0.2, roof);
    tower(ctx, w * 0.86, h * 0.92, w * 0.055, h * 0.2, roof);
    // Gate.
    ctx.fillStyle = "#3a2716";
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.86, w * 0.045, Math.PI, 0);
    ctx.lineTo(w * 0.545, h * 0.9);
    ctx.lineTo(w * 0.455, h * 0.9);
    ctx.fill();
  });
}

const BUILDINGS: Record<string, () => HTMLCanvasElement> = {
  "building-fort": () =>
    sprite(40, 34, (ctx, w, h) => {
      groundShadow(ctx, w * 0.55, h * 0.88, w * 0.46, h * 0.14);
      wall(ctx, w * 0.14, w * 0.86, h * 0.88, h * 0.26);
      for (const x of [0.16, 0.84]) tower(ctx, w * x, h * 0.9, w * 0.08, h * 0.4, "#6b5b4b");
    }),
  "building-market": () =>
    sprite(40, 30, (ctx, w, h) => {
      groundShadow(ctx, w * 0.55, h * 0.86, w * 0.46, h * 0.15);
      const cols = ["#c2553f", "#2f6fe0", "#e2ad1c"];
      cols.forEach((c, i) => {
        const x = w * (0.22 + i * 0.28), y = h * (0.82 - (i % 2) * 0.1), s = w * 0.12;
        ctx.fillStyle = "#e8dcc0";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.1 * S;
        ctx.fillRect(x - s, y - s * 0.8, s * 2, s * 0.8);
        ctx.strokeRect(x - s, y - s * 0.8, s * 2, s * 0.8);
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = k % 2 ? "#f4ecd9" : c;
          ctx.fillRect(x - s * 1.15 + (k * s * 2.3) / 4, y - s * 1.35, (s * 2.3) / 4, s * 0.55);
        }
        ctx.strokeRect(x - s * 1.15, y - s * 1.35, s * 2.3, s * 0.55);
      });
    }),
  "building-barracks": () =>
    sprite(42, 30, (ctx, w, h) => {
      groundShadow(ctx, w * 0.55, h * 0.86, w * 0.46, h * 0.15);
      ctx.strokeStyle = "#6b4a2a";
      ctx.lineWidth = 1 * S;
      ctx.strokeRect(w * 0.08, h * 0.66, w * 0.84, h * 0.24);
      ctx.fillStyle = "#c8b48c";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2 * S;
      ctx.fillRect(w * 0.22, h * 0.42, w * 0.56, h * 0.3);
      ctx.strokeRect(w * 0.22, h * 0.42, w * 0.56, h * 0.3);
      ctx.fillStyle = "#7a4a2e";
      ctx.beginPath();
      ctx.moveTo(w * 0.18, h * 0.42);
      ctx.lineTo(w * 0.3, h * 0.22);
      ctx.lineTo(w * 0.7, h * 0.22);
      ctx.lineTo(w * 0.82, h * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }),
  "building-watchtower": () =>
    sprite(24, 44, (ctx, w, h) => {
      groundShadow(ctx, w * 0.6, h * 0.92, w * 0.42, h * 0.07);
      tower(ctx, w * 0.5, h * 0.94, w * 0.18, h * 0.6, "#6b5b4b", "#e3c77e");
    }),
};

// Figures: the body cloth is drawn into a separate mask so the House colour can be applied.
function figure(w: number, h: number, draw: (ctx: Ctx, mask: Ctx, w: number, h: number) => void): Painted {
  const [mask, mctx] = canvas(w * S, h * S);
  mctx.lineJoin = "round";
  const image = sprite(w, h, (ctx, W, H) => draw(ctx, mctx, W, H));
  return { image, tintMask: mask };
}

/** A flag on a pole; the cloth is tinted. Used for the House banner on the map and in menus. */
function flag(w: number, h: number, poleTop: number): Painted {
  return figure(w, h, (ctx, mask, W, H) => {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6 * S;
    ctx.fillStyle = "#6b4a2a";
    ctx.fillRect(W * 0.14, H * poleTop, W * 0.07, H * (1 - poleTop));
    ctx.strokeRect(W * 0.14, H * poleTop, W * 0.07, H * (1 - poleTop));
    ctx.fillStyle = "#e3c77e";
    ctx.beginPath();
    ctx.arc(W * 0.175, H * poleTop, W * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const cloth = (c: Ctx) => {
      c.beginPath();
      c.moveTo(W * 0.21, H * (poleTop + 0.04));
      c.quadraticCurveTo(W * 0.55, H * (poleTop - 0.02), W * 0.92, H * (poleTop + 0.06));
      c.lineTo(W * 0.78, H * (poleTop + 0.2));
      c.lineTo(W * 0.92, H * (poleTop + 0.36));
      c.quadraticCurveTo(W * 0.55, H * (poleTop + 0.3), W * 0.21, H * (poleTop + 0.36));
      c.closePath();
    };
    for (const c of [ctx, mask]) {
      cloth(c);
      c.fillStyle = "#eeeeee";
      c.fill();
    }
    ctx.stroke();
  });
}

function soldier(ctx: Ctx, mask: Ctx, x: number, y: number, s: number) {
  // Legs, body (tabard: tinted), head, spear, shield.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1 * S;
  ctx.fillStyle = "#4a3a2a";
  ctx.fillRect(x - s * 0.35, y - s * 0.9, s * 0.25, s * 0.9);
  ctx.fillRect(x + s * 0.1, y - s * 0.9, s * 0.25, s * 0.9);
  for (const c of [ctx, mask]) {
    c.fillStyle = "#eeeeee";
    c.beginPath();
    c.roundRect(x - s * 0.5, y - s * 2.1, s, s * 1.3, s * 0.2);
    c.fill();
  }
  ctx.stroke();
  ctx.fillStyle = "#e9c9a0";
  ctx.beginPath();
  ctx.arc(x, y - s * 2.45, s * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#9aa0aa";
  ctx.beginPath();
  ctx.arc(x, y - s * 2.6, s * 0.4, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = "#6b4a2a";
  ctx.lineWidth = 0.8 * S;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.6, y - s * 0.2);
  ctx.lineTo(x + s * 0.6, y - s * 3.4);
  ctx.stroke();
  ctx.fillStyle = "#c0c4cc";
  ctx.beginPath();
  ctx.moveTo(x + s * 0.6, y - s * 3.9);
  ctx.lineTo(x + s * 0.75, y - s * 3.4);
  ctx.lineTo(x + s * 0.45, y - s * 3.4);
  ctx.fill();
}

const FIGURES: Record<string, () => Painted> = {
  "figure-army": () =>
    figure(36, 30, (ctx, mask, w, h) => {
      groundShadow(ctx, w * 0.55, h * 0.9, w * 0.44, h * 0.1);
      const spots: [number, number][] = [[0.3, 0.72], [0.5, 0.7], [0.7, 0.72], [0.4, 0.92], [0.6, 0.92]];
      for (const [x, y] of spots) soldier(ctx, mask, w * x, h * y, w * 0.07);
    }),
  "figure-cavalry": () =>
    figure(34, 32, (ctx, mask, w, h) => {
      groundShadow(ctx, w * 0.5, h * 0.92, w * 0.42, h * 0.09);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2 * S;
      ctx.fillStyle = "#7a5230";
      // Horse body, legs, neck and head.
      ctx.beginPath();
      ctx.ellipse(w * 0.48, h * 0.62, w * 0.24, h * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (const x of [0.3, 0.38, 0.58, 0.66]) {
        ctx.fillRect(w * x, h * 0.66, w * 0.04, h * 0.26);
        ctx.strokeRect(w * x, h * 0.66, w * 0.04, h * 0.26);
      }
      ctx.beginPath();
      ctx.moveTo(w * 0.66, h * 0.58);
      ctx.lineTo(w * 0.8, h * 0.34);
      ctx.lineTo(w * 0.9, h * 0.42);
      ctx.lineTo(w * 0.74, h * 0.64);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      soldier(ctx, mask, w * 0.46, h * 0.56, w * 0.075);
    }),
  "figure-siege": () => ({
    image: sprite(36, 30, (ctx, w, h) => {
      groundShadow(ctx, w * 0.5, h * 0.9, w * 0.44, h * 0.1);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2 * S;
      ctx.fillStyle = "#8a5a32";
      ctx.fillRect(w * 0.15, h * 0.66, w * 0.7, h * 0.12);
      ctx.strokeRect(w * 0.15, h * 0.66, w * 0.7, h * 0.12);
      for (const x of [0.25, 0.75]) {
        ctx.fillStyle = "#5a3d22";
        ctx.beginPath();
        ctx.arc(w * x, h * 0.82, w * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.lineWidth = 2 * S;
      ctx.strokeStyle = "#6b4a2a";
      ctx.beginPath();
      ctx.moveTo(w * 0.35, h * 0.66);
      ctx.lineTo(w * 0.8, h * 0.18);
      ctx.stroke();
      ctx.fillStyle = "#8f877a";
      ctx.beginPath();
      ctx.arc(w * 0.8, h * 0.16, w * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }),
  }),
  "figure-scouts": () => ({
    image: sprite(22, 30, (ctx, w, h) => {
      groundShadow(ctx, w * 0.5, h * 0.92, w * 0.4, h * 0.08);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2 * S;
      ctx.fillStyle = "#3f5a3a";
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.12);
      ctx.quadraticCurveTo(w * 0.85, h * 0.2, w * 0.82, h * 0.92);
      ctx.lineTo(w * 0.18, h * 0.92);
      ctx.quadraticCurveTo(w * 0.15, h * 0.2, w * 0.5, h * 0.12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#c8a04a";
      ctx.fillRect(w * 0.55, h * 0.32, w * 0.4, h * 0.07);
    }),
  }),
  "figure-engineers": () => ({
    image: sprite(32, 26, (ctx, w, h) => {
      groundShadow(ctx, w * 0.5, h * 0.9, w * 0.44, h * 0.1);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.1 * S;
      ctx.fillStyle = "#b08a58";
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(w * 0.45, h * (0.62 + i * 0.1), w * 0.45, h * 0.09);
        ctx.strokeRect(w * 0.45, h * (0.62 + i * 0.1), w * 0.45, h * 0.09);
      }
      ctx.fillStyle = "#8a6a3a";
      ctx.beginPath();
      ctx.roundRect(w * 0.12, h * 0.3, w * 0.22, h * 0.6, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e9c9a0";
      ctx.beginPath();
      ctx.arc(w * 0.23, h * 0.22, w * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }),
  }),
  "figure-healers": () => ({
    image: sprite(32, 28, (ctx, w, h) => {
      groundShadow(ctx, w * 0.5, h * 0.9, w * 0.44, h * 0.1);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2 * S;
      ctx.fillStyle = "#efe6d2";
      ctx.beginPath();
      ctx.moveTo(w * 0.42, h * 0.88);
      ctx.lineTo(w * 0.66, h * 0.3);
      ctx.lineTo(w * 0.92, h * 0.88);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#3f8a4a";
      ctx.fillRect(w * 0.63, h * 0.55, w * 0.06, h * 0.2);
      ctx.fillRect(w * 0.58, h * 0.62, w * 0.16, h * 0.06);
      ctx.fillStyle = "#6a7ea8";
      ctx.beginPath();
      ctx.moveTo(w * 0.22, h * 0.3);
      ctx.lineTo(w * 0.36, h * 0.9);
      ctx.lineTo(w * 0.08, h * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }),
  }),
};

function ship(): HTMLCanvasElement {
  return sprite(30, 26, (ctx, w, h) => {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.84, w * 0.42, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2 * S;
    ctx.fillStyle = "#7a4a2a";
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.66);
    ctx.lineTo(w * 0.9, h * 0.66);
    ctx.lineTo(w * 0.76, h * 0.84);
    ctx.lineTo(w * 0.22, h * 0.84);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.66);
    ctx.lineTo(w * 0.5, h * 0.08);
    ctx.stroke();
    ctx.fillStyle = "#f6f1e4";
    ctx.beginPath();
    ctx.moveTo(w * 0.52, h * 0.12);
    ctx.quadraticCurveTo(w * 0.86, h * 0.36, w * 0.52, h * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.48, h * 0.18);
    ctx.quadraticCurveTo(w * 0.2, h * 0.4, w * 0.48, h * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
}

function cloud(v: number): HTMLCanvasElement {
  const [c, ctx] = canvas(256, 160);
  const r = rand(v * 71);
  for (let i = 0; i < 14; i++) {
    const x = 50 + r() * 156, y = 50 + r() * 60, rad = 25 + r() * 35;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return c;
}

// ---------------- Icons (64 px, bold silhouettes with a light gold rim) ----------------

function icon(draw: (ctx: Ctx, s: number) => void): HTMLCanvasElement {
  const s = 64;
  const [c, ctx] = canvas(s);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  draw(ctx, s);
  return c;
}
const GOLD = "#e3c77e";
const iconStroke = (ctx: Ctx, fill: string) => {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = "#1b1206";
  ctx.lineWidth = 4;
  ctx.stroke();
};
const ICONS: Record<string, () => HTMLCanvasElement> = {
  "icon-crown": () =>
    icon((ctx, s) => {
      ctx.beginPath();
      ctx.moveTo(s * 0.12, s * 0.78);
      ctx.lineTo(s * 0.12, s * 0.3);
      ctx.lineTo(s * 0.32, s * 0.52);
      ctx.lineTo(s * 0.5, s * 0.2);
      ctx.lineTo(s * 0.68, s * 0.52);
      ctx.lineTo(s * 0.88, s * 0.3);
      ctx.lineTo(s * 0.88, s * 0.78);
      ctx.closePath();
      iconStroke(ctx, GOLD);
      ctx.fillStyle = "#c2553f";
      ctx.beginPath();
      ctx.arc(s * 0.5, s * 0.64, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }),
  "icon-gold": () =>
    icon((ctx, s) => {
      for (const [x, y] of [[0.36, 0.64], [0.62, 0.66], [0.5, 0.42]]) {
        ctx.beginPath();
        ctx.ellipse(s * x!, s * y!, s * 0.22, s * 0.14, 0, 0, Math.PI * 2);
        iconStroke(ctx, GOLD);
      }
    }),
  "icon-culture": () =>
    icon((ctx, s) => {
      ctx.beginPath();
      ctx.arc(s * 0.5, s * 0.5, s * 0.34, 0.5, Math.PI - 0.5, true);
      ctx.strokeStyle = "#4f8a3a";
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(s * 0.36, s * 0.32, s * 0.28, s * 0.36, 3);
      iconStroke(ctx, "#efe6d2");
    }),
  "icon-troops": () =>
    icon((ctx, s) => {
      for (const d of [1, -1]) {
        ctx.beginPath();
        ctx.moveTo(s * (0.5 - d * 0.32), s * 0.82);
        ctx.lineTo(s * (0.5 + d * 0.3), s * 0.16);
        ctx.strokeStyle = "#1b1206";
        ctx.lineWidth = 9;
        ctx.stroke();
        ctx.strokeStyle = "#d8dde5";
        ctx.lineWidth = 5;
        ctx.stroke();
      }
    }),
  "icon-fort": () =>
    icon((ctx, s) => {
      ctx.beginPath();
      ctx.moveTo(s * 0.14, s * 0.86);
      ctx.lineTo(s * 0.14, s * 0.22);
      ctx.lineTo(s * 0.3, s * 0.22);
      ctx.lineTo(s * 0.3, s * 0.36);
      ctx.lineTo(s * 0.42, s * 0.36);
      ctx.lineTo(s * 0.42, s * 0.22);
      ctx.lineTo(s * 0.58, s * 0.22);
      ctx.lineTo(s * 0.58, s * 0.36);
      ctx.lineTo(s * 0.7, s * 0.36);
      ctx.lineTo(s * 0.7, s * 0.22);
      ctx.lineTo(s * 0.86, s * 0.22);
      ctx.lineTo(s * 0.86, s * 0.86);
      ctx.closePath();
      iconStroke(ctx, "#c9c1b2");
    }),
  "icon-market": () =>
    icon((ctx, s) => {
      ctx.beginPath();
      ctx.rect(s * 0.18, s * 0.46, s * 0.64, s * 0.38);
      iconStroke(ctx, "#efe6d2");
      ctx.beginPath();
      ctx.moveTo(s * 0.1, s * 0.48);
      ctx.lineTo(s * 0.2, s * 0.2);
      ctx.lineTo(s * 0.8, s * 0.2);
      ctx.lineTo(s * 0.9, s * 0.48);
      ctx.closePath();
      iconStroke(ctx, "#c2553f");
    }),
  "icon-barracks": () =>
    icon((ctx, s) => {
      ctx.beginPath();
      ctx.moveTo(s * 0.12, s * 0.84);
      ctx.lineTo(s * 0.12, s * 0.44);
      ctx.lineTo(s * 0.5, s * 0.16);
      ctx.lineTo(s * 0.88, s * 0.44);
      ctx.lineTo(s * 0.88, s * 0.84);
      ctx.closePath();
      iconStroke(ctx, "#b5583a");
      ctx.beginPath();
      ctx.moveTo(s * 0.34, s * 0.78);
      ctx.lineTo(s * 0.66, s * 0.46);
      ctx.moveTo(s * 0.66, s * 0.78);
      ctx.lineTo(s * 0.34, s * 0.46);
      ctx.strokeStyle = "#f4ecd9";
      ctx.lineWidth = 5;
      ctx.stroke();
    }),
  "icon-watchtower": () =>
    icon((ctx, s) => {
      ctx.beginPath();
      ctx.moveTo(s * 0.3, s * 0.88);
      ctx.lineTo(s * 0.36, s * 0.34);
      ctx.lineTo(s * 0.26, s * 0.34);
      ctx.lineTo(s * 0.26, s * 0.14);
      ctx.lineTo(s * 0.74, s * 0.14);
      ctx.lineTo(s * 0.74, s * 0.34);
      ctx.lineTo(s * 0.64, s * 0.34);
      ctx.lineTo(s * 0.7, s * 0.88);
      ctx.closePath();
      iconStroke(ctx, "#c9c1b2");
    }),
  "icon-cavalry": () =>
    icon((ctx, s) => {
      ctx.beginPath();
      ctx.moveTo(s * 0.28, s * 0.88);
      ctx.lineTo(s * 0.34, s * 0.5);
      ctx.lineTo(s * 0.5, s * 0.16);
      ctx.lineTo(s * 0.62, s * 0.24);
      ctx.lineTo(s * 0.86, s * 0.5);
      ctx.lineTo(s * 0.78, s * 0.6);
      ctx.lineTo(s * 0.6, s * 0.5);
      ctx.lineTo(s * 0.66, s * 0.88);
      ctx.closePath();
      iconStroke(ctx, "#9a6a3e");
    }),
  "icon-siege": () =>
    icon((ctx, s) => {
      ctx.beginPath();
      ctx.rect(s * 0.14, s * 0.6, s * 0.72, s * 0.14);
      iconStroke(ctx, "#8a5a32");
      ctx.beginPath();
      ctx.moveTo(s * 0.36, s * 0.6);
      ctx.lineTo(s * 0.78, s * 0.16);
      ctx.strokeStyle = "#1b1206";
      ctx.lineWidth = 8;
      ctx.stroke();
      for (const x of [0.28, 0.72]) {
        ctx.beginPath();
        ctx.arc(s * x, s * 0.8, s * 0.1, 0, Math.PI * 2);
        iconStroke(ctx, "#5a3d22");
      }
    }),
  "icon-scouts": () =>
    icon((ctx, s) => {
      ctx.beginPath();
      ctx.ellipse(s * 0.5, s * 0.5, s * 0.38, s * 0.22, 0, 0, Math.PI * 2);
      iconStroke(ctx, "#efe6d2");
      ctx.beginPath();
      ctx.arc(s * 0.5, s * 0.5, s * 0.13, 0, Math.PI * 2);
      iconStroke(ctx, "#2f6a8a");
    }),
  "icon-engineers": () =>
    icon((ctx, s) => {
      ctx.beginPath();
      ctx.moveTo(s * 0.24, s * 0.84);
      ctx.lineTo(s * 0.62, s * 0.34);
      ctx.strokeStyle = "#1b1206";
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.strokeStyle = "#a07a4a";
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(s * 0.44, s * 0.14, s * 0.4, s * 0.2);
      iconStroke(ctx, "#9aa0aa");
    }),
  "icon-healers": () =>
    icon((ctx, s) => {
      ctx.beginPath();
      ctx.moveTo(s * 0.4, s * 0.14);
      ctx.lineTo(s * 0.6, s * 0.14);
      ctx.lineTo(s * 0.6, s * 0.4);
      ctx.lineTo(s * 0.86, s * 0.4);
      ctx.lineTo(s * 0.86, s * 0.6);
      ctx.lineTo(s * 0.6, s * 0.6);
      ctx.lineTo(s * 0.6, s * 0.86);
      ctx.lineTo(s * 0.4, s * 0.86);
      ctx.lineTo(s * 0.4, s * 0.6);
      ctx.lineTo(s * 0.14, s * 0.6);
      ctx.lineTo(s * 0.14, s * 0.4);
      ctx.lineTo(s * 0.4, s * 0.4);
      ctx.closePath();
      iconStroke(ctx, "#4f9a5a");
    }),
  // The culture ladder (session 15): placeholders until the art comes (docs/art/asset-list-and-prompts.md, Tier 3).
  "icon-rangers": () =>
    icon((ctx, s) => {
      // A bow and an arrow.
      ctx.beginPath();
      ctx.arc(s * 0.36, s * 0.5, s * 0.36, -Math.PI / 2.6, Math.PI / 2.6);
      ctx.strokeStyle = "#1b1206";
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.strokeStyle = "#7a5a32";
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.6, s * 0.2);
      ctx.lineTo(s * 0.6, s * 0.8);
      ctx.strokeStyle = "#efe6d2";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.12, s * 0.5);
      ctx.lineTo(s * 0.88, s * 0.5);
      ctx.strokeStyle = "#1b1206";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.9, s * 0.5);
      ctx.lineTo(s * 0.76, s * 0.42);
      ctx.lineTo(s * 0.76, s * 0.58);
      ctx.closePath();
      iconStroke(ctx, "#9aa0aa");
    }),
  "icon-standard-bearer": () =>
    icon((ctx, s) => {
      // A pole and a swallow-tailed banner.
      ctx.beginPath();
      ctx.moveTo(s * 0.28, s * 0.1);
      ctx.lineTo(s * 0.28, s * 0.9);
      ctx.strokeStyle = "#1b1206";
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = "#a07a4a";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.3, s * 0.14);
      ctx.lineTo(s * 0.86, s * 0.2);
      ctx.lineTo(s * 0.7, s * 0.34);
      ctx.lineTo(s * 0.86, s * 0.48);
      ctx.lineTo(s * 0.3, s * 0.5);
      ctx.closePath();
      iconStroke(ctx, "#b0302a");
    }),
  emblem: () =>
    icon((ctx, s) => {
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? s * 0.16 : i % 4 ? s * 0.3 : s * 0.46;
        ctx.lineTo(s / 2 + Math.cos(a) * rr, s / 2 + Math.sin(a) * rr);
      }
      ctx.closePath();
      iconStroke(ctx, GOLD);
    }),
};

/** An empty heraldic shield: white field (tinted) inside a gold rim. */
function shield(): Painted {
  const s = 64;
  const [c, ctx] = canvas(s);
  const [m, mctx] = canvas(s);
  const outline = (x: Ctx, inset: number) => {
    x.beginPath();
    x.moveTo(s * 0.14 + inset, s * 0.1 + inset);
    x.lineTo(s * 0.86 - inset, s * 0.1 + inset);
    x.lineTo(s * 0.86 - inset, s * 0.48);
    x.quadraticCurveTo(s * 0.84 - inset, s * 0.8 - inset, s * 0.5, s * 0.94 - inset * 1.4);
    x.quadraticCurveTo(s * 0.16 + inset, s * 0.8 - inset, s * 0.14 + inset, s * 0.48);
    x.closePath();
  };
  outline(ctx, 0);
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.strokeStyle = "#1b1206";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  for (const x of [ctx, mctx]) {
    outline(x, 5);
    x.fillStyle = "#f2f2f2";
    x.fill();
  }
  return { image: c, tintMask: m };
}

// ---------------- The catalogue ----------------

const variant = (name: string) => Number(name.slice(name.lastIndexOf("-") + 1));

/** The placeholder for an asset name, or null if it has none. */
export function placeholder(name: string): Painted | null {
  const t = TEXTURES[name];
  if (t) return { image: t() };
  if (name.startsWith("tree-conifer-")) return { image: treeCluster("conifer", variant(name)) };
  if (name.startsWith("tree-broadleaf-")) return { image: treeCluster("broadleaf", variant(name)) };
  if (name.startsWith("mountain-")) return { image: peak(variant(name)) };
  if (name.startsWith("hill-")) return { image: hill(variant(name)) };
  if (name.startsWith("village-")) return { image: village(variant(name)) };
  if (name.startsWith("town-")) return { image: town(variant(name)) };
  if (name.startsWith("capital-")) return { image: castle(variant(name)) };
  if (name.startsWith("cloud-")) return { image: cloud(variant(name)) };
  if (name === "ship") return { image: ship() };
  const b = BUILDINGS[name];
  if (b) return { image: b() };
  const f = FIGURES[name];
  if (f) return f();
  const i = ICONS[name];
  if (i) return { image: i() };
  if (name === "banner-flag") return flag(28, 44, 0.1);
  if (name === "banner-base") return flag(32, 32, 0.12);
  if (name === "shield-base") return shield();
  const m = menuPlaceholder(name);
  if (m) return { image: m };
  return null;
}

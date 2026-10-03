import { canvas, rand, type Ctx } from "./paint";

/**
 * Placeholders for the menu art (Tier 2): Leader portraits, territory card vistas and the wax seal. Painted in the
 * same storybook style, keyed by the real files' names, so Nate's art replaces them with no code change.
 */

const SKIN = ["#e8c4a0", "#d9a77e", "#b88160", "#8d5b3e", "#f0d2b6"];
const HAIR = ["#3b2a1a", "#7a4a22", "#c9a45c", "#9aa0a8", "#1b1206", "#a3462a"];
const ROBE = ["#2f4f7f", "#7f2f2f", "#2f6f4f", "#5f3f7f", "#7f5f2f", "#2f6f6f", "#6f2f4f", "#5a5a66", "#3f3f3f", "#8a6a3a"];

/** A Leader's head-and-shoulders portrait (square). */
export function leaderPortrait(n: number): HTMLCanvasElement {
  const s = 256;
  const [c, ctx] = canvas(s);
  const r = rand(n * 97 + 11);
  const g = ctx.createRadialGradient(s * 0.5, s * 0.35, s * 0.1, s * 0.5, s * 0.5, s * 0.75);
  g.addColorStop(0, "#3a4a5e");
  g.addColorStop(1, "#0f1620");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const skin = SKIN[n % SKIN.length]!, hair = HAIR[(n * 3) % HAIR.length]!, robe = ROBE[n % ROBE.length]!;
  // Shoulders and robe with a gold collar.
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(s * 0.12, s);
  ctx.quadraticCurveTo(s * 0.16, s * 0.68, s * 0.5, s * 0.66);
  ctx.quadraticCurveTo(s * 0.84, s * 0.68, s * 0.88, s);
  ctx.fill();
  ctx.strokeStyle = "#c9a45c";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(s * 0.34, s * 0.7);
  ctx.quadraticCurveTo(s * 0.5, s * 0.82, s * 0.66, s * 0.7);
  ctx.stroke();
  // Neck and head.
  ctx.fillStyle = skin;
  ctx.fillRect(s * 0.44, s * 0.52, s * 0.12, s * 0.16);
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.42, s * 0.14, s * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hair (long or short), and a beard on some.
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.33, s * 0.15, s * 0.1, 0, Math.PI, 0);
  ctx.fill();
  if (r() < 0.5) {
    ctx.fillRect(s * 0.35, s * 0.33, s * 0.05, s * 0.28);
    ctx.fillRect(s * 0.6, s * 0.33, s * 0.05, s * 0.28);
  }
  if (r() < 0.45) {
    ctx.beginPath();
    ctx.moveTo(s * 0.38, s * 0.46);
    ctx.quadraticCurveTo(s * 0.5, s * 0.66, s * 0.62, s * 0.46);
    ctx.lineTo(s * 0.58, s * 0.5);
    ctx.quadraticCurveTo(s * 0.5, s * 0.56, s * 0.42, s * 0.5);
    ctx.fill();
  }
  // Eyes.
  ctx.fillStyle = "#1b1206";
  for (const x of [0.45, 0.55]) ctx.fillRect(s * x - 3, s * 0.41, 6, 4);
  // A crown or circlet.
  ctx.fillStyle = "#e3c77e";
  ctx.strokeStyle = "#1b1206";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const cy = s * 0.26;
  ctx.moveTo(s * 0.37, cy + 10);
  for (let i = 0; i <= 4; i++) {
    const x = s * 0.37 + (i * s * 0.26) / 4;
    ctx.lineTo(x, i % 2 ? cy - 2 : cy - 14);
    if (i < 4) ctx.lineTo(x + (s * 0.26) / 8, cy + 2);
  }
  ctx.lineTo(s * 0.63, cy + 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Painted-on soft light.
  const v = ctx.createLinearGradient(0, 0, s, s);
  v.addColorStop(0, "rgba(255,240,210,0.12)");
  v.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, s, s);
  return c;
}

const ridge = (ctx: Ctx, w: number, h: number, base: number, amp: number, seed: number, color: string) => {
  const r = rand(seed);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  let y = base;
  for (let x = 0; x <= w; x += w / 24) {
    y = Math.max(base - amp, Math.min(base + amp * 0.3, y + (r() - 0.5) * amp * 0.7));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.fill();
};

/** A territory card's landscape strip (2:1), by kind: city, valley, forest, mountain, harbor. */
export function vista(kind: string): HTMLCanvasElement {
  const w = 600, h = 300;
  const [c, ctx] = canvas(w, h);
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
  sky.addColorStop(0, "#6d8fb3");
  sky.addColorStop(1, "#f0d7a8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const seed = kind.length * 31;
  if (kind === "mountain") {
    ridge(ctx, w, h, h * 0.35, h * 0.3, seed, "#7b8494");
    ridge(ctx, w, h, h * 0.55, h * 0.2, seed + 1, "#5c6474");
  } else ridge(ctx, w, h, h * 0.55, h * 0.12, seed, "#8aa0a8");
  if (kind === "harbor") {
    ctx.fillStyle = "#3f7aa0";
    ctx.fillRect(0, h * 0.68, w, h * 0.32);
    ctx.fillStyle = "#f2ead6";
    for (const x of [0.62, 0.78]) {
      ctx.beginPath();
      ctx.moveTo(w * x, h * 0.66);
      ctx.lineTo(w * x + 30, h * 0.66);
      ctx.lineTo(w * x + 15, h * 0.48);
      ctx.fill();
    }
    ridge(ctx, w * 0.5, h, h * 0.7, h * 0.08, seed + 2, "#6f8a45");
  } else ridge(ctx, w, h, h * 0.72, h * 0.08, seed + 2, kind === "forest" ? "#3f5a2e" : "#7a9a4a");
  if (kind === "forest" || kind === "valley") {
    const r = rand(seed + 5);
    for (let i = 0; i < (kind === "forest" ? 60 : 14); i++) {
      const x = r() * w, y = h * (0.7 + r() * 0.3), s = 14 + r() * 18;
      ctx.fillStyle = kind === "forest" ? "#2c4a26" : "#3f6a30";
      ctx.beginPath();
      ctx.moveTo(x, y - s * 1.6);
      ctx.lineTo(x + s * 0.6, y);
      ctx.lineTo(x - s * 0.6, y);
      ctx.fill();
    }
  }
  if (kind === "city") {
    ctx.fillStyle = "#8c7a63";
    for (let i = 0; i < 9; i++) {
      const x = w * 0.25 + i * 36, bh = 40 + ((i * 37) % 50);
      ctx.fillRect(x, h * 0.78 - bh, 28, bh);
      ctx.fillStyle = "#a3462a";
      ctx.beginPath();
      ctx.moveTo(x - 3, h * 0.78 - bh);
      ctx.lineTo(x + 14, h * 0.78 - bh - 18);
      ctx.lineTo(x + 31, h * 0.78 - bh);
      ctx.fill();
      ctx.fillStyle = "#8c7a63";
    }
  }
  const v = ctx.createLinearGradient(0, h * 0.5, 0, h);
  v.addColorStop(0, "rgba(15,22,32,0)");
  v.addColorStop(1, "rgba(15,22,32,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/** The Lock in wax seal (round, red wax with a gold-stamped star). */
export function seal(): HTMLCanvasElement {
  const s = 128;
  const [c, ctx] = canvas(s);
  const r = rand(5);
  ctx.beginPath();
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2, rr = s * (0.44 + r() * 0.05);
    ctx.lineTo(s / 2 + Math.cos(a) * rr, s / 2 + Math.sin(a) * rr);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(s * 0.4, s * 0.35, 4, s / 2, s / 2, s * 0.5);
  g.addColorStop(0, "#d4523e");
  g.addColorStop(1, "#7a1f16");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(60,10,6,0.8)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? s * 0.08 : i % 4 ? s * 0.15 : s * 0.24;
    ctx.lineTo(s / 2 + Math.cos(a) * rr, s / 2 + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = "#e3c77e";
  ctx.fill();
  return c;
}

export function menuPlaceholder(name: string): HTMLCanvasElement | null {
  if (name.startsWith("leader-")) return leaderPortrait(Number(name.slice(7)) - 1);
  if (name.startsWith("vista-")) return vista(name.slice(6));
  if (name === "seal") return seal();
  return null;
}

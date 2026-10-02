import type { House, Pattern } from "../map/houses";
import type { Art } from "./book";
import { canvas, type Ctx } from "./paint";

/**
 * House banners and shields: the base art (Nate's `banner-base` / `shield-base`, or the placeholder) with its light
 * cloth coloured in the House tincture, and the House pattern laid over the cloth only.
 */

/** Draw a heraldic pattern over the whole w x h area, in `ink`. */
export function drawPattern(ctx: Ctx, p: Pattern, w: number, h: number, ink: string) {
  ctx.save();
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  const t = Math.min(w, h) * 0.16;
  ctx.lineWidth = t;
  ctx.beginPath();
  switch (p) {
    case "plain":
      break;
    case "chevron":
      ctx.moveTo(0, h * 0.85);
      ctx.lineTo(w / 2, h * 0.35);
      ctx.lineTo(w, h * 0.85);
      ctx.stroke();
      break;
    case "pale":
      ctx.fillRect(w * 0.4, 0, w * 0.2, h);
      break;
    case "bend":
      ctx.moveTo(0, 0);
      ctx.lineTo(w, h);
      ctx.stroke();
      break;
    case "fess":
      ctx.fillRect(0, h * 0.4, w, h * 0.2);
      break;
    case "saltire":
      ctx.moveTo(0, 0);
      ctx.lineTo(w, h);
      ctx.moveTo(w, 0);
      ctx.lineTo(0, h);
      ctx.stroke();
      break;
    case "cross":
      ctx.fillRect(w * 0.42, 0, w * 0.16, h);
      ctx.fillRect(0, h * 0.4, w, h * 0.16);
      break;
    case "chief":
      ctx.fillRect(0, 0, w, h * 0.3);
      break;
    case "bordure":
      ctx.lineWidth = t * 1.1;
      ctx.strokeRect(0, 0, w, h);
      break;
    case "quarterly":
      ctx.fillRect(0, 0, w / 2, h / 2);
      ctx.fillRect(w / 2, h / 2, w / 2, h / 2);
      break;
  }
  ctx.restore();
}

/** Colour a white/grey tintable picture: the base, then its mask multiplied by the House colour, then the pattern on the cloth. */
export function tinted(art: Art, house: House, withPattern: boolean, size?: { w: number; h: number }): HTMLCanvasElement {
  const w = size?.w ?? art.image.width, h = size?.h ?? art.image.height;
  const [c, ctx] = canvas(w, h);
  ctx.drawImage(art.image, 0, 0, w, h);
  if (!art.tintMask) return c;
  // The cloth: mask x tincture.
  const [m, mctx] = canvas(w, h);
  mctx.drawImage(art.tintMask, 0, 0, w, h);
  mctx.globalCompositeOperation = "multiply";
  mctx.fillStyle = house.color;
  mctx.fillRect(0, 0, w, h);
  // Keep only the cloth's shape (multiply also painted the transparent area).
  mctx.globalCompositeOperation = "destination-in";
  mctx.drawImage(art.tintMask, 0, 0, w, h);
  if (withPattern && house.pattern !== "plain") {
    mctx.globalCompositeOperation = "source-atop";
    // Fit the pattern to the cloth's box, not the whole picture.
    const b = clothBox(mctx, w, h);
    mctx.translate(b.x, b.y);
    drawPattern(mctx, house.pattern, b.w, b.h, house.ink);
  }
  ctx.drawImage(m, 0, 0);
  return c;
}

function clothBox(ctx: Ctx, w: number, h: number) {
  const d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4 + 3]! > 40) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < x0 ? { x: 0, y: 0, w, h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

import type { MapDef } from "@conquerra/content";
import { Container, Sprite, Texture } from "pixi.js";
import { canvas } from "../../art/paint";
import { labelCurve, quadPoint } from "../../map/shapes";

/**
 * Names painted on the land: province names large and curved along the map maker's label lines, plus sea, lake
 * and mountain range names. Drawn once to small textures; they live in map space, so they grow as you zoom in
 * and fade out at Near zoom.
 */

const RES = 2.2; // texture pixels per map unit

function curvedText(text: string, path: readonly number[], size: number, opts: { fill: string; stroke: string; font: string; spacing: number }) {
  const [x0, y0, cx, cy, x1, y1] = labelCurve(path);
  // Arc length table for even letter spacing.
  const steps = 64;
  const pts = Array.from({ length: steps + 1 }, (_, i) => quadPoint(x0, y0, cx, cy, x1, y1, i / steps));
  const lens = [0];
  for (let i = 1; i <= steps; i++) lens.push(lens[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  const total = lens[steps]!;
  const at = (d: number) => {
    let i = 1;
    while (i < steps && lens[i]! < d) i++;
    const t = (i - 1 + (d - lens[i - 1]!) / Math.max(1e-6, lens[i]! - lens[i - 1]!)) / steps;
    return quadPoint(x0, y0, cx, cy, x1, y1, Math.max(0, Math.min(1, t)));
  };
  const pad = size * 1.2;
  const minX = Math.min(x0, x1, cx) - pad, maxX = Math.max(x0, x1, cx) + pad;
  const minY = Math.min(y0, y1, cy) - pad, maxY = Math.max(y0, y1, cy) + pad;
  const [c, ctx] = canvas((maxX - minX) * RES, (maxY - minY) * RES);
  ctx.scale(RES, RES);
  ctx.translate(-minX, -minY);
  ctx.font = `${opts.font} ${size}px Cinzel, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width + size * opts.spacing);
  const textLen = widths.reduce((a, b) => a + b, 0);
  let d = Math.max(0, (total - textLen) / 2);
  ctx.lineJoin = "round";
  for (let i = 0; i < chars.length; i++) {
    const [x, y, ang] = at(d + widths[i]! / 2);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.strokeStyle = opts.stroke;
    ctx.lineWidth = size * 0.22;
    ctx.strokeText(chars[i]!, 0, 0);
    ctx.fillStyle = opts.fill;
    ctx.fillText(chars[i]!, 0, 0);
    ctx.restore();
    d += widths[i]!;
  }
  return { canvas: c, x: minX, y: minY };
}

function straightText(text: string, x: number, y: number, size: number, opts: { fill: string; stroke: string; font: string }) {
  const [, mctx] = canvas(4, 4);
  mctx.font = `${opts.font} ${size}px Cinzel, serif`;
  const w = mctx.measureText(text).width + size;
  const h = size * 1.8;
  const [c, ctx] = canvas(w * RES, h * RES);
  ctx.scale(RES, RES);
  ctx.font = mctx.font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = opts.stroke;
  ctx.lineWidth = size * 0.24;
  ctx.strokeText(text, w / 2, h / 2);
  ctx.fillStyle = opts.fill;
  ctx.fillText(text, w / 2, h / 2);
  return { canvas: c, x: x - w / 2, y: y - h / 2 };
}

export interface MapLabels {
  provinces: Container;
  places: Container;
  destroy(): void;
}

export function buildLabels(map: MapDef, illustrated: boolean): MapLabels {
  const g = map.geometry!;
  const provinces = new Container();
  const places = new Container();
  const textures: Texture[] = [];
  const add = (layer: Container, l: { canvas: HTMLCanvasElement; x: number; y: number }) => {
    const t = Texture.from(l.canvas);
    textures.push(t);
    const s = new Sprite(t);
    s.position.set(l.x, l.y);
    s.scale.set(1 / RES);
    layer.addChild(s);
  };
  for (const pl of g.provinceLabels) {
    const name = map.provinces.find((p) => p.id === pl.id)?.name ?? "";
    if (!name) continue;
    const [x0, y0, , , x1, y1] = pl.path as [number, number, number, number, number, number];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const size = Math.max(13, Math.min(30, (len / Math.max(6, name.length)) * 1.05));
    add(
      provinces,
      curvedText(name.toUpperCase(), pl.path, size, illustrated
        ? { fill: "rgba(58,40,22,0.88)", stroke: "rgba(246,236,210,0.55)", font: "700", spacing: 0.22 }
        : { fill: "rgba(20,24,32,0.85)", stroke: "rgba(255,255,255,0.6)", font: "700", spacing: 0.22 }),
    );
  }
  for (const w of g.water)
    add(places, straightText(w.name, w.label.x, w.label.y, w.kind === "sea" ? 15 : 11, { fill: "rgba(225,240,250,0.9)", stroke: "rgba(15,40,70,0.55)", font: "italic 600" }));
  for (const m of g.mountains)
    add(places, straightText(m.name, m.label.x, m.label.y, 10, { fill: "rgba(250,246,236,0.95)", stroke: "rgba(40,30,20,0.75)", font: "600" }));
  return {
    provinces,
    places,
    destroy() {
      for (const t of textures) t.destroy(true);
      provinces.destroy({ children: true });
      places.destroy({ children: true });
    },
  };
}

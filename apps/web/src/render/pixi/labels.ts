import type { MapDef } from "@conquerra/content";
import { Container, Sprite, Texture } from "pixi.js";
import { canvas } from "../../art/paint";

/**
 * Names painted on the land: sea, lake and mountain range names. Drawn once to small textures; they live in map space,
 * so they grow as you zoom in. (Province names were painted here too until session 17; now they're the markers' small
 * names at Far, shown only where they fit, and the plaque of the province you tap.)
 */

const RES = 2.2; // texture pixels per map unit

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
  places: Container;
  /** Session 30, blackout fog: show only the names near land you've seen (`near` says whether a point is). */
  only(near: ((x: number, y: number) => boolean) | null): void;
  destroy(): void;
}

export function buildLabels(map: MapDef): MapLabels {
  const g = map.geometry!;
  const places = new Container();
  const textures: Texture[] = [];
  const at: { s: Sprite; x: number; y: number }[] = [];
  const add = (layer: Container, l: { canvas: HTMLCanvasElement; x: number; y: number }, x: number, y: number) => {
    const t = Texture.from(l.canvas);
    textures.push(t);
    const s = new Sprite(t);
    s.position.set(l.x, l.y);
    s.scale.set(1 / RES);
    layer.addChild(s);
    at.push({ s, x, y });
  };
  for (const w of g.water)
    add(places, straightText(w.name, w.label.x, w.label.y, w.kind === "sea" ? 15 : 11, { fill: "rgba(225,240,250,0.9)", stroke: "rgba(15,40,70,0.55)", font: "italic 600" }), w.label.x, w.label.y);
  for (const m of g.mountains)
    add(places, straightText(m.name, m.label.x, m.label.y, 10, { fill: "rgba(250,246,236,0.95)", stroke: "rgba(40,30,20,0.75)", font: "600" }), m.label.x, m.label.y);
  return {
    places,
    only(near) {
      for (const a of at) a.s.visible = !near || near(a.x, a.y);
    },
    destroy() {
      for (const t of textures) t.destroy(true);
      places.destroy({ children: true });
    },
  };
}

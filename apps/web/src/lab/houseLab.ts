import { TERRAIN_TEXTURES } from "@conquerra/art";
import { Application, Container, Graphics, Text, TilingSprite, Texture } from "pixi.js";
import { ArtBook } from "../art/book";
import { tinted } from "../art/heraldry";
import { canvas } from "../art/paint";
import { simulatePixels, type Vision } from "../map/colorblind";
import { HOUSES } from "../map/houses";
import { RealmLayer, type RealmInput } from "../render/pixi/realms";

/**
 * Check pages for the House colours, opened with `?lab=houses` (used by `pnpm map-check houses` for
 * docs/art/screens/houses.png and house-on-ground.png). Not part of the game.
 */

const REPEAT_UNITS = 170;

/** A wobbly square (looks like a territory), as a closed ring. */
function blob(x: number, y: number, w: number, h: number, seed: number): number[] {
  const pts: number[] = [];
  const n = 40;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const side = Math.floor(t * 4), f = (t * 4) % 1;
    const wob = Math.sin(t * 37 + seed) * 3 + Math.sin(t * 91 + seed * 2) * 1.5;
    const [px, py] = side === 0 ? [x + f * w, y + wob] : side === 1 ? [x + w - wob, y + f * h] : side === 2 ? [x + w - f * w, y + h - wob] : [x + wob, y + h - f * h];
    pts.push(px, py);
  }
  return pts;
}

async function houseOnGround(host: HTMLElement, art: ArtBook) {
  const CELL = 120, GAP = 6, LEFT = 90, TOP = 34;
  const cols = TERRAIN_TEXTURES.length, rows = HOUSES.length;
  const closeW = 520;
  const W = LEFT + cols * (CELL + GAP) + 30 + closeW, H = TOP + rows * (CELL + GAP) + 10;
  const app = new Application();
  await app.init({ width: W, height: H, background: "#0f1620", antialias: true, preference: "webgl" });
  host.appendChild(app.canvas);
  const grounds = TERRAIN_TEXTURES.map((n) => Texture.from(art.get(n)!.image));
  const realms: RealmInput[] = [];
  const stage = new Container();
  app.stage.addChild(stage);
  const label = (text: string, x: number, y: number, size = 13, anchor = 0) => {
    const t = new Text({ text, style: { fontFamily: "Cinzel, serif", fontWeight: "700", fontSize: size, fill: "#EDE6D6" } });
    t.anchor.set(anchor, 0.5);
    t.position.set(x, y);
    app.stage.addChild(t);
  };
  TERRAIN_TEXTURES.forEach((n, c) => label(n.replace("terrain-", ""), LEFT + c * (CELL + GAP) + CELL / 2, TOP / 2, 13, 0.5));
  HOUSES.forEach((h, r) => {
    label(h.name, 8, TOP + r * (CELL + GAP) + CELL / 2);
    TERRAIN_TEXTURES.forEach((_, c) => {
      const x = LEFT + c * (CELL + GAP), y = TOP + r * (CELL + GAP);
      const g = new TilingSprite({ texture: grounds[c]!, width: CELL, height: CELL });
      g.position.set(x, y);
      g.tileScale.set(REPEAT_UNITS / grounds[c]!.width);
      stage.addChild(g);
      const ringPts = blob(x + 12, y + 12, CELL - 24, CELL - 24, r * 7 + c);
      realms.push({ house: h, outlines: [[...ringPts, ringPts[0]!, ringPts[1]!]], territories: [[ringPts]] });
    });
  });
  const layer = new RealmLayer();
  layer.setRealms(realms);
  layer.draw(1);
  app.stage.addChild(layer.root);

  // Close-up: two Houses meeting on grass, at about Near zoom (2.4x).
  const cx = LEFT + cols * (CELL + GAP) + 30, cy = TOP;
  const close = new Container();
  close.position.set(cx, cy);
  close.scale.set(2.4);
  const cw = closeW / 2.4, ch = (H - TOP - 10) / 2.4;
  const g = new TilingSprite({ texture: grounds[0]!, width: cw, height: ch });
  g.tileScale.set(REPEAT_UNITS / grounds[0]!.width);
  close.addChild(g);
  // Two territories sharing one wobbly edge down the middle.
  const edge: number[] = [];
  for (let i = 0; i <= 20; i++) edge.push(cw / 2 + Math.sin(i * 0.9) * 6, 10 + ((ch - 20) * i) / 20);
  const left = [10, 10, ...edge, 10, ch - 10];
  const rightRing = [...edge, cw - 10, ch - 10, cw - 10, 10];
  const closeRealms = new RealmLayer();
  closeRealms.setRealms([
    { house: HOUSES[0]!, outlines: [[...left, left[0]!, left[1]!]], territories: [[left]] },
    { house: HOUSES[1]!, outlines: [[...rightRing, rightRing[0]!, rightRing[1]!]], territories: [[rightRing]] },
  ]);
  closeRealms.draw(1 / 2.4);
  close.addChild(closeRealms.root);
  const m = new Graphics().rect(0, 0, cw, ch).fill(0xffffff);
  close.addChild(m);
  close.mask = m;
  app.stage.addChild(close);
  label("Azure meets Gules (close-up)", cx + closeW / 2, H - 16, 13, 0.5);
  app.render();
}

function housesSwatch(host: HTMLElement, art: ArtBook) {
  const ROW = 46, COLW = 250, TOP = 34;
  const visions: Vision[] = ["normal", "deuteranopia", "protanopia"];
  const [c, ctx] = canvas(COLW * 3 + 110, TOP + ROW * HOUSES.length + 10);
  ctx.fillStyle = "#0f1620";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = "700 14px Cinzel, serif";
  ctx.textBaseline = "middle";
  // Normal column first, then copy it through each simulation.
  const grass = art.get("terrain-grass")!.image;
  HOUSES.forEach((h, i) => {
    const y = TOP + i * ROW;
    ctx.fillStyle = "#EDE6D6";
    ctx.fillText(h.name, 8, y + ROW / 2);
    const x = 110;
    // Tactical (flat), Far zoom (strong tint over the painted land), the band, and the shield with its pattern.
    ctx.fillStyle = h.color;
    ctx.fillRect(x, y + 6, 54, ROW - 12);
    ctx.drawImage(grass, 0, 0, 64, 64, x + 60, y + 6, 70, ROW - 12);
    ctx.globalAlpha = 0.42;
    ctx.fillRect(x + 60, y + 6, 70, ROW - 12);
    ctx.globalAlpha = 1;
    ctx.fillRect(x + 60, y + 6, 70, 5);
    const shield = tinted(art.get("shield-base")!, h, true, { w: 36, h: 36 });
    ctx.drawImage(shield, x + 140, y + 5, 36, 36);
  });
  const src = ctx.getImageData(110, TOP, COLW, ROW * HOUSES.length);
  visions.forEach((v, k) => {
    const copy = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
    simulatePixels(copy.data, v);
    ctx.putImageData(copy, 110 + k * COLW, TOP);
    ctx.fillStyle = "#C9A45C";
    ctx.fillText(v === "normal" ? "Normal vision" : v === "deuteranopia" ? "Deuteranopia" : "Protanopia", 110 + k * COLW, TOP / 2);
  });
  c.id = "houses-swatch";
  host.appendChild(c);
}

export async function runHouseLab(root: HTMLElement) {
  document.body.style.background = "#0f1620";
  await document.fonts.load("700 14px Cinzel");
  const art = await ArtBook.load();
  const a = document.createElement("div");
  a.id = "houses";
  const b = document.createElement("div");
  b.id = "house-on-ground";
  root.append(a, b);
  housesSwatch(a, art);
  await houseOnGround(b, art);
  document.body.dataset.ready = "1";
}

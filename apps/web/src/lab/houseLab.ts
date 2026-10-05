import { ArtBook } from "../art/book";
import { tinted } from "../art/heraldry";
import { canvas } from "../art/paint";
import { simulatePixels, type Vision } from "../map/colorblind";
import { HOUSES } from "../map/houses";

/**
 * The House colours as players with normal and colour-blind vision see them (Tactical, Far tint, shield).
 * Shown on the art test bench (`?lab=bench&part=redo`). The House-on-ground grid is the bench's first part.
 */

export function housesSwatch(host: HTMLElement, art: ArtBook) {
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


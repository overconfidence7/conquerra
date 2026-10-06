/**
 * Turn a black-and-white picture into a map silhouette (a "mask").
 *
 *   pnpm --filter @conquerra/mapgen mask path/to/picture.png wolf "The Wolf"
 *
 * Black (or any dark colour) is land, white (or see-through) is sea. Any size works: it's trimmed to the drawing
 * (plus a small margin) and shrunk to 160 squares across. It writes masks/<id>.json and tells you the one line to add to src/masks.ts. Then pick it in the map lab
 * (Shape: Silhouette) or in a recipe with `shape: "mask", mask: "<id>"`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const [file, id, name] = process.argv.slice(2);
if (!file || !id) {
  console.log('Usage: pnpm --filter @conquerra/mapgen mask <picture.png> <id> "<Name>"');
  process.exit(1);
}
const COLS = 160;
// Cropped to the drawing, with a small white margin, so empty paper around it doesn't become extra sea.
const src = sharp(resolve(process.env.INIT_CWD ?? process.cwd(), file)).flatten({ background: "#ffffff" }).greyscale();
const full = await src.raw().toBuffer({ resolveWithObject: true });
const W = full.info.width, H = full.info.height, C = full.info.channels;
let x0 = W, y0 = H, x1 = -1, y1 = -1;
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++)
    if (full.data[(y * W + x) * C]! < 128) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
const box = { left: Math.max(0, x0 - pad), top: Math.max(0, y0 - pad), width: 0, height: 0 };
box.width = Math.min(W, x1 + pad + 1) - box.left;
box.height = Math.min(H, y1 + pad + 1) - box.top;
const img = sharp(full.data, { raw: { width: W, height: H, channels: C } }).extract(box).greyscale();
const meta = box;
const rows = Math.max(8, Math.round((COLS * meta.height!) / meta.width!));
const { data } = await img.resize(COLS, rows, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
const lines: string[] = [];
let land = 0;
for (let r = 0; r < rows; r++) {
  let line = "";
  for (let c = 0; c < COLS; c++) {
    const dark = data[r * COLS + c]! < 128;
    line += dark ? "#" : ".";
    if (dark) land++;
  }
  lines.push(line);
}
const out = join(dirname(fileURLToPath(import.meta.url)), "../masks");
mkdirSync(out, { recursive: true });
const mask = { id, name: name ?? id, aspect: Math.round((COLS / rows) * 1000) / 1000, rows: lines };
writeFileSync(join(out, `${id}.json`), JSON.stringify(mask, null, 1) + "\n");
console.log(`Saved masks/${id}.json (${COLS} x ${rows}, ${Math.round((100 * land) / (COLS * rows))}% land).`);
if (land / (COLS * rows) < 0.15) console.log("  That's not much land: is the picture black land on white?");
console.log(`Now add it to IMAGE_MASKS in packages/mapgen/src/masks.ts:\n  import ${id.replace(/\W/g, "_")} from "../masks/${id}.json";\n  export const IMAGE_MASKS: MaskDef[] = [${id.replace(/\W/g, "_")}];`);

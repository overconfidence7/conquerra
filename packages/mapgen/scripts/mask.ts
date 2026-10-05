/**
 * Turn a black-and-white picture into a map silhouette (a "mask").
 *
 *   pnpm --filter @conquerra/mapgen mask path/to/picture.png wolf "The Wolf"
 *
 * Black (or any dark colour) is land, white (or see-through) is sea. Any size works; it's shrunk to 160 squares
 * across. It writes masks/<id>.json and tells you the one line to add to src/masks.ts. Then pick it in the map lab
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
const img = sharp(resolve(process.env.INIT_CWD ?? process.cwd(), file)).flatten({ background: "#ffffff" }).greyscale();
const meta = await img.metadata();
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

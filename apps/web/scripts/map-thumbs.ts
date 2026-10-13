/**
 * The lobby's map pictures (session 25b): each official map's ground, shrunk to a small grid (about 72 cells across)
 * and run-length coded ("O14g3f2..."), written to public/maps/thumbs.json. The lobby fetches it after it's on screen
 * and paints the chosen map's picture from it, so the start-up bundle doesn't grow and no map has to load to show one.
 * Run after the maps change: `pnpm map-thumbs` (a test checks it matches the maps).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mapThumbs } from "../src/logic/mapThumb";

const out = join(dirname(fileURLToPath(import.meta.url)), "../public/maps/thumbs.json");
mkdirSync(dirname(out), { recursive: true });
const thumbs = await mapThumbs();
writeFileSync(out, `${JSON.stringify(thumbs)}\n`);
console.log(`${Object.keys(thumbs).length} map pictures, ${(JSON.stringify(thumbs).length / 1024).toFixed(1)} KB: ${out}`);

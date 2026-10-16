/**
 * Session 30: a contact sheet of random maps (the map maker's debug pictures: ground, borders, names, capitals, passes,
 * lanes), to look for what reads wrong (a label on water, a capital on a cut-off island, a range through a province).
 *
 *   pnpm --filter @conquerra/mapgen exec tsx scripts/random-gallery.ts <size> <n> <out.png> [--start 0] [--shapes a,b]
 * Seeds come from seedWords(start...), the shapes in turn. Prints which try passed and why any seed made no map.
 */
import { writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { defaultRules } from "@conquerra/content";
import { mapPreviewSvg, randomMap, randomMapId, RANDOM_SHAPE_IDS, seedWords, type RandomShape, type RandomSize } from "../src/index";

const [size, n, out] = process.argv.slice(2) as [string, string, string];
const si = process.argv.indexOf("--start");
const start = si >= 0 ? Number(process.argv[si + 1]) : 0;
const sh = process.argv.indexOf("--shapes");
const shapes = (sh >= 0 ? process.argv[sh + 1]!.split(",") : RANDOM_SHAPE_IDS) as RandomShape[];
const cells: string[] = [];
const W = 760, cols = 2;
let H = 0;
for (let i = 0; i < Number(n); i++) {
  const id = randomMapId(Number(size) as RandomSize, shapes[i % shapes.length]!, seedWords(start + i));
  try {
    const { map, attempt } = randomMap(id, defaultRules);
    const svg = mapPreviewSvg({ ...map, name: id });
    const g = map.geometry!;
    const h = Math.round((W * g.height) / g.width);
    H = Math.max(H, h);
    cells.push(svg.replace(/^<svg [^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.width} ${g.height}" width="${W}" height="${h}" x="X" y="Y">`));
    console.log(`${id}: try ${attempt}`);
  } catch (e) {
    console.log(`${id}: no map (${(e as Error).message})`);
  }
}
const rows = Math.ceil(cells.length / cols);
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * cols}" height="${H * rows}"><rect width="100%" height="100%" fill="#222"/>${cells.map((c, i) => c.replace('x="X"', `x="${(i % cols) * W}"`).replace('y="Y"', `y="${Math.floor(i / cols) * H}"`)).join("\n")}</svg>`;
writeFileSync(out, new Resvg(sheet, { fitTo: { mode: "width", value: W * cols }, font: { loadSystemFonts: true } }).render().asPng());
console.log(`wrote ${out}`);

/**
 * Side-by-side before/after pictures: every picture found in both folders becomes one JPEG in the output folder,
 * the "before" on the left and the "after" on the right, each with its label.
 *
 *   pnpm --filter @conquerra/art exec tsx scripts/compare.ts <before folder> <after folder> <out folder> "<before label>" "<after label>" [prefix]
 *
 * Used for each art batch: the bench's old set against `pnpm map-check bench`'s new one (prefix "bench-"), and
 * map shots taken with `apps/web/scripts/shot.mjs` before and after.
 */
import { mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";

const [beforeDir, afterDir, outDir, beforeLabel = "Before", afterLabel = "After", prefix = ""] = process.argv.slice(2);
if (!beforeDir || !afterDir || !outDir) {
  console.log('Usage: compare.ts <before folder> <after folder> <out folder> "<before label>" "<after label>" [prefix]');
  process.exit(1);
}
const at = (d: string) => resolve(process.env.INIT_CWD ?? process.cwd(), d);
mkdirSync(at(outDir), { recursive: true });
const HALF = 900, HEAD = 38, GAP = 12;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const label = (text: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${HALF}" height="${HEAD}"><text x="10" y="27" font-family="Georgia, serif" font-weight="700" font-size="22" fill="#e3c77e">${esc(text)}</text></svg>`);

const after = new Set(readdirSync(at(afterDir)).filter((f) => /\.png$/i.test(f)));
let n = 0;
for (const f of readdirSync(at(beforeDir)).filter((f) => after.has(f))) {
  const half = async (dir: string) => sharp(join(at(dir), f)).resize({ width: HALF }).png().toBuffer({ resolveWithObject: true });
  const [b, a] = await Promise.all([half(beforeDir), half(afterDir)]);
  const h = Math.max(b.info.height, a.info.height);
  await sharp({ create: { width: HALF * 2 + GAP, height: h + HEAD, channels: 3, background: "#0e141e" } })
    .composite([
      { input: label(beforeLabel), left: 0, top: 0 },
      { input: label(afterLabel), left: HALF + GAP, top: 0 },
      { input: b.data, left: 0, top: HEAD },
      { input: a.data, left: HALF + GAP, top: HEAD },
    ])
    .jpeg({ quality: 82 })
    .toFile(join(at(outDir), `${prefix}${f.replace(/\.png$/i, ".jpg")}`));
  n++;
}
console.log(`${n} side-by-side pictures in ${outDir}`);

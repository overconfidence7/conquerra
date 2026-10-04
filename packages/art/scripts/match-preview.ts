/**
 * Before and after for the art matching (palette.ts): docs/art/screens/art-matching-before-after.png.
 * Each ground texture is shown repeated 2x2 (so baked-in shading and repeats are easy to spot), before and after.
 *
 *   pnpm --filter @conquerra/art exec tsx scripts/match-preview.ts           -> just the picture
 *   pnpm --filter @conquerra/art exec tsx scripts/match-preview.ts --apply   -> also update the game's textures
 *
 * Normally you don't need --apply: `pnpm art:import` does the matching on the originals in art/incoming.
 * --apply is for textures imported before matching existed, when the originals aren't to hand.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp, { type OverlayOptions } from "sharp";
import { flattenLighting, makeSeamless, matchColour, type Rgba } from "../src/import";
import { GROUND_TARGETS } from "../src/palette";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const artDir = join(root, "apps/web/public/art");
const apply = process.argv.includes("--apply");
const incoming = join(root, "art/incoming");
/** Nate's original for a texture, if it's on this computer (squared and made seamless, nothing else). */
const original = async (name: string): Promise<Rgba | null> => {
  const file = ["png", "jpg", "jpeg", "webp"].map((e) => join(incoming, `${name}.${e}`)).find(existsSync);
  if (!file || apply) return null;
  const meta = await sharp(file).metadata();
  const side = Math.min(meta.width!, meta.height!);
  const { data, info } = await sharp(file).extract({ left: Math.floor((meta.width! - side) / 2), top: Math.floor((meta.height! - side) / 2), width: side, height: side }).resize(512, 512).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return makeSeamless({ data, width: info.width, height: info.height });
};
const T = 192; // one repeat in the picture

const manifest = JSON.parse(readFileSync(join(artDir, "manifest.json"), "utf8")) as { assets: Record<string, { file: string }> };
const names = Object.keys(GROUND_TARGETS).filter((n) => manifest.assets[n] && existsSync(join(artDir, manifest.assets[n]!.file)));
if (!names.length) throw new Error("No imported ground textures to compare.");

const toRaw = async (file: string): Promise<Rgba> => {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
};
const png = (img: Rgba) => sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), { raw: { width: img.width, height: img.height, channels: 4 } });
const tile2x2 = async (img: Rgba) => {
  const one = await png(img).resize(T, T).png().toBuffer();
  return sharp({ create: { width: T * 2, height: T * 2, channels: 4, background: "#000" } })
    .composite([0, 1, 2, 3].map((i) => ({ input: one, left: (i % 2) * T, top: Math.floor(i / 2) * T })))
    .png()
    .toBuffer();
};

const LABEL = 150, HEAD = 40, GAP = 12;
const W = LABEL + 2 * (2 * T) + GAP * 2, H = HEAD + names.length * (2 * T + GAP);
const parts: OverlayOptions[] = [];
const text: string[] = [];
let y = HEAD;
for (const n of names) {
  const file = join(artDir, manifest.assets[n]!.file);
  // With Nate's originals here: before = the original, after = exactly what the game uses (imported by art:import).
  // Without them: the game's texture, and what one more pass of matching would do to it.
  const orig = await original(n);
  const before = orig ?? (await toRaw(file));
  const after: Rgba = orig ? await toRaw(file) : { data: new Uint8ClampedArray(before.data), width: before.width, height: before.height };
  const t = GROUND_TARGETS[n]!;
  if (!orig) {
    if (t.flatten) flattenLighting(after, t.flatten);
    matchColour(after, t);
  }
  parts.push({ input: await tile2x2(before), left: LABEL, top: y }, { input: await tile2x2(after), left: LABEL + 2 * T + GAP, top: y });
  text.push(`<text x="10" y="${y + T}" font-family="serif" font-size="18" fill="#EDE6D6">${n.replace("terrain-", "")}</text>`);
  if (apply) await png(after).webp({ quality: 86 }).toFile(file + ".tmp"), writeFileSync(file, readFileSync(file + ".tmp")), (await import("node:fs")).rmSync(file + ".tmp");
  y += 2 * T + GAP;
}
text.push(`<text x="${LABEL + T}" y="26" text-anchor="middle" font-family="serif" font-size="20" fill="#C9A45C">Before</text>`);
text.push(`<text x="${LABEL + 3 * T + GAP}" y="26" text-anchor="middle" font-family="serif" font-size="20" fill="#C9A45C">After (evened out and colour matched)</text>`);
parts.push({ input: Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${text.join("")}</svg>`), left: 0, top: 0 });
const out = join(root, "docs/art/screens/art-matching-before-after.png");
await sharp({ create: { width: W, height: H, channels: 4, background: "#0F1620" } }).composite(parts).png().toFile(out);
console.log(`Saved ${out}${apply ? " and updated the game's textures" : ""}.`);

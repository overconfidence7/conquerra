/**
 * Session 19: twelve map pictures (from try-maps --out) side by side, one gallery image.
 *   node apps/web/scripts/s19-gallery.mjs <folder of try-maps pictures> <out.png> "<title>"
 */
import { createRequire } from "node:module";
import { readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
const sharp = createRequire(join(root, "packages/art/package.json"))("sharp");
const [dir, out, title] = process.argv.slice(2);
const W = 400, H = 280, cols = 4;
const cells = [];
for (let i = 1; i <= 12; i++) {
  const f = readdirSync(dir).find((x) => x.endsWith(`-${i}.png`));
  const label = `<svg width="${W}" height="24"><rect width="${W}" height="24" fill="#101820"/><text x="8" y="17" font-family="Arial" font-size="15" fill="#fff">Seed ${i}${f ? "" : " — failed the checks"}</text></svg>`;
  const img = f ? await sharp(join(dir, f)).resize(W, H - 24, { fit: "contain", background: "#1a2a3a" }).toBuffer() : await sharp({ create: { width: W, height: H - 24, channels: 3, background: "#333" } }).png().toBuffer();
  cells.push({ input: Buffer.from(label), left: ((i - 1) % cols) * W, top: Math.floor((i - 1) / cols) * H + 40 });
  cells.push({ input: img, left: ((i - 1) % cols) * W, top: Math.floor((i - 1) / cols) * H + 64 });
}
const head = `<svg width="${W * cols}" height="40"><rect width="${W * cols}" height="40" fill="#0b1118"/><text x="10" y="27" font-family="Arial" font-size="20" fill="#f0d9a0">${title}</text></svg>`;
await sharp({ create: { width: W * cols, height: H * 3 + 40, channels: 3, background: "#0b1118" } }).composite([{ input: Buffer.from(head), left: 0, top: 0 }, ...cells]).png().toFile(out);
console.log("saved", out);

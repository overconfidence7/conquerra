/**
 * The installable app's icons (the gold emblem on navy): apps/web/public/icons/*.png.
 * Uses Nate's emblem art if it has been imported, else draws the placeholder emblem. Run:
 *   pnpm --filter @conquerra/art exec tsx scripts/app-icons.ts
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const outDir = join(root, "apps/web/public/icons");
mkdirSync(outDir, { recursive: true });

const manifestPath = join(root, "apps/web/public/art/manifest.json");
const manifest = existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, "utf8")) as { assets: Record<string, { file: string }> }) : { assets: {} };
const real = manifest.assets.emblem ? join(root, "apps/web/public/art", manifest.assets.emblem.file) : null;

/** The placeholder emblem: a sixteen-point gold star with an ink outline (same as the game's). */
function star(size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.16 : i % 4 ? 0.3 : 0.46;
    pts.push(`${(0.5 + Math.cos(a) * r) * size},${(0.5 + Math.sin(a) * r) * size}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="#e3c77e" stroke="#1b1206" stroke-width="${size * 0.03}" stroke-linejoin="round"/>`;
}

async function icon(size: number, file: string, safe: number) {
  // Navy square with a fine double gold rule; the emblem fills the "safe" share in the middle (maskable icons crop).
  const inner = Math.round(size * safe);
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="#0f1620"/>` +
      (safe < 0.7 ? "" : `<rect x="${size * 0.04}" y="${size * 0.04}" width="${size * 0.92}" height="${size * 0.92}" rx="${size * 0.12}" fill="none" stroke="#c9a45c" stroke-width="${size * 0.012}"/>`) +
      `</svg>`,
  );
  const emblem = real
    ? await sharp(real).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    : Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${inner}" height="${inner}">${star(inner)}</svg>`);
  const off = Math.round((size - inner) / 2);
  await sharp(bg).composite([{ input: emblem, left: off, top: off }]).png().toFile(join(outDir, file));
}

await icon(192, "icon-192.png", 0.78);
await icon(512, "icon-512.png", 0.78);
await icon(512, "icon-maskable-512.png", 0.56);
await icon(180, "apple-touch-icon.png", 0.74);
await icon(64, "favicon-64.png", 0.9);
console.log(`App icons saved to apps/web/public/icons/ (${real ? "from Nate's emblem" : "placeholder emblem"}).`);

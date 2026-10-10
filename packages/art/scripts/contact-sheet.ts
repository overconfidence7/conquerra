/**
 * Contact sheets of imported art (session 21): each piece over three grounds (grass, the navy menus, sand), blended
 * the way the game draws it, so soft edges, fringes and cut-outs can be judged at a glance.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp, { type Blend, type OverlayOptions } from "sharp";
import { ASSET_BY_NAME, type ArtManifest } from "../src/registry";

const CELL = 220;
const GROUNDS = [
  { r: 93, g: 122, b: 58 },
  { r: 23, g: 34, b: 49 },
  { r: 201, g: 180, b: 138 },
];
const BLEND: Record<string, Blend> = { normal: "over", add: "add", screen: "screen" };

export async function contactSheet(manifest: ArtManifest, artDir: string, names: readonly string[], out: string, cols = 8): Promise<number> {
  const shown = names.filter((n) => manifest.assets[n] && existsSync(join(artDir, manifest.assets[n]!.file)));
  if (!shown.length) return 0;
  const rows = Math.ceil(shown.length / cols);
  const W = cols * CELL, H = rows * (CELL + 22);
  const layers: OverlayOptions[] = [];
  // Three ground strips under every cell.
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      GROUNDS.forEach((g, k) =>
        layers.push({
          input: { create: { width: CELL, height: Math.ceil(CELL / 3), channels: 4, background: { ...g, alpha: 1 } } },
          left: c * CELL,
          top: r * (CELL + 22) + Math.round((k * CELL) / 3),
        }),
      );
  for (const [i, name] of shown.entries()) {
    const e = manifest.assets[name]!;
    const spec = ASSET_BY_NAME.get(name);
    const k = Math.min(1, (CELL - 16) / Math.max(e.width, e.height));
    const w = Math.max(1, Math.round(e.width * k)), h = Math.max(1, Math.round(e.height * k));
    const img = await sharp(join(artDir, e.file)).resize(w, h).png().toBuffer();
    const x = (i % cols) * CELL, y = Math.floor(i / cols) * (CELL + 22);
    layers.push({ input: img, left: x + Math.round((CELL - w) / 2), top: y + Math.round((CELL - h) / 2), blend: BLEND[spec?.blend ?? "normal"] ?? "over" });
    const label = `${name}${spec?.blend && spec.blend !== "normal" ? ` (${spec.blend})` : ""}`;
    const svg = `<svg width="${CELL}" height="22" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0f1620"/><text x="6" y="15" font-family="Segoe UI, sans-serif" font-size="13" fill="#ede6d6">${label}</text></svg>`;
    layers.push({ input: Buffer.from(svg), left: x, top: y + CELL });
  }
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 15, g: 22, b: 32, alpha: 1 } } }).composite(layers).png().toFile(out);
  return shown.length;
}

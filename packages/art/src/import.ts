/**
 * The art import: turns Nate's AI art in `art/incoming/` into game-ready WebP files plus the art manifest.
 *   - sprites and icons: cut out a flat magenta (#FF00FF) background, trim the empty edges, resize
 *   - ground and water textures: crop square, resize, and make them tile seamlessly
 *   - tinted art (shields, banners, flags, army figures): also writes a mask of the light grey parts,
 *     which the game colours with each House's tincture
 * Node only (uses sharp). Run it with `pnpm art:import`.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import sharp, { type Sharp } from "sharp";
import { ASSETS, ASSET_BY_NAME, type ArtManifest, type AssetSpec } from "./registry";

// Don't hold files open after reading them (Windows locks open files, which blocks Nate re-saving art).
sharp.cache(false);

const IMAGE_TYPES = new Set([".png", ".jpg", ".jpeg", ".webp"]);
/** Files that can sit in the folder without being art. */
const IGNORED = new Set([".gitkeep", "readme.md", "readme.txt", "thumbs.db", "desktop.ini", ".ds_store"]);

export type NameMatch =
  | { kind: "ok"; spec: AssetSpec; /** Set when the name only matched after tidying it (case, spaces, underscores). */ readAs?: string }
  | { kind: "ignored" }
  | { kind: "notImage" }
  | { kind: "unknown"; suggestion?: string };

function levenshtein(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
}

/** Which asset a file in art/incoming is, by its name. Forgiving about case, spaces and underscores. */
export function matchFileName(file: string): NameMatch {
  if (IGNORED.has(file.toLowerCase())) return { kind: "ignored" };
  const ext = extname(file).toLowerCase();
  if (!IMAGE_TYPES.has(ext)) return { kind: "notImage" };
  const stem = file.slice(0, file.length - ext.length);
  const exact = ASSET_BY_NAME.get(stem);
  if (exact) return { kind: "ok", spec: exact };
  const tidy = stem
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    // "tree-conifer1" -> "tree-conifer-1", "leader-3" -> "leader-03"
    .replace(/([a-z])(\d+)$/, "$1-$2")
    .replace(/^leader-(\d)$/, "leader-0$1");
  const tidied = ASSET_BY_NAME.get(tidy);
  if (tidied) return { kind: "ok", spec: tidied, readAs: tidy };
  let best: string | undefined;
  let bestD = 4;
  for (const a of ASSETS) {
    const dist = levenshtein(tidy, a.name);
    if (dist < bestD) (bestD = dist), (best = a.name);
  }
  return best ? { kind: "unknown", suggestion: best } : { kind: "unknown" };
}

// ---------- Pixel work (on raw RGBA buffers, so it's easy to test) ----------

export interface Rgba {
  data: Uint8ClampedArray | Buffer;
  width: number;
  height: number;
}

const MAGENTA_DIST = (r: number, g: number, b: number) => Math.sqrt((255 - r) ** 2 + g ** 2 + (255 - b) ** 2);

/** Does the image sit on a flat magenta background? (At least 3 of the 4 corners are magenta.) */
export function hasMagentaBackground(img: Rgba): boolean {
  const { data, width: w, height: h } = img;
  let n = 0;
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]] as const) {
    const i = (y * w + x) * 4;
    if (data[i + 3]! > 200 && MAGENTA_DIST(data[i]!, data[i + 1]!, data[i + 2]!) < 90) n++;
  }
  return n >= 3;
}

/**
 * Make magenta see-through, with soft edges, and take the pink fringe off the edge pixels.
 * Changes `img` in place. Returns how many pixels became fully transparent.
 */
export function cutOutMagenta(img: Rgba): number {
  const { data } = img;
  let cleared = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    const dist = MAGENTA_DIST(r, g, b);
    if (dist >= 150) continue;
    // 0 at pure magenta, 1 once clearly a different colour.
    const keep = Math.max(0, Math.min(1, (dist - 45) / 105));
    if (keep === 0) cleared++;
    data[i + 3] = Math.round(data[i + 3]! * keep);
    // De-spill: pull red and blue down toward green, so edges aren't pink.
    const spill = Math.max(0, Math.min(r, b) - g) * (1 - keep);
    data[i] = r - spill;
    data[i + 2] = b - spill;
  }
  return cleared;
}

/** The smallest box holding every pixel that isn't (nearly) transparent, with a little padding. */
export function opaqueBounds(img: Rgba, pad = 2): { left: number; top: number; width: number; height: number } | null {
  const { data, width: w, height: h } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3]! > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/**
 * Make a square texture tile seamlessly: blend it with a copy shifted by half its size. The copy has no seam at
 * the edges, the original has none in the middle, and the blend uses each where it's seamless.
 */
export function makeSeamless(img: Rgba): Rgba {
  const { data, width: s } = img;
  const out = new Uint8ClampedArray(data.length);
  const half = s >> 1;
  for (let y = 0; y < s; y++) {
    const ey = Math.abs((2 * y) / (s - 1) - 1);
    for (let x = 0; x < s; x++) {
      const ex = Math.abs((2 * x) / (s - 1) - 1);
      const e = Math.max(ex, ey);
      // Smoothly from the original (centre) to the shifted copy (edges).
      const t = Math.max(0, Math.min(1, (e - 0.45) / 0.5));
      const m = t * t * (3 - 2 * t);
      const i = (y * s + x) * 4;
      const j = (((y + half) % s) * s + ((x + half) % s)) * 4;
      for (let c = 0; c < 4; c++) out[i + c] = data[i + c]! * (1 - m) + data[j + c]! * m;
    }
  }
  return { data: out, width: s, height: s };
}

/**
 * For tinted art: the light, colourless parts (the white/grey cloth), as greyscale with alpha. The game draws this
 * over the original, coloured with the House tincture, so shading is kept.
 */
export function tintMask(img: Rgba): Rgba {
  const { data } = img;
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const w = Math.max(0, Math.min(1, (0.28 - sat) / 0.14)) * Math.max(0, Math.min(1, (lum - 0.3) / 0.2));
    const v = Math.round(Math.min(1, lum * 1.15) * 255);
    out[i] = out[i + 1] = out[i + 2] = v;
    out[i + 3] = Math.round(data[i + 3]! * w);
  }
  return { data: out, width: img.width, height: img.height };
}

// ---------- The import ----------

export interface ImportReport {
  imported: { file: string; asset: string; note?: string }[];
  /** Files whose name isn't one the game knows. */
  unknown: { file: string; suggestion?: string }[];
  /** Imported, but worth a look (too small, cropped, not square...). */
  warnings: string[];
  /** Asset names with no file yet (the game shows a placeholder). */
  missing: AssetSpec[];
}

export interface ImportOptions {
  incomingDir: string;
  outDir: string;
}

const raw = async (s: Sharp): Promise<Rgba> => {
  const { data, info } = await s.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
};
const fromRaw = (img: Rgba) => sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), { raw: { width: img.width, height: img.height, channels: 4 } });

export async function importArt({ incomingDir, outDir }: ImportOptions): Promise<{ manifest: ArtManifest; report: ImportReport }> {
  const manifest: ArtManifest = { version: 1, assets: {} };
  const report: ImportReport = { imported: [], unknown: [], warnings: [], missing: [] };
  mkdirSync(outDir, { recursive: true });
  const files = readdirSync(incomingDir).sort();

  for (const file of files) {
    const m = matchFileName(file);
    if (m.kind === "ignored") continue;
    if (m.kind === "notImage") {
      report.unknown.push({ file });
      continue;
    }
    if (m.kind === "unknown") {
      report.unknown.push(m.suggestion ? { file, suggestion: m.suggestion } : { file });
      continue;
    }
    const spec = m.spec;
    if (manifest.assets[spec.name]) {
      report.warnings.push(`${file}: there's already a file for "${spec.name}", so this one was skipped.`);
      continue;
    }
    const notes: string[] = [];
    if (m.readAs) notes.push(`read as ${m.readAs}`);
    const src = sharp(join(incomingDir, file));
    const meta = await src.metadata();
    const w0 = meta.width ?? 0, h0 = meta.height ?? 0;
    if (Math.max(w0, h0) < spec.minSource)
      report.warnings.push(`${file} is only ${w0}×${h0}. It works, but it will look blurry; ${spec.minSource}×${spec.minSource} or bigger is best.`);

    const outName = `${spec.name}.webp`;
    let width: number, height: number;
    let tintFile: string | undefined;

    if (spec.kind === "texture") {
      if (w0 !== h0) notes.push(`cropped to a square from ${w0}×${h0}`);
      const side = Math.min(w0, h0);
      const square = await raw(src.clone().extract({ left: Math.floor((w0 - side) / 2), top: Math.floor((h0 - side) / 2), width: side, height: side }).resize(spec.size, spec.size, { kernel: "lanczos3" }));
      const seamless = makeSeamless(square);
      await fromRaw(seamless).webp({ quality: 86 }).toFile(join(outDir, outName));
      width = height = spec.size;
    } else if (spec.kind === "portrait" || spec.kind === "vista") {
      const [w, h] = spec.kind === "portrait" ? [spec.size, spec.size] : [spec.size, spec.size / 2];
      if (Math.abs(w0 / h0 - w / h) > 0.15) notes.push(`cropped to ${w}×${h} shape from ${w0}×${h0}`);
      await src.clone().resize(w, h, { fit: "cover", kernel: "lanczos3" }).webp({ quality: 86 }).toFile(join(outDir, outName));
      width = w;
      height = h;
    } else {
      // Sprites and icons.
      const img = await raw(src.clone());
      if (hasMagentaBackground(img)) {
        cutOutMagenta(img);
        notes.push("magenta background removed");
      }
      const box = opaqueBounds(img);
      if (!box) {
        report.warnings.push(`${file} came out completely see-through, so it was skipped. Is the whole image magenta?`);
        continue;
      }
      const trimmed = fromRaw(img).extract(box);
      const scale = Math.min(1, spec.size / Math.max(box.width, box.height));
      width = Math.max(1, Math.round(box.width * scale));
      height = Math.max(1, Math.round(box.height * scale));
      const sized = await raw(fromRaw(await raw(trimmed)).resize(width, height, { kernel: "lanczos3" }));
      await fromRaw(sized).webp({ quality: 90, alphaQuality: 100 }).toFile(join(outDir, outName));
      if (spec.tint) {
        tintFile = `${spec.name}.tint.webp`;
        await fromRaw(tintMask(sized)).webp({ quality: 90, alphaQuality: 100 }).toFile(join(outDir, tintFile));
      }
    }
    manifest.assets[spec.name] = { file: outName, width, height, ...(tintFile ? { tintMask: tintFile } : {}) };
    report.imported.push({ file, asset: spec.name, ...(notes.length ? { note: notes.join("; ") } : {}) });
  }

  report.missing = ASSETS.filter((a) => !manifest.assets[a.name]);
  // Clear out files from earlier imports that are no longer in the manifest.
  const keep = new Set(Object.values(manifest.assets).flatMap((e) => [e.file, ...(e.tintMask ? [e.tintMask] : [])]));
  for (const f of readdirSync(outDir)) if (f.endsWith(".webp") && !keep.has(f)) rmSync(join(outDir, f));
  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, report };
}

/** The import result in plain language. */
export function formatReport(report: ImportReport): string {
  const out: string[] = [];
  out.push(report.imported.length ? `Imported ${report.imported.length} file${report.imported.length === 1 ? "" : "s"}:` : "No art imported (art/incoming has no files with names the game knows).");
  for (const i of report.imported) out.push(`  ✓ ${i.file}${i.note ? ` (${i.note})` : ""}`);
  if (report.unknown.length) {
    out.push("", "Not recognised (check the name against docs/art/asset-list-and-prompts.md):");
    for (const u of report.unknown) out.push(`  ? ${u.file}${u.suggestion ? `: did you mean ${u.suggestion}.png?` : ""}`);
  }
  if (report.warnings.length) {
    out.push("", "Worth a look:");
    for (const w of report.warnings) out.push(`  ! ${w}`);
  }
  const t1 = report.missing.filter((a) => a.tier === 1);
  const t2 = report.missing.filter((a) => a.tier === 2);
  out.push("");
  if (t1.length) out.push(`Still missing from Tier 1 (the map), ${t1.length}, shown as placeholders: ${t1.map((a) => a.name).join(", ")}`);
  else out.push("Tier 1 (the map) is complete.");
  if (t2.length) out.push(`Still missing from Tier 2 (icons, portraits, vistas): ${t2.length}.`);
  return out.join("\n");
}

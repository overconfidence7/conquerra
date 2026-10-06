/**
 * The art import: turns Nate's AI art in `art/incoming/` into game-ready WebP files plus the art manifest.
 *   - sprites and icons: cut out a flat magenta (#FF00FF) background, trim the empty edges, resize
 *   - ground and water textures: crop square, resize, and make them tile seamlessly
 *   - tinted art (shields, banners, flags, army figures): also writes a mask of the light grey parts,
 *     which the game colours with each House's tincture
 *   - making the art match (palette.ts): ground textures have big baked-in light and dark patches evened out, and
 *     textures and sprite families (trees, mountains, hills, settlements) are nudged toward one colour and contrast
 * Node only (uses sharp). Run it with `pnpm art:import`.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import sharp, { type Sharp } from "sharp";
import { colourTargetFor } from "./palette";
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
  // "_review/", "_source-map.txt": Nate's own notes and folders, never art.
  if (IGNORED.has(file.toLowerCase()) || file.startsWith("_")) return { kind: "ignored" };
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
  const { data, width: w, height: h } = img;
  // The image's own background colour: Gemini's "magenta" is often a lighter pink (e.g. 236,41,239), so measure it
  // from the border instead of assuming pure #FF00FF.
  const bg = [0, 0, 0];
  let nb = 0;
  for (let k = 0; k < w + h; k++) {
    for (const [x, y] of k < w ? [[k, 0], [k, h - 1]] : [[0, k - w], [w - 1, k - w]]) {
      const i = (y! * w + x!) * 4;
      if (MAGENTA_DIST(data[i]!, data[i + 1]!, data[i + 2]!) < 110) (bg[0]! += data[i]!), (bg[1]! += data[i + 1]!), (bg[2]! += data[i + 2]!), nb++;
    }
  }
  const [br, bgG, bb] = nb ? bg.map((v) => v / nb) : [255, 0, 255];
  let cleared = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    // 0 at the background colour, 1 once clearly a different colour.
    const dist = Math.sqrt((r - br!) ** 2 + (g - bgG!) ** 2 + (b - bb!) ** 2);
    const keepDist = Math.max(0, Math.min(1, (dist - 35) / 95));
    // Magenta cast: red and blue both well above green and close to each other (shadowed or tinted background).
    // Sprites never contain magenta, so strongly magenta pixels are background whatever their brightness.
    const hi = Math.max(r, b);
    const cast = hi < 40 || Math.abs(r - b) > 0.45 * hi ? 0 : (Math.min(r, b) - g) / hi;
    const keepCast = Math.max(0, Math.min(1, (0.58 - cast) / 0.28));
    const keep = Math.min(keepDist, keepCast);
    if (keep === 0) cleared++;
    data[i + 3] = Math.round(data[i + 3]! * keep);
    // De-spill: pull red and blue down toward green on pink-tinted pixels, so edges aren't pink.
    const spillW = Math.max(1 - keep, Math.max(0, Math.min(1, (cast - 0.06) / 0.12)));
    const spill = Math.max(0, Math.min(r, b) - g) * spillW;
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

/**
 * Remove stray pieces the AI left beside a sprite: detached blobs that are small (under 15% of the drawing) and
 * clearly a different colour from the rest (a smudge beside a tree cluster), plus specks under 0.3%. Changes `img`
 * in place; returns how many stray pieces (not specks) were removed.
 */
export function removeStrayBlobs(img: Rgba): number {
  const { data, width: w, height: h } = img;
  const solid = (p: number) => data[p * 4 + 3]! > 40;
  const label = new Int32Array(w * h).fill(-1);
  const blobs: { pixels: number[]; sum: [number, number, number] }[] = [];
  const total: [number, number, number] = [0, 0, 0];
  let area = 0;
  for (let s = 0; s < w * h; s++) {
    if (label[s]! >= 0 || !solid(s)) continue;
    const blob = { pixels: [] as number[], sum: [0, 0, 0] as [number, number, number] };
    const stack = [s];
    label[s] = blobs.length;
    while (stack.length) {
      const p = stack.pop()!;
      blob.pixels.push(p);
      for (let c = 0; c < 3; c++) blob.sum[c]! += data[p * 4 + c]!;
      const x = p % w, y = (p / w) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1])
        if (q >= 0 && label[q]! < 0 && solid(q)) (label[q] = blobs.length), stack.push(q);
    }
    for (let c = 0; c < 3; c++) total[c]! += blob.sum[c]!;
    area += blob.pixels.length;
    blobs.push(blob);
  }
  if (blobs.length < 2) return 0;
  let removed = 0;
  for (const b of blobs) {
    const n = b.pixels.length;
    const rest = area - n;
    const dist = Math.sqrt([0, 1, 2].reduce((d, c) => d + (b.sum[c]! / n - (total[c]! - b.sum[c]!) / rest) ** 2, 0));
    const speck = n < area * 0.003;
    if (speck || (n < area * 0.15 && dist > 45)) {
      for (const p of b.pixels) data[p * 4 + 3] = 0;
      if (!speck) removed++;
    }
  }
  return removed;
}

// ---------- Making the art match ----------

const lumOf = (d: ArrayLike<number>, i: number) => 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;

/** Blur a square field that wraps around at the edges (a tiling texture), with three box passes each way. */
function wrapBlur(f: Float32Array, s: number, r: number): Float32Array {
  let a: Float32Array = f, b: Float32Array = new Float32Array(f.length);
  const pass = (src: Float32Array, dst: Float32Array, horizontal: boolean) => {
    const n = 2 * r + 1;
    for (let line = 0; line < s; line++) {
      const at = (k: number) => (horizontal ? src[line * s + ((k + s * 4) % s)]! : src[((k + s * 4) % s) * s + line]!);
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += at(k);
      for (let k = 0; k < s; k++) {
        if (horizontal) dst[line * s + k] = sum / n;
        else dst[k * s + line] = sum / n;
        sum += at(k + r + 1) - at(k - r);
      }
    }
  };
  for (let i = 0; i < 3; i++) {
    pass(a, b, true);
    [a, b] = [b, a];
    pass(a, b, false);
    [a, b] = [b, a];
  }
  return a;
}

/**
 * Even out big light and dark patches in a tiling texture (built-in shading), keeping the small detail. Each pixel
 * is scaled by how much darker or lighter its neighbourhood (about an eighth of the texture) is than average.
 * `strength` 0 = unchanged, 1 = the large-scale brightness is made completely even. Changes `img` in place.
 */
export function flattenLighting(img: Rgba, strength: number): void {
  const { data, width: s } = img;
  const lum = new Float32Array(s * s);
  let mean = 0;
  for (let p = 0; p < s * s; p++) mean += lum[p] = lumOf(data, p * 4);
  mean /= s * s;
  const blur = wrapBlur(lum, s, Math.max(2, Math.round(s / 16)));
  for (let p = 0; p < s * s; p++) {
    const f = mean / Math.max(4, blur[p]!);
    const k = Math.max(0.5, Math.min(2, 1 + (f - 1) * strength));
    for (let c = 0; c < 3; c++) data[p * 4 + c] = Math.max(0, Math.min(255, Math.round(data[p * 4 + c]! * k)));
  }
}

/** Average colour and brightness spread of an image (only fairly solid pixels count). */
export function colourStats(img: Rgba): { mean: [number, number, number]; contrast: number } {
  const { data } = img;
  const sum: [number, number, number] = [0, 0, 0];
  let n = 0, l1 = 0, l2 = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 128) continue;
    sum[0] += data[i]!;
    sum[1] += data[i + 1]!;
    sum[2] += data[i + 2]!;
    const l = lumOf(data, i);
    l1 += l;
    l2 += l * l;
    n++;
  }
  if (!n) return { mean: [0, 0, 0], contrast: 0 };
  const lm = l1 / n;
  return { mean: [sum[0]! / n, sum[1]! / n, sum[2]! / n], contrast: Math.sqrt(Math.max(0, l2 / n - lm * lm)) };
}

/**
 * Nudge an image toward a target average colour and contrast (`strength` of the way there), so pieces from
 * different AI batches sit together. Changes `img` in place; see palette.ts for the targets.
 */
export function matchColour(img: Rgba, target: { colour: string; contrast: number; strength: number }): void {
  const { data } = img;
  const st = colourStats(img);
  const t = [1, 3, 5].map((i) => parseInt(target.colour.slice(i, i + 2), 16));
  const mean = st.mean.map((m, c) => m + (t[c]! - m) * target.strength);
  const ratio = st.contrast > 0.5 ? target.contrast / st.contrast : 1;
  const k = Math.max(0.6, Math.min(1.6, 1 + (ratio - 1) * target.strength));
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, Math.round(mean[c]! + (data[i + c]! - st.mean[c]!) * k)));
  }
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
  /** Imported before and kept, because their originals aren't in art/incoming now. */
  kept: string[];
}

export interface ImportOptions {
  incomingDir: string;
  outDir: string;
}

function readManifest(path: string): ArtManifest {
  try {
    const m = JSON.parse(readFileSync(path, "utf8")) as ArtManifest;
    return m && typeof m.assets === "object" ? m : { version: 1, assets: {} };
  } catch {
    return { version: 1, assets: {} };
  }
}

const raw = async (s: Sharp): Promise<Rgba> => {
  const { data, info } = await s.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
};
const fromRaw = (img: Rgba) => sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), { raw: { width: img.width, height: img.height, channels: 4 } });

export async function importArt({ incomingDir, outDir }: ImportOptions): Promise<{ manifest: ArtManifest; report: ImportReport }> {
  const manifest: ArtManifest = { version: 1, assets: {} };
  const report: ImportReport = { imported: [], unknown: [], warnings: [], missing: [], kept: [] };
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
    /** The bigger copy for the Near zoom (session 16), for art with an hd size. */
    let hd: { file: string; width: number; height: number } | undefined;
    const hdName = `${spec.name}.hd.webp`;

    if (spec.kind === "texture") {
      if (w0 !== h0) notes.push(`cropped to a square from ${w0}×${h0}`);
      const side = Math.min(w0, h0);
      const target = colourTargetFor(spec.name, spec.kind);
      // The game-size texture, and (session 16) a bigger one made the same way for the Near zoom.
      for (const size of [spec.size, ...(spec.hd ? [Math.min(spec.hd, side)] : [])]) {
        const square = await raw(src.clone().extract({ left: Math.floor((w0 - side) / 2), top: Math.floor((h0 - side) / 2), width: side, height: side }).resize(size, size, { kernel: "lanczos3" }));
        const seamless = makeSeamless(square);
        if (target?.flatten) flattenLighting(seamless, target.flatten);
        if (target) matchColour(seamless, target);
        const isHd = size !== spec.size;
        await fromRaw(seamless).webp({ quality: 86 }).toFile(join(outDir, isHd ? hdName : outName));
        if (isHd) hd = { file: hdName, width: size, height: size };
      }
      if (target) notes.push("colour matched");
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
        if (spec.kind === "sprite") {
          const strays = removeStrayBlobs(img);
          if (strays) notes.push(`${strays} stray piece${strays === 1 ? "" : "s"} removed`);
        }
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
      const target = colourTargetFor(spec.name, spec.kind);
      if (target) {
        matchColour(sized, target);
        notes.push("colour matched to its family");
      }
      await fromRaw(sized).webp({ quality: 90, alphaQuality: 100 }).toFile(join(outDir, outName));
      // The bigger copy for the Near zoom (session 16): only when the original is bigger than the game size.
      if (spec.hd && Math.max(box.width, box.height) > spec.size) {
        const k = Math.min(1, spec.hd / Math.max(box.width, box.height));
        const hw = Math.max(1, Math.round(box.width * k)), hh = Math.max(1, Math.round(box.height * k));
        const big = await raw(fromRaw(await raw(fromRaw(img).extract(box))).resize(hw, hh, { kernel: "lanczos3" }));
        if (target) matchColour(big, target);
        await fromRaw(big).webp({ quality: 88, alphaQuality: 100 }).toFile(join(outDir, hdName));
        hd = { file: hdName, width: hw, height: hh };
      }
      if (spec.tint) {
        tintFile = `${spec.name}.tint.webp`;
        await fromRaw(tintMask(sized)).webp({ quality: 90, alphaQuality: 100 }).toFile(join(outDir, tintFile));
      }
    }
    manifest.assets[spec.name] = { file: outName, width, height, ...(tintFile ? { tintMask: tintFile } : {}), ...(hd ? { hd } : {}) };
    report.imported.push({ file, asset: spec.name, ...(notes.length ? { note: notes.join("; ") } : {}) });
  }

  // Art imported earlier whose original isn't in art/incoming any more (for example on another computer) stays,
  // so an import never throws away art the game already has. Only names the game no longer knows are dropped.
  const previous = readManifest(join(outDir, "manifest.json"));
  for (const [name, e] of Object.entries(previous.assets)) {
    if (manifest.assets[name] || !ASSET_BY_NAME.has(name) || !existsSync(join(outDir, e.file))) continue;
    manifest.assets[name] = e;
    report.kept.push(name);
  }
  report.missing = ASSETS.filter((a) => !manifest.assets[a.name]);
  // Clear out files from earlier imports that are no longer in the manifest.
  const keep = new Set(Object.values(manifest.assets).flatMap((e) => [e.file, ...(e.tintMask ? [e.tintMask] : []), ...(e.hd ? [e.hd.file] : [])]));
  for (const f of readdirSync(outDir)) if (f.endsWith(".webp") && !keep.has(f)) rmSync(join(outDir, f));
  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, report };
}

/** The import result in plain language. */
export function formatReport(report: ImportReport): string {
  const out: string[] = [];
  out.push(report.imported.length ? `Imported ${report.imported.length} file${report.imported.length === 1 ? "" : "s"}:` : "No art imported (art/incoming has no files with names the game knows).");
  for (const i of report.imported) out.push(`  ✓ ${i.file}${i.note ? ` (${i.note})` : ""}`);
  if (report.kept?.length) out.push(`Kept ${report.kept.length} imported before (their originals aren't in art/incoming): ${report.kept.join(", ")}`);
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

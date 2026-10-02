import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { ASSETS } from "../src/registry";
import { cutOutMagenta, formatReport, hasMagentaBackground, importArt, makeSeamless, matchFileName, opaqueBounds, type Rgba } from "../src/import";

const tmp = mkdtempSync(join(tmpdir(), "conquerra-art-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** A w×h image: magenta background with a red disc in the middle. */
function magentaSprite(w: number, h: number): Rgba {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inside = (x - w / 2) ** 2 + (y - h / 2) ** 2 < (Math.min(w, h) / 4) ** 2;
      data.set(inside ? [200, 30, 30, 255] : [255, 0, 255, 255], i);
    }
  return { data, width: w, height: h };
}
const px = (img: Rgba, x: number, y: number) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

describe("art file names", () => {
  it("knows every name in the prompt pack, exactly", () => {
    for (const name of ["terrain-grass", "tree-conifer-3", "mountain-4", "capital-2", "figure-army", "banner-flag", "cloud-1", "icon-healers", "leader-10", "vista-harbor"])
      expect(matchFileName(`${name}.png`)).toMatchObject({ kind: "ok", spec: { name } });
    expect(ASSETS.filter((a) => a.tier === 1)).toHaveLength(10 + 3 + 3 + 4 + 3 + 3 + 2 + 2 + 4 + 6 + 1 + 1 + 1 + 3);
  });

  it("forgives case, spaces, underscores and a missing dash before the number", () => {
    expect(matchFileName("Terrain-Grass.PNG")).toMatchObject({ kind: "ok", spec: { name: "terrain-grass" }, readAs: "terrain-grass" });
    expect(matchFileName("water_deep.jpg")).toMatchObject({ kind: "ok", spec: { name: "water-deep" } });
    expect(matchFileName("tree conifer1.webp")).toMatchObject({ kind: "ok", spec: { name: "tree-conifer-1" } });
    expect(matchFileName("leader-3.png")).toMatchObject({ kind: "ok", spec: { name: "leader-03" } });
  });

  it("flags unknown names with a suggestion, and skips non-images and housekeeping files", () => {
    expect(matchFileName("terain-gras.png")).toEqual({ kind: "unknown", suggestion: "terrain-grass" });
    expect(matchFileName("dragon.png")).toEqual({ kind: "unknown" });
    expect(matchFileName("notes.txt")).toEqual({ kind: "notImage" });
    expect(matchFileName(".gitkeep")).toEqual({ kind: "ignored" });
  });
});

describe("image processing", () => {
  it("cuts out a magenta background and trims to the drawing", () => {
    const img = magentaSprite(64, 48);
    expect(hasMagentaBackground(img)).toBe(true);
    cutOutMagenta(img);
    expect(px(img, 0, 0)[3]).toBe(0);
    expect(px(img, 32, 24)).toEqual([200, 30, 30, 255]);
    const box = opaqueBounds(img, 0)!;
    expect(box.width).toBeGreaterThanOrEqual(22);
    expect(box.width).toBeLessThanOrEqual(26);
    expect(box.left).toBeGreaterThan(18);
  });

  it("leaves art without a magenta background alone", () => {
    const img = magentaSprite(32, 32);
    img.data.fill(0);
    expect(hasMagentaBackground(img)).toBe(false);
  });

  it("makes a texture tile seamlessly (its opposite edges match)", () => {
    const s = 64;
    // A left-to-right ramp: the worst case for a seam.
    const data = new Uint8ClampedArray(s * s * 4);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) data.set([x * 4, y * 4, 128, 255], (y * s + x) * 4);
    const out = makeSeamless({ data, width: s, height: s });
    for (let y = 0; y < s; y++) {
      const a = px(out, 0, y), b = px(out, s - 1, y);
      expect(Math.abs(a[0]! - b[0]!)).toBeLessThanOrEqual(8);
    }
  });
});

describe("pnpm art:import", () => {
  it("imports sample files into WebP plus a manifest, and reports unknown and missing art", async () => {
    const incoming = join(tmp, "incoming"), out = join(tmp, "out");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(incoming);
    const sprite = magentaSprite(300, 240);
    await sharp(Buffer.from(sprite.data), { raw: { width: 300, height: 240, channels: 4 } }).png().toFile(join(incoming, "tree-conifer-1.png"));
    await sharp({ create: { width: 700, height: 600, channels: 3, background: { r: 60, g: 140, b: 60 } } }).png().toFile(join(incoming, "Terrain_Grass.png"));
    // White tabard figure for tinting.
    await sharp({ create: { width: 200, height: 200, channels: 4, background: { r: 240, g: 240, b: 240, alpha: 1 } } }).png().toFile(join(incoming, "figure-army.png"));
    await sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toFile(join(incoming, "dragon.png"));

    const { manifest, report } = await importArt({ incomingDir: incoming, outDir: out });
    expect(Object.keys(manifest.assets).sort()).toEqual(["figure-army", "terrain-grass", "tree-conifer-1"]);
    expect(manifest.assets["terrain-grass"]).toEqual({ file: "terrain-grass.webp", width: 512, height: 512 });
    expect(manifest.assets["figure-army"]!.tintMask).toBe("figure-army.tint.webp");
    // The tree was trimmed to its disc (about 120 px), not kept at 300 px.
    expect(manifest.assets["tree-conifer-1"]!.width).toBeLessThan(140);
    const tree = await sharp(join(out, "tree-conifer-1.webp")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(tree.data[3]).toBe(0); // corner is see-through
    expect(readdirSync(out).sort()).toEqual(["figure-army.tint.webp", "figure-army.webp", "manifest.json", "terrain-grass.webp", "tree-conifer-1.webp"]);
    expect(JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"))).toEqual(manifest);

    expect(report.unknown).toEqual([{ file: "dragon.png" }]);
    expect(report.missing.some((a) => a.name === "terrain-grass")).toBe(false);
    expect(report.missing.some((a) => a.name === "water-deep")).toBe(true);
    const text = formatReport(report);
    expect(text).toContain("Imported 3 files");
    expect(text).toContain("dragon.png");
    expect(text).toContain("cropped to a square from 700×600");
  }, 30_000);
});

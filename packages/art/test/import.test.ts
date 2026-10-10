import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { ASSETS, FIGURE_SPRITES, TERRAIN_TEXTURES, WATER_TEXTURES } from "../src/registry";
import { colourTargetFor } from "../src/palette";
import { blackToAlpha, colourStats, cutOutMagenta, hasBlackBackground, flattenLighting, formatReport, hasMagentaBackground, importArt, makeSeamless, matchColour, matchFileName, opaqueBounds, removeStrayBlobs, type Rgba } from "../src/import";

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
    expect(ASSETS.filter((a) => a.tier === 1)).toHaveLength(10 + 3 + 3 + 4 + 3 + 3 + 2 + 2 + 4 + 6 + 1 + 1 + 1 + 3 + /* batch 3 */ 3 + 3 + 1 + 1 + 1 + 4 + /* batch 4: figures, the windmill in two */ 3 + 2);
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
    // Session 16: a bigger copy for the Near zoom too, as big as the original allows (here 600 of the 1024 asked for).
    expect(manifest.assets["terrain-grass"]).toEqual({ file: "terrain-grass.webp", width: 512, height: 512, hd: { file: "terrain-grass.hd.webp", width: 600, height: 600 } });
    expect(manifest.assets["figure-army"]!.tintMask).toBe("figure-army.tint.webp");
    // The tree was trimmed to its disc (about 120 px), not kept at 300 px.
    expect(manifest.assets["tree-conifer-1"]!.width).toBeLessThan(140);
    // Its original is no bigger than the game size, so there's no bigger copy to make.
    expect(manifest.assets["tree-conifer-1"]!.hd).toBeUndefined();
    const tree = await sharp(join(out, "tree-conifer-1.webp")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(tree.data[3]).toBe(0); // corner is see-through
    expect(readdirSync(out).sort()).toEqual(["figure-army.tint.webp", "figure-army.webp", "manifest.json", "terrain-grass.hd.webp", "terrain-grass.webp", "tree-conifer-1.webp"]);
    expect(JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"))).toEqual(manifest);

    expect(report.unknown).toEqual([{ file: "dragon.png" }]);
    expect(report.missing.some((a) => a.name === "terrain-grass")).toBe(false);
    expect(report.missing.some((a) => a.name === "water-deep")).toBe(true);
    const text = formatReport(report);
    expect(text).toContain("Imported 3 files");
    expect(text).toContain("dragon.png");
    expect(text).toContain("cropped to a square from 700×600");

    // Importing again on a computer without the originals keeps the art the game already has.
    const empty = join(tmp, "empty");
    mkdirSync(empty);
    const again = await importArt({ incomingDir: empty, outDir: out });
    expect(Object.keys(again.manifest.assets).sort()).toEqual(["figure-army", "terrain-grass", "tree-conifer-1"]);
    expect(again.report.kept.sort()).toEqual(["figure-army", "terrain-grass", "tree-conifer-1"]);
    expect(readdirSync(out)).toContain("terrain-grass.webp");
    expect(formatReport(again.report)).toContain("Kept 3");
  }, 30_000);
});

describe("making the art match", () => {
  /** A 64x64 texture: fine checker detail, plus a big dark patch in one corner (baked-in shading). */
  const shaded = () => {
    const s = 64, data = new Uint8ClampedArray(s * s * 4);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const detail = (x + y) % 2 ? 12 : -12;
        const patch = x < 32 && y < 32 ? 0.5 : 1;
        const v = (120 + detail) * patch;
        data.set([v, v * 0.9, v * 0.6, 255], (y * s + x) * 4);
      }
    return { data, width: s, height: s };
  };
  const meanLum = (img: { data: Uint8ClampedArray }, x0: number, y0: number, w: number) => {
    let t = 0;
    for (let y = y0; y < y0 + w; y++) for (let x = x0; x < x0 + w; x++) t += img.data[(y * 64 + x) * 4]!;
    return t / (w * w);
  };

  it("flattening evens out a big dark patch but keeps the fine detail", () => {
    const img = shaded();
    const before = meanLum(img, 40, 40, 16) / meanLum(img, 8, 8, 16);
    flattenLighting(img, 1);
    const after = meanLum(img, 40, 40, 16) / meanLum(img, 8, 8, 16);
    expect(before).toBeGreaterThan(1.8);
    expect(after).toBeLessThan(1.25);
    // Neighbouring pixels still differ (the checker detail survives).
    const i = (48 * 64 + 48) * 4;
    expect(Math.abs(img.data[i]! - img.data[i + 4]!)).toBeGreaterThan(10);
  });

  it("flattening at strength 0 changes nothing", () => {
    const img = shaded();
    const copy = new Uint8ClampedArray(img.data);
    flattenLighting(img, 0);
    expect([...img.data]).toEqual([...copy]);
  });

  it("colour matching moves the average colour and contrast toward the target", () => {
    const img = shaded();
    const target = { colour: "#3a6a30", contrast: 10, strength: 1 };
    matchColour(img, target);
    const st = colourStats(img);
    expect(Math.abs(st.mean[0] - 0x3a)).toBeLessThan(4);
    expect(Math.abs(st.mean[1] - 0x6a)).toBeLessThan(4);
    expect(st.contrast).toBeLessThan(colourStats(shaded()).contrast);
  });

  it("half strength goes about half way, and see-through pixels are left alone", () => {
    const img = shaded();
    img.data[3] = 0;
    const r0 = colourStats(img).mean[0];
    matchColour(img, { colour: "#000000", contrast: 30, strength: 0.5 });
    expect(Math.abs(colourStats(img).mean[0] - r0 / 2)).toBeLessThan(2);
    expect(img.data[3]).toBe(0);
  });

  it("every ground texture and every sprite family has a target", () => {
    for (const n of [...TERRAIN_TEXTURES, ...WATER_TEXTURES]) expect(colourTargetFor(n, "texture")).not.toBeNull();
    for (const n of ["tree-conifer-1", "mountain-3", "hill-2", "village-1", "town-2", "capital-1"]) expect(colourTargetFor(n, "sprite")).not.toBeNull();
    expect(colourTargetFor("icon-gold", "icon")).toBeNull();
  });
});

describe("session 6: Nate's whole art list", () => {
  /** Every file name the art list (docs/art/asset-list-and-prompts.md) asks for, with its "…" ranges expanded. */
  const namesInArtList = () => {
    const doc = readFileSync(join(__dirname, "../../../docs/art/asset-list-and-prompts.md"), "utf8");
    // Tiers 1 and 2, and batch 3 (whose dragon outline is a map shape, not art: it goes through the mask script).
    const tiers = doc.slice(doc.indexOf("## Tier 1"), doc.indexOf("## Tier 3")) + doc.slice(doc.indexOf("## Batch 3")).replace("`mask-dragon.png`", "");
    const names = new Set<string>();
    // "`tree-conifer-1.png` … `-3.png`" and "`leader-01.png` … `leader-10.png`"
    for (const m of tiers.matchAll(/`([a-z-]+?)-(\d+)\.png`\s*…\s*`(?:[a-z-]*?)-?(\d+)\.png`/g)) {
      const width = m[2]!.length;
      for (let i = Number(m[2]); i <= Number(m[3]); i++) names.add(`${m[1]}-${String(i).padStart(width, "0")}`);
    }
    for (const m of tiers.matchAll(/`([a-z][a-z0-9-]*)\.png`/g)) names.add(m[1]!);
    for (const m of tiers.matchAll(/`(vista-[a-z]+)\.png`/g)) names.add(m[1]!);
    return [...names];
  };

  it("recognises every name in the art list (Tier 1 and Tier 2), and the list has all of them", () => {
    const names = namesInArtList();
    expect(names.length).toBe(ASSETS.length);
    for (const n of names) expect(matchFileName(`${n}.png`)).toMatchObject({ kind: "ok", spec: { name: n } });
    for (const n of ["ridge-3", "cliff-1", "pass-gate", "scaffold", "bridge-wood", "landmark-windmill", "frame-plaque", "figure-healers", "ship", "bridge", "cloud-3", "shield-base", "banner-base", "icon-watchtower", "emblem", "seal", "frame-corner", "leader-07", "vista-mountain"])
      expect(names).toContain(n);
  });

  it("every piece made in white/grey for tinting gets a tint mask: all figures, banners, shields and the flag", () => {
    const tinted = ASSETS.filter((a) => a.tint).map((a) => a.name).sort();
    expect(tinted).toEqual([...FIGURE_SPRITES, "banner-base", "banner-flag", "shield-base"].sort());
  });

  it("skips Nate's notes and review folders quietly", () => {
    expect(matchFileName("_source-map.txt")).toEqual({ kind: "ignored" });
    expect(matchFileName("_review")).toEqual({ kind: "ignored" });
  });

  it("cuts out Gemini's lighter pink backgrounds and the darker magenta shadows on them", () => {
    // A light pink background (236,41,239), a magenta shadow patch, and a brown drawing in the middle.
    const w = 48, h = 48, data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const inside = Math.abs(x - 24) < 10 && Math.abs(y - 24) < 10;
        const shadow = !inside && x < 12 && y > 30;
        data.set(inside ? [120, 80, 50, 255] : shadow ? [150, 0, 140, 255] : [236, 41, 239, 255], (y * w + x) * 4);
      }
    const img = { data, width: w, height: h };
    expect(hasMagentaBackground(img)).toBe(true);
    cutOutMagenta(img);
    expect(px(img, 0, 0)[3]).toBe(0);
    expect(px(img, 4, 40)[3]).toBe(0); // the shadow went too
    expect(px(img, 24, 24)).toEqual([120, 80, 50, 255]);
    // A pinkish edge pixel (background bled into brown ground) loses its pink.
    const edge = { data: new Uint8ClampedArray([255, 0, 255, 255, 160, 80, 112, 255, 255, 0, 255, 255, 255, 0, 255, 255]), width: 2, height: 2 };
    cutOutMagenta(edge);
    expect(edge.data[4]! - edge.data[5]!).toBeGreaterThan(edge.data[6]! - edge.data[5]! + 20); // red stays above blue: brown, not pink
  });

  it("removes a small stray blob of a different colour beside a sprite, but keeps detached parts that match", () => {
    const w = 60, h = 30, data = new Uint8ClampedArray(w * h * 4);
    const disc = (cx: number, cy: number, r: number, c: number[]) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) data.set([...c, 255], (y * w + x) * 4);
    };
    disc(12, 15, 9, [70, 110, 50]); // two green trees, apart
    disc(34, 15, 9, [75, 105, 55]);
    disc(54, 4, 3, [140, 125, 95]); // a grey-brown smudge
    const img = { data, width: w, height: h };
    expect(removeStrayBlobs(img)).toBe(1);
    expect(px(img, 54, 4)[3]).toBe(0);
    expect(px(img, 12, 15)[3]).toBe(255);
    expect(px(img, 34, 15)[3]).toBe(255);
  });

  it("re-running the import is safe: same manifest, same files", async () => {
    const incoming = join(tmp, "rerun-in"), out = join(tmp, "rerun-out");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(incoming);
    const sprite = magentaSprite(200, 160);
    await sharp(Buffer.from(sprite.data), { raw: { width: 200, height: 160, channels: 4 } }).png().toFile(join(incoming, "figure-scouts.png"));
    await sharp({ create: { width: 600, height: 600, channels: 3, background: { r: 30, g: 80, b: 120 } } }).png().toFile(join(incoming, "water-deep.png"));
    await sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toFile(join(incoming, "_notes.png"));
    const first = await importArt({ incomingDir: incoming, outDir: out });
    const files = readdirSync(out).sort();
    const second = await importArt({ incomingDir: incoming, outDir: out });
    expect(second.manifest).toEqual(first.manifest);
    expect(readdirSync(out).sort()).toEqual(files);
    expect(files).toContain("figure-scouts.tint.webp");
    expect(second.report.unknown).toEqual([]);
  }, 30_000);
});

describe("session 21: effects painted on black", () => {
  /** A w×h image on black with a soft round puff of `colour`, brightest in the middle. */
  function blackPuff(w: number, h: number, colour: [number, number, number]): Rgba {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - w / 2, y - h / 2) / (Math.min(w, h) / 3);
        const k = Math.max(0, 1 - d);
        data.set([colour[0] * k, colour[1] * k, colour[2] * k, 255].map(Math.round), (y * w + x) * 4);
      }
    return { data, width: w, height: h };
  }
  const SPEC = { floor: 10, density: 0.7 };

  it("finds a black background, and not a magenta one", () => {
    expect(hasBlackBackground(blackPuff(64, 64, [240, 240, 240]))).toBe(true);
    expect(hasBlackBackground(magentaSprite(64, 64))).toBe(false);
  });

  it("black becomes see-through; the puff keeps its colour, so its soft edge has no dark fringe", () => {
    const img = blackPuff(64, 64, [255, 140, 40]);
    blackToAlpha(img, SPEC.floor, SPEC.density);
    expect(px(img, 0, 0)[3]).toBe(0);
    const mid = px(img, 32, 32);
    expect(mid[3]).toBeGreaterThan(250);
    // Out at the soft edge: faint, but the same orange, not a darker brown.
    const edge = px(img, 32 + 18, 32);
    expect(edge[3]).toBeGreaterThan(0);
    expect(edge[3]).toBeLessThan(200);
    // (The painted edge pixel is about 95,52,15 on black: it comes out much brighter, at the same hue.)
    const painted = (1 - 18 / (64 / 3)) * 255;
    expect(edge[0]).toBeGreaterThan(painted * 1.5);
    expect(edge[0]! / edge[1]!).toBeCloseTo(255 / 140, 0);
  });

  it("drawn over black it looks exactly like the painting (so flames add the same light)", () => {
    const original = blackPuff(48, 48, [230, 230, 220]);
    const img = { ...original, data: new Uint8ClampedArray(original.data) };
    blackToAlpha(img, SPEC.floor, SPEC.density);
    for (const [x, y] of [[24, 24], [30, 24], [34, 28], [24, 36]] as const) {
      const a = px(img, x, y), o = px(original, x, y);
      if (Math.max(o[0]!, o[1]!, o[2]!) <= SPEC.floor + 2) continue;
      for (let c = 0; c < 3; c++) expect(Math.abs((a[c]! * a[3]!) / 255 - o[c]!)).toBeLessThanOrEqual(3);
    }
  });

  it("grey smoke stays fairly solid (denser than plain brightness), keeping its own shading", () => {
    const img = { data: new Uint8ClampedArray([128, 128, 128, 255, 64, 64, 64, 255]), width: 2, height: 1 };
    blackToAlpha(img, SPEC.floor, SPEC.density);
    expect(img.data[3]).toBeGreaterThan(128);
    expect(img.data[0]).toBeLessThan(255);
    expect(img.data[7]).toBeLessThan(img.data[3]!);
  });

  it("the import cuts black effects and magenta effects each their own way, and keeps the key art whole", async () => {
    const { mkdirSync } = await import("node:fs");
    const incoming = join(tmp, "fx-in"), out = join(tmp, "fx-out");
    mkdirSync(incoming);
    const smoke = blackPuff(300, 300, [235, 235, 230]);
    await sharp(Buffer.from(smoke.data), { raw: { width: 300, height: 300, channels: 4 } }).png().toFile(join(incoming, "fx-smoke-1.png"));
    const coin = magentaSprite(200, 200);
    await sharp(Buffer.from(coin.data), { raw: { width: 200, height: 200, channels: 4 } }).png().toFile(join(incoming, "fx-coin.png"));
    await sharp({ create: { width: 1376, height: 768, channels: 3, background: { r: 60, g: 40, b: 30 } } }).png().toFile(join(incoming, "art-title.png"));
    const { manifest, report } = await importArt({ incomingDir: incoming, outDir: out });
    expect(report.imported.find((i) => i.asset === "fx-smoke-1")?.note).toMatch(/black background/);
    expect(report.imported.find((i) => i.asset === "fx-coin")?.note).toMatch(/magenta/);
    expect(report.warnings).toEqual([]);
    // Trimmed to the puff (the black margin went), and see-through at its corners.
    const s = manifest.assets["fx-smoke-1"]!;
    expect(s.width).toBeLessThan(256);
    const { data, info } = await sharp(join(out, s.file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);
    expect(data[((info.height >> 1) * info.width + (info.width >> 1)) * 4 + 3]).toBeGreaterThan(230);
    expect(manifest.assets["art-title"]).toMatchObject({ width: 1280, height: 714 });
  }, 30_000);

  it("every effect says how it's blended, and every black one is marked as black", () => {
    const fx = ASSETS.filter((a) => a.kind === "fx");
    expect(fx.length).toBe(25);
    for (const a of fx) expect(a.blend).toBeDefined();
    expect(fx.filter((a) => a.background === "black").map((a) => a.name)).toEqual(expect.arrayContaining(["fx-smoke-2", "fx-flame-3", "fx-wisp-1", "fx-lightning-2", "fx-crack", "fx-impact", "fx-splash", "fx-dust-2"]));
    expect(ASSETS.find((a) => a.name === "fx-flame-1")?.blend).toBe("add");
    expect(ASSETS.find((a) => a.name === "fx-coin")?.background).toBeUndefined();
  });
});

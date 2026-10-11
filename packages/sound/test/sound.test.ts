import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { encodeArgs, LOUDNESS, mixArgs, parseLoudness, PEAK_CEILING } from "../src/import";
import { RECIPE } from "../src/recipe";
import { ALLOWED_LICENSES, CREDIT_BY_ID, CREDITS, creditsInUse, fileName, licenseProblems, REGISTRY } from "../src/registry";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const listCues = () =>
  [...readFileSync(join(root, "docs/sound/sound-list.md"), "utf8").matchAll(/^\| `([a-z0-9-]+)` \|/gm)].map((m) => m[1]);

describe("the sounds and their licenses (session 24)", () => {
  it("every registered file has a credits entry with an allowed license", () => {
    expect(REGISTRY.files.flatMap((f) => licenseProblems(f))).toEqual([]);
  });

  it("a file with no license entry, or a license that isn't allowed, fails", () => {
    expect(licenseProblems({ name: "sfx-test-1", sources: ["nobody-knows"] })).toEqual(['sfx-test-1: source "nobody-knows" has no credits entry (no license on record)']);
    const nc = new Map([["nc-pack", { license: "CC-BY-NC-4.0" }]]);
    expect(licenseProblems({ name: "sfx-test-1", sources: ["nc-pack"] }, nc)).toEqual(['sfx-test-1: source "nc-pack" has license "CC-BY-NC-4.0", which isn\'t allowed']);
    expect(ALLOWED_LICENSES).not.toContain("CC-BY-NC-4.0");
  });

  it("every credit says who made it, where it's from, its license and when it was downloaded", () => {
    for (const c of CREDITS) {
      expect(c.url, c.id).toMatch(/^https:\/\//);
      expect((ALLOWED_LICENSES as readonly string[]).includes(c.license), `${c.id}: ${c.license}`).toBe(true);
      if (c.licenseFile) expect(existsSync(join(root, c.licenseFile)), c.licenseFile).toBe(true);
    }
    expect(existsSync(join(root, "docs/sound/licenses/CC0-1.0.txt"))).toBe(true);
    // The credits page in Settings lists every pack in use.
    expect(creditsInUse().length).toBe(new Set(REGISTRY.files.flatMap((f) => f.sources)).size);
    // And docs/sound/credits.md names every one of them.
    const md = readFileSync(join(root, "docs/sound/credits.md"), "utf8");
    for (const c of creditsInUse()) expect(md.includes(c.url), `${c.id} in credits.md`).toBe(true);
  });

  it("the sound list, the recipe and the registry name the same cues, in the same order", () => {
    const recipe = RECIPE.cues.map((c) => c.cue);
    expect(listCues()).toEqual(recipe);
    expect([...new Set(REGISTRY.files.map((f) => f.cue))]).toEqual(recipe);
  });

  it("every registered cue has its files on disk, named by cue", () => {
    for (const c of RECIPE.cues) {
      const files = REGISTRY.files.filter((f) => f.cue === c.cue);
      expect(files.map((f) => f.name), c.cue).toEqual(c.variants.map((_, n) => fileName(c.kind, c.cue, n, c.variants.length)));
      for (const f of files) {
        const path = join(root, "apps/web/public", f.file);
        expect(existsSync(path), f.file).toBe(true);
        expect(statSync(path).size, f.file).toBe(f.bytes);
        expect(f.kind).toBe(c.kind);
      }
    }
    expect(fileName("sfx", "battle", 0, 3)).toBe("sfx-battle-1");
    expect(fileName("music", "planning", 0, 1)).toBe("music-planning");
    expect(fileName("ambience", "wind", 0, 1)).toBe("amb-wind");
  });

  it("loudness is normalised and peaks stay under the ceiling", () => {
    for (const f of REGISTRY.files) {
      expect(f.peak, f.name).toBeLessThanOrEqual(PEAK_CEILING);
      // Sharp clicks (a tick, a card) are held under the target by the limiter, by design: never louder than it.
      expect(f.lufs, f.name).toBeLessThanOrEqual(LOUDNESS[f.kind] + 1);
      if (f.kind !== "sfx") expect(f.lufs, f.name).toBeGreaterThanOrEqual(LOUDNESS[f.kind] - 1.5);
    }
    const sfx = REGISTRY.files.filter((f) => f.kind === "sfx").map((f) => f.lufs).sort((a, b) => a - b);
    expect(sfx[Math.floor(sfx.length / 2)]!).toBeGreaterThan(LOUDNESS.sfx - 1);
  });

  it("a first game's sound stays under about 4 MB", () => {
    const first = REGISTRY.files.filter((f) => f.kind !== "music" || ["title", "planning", "replay", "defeat"].includes(f.cue));
    expect(first.reduce((a, f) => a + f.bytes, 0)).toBeLessThan(4 * 1024 * 1024);
  });
});

describe("the importer's ffmpeg work (session 24)", () => {
  it("reads ffmpeg's loudness log", () => {
    const log = "t: 0.4 TARGET:-23 LUFS M: -30.1 S: -120.7\nt: 0.5 M: -18.2 S: -120\nt: 0.6 M: -inf S: -inf\n[Parsed_ebur128_0] Summary:\n\n  Integrated loudness:\n    I:         -20.4 LUFS\n  True peak:\n    Peak:       -1.6 dBFS\n";
    expect(parseLoudness(log)).toEqual({ integrated: -20.4, maxMomentary: -18.2, truePeak: -1.6 });
  });

  it("mixes layers in time, with gain, pitch and fades, and trims silence on effects", () => {
    const v = RECIPE.cues.find((c) => c.cue === "built")!.variants[0]!;
    const args = mixArgs(v, ["a.ogg", "b.ogg", "c.ogg"], [0.5, 0.25, 0.8], "out.wav", true);
    const graph = args[args.indexOf("-filter_complex") + 1]!;
    expect(graph).toContain("adelay=delays=280:all=1");
    expect(graph).toContain("amix=inputs=3:normalize=0");
    expect(graph).toContain("silenceremove");
    const knocked = RECIPE.cues.find((c) => c.cue === "knocked-out")!.variants[0]!;
    const k = mixArgs(knocked, ["d.wav"], [14.77], "out.wav", false);
    expect(k.slice(0, 4)).toEqual(["-t", "5.5", "-i", "d.wav"]);
    const kg = k[k.indexOf("-filter_complex") + 1]!;
    expect(kg).toContain("asetrate=37485");
    expect(kg).not.toContain("silenceremove");
    // The fade-out starts 4 s before the end of the slowed-down layer (5.5 / 0.85 = 6.47 s).
    expect(kg).toContain("afade=t=out:st=2.471:d=4");
  });

  it("encodes effects mono and music stereo, limited at four times the sample rate", () => {
    const sfx = encodeArgs("sfx", "in.wav", 2.5, "out.mp3").join(" ");
    expect(sfx).toContain("volume=2.5dB,aformat=channel_layouts=mono,aresample=176400,alimiter");
    expect(sfx).toContain("-ac 1");
    expect(sfx).toContain("libmp3lame");
    expect(encodeArgs("music", "in.wav", 0, "out.mp3").join(" ")).toContain("-ac 2");
  });
});

describe("credits are complete for the packs we have", () => {
  it("every recipe layer names a source in credits.json", () => {
    for (const c of RECIPE.cues) for (const v of c.variants) for (const l of v.layers) expect(CREDIT_BY_ID.has(l.src), `${c.cue}: ${l.src}`).toBe(true);
  });
});

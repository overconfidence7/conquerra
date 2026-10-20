import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Session 34, Part 3: the check pages (the map lab, what a bot knew, the art and sound benches: `?lab=...`) are off in
 * the deployed build and on in `pnpm dev` and in `pnpm build:labs` (the build `wrangler dev` serves when they're
 * wanted). Built for real in the deploy: `pnpm deploy:preview` builds with `pnpm build`, and `bundle-size.mjs` stops
 * it if any file of the build mentions a check page.
 */
const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(web, "../..");
const read = (p: string) => readFileSync(p, "utf8");

describe("the check pages are off in the deployed build (session 34)", () => {
  it("the page opens a check page only in development or a labs build; otherwise ?lab= opens the lobby", () => {
    const main = read(join(web, "src/main.tsx"));
    expect(main).toContain('const LABS = import.meta.env.DEV || import.meta.env.VITE_LABS === "on";');
    for (const lab of ["maps", "known", "bench", "sound"]) expect(main).toMatch(new RegExp(`LABS && \\(?lab === "${lab}"`));
    expect(read(join(web, ".env.labs")).trim()).toBe("VITE_LABS=on");
  });

  it("the deployed build swaps every import of src/lab/ for an empty module; the dev server and the labs build don't", () => {
    const cfg = read(join(web, "vite.config.ts"));
    expect(cfg).toContain('noLabs(command === "serve" || mode === "labs")');
    expect(cfg).toContain("/[\\\\/]src[\\\\/]lab[\\\\/]/.test(target) ? NO_LABS : null");
    expect(cfg).not.toMatch(/\u0000/);
  });

  it("the deploy builds without them, and the size check refuses a build that has them", () => {
    const pkg = JSON.parse(read(join(root, "package.json"))) as { scripts: Record<string, string> };
    expect(pkg.scripts["deploy:preview"]).toContain("pnpm build &&");
    expect(pkg.scripts["deploy:preview"]).not.toContain("build:labs");
    expect(pkg.scripts["build:labs"]).toBe("pnpm --filter web exec vite build --mode labs");
    const size = read(join(web, "scripts/bundle-size.mjs"));
    expect(size).toMatch(/labMarkers = \["Map lab", "Art test bench", "Sound bench", "Sim this map", "What a bot knew"\]/);
    expect(size).toContain("process.exit(1)");
  });
});

import { defaultRules } from "@conquerra/content";
import { generateMap, mapFingerprint, MAP_CONFIGS, recipeFor, recipeFromJson, recipeToJson } from "@conquerra/mapgen";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

// Map making is a few seconds of solid work: let the test runner catch up before each test.
beforeEach(() => new Promise((r) => setTimeout(r, 0)));
import { chokeTerritories, labView, makeLabMap } from "../src/lab/maps/core";

const src = join(dirname(fileURLToPath(import.meta.url)), "../src");

describe("map lab", () => {
  it("makes exactly the map generateMap makes (same fingerprint), and says why earlier tries failed", () => {
    const recipe = recipeFor("archipelago", 60, "archipelago-60-1");
    const lab = makeLabMap(recipe, defaultRules);
    const node = generateMap(recipe, defaultRules);
    expect(lab.fingerprint).toBe(mapFingerprint(node.map));
    expect(JSON.stringify(lab.map)).toBe(JSON.stringify(node.map));
    expect(lab.attempt).toBe(node.attempt);
    expect(lab.rejected).toEqual(node.rejected);
    // This seed needs a few tries; each one has a reason.
    expect(lab.rejected.length).toBe(lab.attempt - 1);
    for (const r of lab.rejected) expect(r).toMatch(/^archipelago-60-1(#\d+)?: \S/);
  }, 60_000);

  it("reports a recipe that can't make a map, with every try's reason", () => {
    const made = makeLabMap({ ...recipeFor("continent", 40, "never"), minChokePoints: 99, maxAttempts: 2 }, defaultRules);
    expect(made.map).toBeNull();
    expect(made.error).toMatch(/No map passed/);
    expect(made.rejected).toHaveLength(2);
    for (const r of made.rejected) expect(r).toMatch(/^never(#2)?: \S/);
  }, 60_000);

  it("a recipe survives Copy recipe and Paste recipe unchanged, and makes the same map", () => {
    for (const r of [recipeFor("mask", 80, "rt-1", { mask: "crown" }), recipeFor("twinContinents", 60, "rt-2", { landBridge: true }), MAP_CONFIGS[0]!]) {
      const back = recipeFromJson(recipeToJson(r));
      expect(back).toEqual(JSON.parse(JSON.stringify(r)));
    }
    const r = recipeFor("inlandSea", 60, "rt-3");
    expect(mapFingerprint(generateMap(recipeFromJson(recipeToJson(r)), defaultRules).map)).toBe(mapFingerprint(generateMap(r, defaultRules).map));
    // The JSON reads like configs.ts: id, name and seed first.
    expect(Object.keys(JSON.parse(recipeToJson(r))).slice(0, 4)).toEqual(["id", "name", "seed", "shape"]);
    expect(() => recipeFromJson("{nope")).toThrow(/isn't valid JSON/);
    expect(() => recipeFromJson(JSON.stringify({ ...r, shape: "donut" }))).toThrow(/Unknown shape/);
    expect(() => recipeFromJson(JSON.stringify({ ...r, wobble: 3 }))).toThrow(/Unknown recipe setting "wobble"/);
  }, 60_000);

  it("the preview's view: capitals for the chosen player count, or all neutral", () => {
    const map = makeLabMap(recipeFor("continent", 60, "view-1"), defaultRules).map!;
    const owners = (players: number, capitals: boolean) => new Set(Object.values(labView(map, defaultRules, players, capitals).view.territories).map((t) => (t.detail === "full" ? t.owner : "fog")));
    expect(owners(5, true).size).toBe(6); // five Houses and neutral
    expect([...owners(5, false)]).toEqual([null]);
    // Out-of-range counts are clamped to what the map claims.
    expect(owners(99, true).size).toBe(map.maxPlayers + 1);
    expect(chokeTerritories(map).length).toBeGreaterThan(0);
  }, 60_000);

  it("the lab isn't in the game's start-up bundle: nothing the page loads first imports lab code or the map maker", () => {
    // Follow every static import from the entry (dynamic `import()` loads on demand, so it doesn't count).
    const seen = new Set<string>();
    const reached: string[] = [];
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      reached.push(file);
      const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      for (const m of code.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^'"]*?from\s+["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gm)) {
        const spec = m[1] ?? m[2]!;
        if (spec.startsWith("@conquerra/mapgen") || spec.startsWith("@conquerra/simcore")) reached.push(`${file} -> ${spec}`);
        if (!spec.startsWith(".")) continue;
        const base = resolve(dirname(file), spec);
        const hit = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((p) => existsSync(p) && /\.(ts|tsx)$/.test(p));
        if (hit) visit(hit);
      }
    };
    visit(join(src, "main.tsx"));
    expect(reached.length).toBeGreaterThan(20); // it really walked the game
    expect(reached.filter((f) => /[\\/]lab[\\/]|mapgen|simcore/.test(f))).toEqual([]);
    // And the entry only reaches the labs through import(), behind the VITE_LABS switch.
    const main = readFileSync(join(src, "main.tsx"), "utf8");
    expect(main).toMatch(/LABS && lab === "maps"\) void import\("\.\/lab\/maps\/MapLab"\)/);
  });
});

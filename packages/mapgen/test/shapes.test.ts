import { defaultRules } from "@conquerra/content";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkMap, generateMap, LAND_SHAPES, MAP_CONFIGS, MASKS, recipeFor, type LandShape } from "../src";
import { maskInside, type MaskDef } from "../src/masks";
import { makeShapeField } from "../src/shapes";
import { Rng, seedRng } from "@conquerra/engine";

const hash = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);

describe("land shapes", () => {
  // Every shape, several seeds, at the smallest new size (fast); the big sizes are covered by `pnpm try-maps`.
  describe.each(LAND_SHAPES.map((s) => [s] as const))("%s", (shape: LandShape) => {
    // One map per test, so the test runner gets a word in between (each can take a few seconds).
    it.each([1, 2])("builds a map that passes every check, with the size and provinces asked for (seed %i)", (i) => {
      const recipe = recipeFor(shape, 60, `test-${shape}-${i}`);
      const { map, check } = generateMap(recipe, defaultRules);
      expect(check.problems, `${recipe.seed}`).toEqual([]);
      expect(map.territories.length).toBe(60);
      expect(map.provinces.length).toBe(recipe.provinces);
      // Checked again from scratch, as the game would.
      expect(checkMap(map, defaultRules, { minChokePoints: recipe.minChokePoints!, minSeaLanes: recipe.minSeaLanes }).ok).toBe(true);
      // Every capital layout the map claims exists.
      for (let n = map.minPlayers; n <= map.maxPlayers; n++) expect(map.capitalLayouts!.some((l) => l.players === n)).toBe(true);
    }, 120_000);

    it("the same seed gives the same map", () => {
      const recipe = recipeFor(shape, 60, `same-${shape}`);
      expect(hash(generateMap(recipe, defaultRules).map)).toBe(hash(generateMap(recipe, defaultRules).map));
    }, 60_000);
  });

  it("a 120-territory map builds and passes (provinces scale with size)", () => {
    const recipe = recipeFor("inlandSea", 120, "test-big");
    const { map, check } = generateMap(recipe, defaultRules);
    expect(check.problems).toEqual([]);
    expect(map.territories.length).toBe(120);
    expect(map.provinces.length).toBe(27);
    expect(map.maxPlayers).toBe(10);
    // Ids stay unique and sortable past 100.
    expect(new Set(map.territories.map((t) => t.id)).size).toBe(120);
    expect(map.territories.every((t) => /^t\d{3}$/.test(t.id))).toBe(true);
  }, 120_000);

  it("an archipelago is many islands, every one joined by a sea lane", () => {
    const { map } = generateMap(recipeFor("archipelago", 60, "test-isles"), defaultRules);
    // Islands = groups of territories joined by land borders.
    const land = new Map(map.territories.map((t) => [t.id, [] as string[]]));
    for (const b of map.borders) if (b.type !== "sea") land.get(b.a)!.push(b.b), land.get(b.b)!.push(b.a);
    const seen = new Set<string>();
    const islands: string[][] = [];
    for (const t of map.territories) {
      if (seen.has(t.id)) continue;
      const q = [t.id];
      seen.add(t.id);
      for (let h = 0; h < q.length; h++) for (const m of land.get(q[h]!)!) if (!seen.has(m)) seen.add(m), q.push(m);
      islands.push(q);
    }
    expect(islands.length).toBeGreaterThanOrEqual(5);
    const lanes = map.borders.filter((b) => b.type === "sea");
    for (const isle of islands) expect(lanes.some((l) => isle.includes(l.a) !== isle.includes(l.b))).toBe(true);
  }, 60_000);

  it.each(MASKS.map((m) => [m.id]))("the %s silhouette builds", (id) => {
    const { check } = generateMap(recipeFor("mask", 60, `test-${id}`, { mask: id }), defaultRules);
    expect(check.problems, id).toEqual([]);
  }, 120_000);

  it("a silhouette drawn as a picture (rows of # and .) works like an outline", () => {
    const rows = ["........", "..####..", ".######.", "..####..", "........"];
    const pic: MaskDef = { id: "pic", name: "Pic", aspect: 8 / 5, rows };
    const inside = maskInside(pic);
    expect(inside(0.8, 0.5)).toBe(true); // the middle
    expect(inside(0.05, 0.05)).toBe(false); // a corner
    expect(inside(0.25, 0.5)).toBe(true); // the widest row reaches out
    expect(inside(0.25, 0.3)).toBe(false); // ...the row above it does not
  });

  it("shapes come from their own random sequence and only use exact arithmetic", () => {
    const a = makeShapeField({ shape: "crescent", territories: 80 }, new Rng(seedRng("x|shape")));
    const b = makeShapeField({ shape: "crescent", territories: 80 }, new Rng(seedRng("x|shape")));
    const pts = [0.1, 0.4, 0.7, 1.0, 1.3].flatMap((x) => [0.1, 0.5, 0.9].map((y) => a.at(x, y)));
    expect(pts).toEqual([0.1, 0.4, 0.7, 1.0, 1.3].flatMap((x) => [0.1, 0.5, 0.9].map((y) => b.at(x, y))));
    expect(a.insideShare).toBeGreaterThan(0.15);
    expect(a.insideShare).toBeLessThan(0.6);
  });

  it("the built-in maps keep the original continent (no shape set)", () => {
    for (const c of MAP_CONFIGS) expect(c.shape ?? "continent").toBe("continent");
  });
});

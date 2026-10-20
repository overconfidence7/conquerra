import { defaultRules } from "@conquerra/content";
import { describe, expect, it } from "vitest";
import { mapFingerprint, parseRandomId, randomMap, randomPlayers, randomRecipe, RANDOM_BIG_SEATS, RANDOM_MAX_SEATS, RANDOM_PLAYERS, RANDOM_SIZES } from "../src/index";

/**
 * Session 33b: random maps at 300 and 400 territories, for the big tables (session 34) and the battle royale later.
 * New in version 5 (no game was ever made on one before), so their recipe can differ from the smaller sizes': at most
 * 10 mountain ranges, and a harder search for fair capital layouts. One cheap pin each (seeds that pass on their first
 * try): a 400 takes a few seconds to build.
 */
describe("random maps at 300 and 400 territories (session 33b)", () => {
  it("the sizes and who they suit: 300 from 4 to 10 players (8 to 10 suggested), 400 from 6 to 10 (10); session 34 (version 6): both seat up to 20", () => {
    expect(RANDOM_SIZES).toEqual([40, 80, 120, 200, 300, 400]);
    expect(RANDOM_MAX_SEATS).toBe(10);
    expect(RANDOM_BIG_SEATS).toBe(20);
    expect(RANDOM_PLAYERS[300]).toEqual({ min: 4, max: 20, recommended: { min: 8, max: 10 } });
    expect(RANDOM_PLAYERS[400]).toEqual({ min: 6, max: 20, recommended: { min: 10, max: 10 } });
    // Version 5's (and every map made at it): 10 at most.
    expect(randomPlayers(300, "island", RANDOM_MAX_SEATS)).toEqual({ min: 4, max: 10, recommended: { min: 8, max: 10 } });
    for (const shape of ["island", "archipelago", "twins", "crescent", "inland"] as const) {
      expect(randomPlayers(400, shape).max).toBe(RANDOM_BIG_SEATS);
      expect(randomRecipe(400, shape, "quiet-heron", 5).players.max).toBe(RANDOM_MAX_SEATS);
      expect(randomRecipe(400, shape, "quiet-heron", 6).players.max).toBe(RANDOM_BIG_SEATS);
    }
    expect(randomRecipe(200, "island", "quiet-heron", 6).players).toEqual(randomRecipe(200, "island", "quiet-heron", 5).players);
    expect(parseRandomId("400-inland-quiet-heron")).toEqual({ size: 400, shape: "inland", seed: "quiet-heron" });
    expect(parseRandomId("500-inland-quiet-heron")).toBeNull();
  });

  it("the big sizes' recipe: at most 10 ranges and 60 layout starts; the smaller sizes' as before", () => {
    for (const seed of ["quiet-heron", "jolly-lake", "cold-kestrel"]) {
      expect(randomRecipe(400, "island", seed).mountainRanges).toBeLessThanOrEqual(10);
      expect(randomRecipe(400, "island", seed).layoutStarts).toBe(60);
      expect(randomRecipe(300, "twins", seed).layoutStarts).toBe(60);
      expect(randomRecipe(200, "island", seed).layoutStarts).toBeUndefined();
    }
  });

  it("pinned: 300-inland-quiet-heron at version 5", () => {
    const { map, attempt } = randomMap("300-inland-quiet-heron", defaultRules, { version: 5 });
    expect(attempt).toBe(1);
    expect(mapFingerprint(map)).toBe("d0d818eb23b23555");
  }, 120_000);

  it("pinned: 400-island-quiet-heron at version 5, every name on it different, a layout for 6 to 10 players", () => {
    const { map, attempt } = randomMap("400-island-quiet-heron", defaultRules, { version: 5 });
    expect(attempt).toBe(1);
    expect(mapFingerprint(map)).toBe("031d1616e881fca0");
    expect(map.territories).toHaveLength(400);
    // No name twice on one map: territories, provinces, and the two lists against each other.
    const names = [...map.territories.map((t) => t.name), ...map.provinces.map((p) => p.name)].map((n) => n.toLowerCase().replace(/^the /, ""));
    expect(new Set(names).size).toBe(names.length);
    expect(map.provinces.length).toBeGreaterThan(80);
    expect(map.capitalLayouts!.map((l) => l.players)).toEqual([6, 7, 8, 9, 10]);
    // Version 5's head start on the big map too: troops by exposure, the market and culture on the more exposed half.
    const ten = map.capitalLayouts!.find((l) => l.players === 10)!;
    expect(Object.keys(ten.buildings ?? {})).toHaveLength(5);
    expect(Object.keys(ten.bonus ?? {}).length).toBeGreaterThanOrEqual(5);
  }, 120_000);
});

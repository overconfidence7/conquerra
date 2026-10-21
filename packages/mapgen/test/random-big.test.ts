import { defaultRules } from "@conquerra/content";
import { describe, expect, it } from "vitest";
import { exposureProblem, mapFingerprint, parseRandomId, randomMap, randomPlayers, randomRecipe, RANDOM_BIG_SEATS, RANDOM_MAX_SEATS, RANDOM_SEATS_NOW, RANDOM_SIZES, RANDOM_VERSION, randomVersionDef, versionSeats } from "../src/index";

/**
 * Session 33b: random maps at 300 and 400 territories, for the big tables (session 34) and the battle royale later.
 * New in version 5 (no game was ever made on one before), so their recipe can differ from the smaller sizes': at most
 * 10 mountain ranges, and a harder search for fair capital layouts. One cheap pin each (seeds that pass on their first
 * try): a 400 takes a few seconds to build.
 */
describe("random maps at 300 and 400 territories (session 33b)", () => {
  it("the sizes and who they suit: 300 from 4 to 10 players (8 to 10 suggested), 400 from 6 to 10 (10); session 34 (version 6): the 300 seats up to 12, the 400 up to 16", () => {
    expect(RANDOM_SIZES).toEqual([40, 80, 120, 200, 300, 400]);
    expect(RANDOM_MAX_SEATS).toBe(10);
    // (Session 34b: RANDOM_PLAYERS holds the most any version seats; version 6's own caps: the 300 at 12, the 400 at 16.)
    expect(RANDOM_BIG_SEATS).toBe(20);
    // The lobby's seat counts (written out for the start-up bundle) are the current version's.
    for (const size of RANDOM_SIZES) for (const shape of ["island", "archipelago"] as const) expect(randomPlayers(size, shape)).toEqual(randomPlayers(size, shape, versionSeats(randomVersionDef(RANDOM_VERSION).seats, size)));
    expect(Object.keys(RANDOM_SEATS_NOW).sort()).toEqual(["300", "400"]);
    expect(randomPlayers(300, "island", versionSeats(16, 300))).toEqual({ min: 4, max: 12, recommended: { min: 8, max: 10 } });
    expect(randomPlayers(400, "island", versionSeats(16, 400))).toEqual({ min: 6, max: 16, recommended: { min: 10, max: 10 } });
    // Version 5's (and every map made at it): 10 at most.
    expect(randomPlayers(300, "island", RANDOM_MAX_SEATS)).toEqual({ min: 4, max: 10, recommended: { min: 8, max: 10 } });
    for (const shape of ["island", "archipelago", "twins", "crescent", "inland"] as const) {
      // (A big archipelago stays at 10.)
      const most = shape === "archipelago" ? RANDOM_MAX_SEATS : 16;
      expect(randomPlayers(400, shape, versionSeats(16, 400)).max).toBe(most);
      expect(randomRecipe(400, shape, "quiet-heron", 5).players.max).toBe(RANDOM_MAX_SEATS);
      expect(randomRecipe(400, shape, "quiet-heron", 6).players.max).toBe(most);
    }
    expect(randomPlayers(300, "archipelago").max).toBe(RANDOM_MAX_SEATS);
    expect(randomRecipe(200, "island", "quiet-heron", 6).players).toEqual(randomRecipe(200, "island", "quiet-heron", 5).players);
    // Session 34b (version 7, current): the 400 up to 20, the 300 up to 16; archipelagos 10; the smaller sizes as before.
    expect(RANDOM_VERSION).toBe(7);
    expect(randomPlayers(400, "island")).toEqual({ min: 6, max: 20, recommended: { min: 10, max: 10 } });
    expect(randomPlayers(300, "crescent")).toEqual({ min: 4, max: 16, recommended: { min: 8, max: 10 } });
    expect(randomPlayers(400, "archipelago").max).toBe(RANDOM_MAX_SEATS);
    expect(randomRecipe(400, "twins", "quiet-heron", 7).players.max).toBe(20);
    expect(randomRecipe(300, "twins", "quiet-heron", 7).players.max).toBe(16);
    expect(randomRecipe(300, "twins", "quiet-heron", 6).players.max).toBe(12);
    for (const size of [40, 80, 120, 200] as const) expect(randomRecipe(size, "island", "quiet-heron", 7).players).toEqual(randomRecipe(size, "island", "quiet-heron", 6).players);
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

  it("pinned (session 34): version 6's 400 with layouts for 6 to 16 players, within the band", () => {
    const big = randomMap("400-island-quiet-heron", defaultRules, { version: 6 });
    expect(big.attempt).toBe(1);
    expect(mapFingerprint(big.map)).toBe("045ba6f02ac72662");
    expect(big.map.capitalLayouts!.map((l) => l.players)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(exposureProblem(big.map, 4, null)).toBeNull();
    // Its layouts for 6 to 10 come from the same search as version 5's (the head start too); 11 and up are new.
    const sixteen = big.map.capitalLayouts!.find((l) => l.players === 16)!;
    expect(Object.keys(sixteen.buildings ?? {})).toHaveLength(8);
  }, 180_000);

  it("pinned (session 34): version 6's 300 with layouts for 4 to 12", () => {
    const mid = randomMap("300-inland-quiet-heron", defaultRules, { version: 6 });
    expect(mid.attempt).toBe(1);
    expect(mapFingerprint(mid.map)).toBe("8330a41fcd5f02ad");
    expect(mid.map.maxPlayers).toBe(12);
  }, 180_000);

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

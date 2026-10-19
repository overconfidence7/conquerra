import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import {
  cleanSeed,
  generateMap,
  isRandomMapId,
  mapFingerprint,
  MAPGEN_VERSION,
  MAP_CONFIGS,
  newSeedWords,
  parseRandomId,
  randomMap,
  RandomMapFailed,
  randomMapId,
  randomPlayers,
  randomRecipe,
  RANDOM_SHAPE_IDS,
  RANDOM_SIZES,
  RANDOM_TEXT,
  RANDOM_TRIES,
  seedWords,
} from "../src/index";

/**
 * Session 30: the map maker in stages, and random maps. The twelve official maps come out exactly as before (their one
 * shared random stream); a random map's stages each have their own stream; a random map is its id.
 */

/** The twelve's fingerprints as committed before the stage split (session 30): re-pin nothing. */
const BEFORE_SPLIT: Record<string, string> = {
  embervale: "94a226ab48b4dd53",
  greatmarch: "a576ca43dc0b8e67",
  "shattered-isles": "3637d3742ce446aa",
  "twin-realms": "ab90227d726bfcb5",
  "moon-coast": "445c04602c8569da",
  ringsea: "c4095b333c289e69",
  crownlands: "f74391d2253828f2",
  wyrmland: "998384d6193230e0",
  ashwing: "bc5e7700ebabb97c",
  "sundered-crowns": "e7393caa21504fa6",
  krakenmere: "494246838c13b36d",
  rootholm: "cd1aea5aafcf1f5c",
};

describe("the stage split (session 30)", () => {
  it("the twelve official maps are the same maps, byte for byte (their committed files, which the map maker test rebuilds)", () => {
    expect(Object.fromEntries(Object.entries(maps).map(([id, m]) => [id, mapFingerprint(m)]))).toEqual(BEFORE_SPLIT);
    // And their recipes still ask for the one shared stream (the default).
    for (const c of MAP_CONFIGS) expect(c.streams ?? "shared").toBe("shared");
    expect(MAPGEN_VERSION).toBe(2);
  });

  it("a stage's own stream: another seed for the names or the decorations changes no border, no terrain, no capital", () => {
    const r = randomRecipe(40, "inland", "jolly-lake");
    const base = generateMap(r, defaultRules).map;
    const shape = (m: typeof base) => JSON.stringify({ t: m.territories.map((t) => [t.id, t.province, t.terrain]), b: m.borders, c: m.capitalLayouts, lines: m.geometry!.borderLines, rivers: m.geometry!.rivers.map((x) => x.path) });
    const names = generateMap({ ...r, stageSeeds: { names: "another" } }, defaultRules).map;
    expect(shape(names)).toBe(shape(base));
    expect(names.territories.map((t) => t.name)).not.toEqual(base.territories.map((t) => t.name));
    const places = generateMap({ ...r, stageSeeds: { places: "another" } }, defaultRules).map;
    expect(shape(places)).toBe(shape(base));
    expect(places.territories.map((t) => t.name)).toEqual(base.territories.map((t) => t.name));
    expect(places.geometry!.decorations).not.toEqual(base.geometry!.decorations);
    // The rivers' stream moves rivers, not the coast or the territories' cells.
    const rivers = generateMap({ ...r, stageSeeds: { rivers: "another" } }, defaultRules).map;
    expect(rivers.geometry!.water).toEqual(base.geometry!.water);
  }, 60_000);
});

describe("random maps (session 30)", () => {
  it("an id is a size, a shape and two words; it reads back, forgiving case and spaces; a typed seed is cleaned", () => {
    for (const size of RANDOM_SIZES)
      for (const shape of RANDOM_SHAPE_IDS) {
        const id = randomMapId(size, shape, "quiet-heron");
        expect(parseRandomId(id)).toEqual({ size, shape, seed: "quiet-heron" });
        expect(parseRandomId(`random:${id}`)).toEqual({ size, shape, seed: "quiet-heron" });
      }
    expect(randomMapId(80, "crescent", "quiet-heron")).toBe("80-crescent-quiet-heron");
    expect(isRandomMapId("random:80-crescent-quiet-heron")).toBe(true);
    expect(isRandomMapId("embervale")).toBe(false);
    for (const bad of ["80-crescent-quiet", "81-crescent-quiet-heron", "80-dragon-quiet-heron", "80-crescent-quiet-her0n", "80-crescent-a-heron", ""]) expect(parseRandomId(bad)).toBeNull();
    expect(cleanSeed("  Quiet Heron ")).toBe("quiet-heron");
    expect(cleanSeed("quiet_heron")).toBe("quiet-heron");
    expect(cleanSeed("quiet")).toBeNull();
    expect(cleanSeed("quiet heron owl")).toBeNull();
  });

  it("seeds in a row are all different pairs of words; the lobby's dice pick two words from the lists", () => {
    const run = Array.from({ length: 500 }, (_, i) => seedWords(i));
    expect(new Set(run).size).toBe(500);
    for (const s of run) expect(cleanSeed(s)).toBe(s);
    let k = 0;
    const dice = () => [0.1, 0.9][k++ % 2]!;
    expect(newSeedWords(dice)).toMatch(/^[a-z]+-[a-z]+$/);
  });

  it("the same id makes the same map (at this map maker version), staged, with the random recipe's knobs", () => {
    // (Session 31: built at random map version 2, session 30's, which must never change: games pin it.)
    const a = randomMap("random:40-island-quiet-heron", defaultRules, { version: 2 });
    const b = randomMap("40-island-quiet-heron", defaultRules, { version: 2 });
    expect(mapFingerprint(a.map)).toBe(mapFingerprint(b.map));
    expect(a.map.id).toBe("random:40-island-quiet-heron");
    expect(a.map.name).toBe("Random, 40 territories");
    expect(a.map.generator).toMatchObject({ version: 2, seed: "quiet-heron" });
    expect(a.map.territories).toHaveLength(40);
    expect(a.map.minPlayers).toBe(randomPlayers(40, "island").min);
    expect(a.map.maxPlayers).toBe(randomPlayers(40, "island").max);
    // Pinned: if this changes, the map maker's output changed, and the version must go up (games pin it).
    expect(mapFingerprint(a.map)).toBe(PINNED_40);
    expect(mapFingerprint(randomMap("40-island-quiet-heron", defaultRules, { version: 3 }).map)).toBe(PINNED_40_V3);
    expect(mapFingerprint(randomMap("40-island-quiet-heron", defaultRules).map)).toBe(PINNED_40_V4);
    // A different seed, a different map.
    expect(mapFingerprint(randomMap("40-inland-jolly-lake", defaultRules).map)).not.toBe(mapFingerprint(a.map));
  }, 60_000);

  it("rerolls stop at five: a seed whose six tries all fail says the plain line", () => {
    let failed: unknown = null;
    try {
      randomMap("40-archipelago-cold-kestrel", defaultRules);
    } catch (e) {
      failed = e;
    }
    expect(failed).toBeInstanceOf(RandomMapFailed);
    expect((failed as RandomMapFailed).message).toBe(RANDOM_TEXT.failed);
    expect((failed as RandomMapFailed).tries).toHaveLength(RANDOM_TRIES);
    expect(RANDOM_TRIES).toBe(6);
    expect(() => randomMap("80-dragon-quiet-heron", defaultRules)).toThrow(RANDOM_TEXT.badId);
  }, 60_000);

  it("the seat rule on a random map: its harder spots (the exposure check's) go to bots before a person", () => {
    const { map } = randomMap("80-island-quiet-heron", defaultRules, { version: 2 });
    const layout = map.capitalLayouts!.find((l) => l.harder?.length)!;
    expect(layout).toBeDefined();
    expect(layout.bonus).toBeUndefined();
    const players = Array.from({ length: layout.players }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, bot: i > 0 }));
    let dealtHarder = 0;
    for (let s = 0; s < 40; s++) {
      const anyone = createGame({ map, rules: defaultRules }, { gameId: "g", seed: `seat-${s}`, players, seatRule: "anyone" });
      const fair = createGame({ map, rules: defaultRules }, { gameId: "g", seed: `seat-${s}`, players, seatRule: "botsFirst" });
      if (layout.harder!.includes(anyone.players.find((p) => p.id === "p1")!.capital!)) dealtHarder++;
      expect(layout.harder).not.toContain(fair.players.find((p) => p.id === "p1")!.capital);
    }
    // (Dealt at random, the person would have sat on one now and then.)
    expect(dealtHarder).toBeGreaterThan(0);
  }, 60_000);
});

/** The fingerprint of random map 40-island-quiet-heron at random map version 2 (session 30), at 3 (session 31) and at 4 (session 33). */
const PINNED_40 = "6b42b78a243e32b4";
const PINNED_40_V3 = "69de27e979c27539";
const PINNED_40_V4 = "dbb2a3c5f9b5dedf";

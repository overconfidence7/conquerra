import { defaultRules } from "@conquerra/content";
import { createGame } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { exposureProblem, isRandomVersion, mapFingerprint, MAP_STEPS, randomMap, randomRecipe, RANDOM_EXPOSURE_BAND, RANDOM_TEXT, RANDOM_VERSION, RANDOM_VERSIONS } from "../src/index";

/**
 * Session 31, Step 0: random map version 3. The harder spots start with +4 troops (the official maps' middle bonus)
 * and the exposure band at generation is 4.0. Version 2 (session 30's) still builds exactly as it did, so a game made
 * before the change keeps its map; crescents are fatter at version 3.
 */
describe("random map version 3 (session 31)", () => {
  it("the versions: 3 has the band 4.0 and +4 troops; 2 is kept; 1 can't be built (session 33: 4 is current)", () => {
    expect(RANDOM_VERSION).toBe(4);
    expect(RANDOM_VERSIONS[3]).toEqual({ band: 4.0, bonus: 4 });
    expect(RANDOM_VERSIONS[2]).toEqual({ band: 5.5, bonus: 0 });
    expect(RANDOM_EXPOSURE_BAND).toBe(4.0);
    expect([isRandomVersion(2), isRandomVersion(3), isRandomVersion(4), isRandomVersion(1), isRandomVersion(null)]).toEqual([true, true, true, false, false]);
    expect(() => randomMap("40-island-quiet-heron", defaultRules, { version: 1 })).toThrow(RANDOM_TEXT.oldVersion(1));
  });

  it("a harder spot starts with 4 more troops, and goes to a bot before a person", () => {
    const { map } = randomMap("80-island-quiet-heron", defaultRules, { version: 3 });
    expect(map.generator?.version).toBe(3);
    const layout = map.capitalLayouts!.find((l) => l.harder?.length)!;
    expect(layout.bonus).toEqual(Object.fromEntries(layout.harder!.map((s) => [s, 4])));
    const players = Array.from({ length: layout.players }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, bot: i > 0 }));
    for (let s = 0; s < 12; s++) {
      const g = createGame({ map, rules: defaultRules }, { gameId: "g", seed: `bonus-${s}`, players, startBonus: true, seatRule: "botsFirst" });
      for (const p of g.players) {
        const harder = layout.harder!.includes(p.capital!);
        expect(g.territories[p.capital!]!.troops).toBe(defaultRules.setup.startTroops + (harder ? 4 : 0));
        expect(p.startBonus ?? 0).toBe(harder ? 4 : 0);
      }
      expect(layout.harder).not.toContain(g.players.find((p) => p.id === "p1")!.capital);
    }
    // A game set up before the start bonus (a save's history) gets none, as with the official maps.
    const old = createGame({ map, rules: defaultRules }, { gameId: "g", seed: "bonus-0", players });
    expect(old.players.every((p) => !p.startBonus)).toBe(true);
  }, 60_000);

  it("every layout of a version 3 map is within the band of 4.0 (version 2's was 5.5)", () => {
    const { map } = randomMap("80-island-quiet-heron", defaultRules, { version: 3 });
    expect(exposureProblem(map, 4.0)).toBeNull();
  }, 60_000);

  it("version 2 still builds session 30's map (no bonus, the same layouts) beside version 3", () => {
    const v2 = randomMap("80-island-quiet-heron", defaultRules, { version: 2 }).map;
    expect(v2.generator?.version).toBe(2);
    expect(v2.capitalLayouts!.every((l) => !l.bonus)).toBe(true);
    expect(mapFingerprint(v2)).toBe(mapFingerprint(randomMap("80-island-quiet-heron", defaultRules, { version: 2 }).map));
  }, 60_000);

  it("a version 3 crescent: a smaller bay, one isle, longer lanes and fewer choke points asked; version 2's is as it was", () => {
    const v3 = randomRecipe(80, "crescent", "quiet-heron");
    const v2 = randomRecipe(80, "crescent", "quiet-heron", 2);
    expect(v3).toMatchObject({ islands: 1, bite: 0.5, biteOffset: 0.5, minChokePoints: 4, laneReach: Math.round(v2.laneReach! * 1.6) });
    expect(v2.bite).toBeUndefined();
    expect(v2.minChokePoints).toBe(7);
    // Only crescents change.
    expect(randomRecipe(80, "island", "quiet-heron")).toEqual(randomRecipe(80, "island", "quiet-heron", 2));
  });

  it("progress: told each step of each try, the map the same with or without it", () => {
    const steps: [number, number][] = [];
    const a = randomMap("40-inland-jolly-lake", defaultRules, { onProgress: (s, t) => steps.push([s, t]) });
    expect(mapFingerprint(a.map)).toBe(mapFingerprint(randomMap("40-inland-jolly-lake", defaultRules).map));
    expect(steps[0]).toEqual([1, 1]);
    expect(steps.at(-1)).toEqual([MAP_STEPS, a.attempt]);
    expect(steps.every(([s]) => s >= 1 && s <= MAP_STEPS)).toBe(true);
  }, 60_000);
});

import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { describe, expect, it } from "vitest";
import { adjacency, allDistances, exposureOf, exposureProblem, mapFingerprint, randomMap, randomVersionDef } from "../src/index";

/**
 * Session 34b, random map version 7: the 400 seats up to 20 and the 300 up to 16, with the band 5.5 for the layouts
 * above 12 players (4.0 at 12 and under). Its own file: the two pins take about 20 s to build.
 */
describe("random map version 7 (session 34b)", () => {
  it("the band by table size (session 34b, version 7): 4.0 up to 12 seats, 5.5 above; versions before it one band for every count", () => {
    expect(randomVersionDef(7).band).toBe(4);
    expect(randomVersionDef(7).bandAbove).toEqual({ players: 12, band: 5.5 });
    for (const v of [2, 3, 4, 5, 6]) expect(randomVersionDef(v).bandAbove).toBeUndefined();
    // A 16-seat layout judged by a band just under its own ratio fails, unless the looser band covers 16 seats.
    const map = maps.rootholm!;
    const sixteen = map.capitalLayouts!.find((l) => l.players === 16)!;
    const e = exposureOf(sixteen.slots, allDistances(map), adjacency(map)).exposure;
    const r = Math.max(...e) / Math.min(...e);
    const tight = { ...map, capitalLayouts: [sixteen] };
    expect(exposureProblem(tight, r - 0.01, null)).not.toBeNull();
    expect(exposureProblem(tight, r - 0.01, { players: 12, band: r + 0.01 })).toBeNull();
    expect(exposureProblem(tight, r - 0.01, { players: 16, band: r + 0.01 })).not.toBeNull();
  });

  // (Session 35: one map a test, so a busy machine never holds a worker past vitest's minute.)
  it("pinned (session 34b): version 7's 400 with layouts for 6 to 20 players", () => {
    const big = randomMap("400-island-quiet-heron", defaultRules, { version: 7 });
    expect(big.attempt).toBe(1);
    expect(mapFingerprint(big.map)).toBe("939e8db72a37d2a5");
    expect(big.map.capitalLayouts!.map((l) => l.players)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(exposureProblem(big.map, 4, { players: 12, band: 5.5 })).toBeNull();
  }, 360_000);

  it("pinned (session 34b): version 7's 300 with layouts for 4 to 16", () => {
    const mid = randomMap("300-inland-quiet-heron", defaultRules, { version: 7 });
    expect(mid.attempt).toBe(1);
    expect(mapFingerprint(mid.map)).toBe("b9c277188d4b959a");
    expect(mid.map.maxPlayers).toBe(16);
  }, 360_000);

});

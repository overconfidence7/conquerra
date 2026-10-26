import { defaultRules } from "@conquerra/content";
import { describe, expect, it } from "vitest";
import { exposureProblem, mapFingerprint, randomMap, randomPlayers, randomVersionDef, RANDOM_SEATS_NOW, RANDOM_VERSION } from "../src/index";

/**
 * Session 35, random map version 8 (Nate's call, Oct 20): the band above 12 seats goes from 5.5 to 6.0, so the 300
 * seats up to 20 as the 400 does (34b's seeds: 35 of 50 pass at 20 on a 300 at 6.0). Everything else is version 7's.
 * Its own file: the two pins take about 20 s to build.
 */
describe("random map version 8 (session 35)", () => {
  it("is version 7 with the band 6.0 above 12 seats and 20 seats on the 300; versions 2 to 7 keep theirs", () => {
    expect(RANDOM_VERSION).toBe(8);
    const { bandAbove: b8, seats: s8, ...v8 } = randomVersionDef(8);
    const { bandAbove: b7, seats: s7, ...v7 } = randomVersionDef(7);
    expect(v8).toEqual(v7);
    expect(b7).toEqual({ players: 12, band: 5.5 });
    expect(b8).toEqual({ players: 12, band: 6 });
    expect(s7).toEqual({ 300: 16, 400: 20 });
    expect(s8).toEqual({ 300: 20, 400: 20 });
    expect(RANDOM_SEATS_NOW).toEqual({ 300: 20, 400: 20 });
    expect(randomPlayers(300, "twins").max).toBe(20);
    expect(randomPlayers(300, "archipelago").max).toBe(10);
  });

  it("pinned: version 8's 400 with layouts for 6 to 20 players, its 300 for 4 to 20 (one of them only inside the looser band)", () => {
    const big = randomMap("400-island-quiet-heron", defaultRules, { version: 8 });
    expect(big.attempt).toBe(1);
    expect(mapFingerprint(big.map)).toBe("c2c33606cb9bfd1e");
    expect(big.map.capitalLayouts!.map((l) => l.players)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    const mid = randomMap("300-inland-quiet-heron", defaultRules, { version: 8 });
    expect(mid.attempt).toBe(1);
    expect(mapFingerprint(mid.map)).toBe("75fc219a57fbdcc6");
    expect(mid.map.maxPlayers).toBe(20);
    expect(exposureProblem(mid.map, 4, { players: 12, band: 6 })).toBeNull();
    // Its 18-seat layout is 5.9 times as exposed, most to least: version 7's band would have refused it.
    expect(exposureProblem(mid.map, 4, { players: 12, band: 5.5 })).toMatch(/18 players/);
  }, 360_000);
});

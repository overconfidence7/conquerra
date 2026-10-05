import { makeCaptainBot } from "@conquerra/bots";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { describe, expect, it } from "vitest";
import { runGame, simReport } from "../src";

describe("sim report", () => {
  it("summarizes a few Captain games the same way every time", () => {
    const ctx = { map: maps.embervale!, rules: defaultRules };
    const play = () => [0, 1, 2].map((i) => runGame(ctx, `rep-${i}`, 4, { luck: 0.3, fog: true }, false, makeCaptainBot()));
    const a = simReport(play(), 4), b = simReport(play(), 4);
    expect(a).toEqual(b);
    expect(a.games).toBe(3);
    expect(a.seatWins.reduce((x, y) => x + y, 0) + a.draws).toBeCloseTo(1);
    expect(a.turns.avg).toBeGreaterThan(5);
    expect(a.battles.perGame).toBeGreaterThan(0);
    expect(a.battles.passShare + a.battles.seaShare).toBeLessThanOrEqual(1);
  }, 60_000);
});

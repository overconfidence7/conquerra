import { describe, expect, it } from "vitest";
import { houseSummary, rulesSummary } from "../src/logic/lobbyText";
import { decodeRuns, encodeRuns, mapThumbs, shrinkGround } from "../src/logic/mapThumb";
import { useGame } from "../src/store";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Session 25b: the lobby redesigned (Nate: declutter, dropdowns, smaller text). */
describe("the lobby's folded blocks show their choices in one line", () => {
  it("Rules: luck, fog, Fate, diplomacy, victory and the timer", () => {
    const l = useGame.getState().lobby;
    expect(rulesSummary({ ...l, luck: 0.3, fog: true, fate: true, diplomacy: true, mode: "classic", turnSeconds: 300 })).toBe("normal luck, fog on, Fate on, diplomacy on, classic, 5 min a turn");
    expect(rulesSummary({ ...l, luck: 0, fog: false, fate: false, diplomacy: false, mode: "conquest", turnSeconds: null })).toBe("no luck, fog off, Fate off, diplomacy off, conquest, no timer");
  });

  it("Your House: the colour, the Leader and the Steward with their personalities", () => {
    const l = useGame.getState().lobby;
    expect(houseSummary({ ...l, house: 0, leaderName: "Osric", leaderPersonality: null, stewardName: "", stewardPersonality: "turtle" }, "Fulk")).toMatch(/^\w+ \(\w+\), Leader Osric \(Neutral\), Steward Fulk \(Turtle\)$/);
  });
});

describe("the map pictures", () => {
  it("run-length coding round-trips", () => {
    expect(decodeRuns(encodeRuns("OOOggfO"))).toBe("OOOggfO");
  });
  it("shrinks a ground grid to about 72 cells across, each its most common ground", () => {
    const t = shrinkGround({ cols: 4, rows: 2, data: "OOggOOgg" }, 2);
    expect(t).toEqual({ cols: 2, rows: 1, data: "O1g1" });
  });
  it("public/maps/thumbs.json is up to date with the maps (pnpm map-thumbs)", async () => {
    const file = JSON.parse(readFileSync(join(__dirname, "../public/maps/thumbs.json"), "utf8"));
    expect(file).toEqual(await mapThumbs());
  }, 60_000);
});

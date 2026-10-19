import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomMaps } from "@conquerra/content/randomMaps";
import { describe, expect, it } from "vitest";
import { RANDOM_UI } from "../src/ui/RandomMap";

/** Session 33: the lobby's random-map card says what a random map's exposed spots get, in one line. */
const here = dirname(fileURLToPath(import.meta.url));

describe("the random map's card (sessions 33 and 33b, versions 4 and 5)", () => {
  it("one line, the cap from the content: \"Exposed spots start with extra troops (up to 6).\"", () => {
    const cap = randomMaps.versions[String(randomMaps.current)]!.grade!.cap;
    expect(RANDOM_UI.headStart(cap)).toBe("Exposed spots start with extra troops (up to 6).");
    const src = readFileSync(join(here, "../src/ui/RandomMap.tsx"), "utf8");
    expect(src).toContain("RANDOM_UI.headStart(HEAD_START_CAP, HEAD_START)");
    expect(src).toContain("randomVersionDef(RANDOM_VERSION).grade?.cap");
    expect(src).toContain("randomVersionDef(RANDOM_VERSION).start");
  });

  it("session 33b (version 5): and the market, from the content's start block", () => {
    const start = randomMaps.versions[String(randomMaps.current)]!.start!;
    expect(start.market).toBe(true);
    // The shipped setting (session 33b's third): the more exposed half, a market and a level of culture.
    expect(start).toEqual({ spots: "aboveMiddle", market: true, culture: 1 });
    expect(RANDOM_UI.headStart(6, start)).toBe("Exposed spots start with extra troops (up to 6), the most exposed with a market and a level of culture.");
    expect(RANDOM_UI.headStart(6, { spots: "aboveMiddle", market: true, culture: 0 })).toBe("Exposed spots start with extra troops (up to 6), the most exposed with a market.");
    expect(RANDOM_UI.headStart(6, { spots: "all", market: true, culture: 1 })).toBe("Exposed spots start with extra troops (up to 6), a market and a level of culture.");
  });
});

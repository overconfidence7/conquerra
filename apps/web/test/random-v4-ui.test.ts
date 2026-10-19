import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomMaps } from "@conquerra/content/randomMaps";
import { describe, expect, it } from "vitest";
import { RANDOM_UI } from "../src/ui/RandomMap";

/** Session 33: the lobby's random-map card says what a random map's exposed spots get, in one line. */
const here = dirname(fileURLToPath(import.meta.url));

describe("the random map's card (session 33, version 4)", () => {
  it("one line, the cap from the content: \"Exposed spots start with extra troops (up to 6).\"", () => {
    const cap = randomMaps.versions[String(randomMaps.current)]!.grade!.cap;
    expect(RANDOM_UI.headStart(cap)).toBe("Exposed spots start with extra troops (up to 6).");
    const src = readFileSync(join(here, "../src/ui/RandomMap.tsx"), "utf8");
    expect(src).toContain("RANDOM_UI.headStart(HEAD_START_CAP)");
    expect(src).toContain("randomVersionDef(RANDOM_VERSION).grade?.cap");
  });
});

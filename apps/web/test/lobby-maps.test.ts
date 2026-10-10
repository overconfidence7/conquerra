import { mapCatalog } from "@conquerra/content";
import { describe, expect, it } from "vitest";
import { MAP_SUITS } from "../src/logic/text";

describe("the lobby's maps (session 19)", () => {
  it("lists the bigger maps, and has a line for every map on who it suits", () => {
    expect(mapCatalog.map((m) => m.id)).toEqual(expect.arrayContaining(["ashwing", "sundered-crowns", "krakenmere", "rootholm"]));
    for (const m of mapCatalog) {
      expect(MAP_SUITS[m.id], m.id).toBeTruthy();
      // The line names the map's suggested table sizes.
      expect(MAP_SUITS[m.id]).toContain(`${m.recommendedPlayers.min} to ${m.recommendedPlayers.max}`);
    }
  });
});

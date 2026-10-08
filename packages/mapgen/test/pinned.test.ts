import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { describe, expect, it } from "vitest";
import { allDistances, fairness, MAP_CONFIGS, territoryIncome } from "../src";

/**
 * Fair seats (sessions 19 and 20b): capital layouts chosen with the simulator are pinned in each map's recipe
 * (`capitals`). The committed map carries exactly them, they're the map's own capital spots, and they pass the map
 * maker's paper check (each capital about as far from its nearest rival, about as much gold within 2 steps).
 */
describe("pinned capital layouts", () => {
  const pinned = MAP_CONFIGS.filter((c) => c.capitals && Object.keys(c.capitals).length);
  it("there are some (Embervale at 4 since session 19)", () => {
    expect(pinned.some((c) => c.id === "embervale" && c.capitals![4])).toBe(true);
  });
  for (const c of pinned)
    for (const [n, slots] of Object.entries(c.capitals!))
      it(`${c.id} at ${n}: in the map file, the map's own capital spots, and fair on paper`, () => {
        const map = maps[c.id]!;
        expect(map.capitalLayouts!.find((l) => l.players === Number(n))?.slots).toEqual(slots);
        expect(slots).toHaveLength(Number(n));
        expect(new Set(slots).size).toBe(Number(n));
        for (const s of slots) expect(map.capitalSlots).toContain(s);
        expect(fairness(slots, allDistances(map), territoryIncome(map, defaultRules)).fair).toBe(true);
      });
});

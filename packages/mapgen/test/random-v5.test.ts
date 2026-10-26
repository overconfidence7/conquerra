import { defaultRules } from "@conquerra/content";
import { randomMaps } from "@conquerra/content/randomMaps";
import { createGame, viewFor } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { adjacency, allDistances, exposureOf, gradeBonus, mapFingerprint, randomMap, RANDOM_VERSION, RANDOM_VERSIONS, startSpots } from "../src/index";

/**
 * Session 33b: random map version 5, the income head start (Nate's call, Oct 18). Version 4's graded troops stay; on
 * top, the spots `start.spots` names by exposure rank start with a market at their capital (+2 gold a turn while it's
 * held), finished on turn 1. The band and the land are version 4's, so the same seeds pass; versions 2 to 4 still
 * build exactly their maps, so a running game keeps its own.
 */
const V5 = RANDOM_VERSIONS[5]!;

describe("random map version 5 (session 33b): the income head start", () => {
  it("its values the content's (data/random-maps.json): version 4's grade and band, and a start block (session 34: version 6 is current, version 5 with 20 seats on the big sizes)", () => {
    expect(RANDOM_VERSION).toBe(7); // (session 34b)
    expect(randomMaps.current).toBe(8);
    const { seats, paperUpTo, ...v6 } = RANDOM_VERSIONS[6]!;
    expect(v6).toEqual(V5);
    expect(seats).toBe(16);
    expect(paperUpTo).toBe(10);
    // Session 34b: version 7 is version 6 with seats by size (the 400 to 20, the 300 to 16) and a looser band above 12.
    const { seats: seats7, bandAbove, ...v7 } = RANDOM_VERSIONS[7]!;
    expect(v7).toEqual({ ...V5, paperUpTo: 10 });
    expect(seats7).toEqual({ 300: 16, 400: 20 });
    expect(bandAbove).toEqual({ players: 12, band: 5.5 });
    expect(V5).toEqual(randomMaps.versions["5"]);
    expect(V5.band).toBe(RANDOM_VERSIONS[4]!.band);
    expect(V5.grade).toEqual(RANDOM_VERSIONS[4]!.grade);
    // Session 33b's third setting, the one shipped: the more exposed half, a market and a level of culture.
    expect(V5.start).toEqual({ spots: "aboveMiddle", market: true, culture: 1 });
  });

  it("which spots: by exposure rank, the safest never (and culture on its own spots, if the start block says so)", () => {
    // Ranks by exposure (safest first); the answer is slot indexes, in slot order.
    expect(startSpots([1, 2, 3, 4], "aboveMiddle")).toEqual([2, 3]);
    expect(startSpots([4, 3, 2, 1], "aboveMiddle")).toEqual([0, 1]);
    expect(startSpots([1, 2, 3, 4, 5, 6], "aboveMiddle")).toEqual([3, 4, 5]);
    expect(startSpots([1, 2, 3, 4, 5], "aboveMiddle")).toEqual([3, 4]);
    expect(startSpots([1, 2, 3, 4, 5, 6], "exposedThird")).toEqual([4, 5]);
    expect(startSpots([1, 2, 3, 4], "exposedThird")).toEqual([3]);
    expect(startSpots([3, 1, 2, 4], "all")).toEqual([0, 2, 3]);
  });

  it("a version 5 map: version 4's land and troops, and a market on the spots its start block names", () => {
    const v4 = randomMap("40-island-quiet-heron", defaultRules, { version: 4 }).map;
    const v5 = randomMap("40-island-quiet-heron", defaultRules, { version: 5 }).map;
    expect(v5.generator?.version).toBe(5);
    expect(v5.territories).toEqual(v4.territories);
    expect(v5.borders).toEqual(v4.borders);
    const d = allDistances(v5), adj = adjacency(v5);
    for (const [i, l] of v5.capitalLayouts!.entries()) {
      const was = v4.capitalLayouts![i]!;
      expect(l.slots).toEqual(was.slots);
      expect(l.bonus).toEqual(was.bonus);
      expect(l.harder).toEqual(was.harder);
      const e = exposureOf(l.slots, d, adj).exposure;
      expect(l.slots.map((s) => l.bonus?.[s] ?? 0)).toEqual(gradeBonus(e, V5.grade!));
      const want = startSpots(e, V5.start!.spots).map((k) => l.slots[k]!);
      expect(Object.keys(l.buildings ?? {}).sort()).toEqual([...want].sort());
      expect(Object.values(l.buildings ?? {}).every((b) => b === "market")).toBe(true);
      expect(l.culture).toEqual(Object.fromEntries(want.map((sl) => [sl, 1])));
      const safest = l.slots[e.indexOf(Math.min(...e))]!;
      expect(l.buildings?.[safest]).toBeUndefined();
    }
  }, 60_000);

  it("in a game: the market stands on turn 1, finished; the seat rule still deals the harder spots to bots first", () => {
    const { map } = randomMap("40-island-quiet-heron", defaultRules);
    const layout = map.capitalLayouts!.find((l) => l.players === 6)!;
    const players = Array.from({ length: 6 }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, bot: i > 0 }));
    let markets = 0;
    for (let s = 0; s < 12; s++) {
      const g = createGame({ map, rules: defaultRules }, { gameId: "g", seed: `v5-${s}`, players, startBonus: true, seatRule: "botsFirst" });
      for (const p of g.players) {
        const b = layout.buildings?.[p.capital] ?? null;
        expect(g.territories[p.capital]).toMatchObject({ building: b, construction: null, culture: layout.culture?.[p.capital] ?? 0, troops: defaultRules.setup.startTroops + (layout.bonus?.[p.capital] ?? 0) });
        expect(p.startBuilding ?? null).toBe(b);
        expect(p.startCulture ?? 0).toBe(layout.culture?.[p.capital] ?? 0);
        if (b) markets++;
      }
      expect(layout.harder).not.toContain(g.players.find((p) => p.id === "p1")!.capital);
      // Everyone's view says who started with a market, never where.
      const v = viewFor({ map, rules: defaultRules }, g, "p1");
      expect(v.players.filter((p) => p.startBuilding === "market").length).toBe(Object.keys(layout.buildings ?? {}).length);
    }
    expect(markets).toBe(12 * Object.keys(layout.buildings ?? {}).length);
    expect(markets).toBeGreaterThan(0);
  });

  it("made from the try that passed (the room and the online pages are told it): the same map, byte for byte; a hint that isn't one of the tries is ignored", () => {
    const all = randomMap("40-island-quiet-heron", defaultRules);
    expect(all.attempt).toBe(2);
    const hinted = randomMap("40-island-quiet-heron", defaultRules, { attempt: 2 });
    expect(hinted.attempt).toBe(2);
    expect(mapFingerprint(hinted.map)).toBe(mapFingerprint(all.map));
    expect(mapFingerprint(randomMap("40-island-quiet-heron", defaultRules, { attempt: 1 }).map)).toBe(mapFingerprint(all.map));
    // A hint that isn't one of the six tries is ignored: every try is made, as without one.
    const first = randomMap("80-island-quiet-heron", defaultRules);
    expect(first.attempt).toBe(1);
    expect(mapFingerprint(randomMap("80-island-quiet-heron", defaultRules, { attempt: 7 }).map)).toBe(mapFingerprint(first.map));
  }, 60_000);

  // Pinned, one cheap map a size (seeds that pass on their first try). Taken when version 5 shipped.
  const PINNED: [id: string, fingerprint: string][] = [
    ["40-island-quiet-heron", "12520252d93ea256"],
    ["80-island-quiet-heron", "2e57cd7c9e308b7c"],
    ["120-island-quiet-heron", "2d0deea1f15f6193"],
    ["200-inland-quiet-heron", "eaea1f5d84f1748b"],
  ];
  for (const [id, fp] of PINNED)
    it(`pinned: ${id} at version 5`, () => {
      expect(mapFingerprint(randomMap(id, defaultRules, { version: 5 }).map)).toBe(fp);
    }, 120_000);
});

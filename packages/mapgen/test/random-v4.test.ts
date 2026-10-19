import { defaultRules } from "@conquerra/content";
import { randomMaps } from "@conquerra/content/randomMaps";
import { createGame } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { adjacency, allDistances, exposureOf, gradeBonus, mapFingerprint, randomMap, RANDOM_EXPOSURE_BAND, RANDOM_VERSION, RANDOM_VERSIONS } from "../src/index";

/**
 * Session 33: random map version 4, the graded head start (Nate's call, Oct 16). Each layout's spots are ranked by the
 * map maker's exposure check; the safest gets nothing, every other spot extra troops that grow with how exposed it is,
 * up to 6. The harder spots stay as they were (the most exposed third of the table: bots take those first). The band
 * stays 4.0, so the same seeds pass as at version 3 and the land is the same; only the troops differ. Versions 2 and 3
 * still build exactly as before, so a running game keeps its map.
 */
const GRADE = RANDOM_VERSIONS[4]!.grade!;

describe("random map version 4 (session 33): the graded head start", () => {
  it("is the current version, its values the content's (data/random-maps.json), the band unchanged", () => {
    expect(RANDOM_VERSION).toBe(4);
    expect(randomMaps.current).toBe(4);
    expect(RANDOM_VERSIONS[4]).toEqual(randomMaps.versions["4"]);
    expect(RANDOM_VERSIONS[4]!.band).toBe(4);
    expect(RANDOM_EXPOSURE_BAND).toBe(4);
    expect(GRADE.from).toBe("safest");
    expect(GRADE.cap).toBe(6);
  });

  it("the grade's arithmetic: round(k × (e − e₀) / e₀), at least `least`, at most `cap`; the safest spot none", () => {
    const g = { k: 3, least: 1, cap: 6, from: "safest" as const };
    // e₀ = 1: a spot 1.5 times as exposed gets round(3 × 0.5) = 2 (1.5 rounds up); twice, 3; four times, 9 → 6.
    expect(gradeBonus([1, 1.5, 2, 4], g)).toEqual([0, 2, 3, 6]);
    // A spot only a little more exposed still gets something (`least`), and a tie with the safest gets nothing.
    expect(gradeBonus([2, 2.05, 2, 3], g)).toEqual([0, 1, 0, 2]);
    expect(gradeBonus([2, 2.05, 2, 3], { ...g, least: 0 })).toEqual([0, 0, 0, 2]);
    // Against the middle spot instead: only the spots above it get a start.
    expect(gradeBonus([1, 2, 3, 4], { ...g, from: "middle" })).toEqual([0, 0, 0, 1]);
    expect(gradeBonus([1, 2, 3, 4, 6], { ...g, from: "middle" })).toEqual([0, 0, 0, 1, 3]);
    // Every spot alike: nobody gets one.
    expect(gradeBonus([2, 2, 2], g)).toEqual([0, 0, 0]);
  });

  it("a version 4 map: the same land as version 3, a head start on every spot but the safest, harder spots as before", () => {
    const v3 = randomMap("120-archipelago-quiet-heron", defaultRules, { version: 3 }).map;
    const v4 = randomMap("120-archipelago-quiet-heron", defaultRules).map;
    expect(v4.generator?.version).toBe(4);
    expect(v4.territories).toEqual(v3.territories);
    expect(v4.borders).toEqual(v3.borders);
    const d = allDistances(v4), adj = adjacency(v4);
    for (const [i, l] of v4.capitalLayouts!.entries()) {
      const was = v3.capitalLayouts![i]!;
      expect(l.slots).toEqual(was.slots);
      expect(l.harder).toEqual(was.harder ?? []);
      const e = exposureOf(l.slots, d, adj).exposure;
      const want = gradeBonus(e, GRADE);
      expect(l.slots.map((s) => l.bonus?.[s] ?? 0)).toEqual(want);
      const safest = l.slots[e.indexOf(Math.min(...e))]!;
      expect(l.bonus?.[safest]).toBeUndefined();
      // Spots more exposed get at least as much.
      const byExposure = l.slots.map((s, k) => ({ x: e[k]!, n: l.bonus?.[s] ?? 0 })).sort((a, b) => a.x - b.x);
      for (let k = 1; k < byExposure.length; k++) expect(byExposure[k]!.n).toBeGreaterThanOrEqual(byExposure[k - 1]!.n);
    }
  }, 120_000);

  it("pinned: a seed at each size builds the same version 4 map, and versions 2 and 3 build the maps they built before session 33", () => {
    const v4 = { "40-island-quiet-heron": "dbb2a3c5f9b5dedf", "80-island-quiet-heron": "97423f72ed759de8", "120-archipelago-quiet-heron": "8de6604e1d8cf378", "200-inland-quiet-heron": "ba40710051311836" };
    for (const [id, fp] of Object.entries(v4)) expect(mapFingerprint(randomMap(id, defaultRules).map), id).toBe(fp);
    // (Taken before any of session 33's changes.)
    const old = { 2: { "40-island-quiet-heron": "6b42b78a243e32b4", "80-twins-jolly-lake": "52e1a507ff979023", "200-inland-quiet-heron": "557b04c14a28d0f1" }, 3: { "40-island-quiet-heron": "69de27e979c27539", "120-archipelago-quiet-heron": "5812f63a1d9fd292" } };
    for (const [v, ids] of Object.entries(old)) for (const [id, fp] of Object.entries(ids)) expect(mapFingerprint(randomMap(id, defaultRules, { version: Number(v) }).map), `${id} at version ${v}`).toBe(fp);
    // The 40's four-player head starts, by hand: k = 8, capped at 6.
    expect(randomMap("40-island-quiet-heron", defaultRules).map.capitalLayouts!.find((l) => l.players === 4)!.bonus).toEqual({ t20: 5, t32: 3 });
  }, 300_000);

  it("in a game: each capital starts with its spot's head start; the seat rule deals only the harder spots to bots first", () => {
    const { map } = randomMap("120-archipelago-quiet-heron", defaultRules);
    const layout = map.capitalLayouts!.find((l) => l.players === 8)!;
    expect(Object.keys(layout.bonus!).length).toBeGreaterThan(layout.harder!.length);
    const players = Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, bot: i > 0 }));
    let headStart = 0;
    for (let s = 0; s < 16; s++) {
      const g = createGame({ map, rules: defaultRules }, { gameId: "g", seed: `v4-${s}`, players, startBonus: true, seatRule: "botsFirst" });
      for (const p of g.players) {
        const extra = layout.bonus![p.capital!] ?? 0;
        expect(g.territories[p.capital!]!.troops).toBe(defaultRules.setup.startTroops + extra);
        expect(p.startBonus ?? 0).toBe(extra);
      }
      const me = g.players.find((p) => p.id === "p1")!;
      expect(layout.harder).not.toContain(me.capital);
      if (me.startBonus) headStart++;
    }
    // A person can sit on a spot with a head start that isn't a harder one (most spots have one).
    expect(headStart).toBeGreaterThan(0);
  }, 120_000);
});

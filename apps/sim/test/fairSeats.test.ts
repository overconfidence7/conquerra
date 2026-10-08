import { maps } from "@conquerra/content/maps";
import { defaultRules } from "@conquerra/content";
import { adjacency, allDistances, exposureOf, fairness, territoryIncome } from "@conquerra/mapgen";
import { describe, expect, it } from "vitest";
import { rankCorrelation, searchFairSeats } from "../src/fairSeats";

/**
 * Session 20b: the fair-seat search. With a stand-in for the games (a spot's "strength" from its exposure plus a fixed
 * wobble), it's deterministic, only ever tries paper-fair layouts of the map's own capital spots, and never ends worse
 * than it started.
 */
describe("the fair-seat search (session 20b)", () => {
  const map = maps.wyrmland!;
  const dists = allDistances(map), adj = adjacency(map), income = territoryIncome(map, defaultRules);
  const players = 6;
  const start = map.capitalLayouts!.find((l) => l.players === players)!.slots;
  const wobble = (t: string) => ([...t].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 97) / 970;
  const measure = async (l: readonly string[]) => {
    const e = exposureOf(l, dists, adj).exposure;
    const raw = l.map((t, i) => 1 / (0.2 + e[i]!) + wobble(t));
    const sum = raw.reduce((a, b) => a + b, 0);
    return raw.map((x) => x / sum);
  };
  const run = () =>
    searchFairSeats({
      start,
      slots: map.capitalSlots,
      measure,
      paperFair: (l) => fairness(l, dists, income).fair,
      dist: (a, b) => dists.get(a)!.get(b) ?? 99,
      exposure: (l, s) => exposureOf(l, dists, adj).exposure[l.indexOf(s)]!,
      budget: 10,
    });

  it("is deterministic, stays on paper-fair layouts of the map's own spots, and never ends worse than it started", async () => {
    const a = await run(), b = await run();
    expect(a.tried.map((m) => m.layout)).toEqual(b.tried.map((m) => m.layout));
    expect(a.best).toEqual(b.best);
    expect(a.tried.length).toBeLessThanOrEqual(10);
    for (const m of a.tried) {
      expect(m.layout).toHaveLength(players);
      expect(m.layout.every((t) => map.capitalSlots.includes(t))).toBe(true);
      expect(new Set(m.layout).size).toBe(players);
    }
    for (const m of a.tried.slice(1)) expect(fairness(m.layout, dists, income).fair).toBe(true);
    expect(a.best.spread).toBeLessThanOrEqual(a.start.spread);
  });

  it("rank correlation: 1 for the same order, -1 for the reverse, ties shared", () => {
    expect(rankCorrelation([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(rankCorrelation([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
    expect(rankCorrelation([1, 1, 2], [5, 5, 9])).toBeCloseTo(1);
  });
});

import { describe, expect, it } from "vitest";
import { defaultRules } from "@conquerra/content";
import { LAYOUT_VERSION, layoutVersions } from "@conquerra/content/bigTables";
import { mapCatalog } from "@conquerra/content";
import { mapFiles, maps } from "@conquerra/content/maps";
import { createGame, layoutFor, stateFingerprint } from "@conquerra/engine";
import { adjacency, allDistances, exposureOf } from "@conquerra/mapgen";

/**
 * Session 35, layout version 3 (Nate's calls, Oct 20): the strong spots (those the simulator says win more than twice
 * their fair share, from session 34b's fresh games and session 35's own) are marked on every table 34b measured, and
 * the seat rule deals them to bots first; and Krakenmere seats 14 (the band above 12 seats is 6.0), on a layout the
 * simulator chose. Nothing else of a layout changes: its spots and head start are version 2's.
 */
const v3 = layoutVersions["3"]!;
const STRONG: Record<string, Record<number, string[]>> = {
  rootholm: { 8: ["t067", "t196"], 10: ["t007", "t150"], 12: ["t043", "t150", "t190"], 16: ["t150", "t196"], 20: ["t190", "t195", "t196"] },
  krakenmere: { 8: ["t188"], 10: ["t188", "t196"], 12: ["t156", "t185", "t188"], 13: ["t120", "t185", "t194"], 14: ["t055", "t156", "t196"] },
};
const seats = (n: number, people: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, ...(i >= people ? { bot: true } : {}) }));
const weakOf = (l: { harder?: string[]; bonus?: Record<string, number> }) => new Set(l.harder ?? Object.keys(l.bonus ?? {}));

describe("layout version 3: the strong spots, and Krakenmere 14 (session 35)", () => {
  it("is the newest version; it marks the strong spots of every table 34b measured, and nothing else of them changes", () => {
    expect(LAYOUT_VERSION).toBe(3);
    for (const [id, byCount] of Object.entries(STRONG))
      for (const [n, strong] of Object.entries(byCount)) {
        const l = layoutFor(maps[id]!, Number(n), 3)!;
        expect([...l.strong!].sort()).toEqual(strong);
        if (Number(n) === 14) continue;
        const { strong: _s, ...rest } = l;
        expect(rest).toEqual(layoutFor(maps[id]!, Number(n), 2));
      }
    // No other map, and no 4-player table anywhere, gains a mark (standard fog's digest stays the same).
    expect(Object.keys(v3).sort()).toEqual(["krakenmere", "rootholm"]);
    for (const e of Object.values(v3)) for (const l of e.layouts) expect(l.players).toBeGreaterThanOrEqual(8);
    expect(mapFiles.krakenmere!.layoutVersions).toBeUndefined();
  });

  it("Krakenmere seats 14: its castle spots, no two capitals side by side, within the band 6.0; the lobby's and the Worker's counts follow", () => {
    const map = maps.krakenmere!;
    expect(map.maxPlayers).toBe(14);
    expect(mapCatalog.find((m) => m.id === "krakenmere")!.maxPlayers).toBe(14);
    const l = layoutFor(map, 14, 3)!;
    const d = allDistances(map), adj = adjacency(map);
    for (const s of l.slots) expect(map.capitalSlots).toContain(s);
    for (const a of l.slots) for (const b of l.slots) if (a !== b) expect(d.get(a)!.get(b)).toBeGreaterThanOrEqual(2);
    const e = exposureOf(l.slots, d, adj).exposure;
    expect(Math.max(...e) / Math.min(...e)).toBeLessThanOrEqual(6);
    // Session 23's bonus, sized on fresh games: the spots that win under half their share.
    expect(l.bonus).toEqual({ t004: 2, t015: 6, t104: 6, t133: 6, t159: 6, t163: 6, t173: 6, t189: 6 });
    // A game made before (version 2) can't seat 14 there: the layout is new with version 3.
    expect(layoutFor(map, 14, 2)).toBeUndefined();
  });

  it("the seat rule at every marked table: a person never sits on a strong or weak spot while a bot holds an unmarked one, and the strong spots go to bots before the weak", () => {
    for (const [id, byCount] of Object.entries(STRONG))
      for (const n of Object.keys(byCount).map(Number)) {
        const l = layoutFor(maps[id]!, n, 3)!;
        const strong = new Set(l.strong), weak = weakOf(l);
        const unmarked = l.slots.filter((s) => !strong.has(s) && !weak.has(s)).length;
        expect(unmarked).toBeGreaterThan(0);
        for (const people of [1, Math.min(unmarked, 10), Math.min(10, n - strong.size)])
          for (const seed of ["a", "b", "c", "d"]) {
            const s = createGame({ map: maps[id]!, rules: defaultRules }, { gameId: "seat", seed: `${seed}-${id}-${n}-${people}`, players: seats(n, people), startBonus: true, seatRule: "botsFirst", layouts: 3 });
            const mine = s.players.filter((p) => Number(p.id.slice(1)) <= people);
            // People on marked spots only once every unmarked spot is a person's.
            const onMarked = mine.filter((p) => strong.has(p.capital) || weak.has(p.capital)).length;
            expect(onMarked).toBe(Math.max(0, people - unmarked));
            // A strong spot is a bot's while there are enough bots for them all.
            if (n - people >= strong.size) expect(mine.filter((p) => strong.has(p.capital))).toHaveLength(0);
          }
      }
  });

  it("with no bots at the table nothing changes: the same deal and the same game as version 2", () => {
    for (const [id, byCount] of Object.entries(STRONG))
      for (const n of Object.keys(byCount).map(Number)) {
        if (n === 14 || n > 10) continue; // (at most 10 people at a table)
        const players = seats(n, n);
        const a = createGame({ map: maps[id]!, rules: defaultRules }, { gameId: "people", seed: `p-${id}-${n}`, players, startBonus: true, seatRule: "botsFirst", layouts: 3 });
        const b = createGame({ map: maps[id]!, rules: defaultRules }, { gameId: "people", seed: `p-${id}-${n}`, players, startBonus: true, seatRule: "botsFirst", layouts: 2 });
        expect(stateFingerprint(a)).toBe(stateFingerprint(b));
      }
  });

  it("a game made before (layout version 2) keeps its deal: a person may still sit on a spot version 3 marks", () => {
    const l = layoutFor(maps.krakenmere!, 10, 2)!;
    const spots = new Set<string>();
    for (let i = 0; i < 40; i++) spots.add(createGame({ map: maps.krakenmere!, rules: defaultRules }, { gameId: "old", seed: `old-${i}`, players: seats(10, 1), startBonus: true, seatRule: "botsFirst", layouts: 2 }).players[0]!.capital);
    expect(spots.has("t188") || spots.has("t196")).toBe(true);
    expect([...spots].every((s) => !Object.keys(l.bonus ?? {}).includes(s))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { defaultRules } from "@conquerra/content";
import { bigTables, LAYOUT_VERSION, layoutVersions } from "@conquerra/content/bigTables";
import { mapFiles, maps } from "@conquerra/content/maps";
import { createGame, layoutFor } from "@conquerra/engine";
import { adjacency, allDistances, exposureOf, fairnessOf, fairnessTable, territoryIncome } from "@conquerra/mapgen";
import { LocalGame } from "../src/host/localGame";

/**
 * Session 34b: the official 200s' capital layouts chosen with the simulator (layout version 2, beside the map files).
 * New games are dealt from version 2; a game made before (its setup has no version) keeps version 1's spots.
 */
const v2 = layoutVersions["2"]!;

describe("layout version 2: the 200s' layouts chosen by the simulator (session 34b)", () => {
  it("sits beside the map files (the files, and every other map, untouched); session 35's version 3 is newer", () => {
    expect(LAYOUT_VERSION).toBe(3);
    expect(Object.keys(v2).every((id) => ["krakenmere", "rootholm"].includes(id))).toBe(true);
    for (const id of Object.keys(maps)) if (!bigTables[id] && !v2[id]) expect(maps[id]).toBe(mapFiles[id]);
    expect(mapFiles.rootholm!.layoutVersions).toBeUndefined();
  });

  it("pinned: each version 2 layout is the map's own capital spots, no two side by side, within the paper check at 10 and under (within the exposure band above), its bonus on its own spots", () => {
    for (const [id, entry] of Object.entries(v2)) {
      const map = mapFiles[id]!;
      const d = allDistances(map), adj = adjacency(map);
      const tbl = fairnessTable(d, territoryIncome(map, defaultRules));
      for (const l of entry.layouts) {
        expect(l.slots).toHaveLength(l.players);
        expect(new Set(l.slots).size).toBe(l.players);
        for (const s of l.slots) expect(map.capitalSlots).toContain(s);
        for (const a of l.slots) for (const b of l.slots) if (a !== b) expect(d.get(a)!.get(b)).toBeGreaterThanOrEqual(2);
        const old = layoutFor(maps[id]!, l.players, 1)!;
        if (l.players <= 10 && [...l.slots].sort().join() !== [...old.slots].sort().join()) expect(fairnessOf(l.slots.map((t) => tbl.ids.indexOf(t)), tbl).fair).toBe(true);
        if (l.players > 10) expect(exposureOf(l.slots, d, adj, 4).fair).toBe(true);
        for (const [s, n] of Object.entries(l.bonus ?? {})) {
          expect(l.slots).toContain(s);
          expect(n).toBeGreaterThanOrEqual(2);
          expect(n).toBeLessThanOrEqual(6);
        }
        // The same spots every time the game loads the map (the pin).
        expect(layoutFor(maps[id]!, l.players, 2)).toEqual(l);
      }
    }
  });

  it("the old layouts still build: a setup with no version (a running game) is dealt version 1's spots and head start", () => {
    for (const [id, entry] of Object.entries(v2))
      for (const l of entry.layouts) {
        const old = layoutFor(maps[id]!, l.players, 1)!;
        const players = Array.from({ length: l.players }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` }));
        const s = createGame({ map: maps[id]!, rules: defaultRules }, { gameId: "old", seed: `old-${id}-${l.players}`, players, startBonus: true });
        expect(s.players.map((p) => p.capital).sort()).toEqual([...old.slots].sort());
      }
  });

  it("a new game is dealt from version 2: its spots, and its bonus on turn 1", () => {
    for (const [id, entry] of Object.entries(v2))
      for (const l of entry.layouts) {
        const players = Array.from({ length: l.players }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` }));
        const s = createGame({ map: maps[id]!, rules: defaultRules }, { gameId: "new", seed: `new-${id}-${l.players}`, players, startBonus: true, layouts: LAYOUT_VERSION });
        expect(s.players.map((p) => p.capital).sort()).toEqual([...l.slots].sort());
        for (const p of s.players) {
          const extra = l.bonus?.[p.capital] ?? 0;
          expect(s.territories[p.capital]!.troops).toBe(defaultRules.setup.startTroops + extra);
          expect(p.startBonus ?? 0).toBe(extra);
          // Version 2's layouts carry the troops alone (session 23's way): no market or culture at the start.
          expect(s.territories[p.capital]!.building).toBeNull();
        }
      }
  });

  it("the seat rule with the new spots: no person on a spot with a bonus while a bot holds one without", () => {
    for (const [id, entry] of Object.entries(v2))
      for (const l of entry.layouts) {
        const harder = new Set(Object.keys(l.bonus ?? {}));
        if (!harder.size || harder.size === l.players) continue;
        const people = Math.min(10, l.players - harder.size);
        for (const seed of ["a", "b", "c"]) {
          const players = Array.from({ length: l.players }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, ...(i >= people ? { bot: true } : {}) }));
          // (Version 2's own deal: session 35's version 3 adds the strong spots, `layouts-v3.test.ts`.)
          const s = createGame({ map: maps[id]!, rules: defaultRules }, { gameId: "seat", seed: `${seed}-${id}-${l.players}`, players, startBonus: true, seatRule: "botsFirst", layouts: 2 });
          expect(s.players.filter((p) => Number(p.id.slice(1)) <= people && harder.has(p.capital))).toHaveLength(0);
        }
      }
  });

  it("the game the lobby makes records the version in its setup (so its history replays on these spots)", () => {
    const map = maps.rootholm!;
    const g = new LocalGame(map, { mapId: "rootholm", bots: 7, botLevel: "captain", luck: 0.3, fog: true, mode: "classic", turnSeconds: 300 }, "seed-v2", () => 0);
    const save = g.snapshot();
    expect(save.history?.setup.layouts).toBe(LAYOUT_VERSION);
    const l = layoutFor(map, 8, LAYOUT_VERSION)!;
    expect(save.state.players.map((p) => p.capital).sort()).toEqual([...l.slots].sort());
  });
});

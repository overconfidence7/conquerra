import { defaultRules, MapDef } from "@conquerra/content";
import { describe, expect, it } from "vitest";
import { createGame, expectBattle, previewAttack, resolveTurn, viewFor } from "../src";
import { board, ctxWith, find, lineGame, lineMap, mv } from "./helpers";

/** The line map a - b - c - d - e, with b and c joined by a sea lane instead of a land border. */
const seaMap: MapDef = MapDef.parse({
  ...lineMap,
  id: "line-sea",
  borders: lineMap.borders.map((b) => (b.a === "b" && b.b === "c" ? { ...b, type: "sea" } : b)),
});

describe("sea lanes", () => {
  it("attacking across a sea lane is weaker (the attack penalty from rules.json)", () => {
    const base = { attackers: 10, attackerSpecialists: [], attackerLeader: false, defenders: 4, defenderSpecialists: [], defenderLeader: false, terrain: "plains" as const, building: null, culture: 0, luck: 0.3 };
    const land = expectBattle(defaultRules, { ...base, border: "normal" });
    const sea = expectBattle(defaultRules, { ...base, border: "sea" });
    expect(defaultRules.borders.sea.attackMult).toBeLessThan(1);
    expect(sea.attackStrength).toBeCloseTo(land.attackStrength * defaultRules.borders.sea.attackMult);
    // Harder than a river crossing or a mountain pass.
    expect(defaultRules.borders.sea.attackMult).toBeLessThan(defaultRules.borders.pass.attackMult);
    expect(defaultRules.borders.sea.attackMult).toBeLessThan(defaultRules.borders.river.attackMult);
  });

  it("the same attack that takes a territory over land fails over a sea lane", () => {
    for (const [map, captured] of [
      [lineMap, true],
      [seaMap, false],
    ] as const) {
      const ctx = ctxWith(undefined, map);
      const s = lineGame(ctx);
      board(s, { a: ["p1", 3], b: ["p1", 6], c: [null, 5], e: ["p2", 8] });
      const { state, events } = resolveTurn(ctx, s, { p1: [mv("b", "c", "all")] });
      expect(find(events, "battle")?.captured).toBe(captured);
      expect(state.territories.c!.owner).toBe(captured ? "p1" : null);
    }
  });

  it("the odds preview counts the sea lane penalty", () => {
    const odds = (map: MapDef) => {
      const ctx = ctxWith(undefined, map);
      const s = lineGame(ctx);
      board(s, { a: ["p1", 3], b: ["p1", 6], c: [null, 5], e: ["p2", 8] });
      return previewAttack(ctx, viewFor(ctx, s, "p1"), { from: "b", to: "c", troops: 5 })!;
    };
    expect(odds(lineMap).captureLikely).toBe(true);
    expect(odds(seaMap).captureLikely).toBe(false);
    expect(odds(seaMap).attackStrength).toBeCloseTo(5 * defaultRules.borders.sea.attackMult);
  });
});

describe("fair capital layouts", () => {
  it("a map's layout for the table size decides where capitals go", () => {
    const map = MapDef.parse({
      ...lineMap,
      maxPlayers: 3,
      recommendedPlayers: { min: 2, max: 3 },
      capitalSlots: ["a", "c", "e"],
      capitalLayouts: [
        { players: 2, slots: ["b", "d"] },
        { players: 3, slots: ["a", "c", "e"] },
      ],
    });
    const ctx = ctxWith(undefined, map);
    for (const seed of ["one", "two", "three"]) {
      const two = createGame(ctx, { gameId: "g", seed, players: [{ id: "p1", name: "1" }, { id: "p2", name: "2" }] });
      expect(two.players.map((p) => p.capital).sort()).toEqual(["b", "d"]);
      const three = createGame(ctx, { gameId: "g", seed, players: [{ id: "p1", name: "1" }, { id: "p2", name: "2" }, { id: "p3", name: "3" }] });
      expect(three.players.map((p) => p.capital).sort()).toEqual(["a", "c", "e"]);
    }
  });

  it("the built-in maps have a fair layout for every player count they allow", async () => {
    const { maps } = await import("@conquerra/content/maps");
    for (const m of [maps.embervale!, maps.greatmarch!])
      for (let n = m.minPlayers; n <= m.maxPlayers; n++) expect(m.capitalLayouts?.find((l) => l.players === n)?.slots.length).toBe(n);
  });
});

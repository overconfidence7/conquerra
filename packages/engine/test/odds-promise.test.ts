import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Terrain, type SpecialistType } from "@conquerra/content";
import { previewAttack, resolveTurn, viewFor } from "../src";
import { board, ctxWith, find, lineGame, lineMap, mv } from "./helpers";

/**
 * The odds preview is a promise: an attack it calls "guaranteed" always captures, and one it calls "impossible"
 * never does, whatever the luck setting and whatever the dice say. (Session 9: a 35-against-1 attack used to fail,
 * because luck was rolled on losses already capped at the defender's army.)
 */
describe("the odds preview keeps its promises", () => {
  // Its own copy of the map, so changing the target's terrain can't leak into other tests.
  const ctx = ctxWith(undefined, JSON.parse(JSON.stringify(lineMap)));
  const battle = (o: { attackers: number; defenders: number; luck: number; terrain: Terrain; fort: boolean; culture: number; atkSpecs: SpecialistType[]; defSpecs: SpecialistType[]; leader: boolean; seed: string }) => {
    ctx.map.territories.find((t) => t.id === "c")!.terrain = o.terrain;
    const s = lineGame(ctx, { luck: o.luck }, o.seed);
    // p1 attacks from b (with Leader if asked) into p2's c.
    board(s, {
      a: ["p1", 1],
      b: ["p1", o.attackers + 1, o.atkSpecs],
      c: ["p2", o.defenders, o.defSpecs, { culture: o.culture, ...(o.fort ? { building: "fort" as const } : {}) }],
      e: ["p2", 1],
    });
    s.players.find((p) => p.id === "p1")!.leader.territory = o.leader ? "b" : "a";
    const preview = previewAttack(ctx, viewFor(ctx, s, "p1"), { from: "b", to: "c", troops: o.attackers, specialists: o.atkSpecs, withLeader: o.leader })!;
    const { events } = resolveTurn(ctx, s, { p1: [mv("b", "c", o.attackers, { withLeader: o.leader })] });
    return { preview, fight: find(events, "battle")! };
  };

  it("guaranteed always captures; impossible never does (any battle, any luck)", () => {
    const specs = fc.subarray(["siege", "healers", "cavalry"] as SpecialistType[], { maxLength: 2 });
    fc.assert(
      fc.property(
        fc.record({
          attackers: fc.integer({ min: 1, max: 60 }),
          defenders: fc.integer({ min: 1, max: 40 }),
          luck: fc.constantFrom(0, 0.1, 0.3, 0.5, 0.75, 1),
          terrain: fc.constantFrom(...Terrain.options),
          fort: fc.boolean(),
          culture: fc.integer({ min: 0, max: 5 }),
          atkSpecs: specs,
          defSpecs: fc.subarray(["healers"] as SpecialistType[]),
          leader: fc.boolean(),
          seed: fc.string({ minLength: 1, maxLength: 6 }),
        }),
        (o) => {
          const { preview, fight } = battle(o);
          if (preview.captureGuaranteed) expect(fight.captured).toBe(true);
          if (preview.captureImpossible) expect(fight.captured).toBe(false);
        },
      ),
      { numRuns: 1500 },
    );
  });

  it("guaranteed always captures and impossible never does at a wall too (session 20b: the preview sees the shared garrison)", () => {
    // c and d are p2's, both walled (culture 5 and a fort); d lends its spare troops when c is attacked.
    const walled = (o: { attackers: number; defenders: number; lender: number; luck: number; atkSpecs: SpecialistType[]; leader: boolean; seed: string }) => {
      ctx.map.territories.find((t) => t.id === "c")!.terrain = "plains";
      const s = lineGame(ctx, { luck: o.luck }, o.seed);
      board(s, {
        a: ["p1", 1],
        b: ["p1", o.attackers + 1, o.atkSpecs],
        c: ["p2", o.defenders, [], { culture: 5, building: "fort" }],
        d: ["p2", o.lender, [], { culture: 5, building: "fort" }],
        e: ["p2", 1],
      });
      s.territories.c!.walled = true;
      s.territories.d!.walled = true;
      s.players.find((p) => p.id === "p1")!.leader.territory = o.leader ? "b" : "a";
      const view = viewFor(ctx, s, "p1");
      const preview = previewAttack(ctx, view, { from: "b", to: "c", troops: o.attackers, specialists: o.atkSpecs, withLeader: o.leader })!;
      const { events } = resolveTurn(ctx, s, { p1: [mv("b", "c", o.attackers, { withLeader: o.leader })] });
      return { preview, fight: find(events, "battle")!, view };
    };
    fc.assert(
      fc.property(
        fc.record({
          attackers: fc.integer({ min: 1, max: 120 }),
          defenders: fc.integer({ min: 1, max: 30 }),
          lender: fc.integer({ min: 1, max: 30 }),
          luck: fc.constantFrom(0, 0.1, 0.3, 0.5, 0.75, 1),
          atkSpecs: fc.subarray(["siege", "healers"] as SpecialistType[], { maxLength: 2 }),
          leader: fc.boolean(),
          seed: fc.string({ minLength: 1, maxLength: 6 }),
        }),
        (o) => {
          const { preview, fight, view } = walled(o);
          // The preview counts the lender (it's in view: p1 sees c, so it sees the whole wall).
          expect(view.walls?.[0]?.defend.c).toBe(o.defenders + o.lender - 1);
          expect(fight.defenders.troops).toBe(o.defenders + o.lender - 1);
          if (preview.captureGuaranteed) expect(fight.captured).toBe(true);
          if (preview.captureImpossible) expect(fight.captured).toBe(false);
        },
      ),
      { numRuns: 1000 },
    );
  });

  // Every lobby setting (None, Low, Normal, High) and more. At 100% luck a side's losses can roll all the way down
  // to 0, so the preview says "likely" there, not "guaranteed" (the property test above still covers it).
  it("35 against 1 always wins, at every luck level", () => {
    for (const luck of [0, 0.15, 0.3, 0.5, 0.75])
      for (let i = 0; i < 200; i++) {
        const { preview, fight } = battle({ attackers: 35, defenders: 1, luck, terrain: "plains", fort: false, culture: 0, atkSpecs: [], defSpecs: [], leader: false, seed: `l${luck}-${i}` });
        expect(preview.captureGuaranteed).toBe(true);
        expect(fight.captured).toBe(true);
      }
  });

  it("the defenders' losses are still capped at their army, and the attackers' at theirs", () => {
    for (let i = 0; i < 100; i++) {
      const { fight } = battle({ attackers: 30, defenders: 2, luck: 1, terrain: "plains", fort: false, culture: 0, atkSpecs: [], defSpecs: [], leader: false, seed: `cap${i}` });
      expect(fight.result.defenderLosses).toBeLessThanOrEqual(2);
      expect(fight.result.attackerLosses).toBeLessThanOrEqual(30);
    }
  });
});

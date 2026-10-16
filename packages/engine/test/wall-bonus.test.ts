import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { defaultRules, type Rules, type SpecialistType } from "@conquerra/content";
import { MapDef } from "@conquerra/content/schemas";
import { createGame, expectBattle, previewAttack, resolveTurn, viewFor, wallDefense, type GameContext, type GameState, type StepEvent } from "../src";
import { mv } from "./helpers";

/**
 * Walls that pay back (session 25, Nate's call): a walled territory defends at
 * × (1 + min(stackMax, stackPerTerritory × (wall size − 1))), the wall size being every walled territory of that House
 * connected to it. On top of the fort and culture 5, and the shared defenders.
 *
 * A chain of ten: p1 holds t0 and attacks t1; p2 walls t1..tN (N up to 8) and holds t9, its capital.
 *   t0 - t1 - t2 - ... - t9
 */
const chain = MapDef.parse({
  id: "wall-chain",
  name: "Wall chain",
  minPlayers: 2,
  maxPlayers: 2,
  recommendedPlayers: { min: 2, max: 2 },
  territories: Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, name: `T${i}`, province: `p${i}`, terrain: "plains", x: i * 100, y: 0 })),
  provinces: Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `Province ${i}`, bonus: 1 })),
  borders: Array.from({ length: 9 }, (_, i) => ({ a: `t${i}`, b: `t${i + 1}` })),
  capitalSlots: ["t0", "t9"],
});

type Walls = NonNullable<Rules["walls"]>;
const rulesWith = (w: Partial<Walls>): Rules => ({ ...defaultRules, walls: { ...defaultRules.walls!, ...w } });
const CAPPED = { stackPerTerritory: 0.1, stackMax: 0.4 };
const UNCAPPED = { stackPerTerritory: 0.1, stackMax: null };
const ctxOf = (w: Partial<Walls>): GameContext => ({ map: chain, rules: rulesWith(w) });

/** p1 has `attackers` + 1 at t0 (and a siege engine if asked); p2 walls t1..t`size`, `own` troops at t1 and `lender` in each of the rest. */
function game(c: GameContext, o: { attackers: number; size: number; own: number; lender: number; luck?: number; siege?: boolean; seed?: string }): GameState {
  const s = createGame(c, { gameId: "wb", seed: o.seed ?? "wb", players: [{ id: "p1", name: "One" }, { id: "p2", name: "Two" }], settings: { luck: o.luck ?? 0, fate: false, spies: false, diplomacy: false } });
  for (let i = 0; i < 10; i++) {
    const walled = i >= 1 && i <= o.size;
    s.territories[`t${i}`] = {
      owner: i === 0 ? "p1" : walled || i === 9 ? "p2" : null,
      troops: i === 0 ? o.attackers + 1 : i === 1 ? o.own : walled ? o.lender : 1,
      specialists: i === 0 && o.siege ? [{ id: "sg1", type: "siege" }] : [],
      building: walled ? "fort" : null,
      construction: null,
      culture: walled ? 5 : 0,
      ...(walled ? { walled: true } : {}),
    };
  }
  for (const p of s.players) {
    p.capital = p.id === "p1" ? "t0" : "t9";
    p.leader = { alive: true, territory: p.capital };
  }
  s.intel = { p1: {}, p2: {} };
  return s;
}

const battleOf = (ev: StepEvent[]) => ev.find((e): e is Extract<StepEvent, { type: "battle" }> => e.type === "battle")!;
const attack = (c: GameContext, s: GameState, troops: number) => {
  const preview = previewAttack(c, viewFor(c, s, "p1"), { from: "t0", to: "t1", troops })!;
  const { events } = resolveTurn(c, s, { p1: [mv("t0", "t1", troops)] });
  return { preview, fight: battleOf(events) };
};
/** The same battle with no wall bonus at all (the fort, culture 5 and the shared defenders only). */
const plainBattle = (c: GameContext, defenders: number, attackerSpecialists: SpecialistType[] = []) =>
  expectBattle(c.rules, { attackers: 30, attackerSpecialists, attackerLeader: false, defenders, defenderSpecialists: [], defenderLeader: false, terrain: "plains", building: "fort", culture: 5, border: "normal", luck: 0 });

describe("walls that pay back: the stacking bonus (session 25)", () => {
  it("the multiplier for walls of 1, 2, 3, 5 and 8, capped at +40% and uncapped", () => {
    const capped = rulesWith(CAPPED), uncapped = rulesWith(UNCAPPED);
    const sizes = [1, 2, 3, 5, 8];
    [1, 1.1, 1.2, 1.4, 1.4].forEach((m, i) => expect(wallDefense(capped, sizes[i]!)).toBeCloseTo(m, 10));
    [1, 1.1, 1.2, 1.4, 1.7].forEach((m, i) => expect(wallDefense(uncapped, sizes[i]!)).toBeCloseTo(m, 10));
    // Not walled (0), or walls off: nothing.
    expect(wallDefense(capped, 0)).toBe(1);
    expect(wallDefense(rulesWith({ ...CAPPED, on: false }), 5)).toBe(1);
    // Whatever rules.json ships, one territory alone never gets a bonus.
    expect(wallDefense(defaultRules, 1)).toBe(1);
    // What rules.json ships since session 26 (Nate, Oct 12): no cap, so a wall of 8 gets +70%.
    expect(defaultRules.walls!.stackMax).toBeNull();
    expect(wallDefense(defaultRules, 8)).toBeCloseTo(1.7, 10);
  });

  it("an older game's rules (no stacking numbers) give no bonus, so its history replays as it was played", () => {
    const old = JSON.parse(JSON.stringify(defaultRules)) as Rules;
    delete old.walls!.stackPerTerritory;
    delete old.walls!.stackMax;
    for (const n of [1, 2, 3, 5, 8]) expect(wallDefense(old, n)).toBe(1);
    // A rate with no cap given: the cap is 0 (missing means off), not "no cap".
    const half = JSON.parse(JSON.stringify(old)) as Rules;
    half.walls!.stackPerTerritory = 0.1;
    expect(wallDefense(half, 5)).toBe(1);
    // And a battle at a wall plays exactly as with the bonus at 0.
    const c0: GameContext = { map: chain, rules: old };
    const cz = ctxOf({ stackPerTerritory: 0, stackMax: 0.4 });
    const a = attack(c0, game(c0, { attackers: 20, size: 4, own: 3, lender: 3 }), 20).fight;
    const b = attack(cz, game(cz, { attackers: 20, size: 4, own: 3, lender: 3 }), 20).fight;
    expect({ ...a, orderId: "" }).toEqual({ ...b, orderId: "" });
  });

  it("the engine counts it, and the odds preview counts exactly what the engine counts", () => {
    for (const w of [CAPPED, UNCAPPED])
      for (const size of [1, 2, 3, 5, 8]) {
        const c = ctxOf(w);
        const { preview, fight } = attack(c, game(c, { attackers: 30, size, own: 4, lender: 2 }), 30);
        expect(fight.defenders.troops).toBe(4 + (size - 1));
        expect(fight.result.defenseStrength).toBeCloseTo(plainBattle(c, 4 + (size - 1)).defenseStrength * wallDefense(c.rules, size), 2);
        expect(Math.abs(preview.defenseStrength - fight.result.defenseStrength)).toBeLessThanOrEqual(0.006); // the event keeps 2 decimals
      }
  });

  it("the whole wall counts, whatever the lending reach (the same connectivity as the lending)", () => {
    const c = ctxOf({ ...CAPPED, reach: 1 });
    const { preview, fight } = attack(c, game(c, { attackers: 30, size: 5, own: 4, lender: 3 }), 30);
    // Only t2 lends at reach 1 (its 2 spare troops), but all five count for the bonus.
    expect(fight.defenders.troops).toBe(4 + 2);
    expect(fight.result.defenseStrength).toBeCloseTo(plainBattle(c, 6).defenseStrength * 1.4, 2);
    expect(Math.abs(preview.defenseStrength - fight.result.defenseStrength)).toBeLessThanOrEqual(0.006); // the event keeps 2 decimals
  });

  it("Siege cuts the fort's bonus only: the wall's bonus stands", () => {
    const c = ctxOf(CAPPED);
    const s = game(c, { attackers: 30, size: 3, own: 4, lender: 2, siege: true });
    const { events } = resolveTurn(c, s, { p1: [mv("t0", "t1", 30, { specialists: ["siege"] })] });
    const fight = battleOf(events);
    const sieged = plainBattle(c, 6, ["siege"]);
    expect(fight.defense.fort).toBe(sieged.fortCounted);
    expect(fight.result.defenseStrength).toBeCloseTo(sieged.defenseStrength * 1.2, 2);
  });

  it("losses fall as before: the defenders lose what they would have (the attacked land first, then the lenders); only the attackers lose more", () => {
    const off = ctxOf({ stackPerTerritory: 0, stackMax: 0 }), on = ctxOf(CAPPED);
    const o = { attackers: 40, size: 5, own: 3, lender: 4 };
    const a = attack(off, game(off, o), 40).fight, b = attack(on, game(on, o), 40).fight;
    expect(b.result.defenderLosses).toBe(a.result.defenderLosses);
    expect(b.wall?.lent).toEqual(a.wall?.lent);
    expect(b.result.attackerLosses).toBeGreaterThan(a.result.attackerLosses);
  });

  it("guaranteed always captures and impossible never does at walls of every size (capped and uncapped, any luck, Siege or not)", () => {
    fc.assert(
      fc.property(
        fc.record({
          attackers: fc.integer({ min: 1, max: 150 }),
          size: fc.integer({ min: 1, max: 8 }),
          own: fc.integer({ min: 1, max: 25 }),
          lender: fc.integer({ min: 1, max: 12 }),
          luck: fc.constantFrom(0, 0.1, 0.3, 0.5, 0.75, 1),
          siege: fc.boolean(),
          w: fc.constantFrom<Partial<Walls>>(CAPPED, UNCAPPED, { stackPerTerritory: 0.05, stackMax: 0.2 }, { stackPerTerritory: 0.15, stackMax: 0.6 }),
          seed: fc.string({ minLength: 1, maxLength: 6 }),
        }),
        (o) => {
          const c = ctxOf(o.w);
          const s = game(c, o);
          const specialists: SpecialistType[] = o.siege ? ["siege"] : [];
          const preview = previewAttack(c, viewFor(c, s, "p1"), { from: "t0", to: "t1", troops: o.attackers, specialists })!;
          const { events } = resolveTurn(c, s, { p1: [mv("t0", "t1", o.attackers, o.siege ? { specialists: ["siege"] } : {})] });
          const fight = battleOf(events);
          expect(Math.abs(preview.defenseStrength - fight.result.defenseStrength)).toBeLessThanOrEqual(0.006); // the event keeps 2 decimals
          if (preview.captureGuaranteed) expect(fight.captured).toBe(true);
          if (preview.captureImpossible) expect(fight.captured).toBe(false);
        },
      ),
      { numRuns: 800 },
    );
  }, 60_000);
});
